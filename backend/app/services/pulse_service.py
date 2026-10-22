"""The "Was this useful?" pop-up: saving answers, "was this person asked
already?", and the admin summary. Routes are in routes/feedback.py, the
whitelists in models/pulse.py.

Two collections:
  feedback          one row per session with context="rec_useful" (the existing
                    collection and shape; a second answer updates the row)
  screener_answers  one row per (session_id, key); a repeat tap changes the
                    answer, it never adds a row

What the browser sends is only the session id and the answer codes. Who the
person is (user_id) comes from their token; where they came from (channel,
campaign, city, breed) is looked up from the session's quiz_progress row; and
their paywall state from their account. None of it is believed from the body.
"""
import logging
from typing import Optional

from pymongo.errors import DuplicateKeyError

from app.config.settings import settings
from app.models.pulse import PAYWALL_STATES, SCREENER_ANSWERS, USEFUL_RATING, PulseFeedback
from app.services import paywall_service as pay
from app.services.funnel_service import EVENTS, PROGRESS, _window, utc_now

logger = logging.getLogger(__name__)

FEEDBACK = "feedback"
SCREENER = "screener_answers"
CONTEXT = "rec_useful"

#: Below this many answers a percentage says more about chance than about people.
TOO_FEW = 20


async def paywall_state(db, claims: Optional[dict]) -> str:
    """"paid" only from a real payment row; a fake-door unlock is "fake_door"."""
    mode = settings.PAYWALL_MODE
    if mode == "off":
        return "none"
    if not claims:
        return "dismissed"
    if await pay.has_real_payment(db, claims["sub"]):
        return "paid"
    if await db[pay.PAYMENTS].find_one({"user_id": claims["sub"], "status": pay.STATUS_FAKE_DOOR})             or await pay.unlocked_until(db, claims["sub"]):
        return "fake_door"
    return "dismissed"


async def _session_facts(db, session_id: str) -> dict:
    """What the session's own record says about where this person came from.
    Never personal: no name, number or email is kept on quiz_progress."""
    row = await db[PROGRESS].find_one({"session_id": session_id}) or {}
    attr = row.get("attribution") or {}
    return {
        "channel": attr.get("channel") or "",
        "campaign": attr.get("utm_campaign") or "",
        "city": row.get("city") or "",
        "top_breed": row.get("top_breed") or "",
        "session_started_at": row.get("started_at"),
    }


async def _upsert(collection, query: dict, fields: dict, user_id: Optional[str], keep: tuple = ()):
    """Insert or update one row. Fields named in `keep` are written only when
    the row is new or when this post is signed in: a later post without a token
    must not overwrite what a signed-in post established (paid -> dismissed)."""
    now = utc_now()
    later = {} if user_id else {k: fields.pop(k) for k in keep if k in fields}
    update = {"$set": {**fields, "updated_at": now}, "$setOnInsert": {"created_at": now, **later}}
    if user_id:
        # Only ever set, never cleared: a later post without a token must not
        # wipe the account an earlier post was tied to.
        update["$set"]["user_id"] = user_id
    try:
        await collection.update_one(query, update, upsert=True)
    except DuplicateKeyError:
        # Two taps raced and both tried to insert. The unique index let one
        # through; this one becomes a plain update of that row.
        await collection.update_one(query, update)


async def save_pulse(db, payload, claims: Optional[dict]) -> None:
    user_id = claims["sub"] if claims else None
    row = PulseFeedback(
        user_id=user_id,
        rating=USEFUL_RATING[payload.useful],
        comment=payload.comment,
        context=CONTEXT,
        rating_type="quick",
        session_id=payload.session_id,
        paywall_state=await paywall_state(db, claims),
        paywall_mode=settings.PAYWALL_MODE,
        useful=payload.useful,
        version=payload.version,
    ).model_dump(exclude={"created_at", "updated_at", "user_id", "user_name"})
    if row["comment"] is None:
        # Picking an answer posts without a comment; it must not erase one sent earlier.
        row.pop("comment")
    await _upsert(db[FEEDBACK], {"context": CONTEXT, "session_id": payload.session_id}, row, user_id,
                  keep=("paywall_state", "paywall_mode"))


async def save_screener(db, payload, claims: Optional[dict]) -> None:
    user_id = claims["sub"] if claims else None
    fields = {
        "session_id": payload.session_id,
        "key": payload.key,
        "answer": payload.answer,
        "version": payload.version,
        "paywall_state": await paywall_state(db, claims),
        "paywall_mode": settings.PAYWALL_MODE,
        **await _session_facts(db, payload.session_id),
    }
    await _upsert(db[SCREENER], {"session_id": payload.session_id, "key": payload.key}, fields, user_id,
                  keep=("paywall_state", "paywall_mode"))


async def status(db, session_id: str, user_id: Optional[str], version: int) -> dict:
    """Has this session (or this signed-in account) been asked or answered?
    Only booleans and codes - nothing about the person."""
    who = [{"session_id": session_id}] + ([{"user_id": user_id}] if user_id else [])

    async def rows(collection, query):
        found = []
        for clause in who:
            found += await db[collection].find({**query, **clause}).to_list(200)
        return found

    pulses = await rows(FEEDBACK, {"context": CONTEXT, "version": version})
    answers = await rows(SCREENER, {"version": version})
    shown = await rows(EVENTS, {"event_name": "pulse_shown"})
    kinds = sorted({(e.get("props") or {}).get("kind") for e in shown
                    if (e.get("props") or {}).get("version") == version} & set(PAYWALL_STATES))
    steps = (["useful"] if pulses else []) + sorted({a["key"] for a in answers})
    # "What stopped you from unlocking?" (NotUnlockedCard): asked once per person.
    not_unlocked = bool(await rows(EVENTS, {"event_name": "not_unlocked_asked"}))
    return {"answered": bool(pulses), "steps_done": steps, "shown_kinds": kinds,
            "not_unlocked_asked": not_unlocked}


