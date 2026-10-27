"""The Pilot dashboard: four stages of the paid pilot, read-only.

    Reach -> Free engine -> Money -> Action

Routes are in routes/funnel.py (GET /api/funnel/pilot-report and
/pilot-export.csv, both admin only). This module only READS: events,
quiz_progress, users and payments. It never writes anything.

Rules that shape every number here:

* Money comes from the `payments` collection, never from events. Anyone can
  post to /api/funnel/events, so an event can only ever be a cross-check.
* In fake-door mode nobody pays: a "Pay" tap is stored as a payments row with
  status "fake_door". Those are counted as INTENT ("tapped Pay, no money
  taken"), next to real paid rows (status "paid", mode live). Razorpay TEST
  payments are left out unless include_test is on.
* Internal traffic is left out unless include_test is on: admins, the numbers
  in INTERNAL_TEST_MOBILES, and visits tagged ?utm_source=test.
* Funnel steps count distinct SESSIONS (as the Funnel tab does). Money and
  breeder stages also count distinct signed-in PEOPLE (user_id), because one
  person can have two sessions. Every block says which.
* Mobile numbers are unverified (there is no OTP). Nothing here treats a number
  as proof of who someone is, and none is ever returned except the last 4
  digits in the CSV.

One aggregation over the events in the window does the heavy lifting (distinct
session x event, with first time and labels); the joins to users, progress and
payments are then done in Python on those few thousand rows.
"""
import time
from collections import defaultdict
from datetime import timedelta, timezone
from typing import Optional

from app.config.settings import settings
from app.services.funnel_service import EVENTS, PROGRESS, _aware, _health, _parse, utc_now

USERS = "users"
PAYMENTS = "payments"
IST = timezone(timedelta(hours=5, minutes=30))   # days are Indian days

#: Below these a percentage lies more than it tells: show "too few" instead.
MIN_VISITS = 30
MIN_PAYWALL_VIEWS = 5

#: Two sources may drift by a couple (a closed tab, a retry); more is a bug.
MISMATCH_TOLERANCE = 2

STAGE_EVENTS = {
    "reach": ("site_visit",),
    "entry": ("find_dog_clicked", "contact_form_viewed", "contact_form_started", "login_started",
              "contact_form_error", "contact_form_closed"),
    "free": ("login_completed", "otp_verified", "quiz_started", "free_part_completed", "rough_rec_viewed"),
    "money": ("paywall_viewed", "paywall_cta_clicked", "payment_started", "payment_dismissed",
              "payment_failed", "payment_success", "unlock_continued"),
    "action": ("quiz_completed", "results_viewed", "breeder_cta_clicked", "breeder_call_clicked",
               "breeder_whatsapp_opened", "contact_submitted"),
}
ALL_STAGE_EVENTS = tuple(e for names in STAGE_EVENTS.values() for e in names)
BREEDER_TAPS = ("breeder_call_clicked", "breeder_whatsapp_opened")
BREAKDOWN_KEYS = ("campaign", "content", "channel", "device", "city", "age_range", "top_breed")
NOT_GIVEN = "Not given"
NONE_LABEL = "(none)"


# ------------------------------------------------------------------ helpers

def pct(num, den) -> Optional[float]:
    """One decimal, or None when there is nothing to divide by (the UI shows a dash)."""
    return round(num / den * 100, 1) if den else None


def ratio(num: int, den: int) -> dict:
    """A number with its denominator, so the page can say "12 of 80 (15.0%)"."""
    return {"count": num, "of": den, "pct": pct(num, den)}


def _window(start: Optional[str], end: Optional[str], days: Optional[int]) -> tuple:
    """(clause, start_dt, end_dt). Default: the pilot window from settings."""
    if days and not (start or end):
        end_dt = utc_now()
        start_dt = end_dt - timedelta(days=days)
        return {"$gte": start_dt}, start_dt, end_dt
    start = start or settings.PILOT_START
    end = end or settings.PILOT_END
    start_dt = _parse(start)
    end_dt = _parse(end) + timedelta(days=1)          # the end date is inclusive
    return {"$gte": start_dt, "$lt": end_dt}, start_dt, end_dt


def _in(clause: dict, when) -> bool:
    when = _aware(when)
    if when is None:
        return False
    return all((op != "$gte" or when >= v) and (op != "$lt" or when < v) for op, v in clause.items())


def _ist_day(when) -> Optional[str]:
    when = _aware(when)
    return when.astimezone(IST).date().isoformat() if when else None


def _mobile10(raw) -> str:
    digits = "".join(ch for ch in str(raw or "") if ch.isdigit())
    if len(digits) == 12 and digits.startswith("91"):
        return digits[2:]
    if len(digits) == 11 and digits.startswith("0"):
        return digits[1:]
    return digits


def _label(value) -> str:
    value = (str(value).strip() if value is not None else "")
    return value or NONE_LABEL


# ------------------------------------------------------------------ loading

async def _session_events(db, clause: dict) -> dict:
    """Every session in the window, with each event's first time and its labels.

    The one heavy query: events grouped to one row per (session, event)."""
    pipeline = [
        {"$match": {"created_at": clause}},
        {"$group": {
            "_id": {"s": "$session_id", "e": "$event_name"},
            "first": {"$min": "$created_at"},
            "user": {"$max": "$user_id"},
            "channel": {"$first": "$props.channel"},
            "campaign": {"$first": "$props.campaign"},
            "content": {"$first": "$props.content"},
            "device": {"$first": "$props.device"},
        }},
    ]
    sessions = {}
    async for row in db[EVENTS].aggregate(pipeline):
        sid = row["_id"].get("s")
        if not sid:
            continue                     # server events written without a session
        s = sessions.setdefault(sid, {"events": {}, "user": None, "labels": {}})
        s["events"][row["_id"].get("e")] = _aware(row.get("first"))
        if row.get("user"):
            s["user"] = row["user"]
        for key in ("channel", "campaign", "content", "device"):
            if row.get(key) and not s["labels"].get(key):
                s["labels"][key] = row[key]
    return sessions


async def _find_dog_rows(db, clause: dict) -> list:
    """Which button started the quiz, and whether the browser already had an account."""
    pipeline = [
        {"$match": {"created_at": clause, "event_name": "find_dog_clicked"}},
        {"$group": {"_id": {"s": "$session_id", "src": "$props.source", "acct": "$props.has_account"},
                    "first": {"$min": "$created_at"}}},
    ]
    return [{**row["_id"], "first": _aware(row.get("first"))} async for row in db[EVENTS].aggregate(pipeline)]


async def _question_rows(db, clause: dict) -> list:
    pipeline = [
        {"$match": {"created_at": clause, "event_name": {"$in": ["question_viewed", "question_answered"]}}},
        {"$group": {"_id": {"s": "$session_id", "e": "$event_name", "q": "$props.q_index", "id": "$props.q_id"}}},
    ]
    return [row["_id"] async for row in db[EVENTS].aggregate(pipeline)]


async def _breeder_rows(db, clause: dict) -> list:
    pipeline = [
        {"$match": {"created_at": clause, "event_name": {"$in": list(BREEDER_TAPS)}}},
        {"$group": {"_id": {"s": "$session_id", "e": "$event_name", "b": "$props.breeder_id",
                            "name": "$props.breeder_name", "breed": "$props.breed", "src": "$props.source"}}},
    ]
    return [row["_id"] async for row in db[EVENTS].aggregate(pipeline)]


async def _by_ids(db, collection: str, field: str, ids) -> list:
    ids = [i for i in ids if i]
    return await db[collection].find({field: {"$in": ids}}).to_list(None) if ids else []


# ------------------------------------------------------------------ the report