async def _test_sessions(db) -> set:
    """Sessions you tagged as your own testing: visit with ?utm_source=test."""
    return set(await db[PROGRESS].distinct("session_id", {"attribution.channel": "test"}))


async def summary(db, start: Optional[str], end: Optional[str], include_test: bool, days: int = 30) -> dict:
    window = _window(days, start, end)
    skip = set() if include_test else await _test_sessions(db)

    pulses = [r for r in await db[FEEDBACK].find({"context": CONTEXT, "created_at": window}).to_list(None)
              if r.get("session_id") not in skip]
    answers = [r for r in await db[SCREENER].find({"created_at": window}).to_list(None)
               if r.get("session_id") not in skip]
    shown_rows = await db[EVENTS].find({"event_name": "pulse_shown", "created_at": window}).to_list(None)
    shown = {r.get("session_id") for r in shown_rows if r.get("session_id") not in skip}

    # Left the site with the paywall open and never told us why (no answer from
    # that session or account, at the time or on a later visit).
    left_rows = await db[EVENTS].find({"event_name": "paywall_abandoned", "created_at": window}).to_list(None)
    reason_sessions = {r.get("session_id") for r in await db[SCREENER].find({"key": "not_paid_reason"}).to_list(None)}
    reason_users = {r.get("user_id") for r in await db[SCREENER].find({"key": "not_paid_reason"}).to_list(None) if r.get("user_id")}
    left_open = {r.get("session_id") for r in left_rows
                 if r.get("session_id") not in skip and r.get("session_id") not in reason_sessions
                 and not (r.get("user_id") and r.get("user_id") in reason_users)}

    useful = {state: {"yes": 0, "some": 0, "no": 0} for state in (*PAYWALL_STATES, "all")}
    for r in pulses:
        code = r.get("useful")
        if code in USEFUL_RATING:
            useful[r.get("paywall_state") if r.get("paywall_state") in PAYWALL_STATES else "none"][code] += 1
            useful["all"][code] += 1
    for counts in useful.values():
        counts["total"] = counts["yes"] + counts["some"] + counts["no"]
        counts["too_few"] = counts["total"] < TOO_FEW

    screeners = {}
    for key, codes in SCREENER_ANSWERS.items():
        counts = {code: 0 for code in codes}
        for r in answers:
            if r.get("key") == key and r.get("answer") in counts:
                counts[r["answer"]] += 1
        total = sum(counts.values())
        screeners[key] = {
            # Most common first: during the fake-door pilot "why didn't they pay"
            # is the card that matters, and its top reason should be on top.
            "counts": sorted(({"answer": c, "count": n} for c, n in counts.items()), key=lambda x: -x["count"]),
            "total": total,
            "too_few": total < TOO_FEW,
        }

    # The price question, split: real payers vs fake-door unlockers are never mixed.
    price_codes = SCREENER_ANSWERS["price_fair"]
    price_by_state = {}
    for state in ("paid", "fake_door"):
        counts = {code: 0 for code in price_codes}
        for r in answers:
            if r.get("key") == "price_fair" and r.get("paywall_state") == state and r.get("answer") in counts:
                counts[r["answer"]] += 1
        total = sum(counts.values())
        price_by_state[state] = {"counts": [{"answer": c, "count": counts[c]} for c in price_codes],
                                 "total": total, "too_few": total < TOO_FEW}

    # Rows written before "fake_door" existed that say "paid" although the account
    # only ever tapped Pay. Counted, never rewritten.
    legacy = 0
    for r in pulses + answers:
        uid = r.get("user_id")
        if r.get("paywall_state") == "paid" and uid and not await pay.has_real_payment(db, uid):
            legacy += 1

    answered = {r.get("session_id") for r in pulses}
    breeds = {}
    with_comment = sorted((r for r in pulses if r.get("comment")),
                          key=lambda r: r.get("updated_at") or r.get("created_at"), reverse=True)[:20]
    for r in with_comment:
        sid = r.get("session_id")
        if sid not in breeds:
            row = await db[PROGRESS].find_one({"session_id": sid}) or {}
            breeds[sid] = row.get("top_breed") or ""
    comments = [{
        # Deliberately no name, number, email, user id or session id.
        "date": (r.get("updated_at") or r.get("created_at")).isoformat(),
        "breed": breeds.get(r.get("session_id"), ""),
        "paywall_state": r.get("paywall_state"),
        "useful": r.get("useful"),
        "comment": r.get("comment"),
    } for r in with_comment]

    return {
        "useful": useful,
        "screeners": screeners,
        "response": {
            "shown": len(shown),
            "answered": len(answered),
            "rate": round(len(answered & shown) / len(shown) * 100, 1) if shown else None,
        },
        "comments": comments,
        "price_fair_by_state": price_by_state,
        "left_paywall_open_no_answer": len(left_open),
        "legacy_paid_rows_fake_door": legacy,
        "include_test": include_test,
        "too_few_threshold": TOO_FEW,
    }