async def build_pilot_report(db, start: Optional[str] = None, end: Optional[str] = None,
                             include_test: bool = False, days: Optional[int] = None) -> dict:
    began = time.perf_counter()
    clause, start_dt, end_dt = _window(start, end, days)

    sessions = await _session_events(db, clause)
    progress = {p["session_id"]: p for p in await _by_ids(db, PROGRESS, "session_id", sessions)}
    for sid, s in sessions.items():
        p = progress.get(sid) or {}
        s["user"] = s["user"] or p.get("user_id")
        attr = p.get("attribution") or {}
        # Events from before campaign/content were added carry only channel and
        # device; the session's saved first touch fills the gap.
        s["labels"].setdefault("campaign", attr.get("utm_campaign"))
        s["labels"].setdefault("content", attr.get("utm_content"))
        s["labels"].setdefault("channel", attr.get("channel"))
        s["labels"].setdefault("device", attr.get("device"))
        s["labels"]["city"] = p.get("city")
        s["labels"]["top_breed"] = p.get("top_breed")

    payments = await db[PAYMENTS].find({"created_at": clause}).to_list(None)
    signups = await db[USERS].find({"created_at": clause, "source": "contact_form"}).to_list(None)
    user_ids = {s["user"] for s in sessions.values()} | {p.get("user_id") for p in payments} | {u["id"] for u in signups}
    users = {u["id"]: u for u in await _by_ids(db, USERS, "id", user_ids)}

    # ---- who is internal
    internal_mobiles = settings.internal_test_mobiles
    def internal_user(uid) -> bool:
        u = users.get(uid) or {}
        return u.get("role") == "ADMIN" or (_mobile10(u.get("mobile")) in internal_mobiles if u.get("mobile") else False)
    internal_sessions = {sid for sid, s in sessions.items()
                         if (s["user"] and internal_user(s["user"])) or str(s["labels"].get("channel") or "") == "test"}
    excluded = 0 if include_test else len(internal_sessions)
    if not include_test:
        sessions = {sid: s for sid, s in sessions.items() if sid not in internal_sessions}

    for s in sessions.values():
        u = users.get(s["user"]) or {}
        s["labels"]["age_range"] = u.get("age_range") or NOT_GIVEN

    # ---- money, from the database
    def counts_as_paid(p) -> bool:
        if p.get("status") != "paid":
            return False
        return p.get("mode") == "live" or (include_test and p.get("mode") == "test")
    keep_payment = (lambda p: True) if include_test else (lambda p: not internal_user(p.get("user_id")))
    paid_rows = [p for p in payments if counts_as_paid(p) and keep_payment(p)]
    intent_rows = [p for p in payments if p.get("status") == "fake_door" and keep_payment(p)]
    refund_rows = [p for p in payments if p.get("status") == "refunded" and keep_payment(p)]
    paid_users = {p["user_id"] for p in paid_rows if p.get("user_id")}
    intent_users = {p["user_id"] for p in intent_rows if p.get("user_id")} - paid_users
    payers = paid_users | intent_users
    pay_time = {}
    for p in paid_rows + intent_rows:
        when = _aware(p.get("paid_at")) or _aware(p.get("created_at"))
        uid = p.get("user_id")
        if uid and when and (uid not in pay_time or when < pay_time[uid]):
            pay_time[uid] = when

    def has(s, name) -> bool:
        return name in s["events"]

    def sessions_with(name, pool=None) -> int:
        return sum(1 for s in (pool if pool is not None else sessions.values()) if has(s, name))

    def users_with(name, uids) -> int:
        return len({s["user"] for s in sessions.values() if s["user"] in uids and has(s, name)})

    # ---- Stage 1: Reach
    visits = sessions_with("site_visit")
    bounced = sum(1 for s in sessions.values() if set(s["events"]) == {"site_visit"})

    # ---- Stage 2: Free engine
    signed_in = [u for u in signups if include_test or not internal_user(u["id"])]
    unique_numbers = len({_mobile10(u.get("mobile")) for u in signed_in if u.get("mobile")})
    free = {name: sessions_with(name) for name in STAGE_EVENTS["free"]}

    # ---- Stage 3: Money
    money = {name: sessions_with(name) for name in STAGE_EVENTS["money"]}
    view_time = {}
    for s in sessions.values():
        if s["user"] and has(s, "paywall_viewed"):
            t = s["events"]["paywall_viewed"]
            if s["user"] not in view_time or t < view_time[s["user"]]:
                view_time[s["user"]] = t
    waits = [(pay_time[u] - view_time[u]).total_seconds() / 60 for u in payers
             if u in view_time and u in pay_time and pay_time[u] >= view_time[u]]
    success_event_users = {s["user"] for s in sessions.values() if s["user"] and has(s, "payment_success")}
    db_paid_any_mode = {p["user_id"] for p in payments if p.get("status") == "paid" and p.get("user_id")}
    mismatch = abs(len(success_event_users) - len(db_paid_any_mode)) > MISMATCH_TOLERANCE

    # ---- Stage 4: Action (people, paid vs not)
    seen_users = {s["user"] for s in sessions.values() if s["user"]}
    # "Unlocked" = paid OR tapped Pay in fake-door mode (never called "paid": in
    # fake-door nobody pays). With the paywall off, everyone has the full results.
    unlocked_users = payers | (seen_users if settings.PAYWALL_MODE == "off" else set())
    not_unlocked_users = seen_users - unlocked_users
    def action_block(uids):
        return {name: ratio(users_with(name, uids), len(uids)) for name in STAGE_EVENTS["action"]}

    # ---- breakdowns
    def breakdown(key_fn) -> list:
        rows = defaultdict(lambda: {"visits": 0, "tapped_find_dog": 0, "quiz_started": 0, "rough_rec_viewed": 0,
                                    "form_submitted": 0, "paywall_viewed": 0, "breeder_taps": 0, "_payers": set()})
        for s in sessions.values():
            r = rows[key_fn(s)]
            r["visits"] += has(s, "site_visit")
            r["tapped_find_dog"] += has(s, "find_dog_clicked")
            r["quiz_started"] += has(s, "quiz_started")
            r["rough_rec_viewed"] += has(s, "rough_rec_viewed")
            r["form_submitted"] += has(s, "login_started")
            r["paywall_viewed"] += has(s, "paywall_viewed")
            r["breeder_taps"] += any(has(s, t) for t in BREEDER_TAPS)
            if s["user"] in payers:
                r["_payers"].add(s["user"])
        out = []
        for key, r in rows.items():
            paid = len(r.pop("_payers"))
            too_few = r["visits"] < MIN_VISITS or r["paywall_viewed"] < MIN_PAYWALL_VIEWS
            out.append({"key": key, **r, "paid": paid, "too_few": too_few,
                        "paid_pct": None if too_few else pct(paid, r["paywall_viewed"])})
        out.sort(key=lambda r: (-r["visits"], -r["paid"], str(r["key"])))
        return out

    breakdowns = {k: breakdown(lambda s, k=k: _label(s["labels"].get(k))) for k in BREAKDOWN_KEYS}
    reels = breakdown(lambda s: f'{_label(s["labels"].get("campaign"))} / {_label(s["labels"].get("content"))}')

    # ---- anonymous entry funnel, in the order a newcomer meets it:
    #   visit -> Find my dog -> quiz -> "About you" done -> rough match -> Unlock
    #   -> contact form -> account -> paywall
    # Only sessions that tapped WITHOUT an account already: a returning browser
    # skips the form and must not count as a form drop-out.
    first_tap = {}
    had_account = set()
    for row in await _find_dog_rows(db, clause):
        sid = row.get("s")
        if sid not in sessions:
            continue
        if row.get("acct") is True:
            had_account.add(sid)
        if sid not in first_tap or (row["first"] and row["first"] < first_tap[sid][0]):
            first_tap[sid] = (row["first"], row.get("src") or NONE_LABEL)
    # Until late October 2026 the contact form came BEFORE question 1. Those
    # sessions saw the form first (or never reached the quiz), so they cannot be
    # read in the new order: they are counted apart and left out of the steps.
    def old_order(s) -> bool:
        form, quiz = s["events"].get("contact_form_viewed"), s["events"].get("quiz_started")
        return form is not None and (quiz is None or form <= quiz)
    tapped_new = [sid for sid in first_tap if sid not in had_account]
    old_flow = [sid for sid in tapped_new if old_order(sessions[sid])]
    newcomers = [sid for sid in tapped_new if not old_order(sessions[sid])]
    ENTRY_STEPS = (("tapped", "find_dog_clicked"), ("quiz_started", "quiz_started"),
                   ("free_done", "free_part_completed"), ("rough_viewed", "rough_rec_viewed"),
                   ("unlock_tapped", "paywall_cta_clicked"), ("form_viewed", "contact_form_viewed"),
                   ("form_started", "contact_form_started"), ("submitted", "login_started"),
                   ("account_created", "login_completed"), ("paywall_viewed", "paywall_viewed"))

    def entry_counts(sids) -> dict:
        return {step: sum(1 for sid in sids if has(sessions[sid], name)) for step, name in ENTRY_STEPS}

    def entry_steps(sids, visits_n) -> list:
        counts = entry_counts(sids)
        out, prev = [{"step": "visits", "event": "site_visit", "count": visits_n, "of_previous": None,
                      "of_visits": pct(visits_n, visits_n)}], visits_n
        for step, name in ENTRY_STEPS:
            out.append({"step": step, "event": name, "count": counts[step],
                        "of_previous": pct(counts[step], prev), "of_visits": pct(counts[step], visits_n)})
            prev = counts[step]
        return out

    new_counts = entry_counts(newcomers)
    left = sum(1 for sid in newcomers if has(sessions[sid], "contact_form_viewed") and not has(sessions[sid], "login_completed"))
    finished = sum(1 for sid in newcomers if has(sessions[sid], "login_completed") and has(sessions[sid], "paywall_viewed"))

    def entry_split(key_fn) -> list:
        groups = defaultdict(list)
        for sid in newcomers:
            groups[key_fn(sid)].append(sid)
        out = []
        for key, sids in groups.items():
            c = entry_counts(sids)
            too_few = len(sids) < MIN_VISITS
            out.append({"key": key, **c, "too_few": too_few,
                        "created_pct": None if too_few else pct(c["account_created"], c["form_viewed"])})
        out.sort(key=lambda r: (-r["tapped"], str(r["key"])))
        return out

    entry = {
        # The visits row counts every session; the steps after it only sessions
        # that tapped Find my dog with no account yet, in the current order.
        "steps": entry_steps(newcomers, visits),
        "tapped_with_account": len(had_account),
        "old_flow_sessions": len(old_flow),
        "left_form_unfinished": ratio(left, new_counts["form_viewed"]),
        "finished_and_saw_paywall": ratio(finished, new_counts["form_viewed"]),
        "by_source": entry_split(lambda sid: first_tap[sid][1]),
        "by_device": entry_split(lambda sid: _label(sessions[sid]["labels"].get("device"))),
    }

    # ---- daily series (Indian days)
    day = {}
    first = start_dt.astimezone(IST).date()
    last = (min(end_dt, utc_now()) - timedelta(microseconds=1)).astimezone(IST).date()
    d = first
    while d <= last and len(day) < 400:
        day[d.isoformat()] = {"date": d.isoformat(), "visits": 0, "quiz_started": 0, "paywall_viewed": 0, "paid": 0}
        d += timedelta(days=1)
    for s in sessions.values():
        for name, col in (("site_visit", "visits"), ("quiz_started", "quiz_started"), ("paywall_viewed", "paywall_viewed")):
            k = _ist_day(s["events"].get(name))
            if k in day:
                day[k][col] += 1
    for uid in payers:
        k = _ist_day(pay_time.get(uid))
        if k in day:
            day[k]["paid"] += 1

    # ---- breeders
    # Keyed on breeder_id ONLY, so one breeder with a call tap and a WhatsApp tap
    # is one row. The name comes from any event that carries it (old call events
    # had none and still merge into the right row); the page fills a missing name
    # and the city from the breeder list the app ships (constants/breeders.json).
    by_breeder = defaultdict(lambda: {"name": "", "breeds": set(), "call": set(), "whatsapp": set()})
    taps = defaultdict(lambda: {"call": set(), "whatsapp": set()})          # by breed, by source
    pair = defaultdict(set)                                                 # (breed, breeder_id) -> sessions
    for row in await _breeder_rows(db, clause):
        sid = row.get("s")
        if sid not in sessions:
            continue
        kind = "call" if row.get("e") == "breeder_call_clicked" else "whatsapp"
        bid = row.get("b") or NONE_LABEL
        b = by_breeder[bid]
        b["name"] = b["name"] or (row.get("name") or "")
        if row.get("breed"):
            b["breeds"].add(row["breed"])
        b[kind].add(sid)
        taps[("breed", row.get("breed") or NONE_LABEL)][kind].add(sid)
        taps[("source", row.get("src") or NONE_LABEL)][kind].add(sid)
        pair[(row.get("breed") or NONE_LABEL, bid)].add(sid)

    def split(sids) -> dict:
        """Sessions, and how many of them belong to someone who unlocked (paid or tapped Pay)."""
        unlocked = sum(1 for sid in sids if sessions[sid]["user"] in payers)
        return {"total": len(sids), "unlocked": unlocked, "not_unlocked": len(sids) - unlocked}

    breeder_rows = [{
        "key": bid, "name": b["name"], "breeds": sorted(b["breeds"]),
        "call": split(b["call"]), "whatsapp": split(b["whatsapp"]),
        # A session that tapped both buttons is still one session here.
        "total": split(b["call"] | b["whatsapp"]),
    } for bid, b in by_breeder.items()]
    breeder_rows.sort(key=lambda r: (-r["total"]["total"], r["key"]))

    def tap_table(group) -> list:
        out = []
        for (g, key), t in taps.items():
            if g != group:
                continue
            row = {"key": key, "call": split(t["call"]), "whatsapp": split(t["whatsapp"]),
                   "total": split(t["call"] | t["whatsapp"])}
            if group == "breed":
                # Most-tapped breeder for this breed (sessions, both buttons together).
                best = max(((bid, len(s)) for (br, bid), s in pair.items() if br == key), key=lambda x: (x[1], x[0]))
                row["top_breeder"] = {"key": best[0], "name": by_breeder[best[0]]["name"], "sessions": best[1]}
            out.append(row)
        out.sort(key=lambda r: (-r["total"]["total"], str(r["key"])))
        return out[:10]

    # ---- drop-off by question (free screens are the first ones; the page marks the paywall)
    q = defaultdict(lambda: {"viewed": set(), "answered": set(), "q_id": None})
    for row in await _question_rows(db, clause):
        if row.get("s") not in sessions or row.get("q") is None:
            continue
        r = q[int(row["q"])]
        r["q_id"] = r["q_id"] or row.get("id")
        r["viewed" if row.get("e") == "question_viewed" else "answered"].add(row["s"])
    dropoff = [{"q_index": i, "q_id": r["q_id"], "viewed": len(r["viewed"]), "answered": len(r["answered"]),
                "dropped": max(len(r["viewed"]) - len(r["answered"]), 0),
                "drop_rate": pct(max(len(r["viewed"]) - len(r["answered"]), 0), len(r["viewed"]))}
               for i, r in sorted(q.items())]

    # ---- health
    health = await _health(db)
    since = utc_now() - timedelta(hours=24)
    last24 = [{"event": row["_id"], "count": row["n"]} async for row in db[EVENTS].aggregate([
        {"$match": {"created_at": {"$gte": since}}},
        {"$group": {"_id": "$event_name", "n": {"$sum": 1}}},
    ])]
    last24.sort(key=lambda r: -r["count"])
    ever = set(await db[EVENTS].distinct("event_name"))
    not_live = [name for name in ALL_STAGE_EVENTS if name not in ever]

    target_payers = settings.PILOT_TARGET_PAYERS
    pilot_start = _parse(settings.PILOT_START).date()
    pilot_end = _parse(settings.PILOT_END).date()
    today = utc_now().astimezone(IST).date()
    mode = settings.PAYWALL_MODE

    return {
        "generated_at": utc_now().isoformat(),
        "took_ms": round((time.perf_counter() - began) * 1000),
        # The window's own dates (it is cut at UTC midnight, like the Funnel tab).
        "range": {"start": start_dt.date().isoformat(),
                  "end": (end_dt - timedelta(microseconds=1)).date().isoformat(),
                  "days": days if days and not (start or end) else None,
                  "pilot_window": not (start or end or days)},
        "include_test": include_test,
        "paywall_mode": mode,
        "counting": {"sessions": "distinct sessions (one browser visit)",
                     "people": "distinct signed-in people (user_id); mobile numbers are unverified"},
        "stages": {
            "reach": {"visits": visits, "bounced": ratio(bounced, visits)},
            "free": {
                "signed_in_people": len(signed_in),
                "unique_numbers_unverified": unique_numbers,
                "login_completed": ratio(free["login_completed"], visits),
                "otp_verified": free["otp_verified"],
                "quiz_started": ratio(free["quiz_started"], visits),
                "free_part_completed": ratio(free["free_part_completed"], free["quiz_started"]),
                "rough_rec_viewed": ratio(free["rough_rec_viewed"], free["free_part_completed"]),
            },
            "money": {
                "paywall_viewed": ratio(money["paywall_viewed"], free["rough_rec_viewed"]),
                "paywall_cta_clicked": ratio(money["paywall_cta_clicked"], money["paywall_viewed"]),
                "payment_started": ratio(money["payment_started"], money["paywall_cta_clicked"]),
                "payment_dismissed": money["payment_dismissed"],
                "payment_failed": money["payment_failed"],
                # People, from the payments collection.
                "paid_people": len(paid_users),
                "intent_people": len(intent_users),
                "payers": ratio(len(payers), money["paywall_viewed"]),
                "revenue_rupees": round(sum(p.get("amount_paise", 0) for p in paid_rows) / 100, 2),
                "would_be_rupees": round(len(intent_users) * settings.PILOT_PRICE_PAISE / 100, 2),
                "refunds": len(refund_rows),
                "avg_minutes_to_pay": round(sum(waits) / len(waits), 1) if waits else None,
                "price_rupees": settings.PILOT_PRICE_PAISE / 100,
            },
            # `unlocked`: people who paid or tapped Pay (all signed-in people when the
            # paywall is off). `unpaid`: people who did not unlock.
            "action": {"unlocked_people": len(unlocked_users), "unlocked": action_block(unlocked_users),
                       "unpaid_people": len(not_unlocked_users), "unpaid": action_block(not_unlocked_users),
                       "real_paid_people": len(paid_users)},
        },
        "targets": {
            "signups": {"count": len(signed_in), "target": settings.PILOT_TARGET_SIGNUPS},
            "payers": {"count": len(payers), "target": target_payers},
            # Before the pilot starts this is the whole window; after it ends, 0.
            "days_left": (pilot_end - max(today, pilot_start)).days + 1 if today <= pilot_end else 0,
            "pilot_start": settings.PILOT_START, "pilot_end": settings.PILOT_END,
        },
        "entry": entry,
        "daily": list(day.values()),
        "reels": reels,
        "breakdowns": breakdowns,
        "dropoff": dropoff,
        "breeders": {"by_breeder": breeder_rows[:20], "by_breed": tap_table("breed"),
                     "by_source": tap_table("source")},
        "health": {
            **health,
            "events_last_24h_by_name": last24,
            "mismatch": {"payment_success_event_people": len(success_event_users),
                         "paid_in_database_people": len(db_paid_any_mode), "flag": mismatch},
            "excluded_sessions": excluded,
            "internal_numbers_configured": len(internal_mobiles),
            "not_live_yet": not_live,
        },
        "thresholds": {"min_visits": MIN_VISITS, "min_paywall_views": MIN_PAYWALL_VIEWS},
    }


# ------------------------------------------------------------------ CSV

CSV_COLUMNS = [
    "first_seen", "mobile_last4_unverified", "campaign", "content", "channel", "device", "city", "age_range",
    "top_breed", "free_part_completed", "paywall_viewed", "unlocked", "unlock_kind", "paid", "paid_amount_rupees",
    "unlocked_at",
    "full_quiz_completed", "breeder_call_taps", "breeder_whatsapp_taps",
]


async def export_people(db, start: Optional[str] = None, end: Optional[str] = None,
                        include_test: bool = False, days: Optional[int] = None) -> list:
    """One row per signed-in person who signed up in the window. No name, no
    email; the mobile as its last 4 digits only (and it is unverified)."""
    clause, _, _ = _window(start, end, days)
    people = await db[USERS].find({"created_at": clause, "source": "contact_form"}).to_list(None)
    internal_mobiles = settings.internal_test_mobiles
    if not include_test:
        people = [u for u in people if u.get("role") != "ADMIN" and _mobile10(u.get("mobile")) not in internal_mobiles]
    ids = [u["id"] for u in people]
    progress = await _by_ids(db, PROGRESS, "user_id", ids)
    pays = await _by_ids(db, PAYMENTS, "user_id", ids)
    ev = await db[EVENTS].find({"user_id": {"$in": ids}}).to_list(None) if ids else []
    by_user = defaultdict(list)
    for p in progress:
        by_user[p.get("user_id")].append(p)
    events_of = defaultdict(list)
    for e in ev:
        events_of[e.get("user_id")].append(e)

    rows = []
    for u in sorted(people, key=lambda x: _aware(x.get("created_at")) or utc_now()):
        uid = u["id"]
        prog = sorted(by_user[uid], key=lambda p: _aware(p.get("started_at")) or utc_now())
        first = prog[0] if prog else {}
        attr = first.get("attribution") or {}
        names = [e.get("event_name") for e in events_of[uid]]
        call_breeders = {(e.get("props") or {}).get("breeder_id") for e in events_of[uid] if e.get("event_name") == "breeder_call_clicked"}
        wa_breeders = {(e.get("props") or {}).get("breeder_id") for e in events_of[uid] if e.get("event_name") == "breeder_whatsapp_opened"}
        real = [p for p in pays if p.get("user_id") == uid and p.get("status") == "paid"
                and (p.get("mode") == "live" or (include_test and p.get("mode") == "test"))]
        fake = [p for p in pays if p.get("user_id") == uid and p.get("status") == "fake_door"]
        paid_row = (real or fake or [None])[0]
        mobile = _mobile10(u.get("mobile"))
        rows.append({
            "first_seen": _ist_day(u.get("created_at")) or "",
            "mobile_last4_unverified": mobile[-4:] if len(mobile) >= 4 else "",
            "campaign": attr.get("utm_campaign") or "",
            "content": attr.get("utm_content") or "",
            "channel": attr.get("channel") or "",
            "device": attr.get("device") or "",
            "city": first.get("city") or "",
            "age_range": u.get("age_range") or NOT_GIVEN,
            "top_breed": next((p.get("top_breed") for p in reversed(prog) if p.get("top_breed")), ""),
            "free_part_completed": "yes" if "free_part_completed" in names else "no",
            "paywall_viewed": "yes" if "paywall_viewed" in names else "no",
            # unlocked = paid OR tapped Pay (fake door); paid = real money only.
            "unlocked": "yes" if paid_row else "no",
            "unlock_kind": ("paid" if real else "fake_door") if paid_row else "",
            "paid": "yes" if real else "no",
            "paid_amount_rupees": paid_row.get("amount_paise", 0) / 100 if real else "",
            "unlocked_at": (_aware(paid_row.get("paid_at")) or _aware(paid_row.get("created_at"))).astimezone(IST).strftime("%Y-%m-%d %H:%M")
                       if paid_row else "",
            "full_quiz_completed": "yes" if any(p.get("status") == "completed" for p in prog) or "quiz_completed" in names else "no",
            "breeder_call_taps": len(call_breeders - {None}),
            "breeder_whatsapp_taps": len(wa_breeders - {None}),
        })
    return rows
