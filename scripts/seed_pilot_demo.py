"""Fill a DEMO database with fake pilot data, to check the Pilot dashboard by hand.

    python scripts/seed_pilot_demo.py --db paw_buddy_demo

DEV ONLY. It refuses to run:
  * when ENV=production,
  * unless the database name ends in "_demo",
  * if that name is the database the app itself uses.
It only INSERTS, into the demo database, rows whose ids start with "demo-". It
never deletes or changes anything. To start over, drop the demo database
yourself in Atlas.

Point the backend at the same demo database (MONGODB_URI .../paw_buddy_demo),
open Admin -> Funnel -> Pilot, choose the dates this prints, and compare the
numbers with EXPECTED below.

What it creates (all fake, all marked demo-):
  3 campaigns x reels: hyd_launch/reel_1 (40 visits), campus/poster_qr (30),
  blr_try/reel_2 (12, so "too few"); 2 cities; 3 age ranges plus "not given";
  fake-door "Pay" taps, 2 real (live) payments, 1 Razorpay TEST payment, and
  internal traffic (an admin, a number for INTERNAL_TEST_MOBILES, ?utm_source=test).
"""
import argparse
import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone

INTERNAL_DEMO_MOBILE = "9000000099"     # put this in INTERNAL_TEST_MOBILES to see it excluded

# name, content, channel, city, visits, bounced, started, free_done, rough, cta (Unlock), signed_in, paywall, payers(live, fake)
CAMPAIGNS = [
    ("hyd_launch", "reel_1", "instagram", "Hyderabad", 40, 4, 34, 30, 28, 24, 22, 20, (0, 8)),
    ("campus", "poster_qr", "poster", "Bangalore", 30, 2, 26, 22, 20, 14, 12, 10, (2, 2)),
    ("blr_try", "reel_2", "instagram", "Hyderabad", 12, 2, 8, 6, 6, 6, 6, 6, (0, 2)),
]
# Every non-bounced visitor taps one of these. The quiz starts straight away; the
# contact form comes only when they tap Unlock, so "signed in" <= "cta" above.
ENTRY_SOURCES = ("hero", "sticky_bar", "journey_card")
AGES = ["20_24", "25_29", "30_34", None]          # None -> "Not given"


def build_demo_docs(base: datetime) -> tuple:
    """(docs by collection, expected numbers). Pure: no database involved."""
    docs = {"events": [], "quiz_progress": [], "users": [], "payments": [], "feedback": [], "screener_answers": []}
    exp = {"visits": 0, "bounced": 0, "quiz_started": 0, "signed_in": 0, "free_part_completed": 0,
           "rough_rec_viewed": 0, "paywall_viewed": 0, "paywall_cta_clicked": 0, "paid_live": 0,
           "intent": 0, "revenue": 0.0, "breeder_call_payers": 0, "breeder_whatsapp_unpaid": 0,
           "by_campaign": {}, "by_city": {}, "by_age": {},
           "entry": {"tapped": 0, "quiz_started": 0, "free_done": 0, "rough_viewed": 0, "unlock_tapped": 0,
                     "form_viewed": 0, "form_started": 0, "submitted": 0, "account_created": 0, "paywall_viewed": 0,
                     "errors": 0, "left_form_unfinished": 0, "finished_and_saw_paywall": 0,
                     "tapped_with_account": 0, "old_flow_sessions": 0, "by_source": {}},
           "pulse": {"useful": {"paid": {"yes": 0}, "fake_door": {"yes": 0}}, "price_fair": {"paid": {}, "fake_door": {}},
                     "not_paid_reason": {}, "dismissed_how": {}, "abandoned": 0, "left_open_no_answer": 0}}
    HOWS = ("x", "outside", "esc", "back")
    REASONS = ("price", "price", "price", "trust", "trust", "exploring")

    def pulse_rows(sid, uid, state, useful=None, key=None, answer=None):
        """A 'Was this useful?' answer and/or a screener answer, as the API would store them."""
        when = at()
        if useful:
            docs["feedback"].append({"context": "rec_useful", "session_id": sid, "user_id": uid, "useful": useful,
                                     "rating": {"yes": 3, "some": 2, "no": 1}[useful], "rating_type": "quick",
                                     "paywall_state": state, "paywall_mode": "fake_door", "version": 1,
                                     "created_at": when, "updated_at": when})
            exp["pulse"]["useful"][state][useful] += 1
        if key:
            docs["screener_answers"].append({"session_id": sid, "user_id": uid, "key": key, "answer": answer,
                                             "version": 1, "paywall_state": state, "paywall_mode": "fake_door",
                                             "created_at": when, "updated_at": when})
    t = [0]

    def at():
        t[0] += 1
        return base + timedelta(seconds=30 * t[0])

    def event(sid, name, uid=None, labels=None, **props):
        docs["events"].append({"session_id": sid, "user_id": uid, "event_name": name,
                               "props": {**(labels or {}), **props}, "created_at": at()})

    n = 0
    for (camp, content, channel, city, visits, bounced, started, free_done, rough, cta, signed, paywall,
         (live, fake)) in CAMPAIGNS:
        row = {"visits": visits, "paywall_viewed": paywall, "paid": live + fake}
        exp["by_campaign"][f"{camp} / {content}"] = row
        city_row = exp["by_city"].setdefault(city, {"visits": 0, "paid": 0})
        city_row["visits"] += visits
        city_row["paid"] += live + fake
        for i in range(visits):
            n += 1
            sid = f"demo-s-{n:04d}"
            labels = {"channel": channel, "campaign": camp, "content": content, "device": "mobile"}
            uid = f"demo-u-{n:04d}" if i < signed else None
            age = AGES[n % len(AGES)]
            docs["quiz_progress"].append({
                "session_id": sid, "user_id": uid, "city": city,
                "top_breed": "Indie" if i % 2 else "Beagle", "status": "completed" if i < live + fake else "in_progress",
                "started_at": at(), "updated_at": at(),
                "attribution": {"channel": channel, "utm_campaign": camp, "utm_content": content, "device": "mobile"}})
            event(sid, "site_visit", None, labels)
            if i >= visits - bounced:
                continue                                  # bounced: the visit and nothing else
            # Entry funnel: tap Find my dog, the free quiz and rough match with no
            # account, then Unlock -> the contact form -> an account -> the paywall.
            e = exp["entry"]
            src = ENTRY_SOURCES[i % len(ENTRY_SOURCES)]
            event(sid, "find_dog_clicked", None, labels, source=src, has_account=False)
            e["tapped"] += 1
            e["by_source"].setdefault(src, {"tapped": 0, "account_created": 0})
            e["by_source"][src]["tapped"] += 1
            if i < started:
                event(sid, "quiz_started", None, labels)
                e["quiz_started"] += 1
                for q in range(4):
                    event(sid, "question_viewed", None, labels, q_index=q, q_id=f"q{q}")
                    if i < free_done or q < 2:
                        event(sid, "question_answered", None, labels, q_index=q, q_id=f"q{q}")
            if i < free_done:
                event(sid, "free_part_completed", None, labels)
                e["free_done"] += 1
            if i < rough:
                event(sid, "rough_rec_viewed", None, labels)
                e["rough_viewed"] += 1
            if i < cta:
                event(sid, "paywall_cta_clicked", None, labels, source="rough")
                event(sid, "contact_form_viewed", None, labels)
                e["unlock_tapped"] += 1
                e["form_viewed"] += 1
                if i < min(cta, signed + 2):
                    event(sid, "contact_form_started", None, labels)
                    e["form_started"] += 1
                if signed <= i < min(cta, signed + 2):
                    event(sid, "contact_form_error", None, labels, field="mobile")
                    e["errors"] += 1
                if i < signed:
                    event(sid, "login_started", None, labels)
                    e["submitted"] += 1
                else:
                    event(sid, "contact_form_closed", None, labels)
                    e["left_form_unfinished"] += 1
            if uid:
                docs["users"].append({"id": uid, "name": "Demo person", "mobile": f"98{n:08d}", "role": "USER",
                                      "source": "contact_form", "mobile_verified": False,
                                      "age_range": age, "created_at": at()})
                event(sid, "login_completed", uid, labels)
                e["account_created"] += 1
                e["by_source"][src]["account_created"] += 1
                exp["by_age"].setdefault(age or "Not given", 0)
                exp["by_age"][age or "Not given"] += 1
            if i < paywall:
                event(sid, "paywall_viewed", uid, labels)
                e["paywall_viewed"] += 1
                if uid:
                    e["finished_and_saw_paywall"] += 1
            if i < live + fake:
                is_live = i < live
                docs["payments"].append({
                    "user_id": uid, "session_id": sid, "order_id": f"demo-order-{n:04d}", "amount_paise": 9900,
                    "currency": "INR", "status": "paid" if is_live else "fake_door",
                    "mode": "live" if is_live else "fake_door", "channel": channel,
                    "created_at": at(), "paid_at": at() if is_live else None})
                if is_live:
                    event(sid, "payment_success", uid, labels, amount=99, mode="live")
                    exp["paid_live"] += 1
                    exp["revenue"] += 99
                else:
                    exp["intent"] += 1
                event(sid, "quiz_completed", uid, labels)
                event(sid, "results_viewed", uid, labels)
                if camp == "hyd_launch" and i < 3:
                    event(sid, "breeder_call_clicked", uid, labels, breeder_id="br_demo_1", breed="Indie", source="results")
                    exp["breeder_call_payers"] += 1
                # Feedback after the full results: fake-door unlockers (hyd) and real payers (campus).
                state = "paid" if is_live else "fake_door"
                if (camp == "hyd_launch" and i < 4) or (camp == "campus" and is_live):
                    answer = ("fair", "fair", "high", "high")[i] if camp == "hyd_launch" else "cheap"
                    pulse_rows(sid, uid, state, useful="yes", key="price_fair", answer=answer)
                    exp["pulse"]["price_fair"][state][answer] = exp["pulse"]["price_fair"][state].get(answer, 0) + 1
            elif camp == "hyd_launch" and 8 <= i < paywall:
                # Did not unlock. 8..15 closed the sheet (each way), 16..18 left with it open.
                if i < 16:
                    how = HOWS[i % 4]
                    event(sid, "paywall_dismissed", uid, labels, how=how)
                    exp["pulse"]["dismissed_how"][how] = exp["pulse"]["dismissed_how"].get(how, 0) + 1
                    if i < 14:
                        reason = REASONS[i - 8]
                        event(sid, "not_unlocked_asked", uid, labels, moment="dismissed")
                        pulse_rows(sid, uid, "dismissed", key="not_paid_reason", answer=reason)
                        exp["pulse"]["not_paid_reason"][reason] = exp["pulse"]["not_paid_reason"].get(reason, 0) + 1
                elif i < 19:
                    event(sid, "paywall_abandoned", uid, labels)
                    exp["pulse"]["abandoned"] += 1
                    if i == 16:     # answered on the next visit
                        pulse_rows(sid, uid, "dismissed", key="not_paid_reason", answer="other")
                        exp["pulse"]["not_paid_reason"]["other"] = exp["pulse"]["not_paid_reason"].get("other", 0) + 1
                    else:
                        exp["pulse"]["left_open_no_answer"] += 1
            elif camp == "hyd_launch" and i in (20, 21):
                event(sid, "breeder_whatsapp_opened", uid, labels, breeder_id="br_demo_2", breed="Beagle", source="breed_profile")
                exp["breeder_whatsapp_unpaid"] += 1
        for key, val in (("visits", visits), ("bounced", bounced), ("quiz_started", started), ("signed_in", signed),
                         ("free_part_completed", free_done), ("rough_rec_viewed", rough),
                         ("paywall_viewed", paywall), ("paywall_cta_clicked", cta)):
            exp[key] += val

    # A returning campus visitor: already has an account, so the form is skipped
    # and the session is not a form drop-out.
    sid = "demo-s-returning-1"
    labels = {"channel": "poster", "campaign": "campus", "content": "poster_qr", "device": "mobile"}
    docs["quiz_progress"].append({"session_id": sid, "user_id": "demo-u-0041", "city": "Bangalore",
                                  "top_breed": "Indie", "status": "in_progress", "started_at": at(), "updated_at": at(),
                                  "attribution": {"channel": "poster", "utm_campaign": "campus",
                                                  "utm_content": "poster_qr", "device": "mobile"}})
    event(sid, "site_visit", None, labels)
    event(sid, "find_dog_clicked", "demo-u-0041", labels, source="hero", has_account=True)
    event(sid, "quiz_started", "demo-u-0041", labels)
    exp["visits"] += 1
    exp["quiz_started"] += 1
    exp["by_campaign"]["campus / poster_qr"]["visits"] += 1
    exp["by_city"]["Bangalore"]["visits"] += 1
    exp["entry"]["tapped_with_account"] = 1

    # A visit from before the contact form moved to Unlock: the form came before
    # question 1 and they left. Counted apart, not in the entry steps.
    sid = "demo-s-oldflow-1"
    labels = {"channel": "instagram", "campaign": "hyd_launch", "content": "reel_1", "device": "mobile"}
    docs["quiz_progress"].append({"session_id": sid, "user_id": None, "city": "Hyderabad", "status": "in_progress",
                                  "started_at": at(), "updated_at": at(),
                                  "attribution": {"channel": "instagram", "utm_campaign": "hyd_launch",
                                                  "utm_content": "reel_1", "device": "mobile"}})
    event(sid, "site_visit", None, labels)
    event(sid, "find_dog_clicked", None, labels, source="hero", has_account=False)
    event(sid, "contact_form_viewed", None, labels)
    event(sid, "contact_form_closed", None, labels)
    exp["visits"] += 1
    exp["by_campaign"]["hyd_launch / reel_1"]["visits"] += 1
    exp["by_city"]["Hyderabad"]["visits"] += 1
    exp["entry"]["old_flow_sessions"] = 1

    # A Razorpay TEST payment by a campus person: excluded unless the toggle is on.
    test_payer = next(u["id"] for u in docs["users"] if u["id"] == "demo-u-0050")
    docs["payments"].append({"user_id": test_payer, "session_id": None, "order_id": "demo-order-test",
                             "amount_paise": 9900, "currency": "INR", "status": "paid", "mode": "test",
                             "created_at": at(), "paid_at": at()})

    # Internal traffic: an admin, your own number, and a ?utm_source=test visit.
    internal = [("demo-admin", "ADMIN", "9000000098"), ("demo-internal", "USER", INTERNAL_DEMO_MOBILE)]
    for uid, role, mobile in internal:
        docs["users"].append({"id": uid, "name": "Demo internal", "mobile": mobile, "role": role,
                              "source": "contact_form", "created_at": at()})
        sid = f"demo-s-{uid}"
        labels = {"channel": "instagram", "campaign": "hyd_launch", "content": "reel_1", "device": "desktop"}
        docs["quiz_progress"].append({"session_id": sid, "user_id": uid, "city": "Hyderabad", "started_at": at(),
                                      "attribution": {"channel": "instagram", "utm_campaign": "hyd_launch",
                                                      "utm_content": "reel_1"}})
        for name in ("site_visit", "quiz_started", "login_completed", "paywall_viewed"):
            event(sid, name, uid, labels)
        docs["payments"].append({"user_id": uid, "session_id": sid, "order_id": f"demo-order-{uid}",
                                 "amount_paise": 9900, "status": "fake_door", "mode": "fake_door", "created_at": at()})
    for k in range(2):
        sid = f"demo-s-utmtest-{k}"
        labels = {"channel": "test", "campaign": "", "content": "", "device": "desktop"}
        docs["quiz_progress"].append({"session_id": sid, "started_at": at(), "attribution": {"channel": "test"}})
        event(sid, "site_visit", None, labels)
        event(sid, "quiz_started", None, labels)
    exp["internal_sessions"] = len(internal) + 2
    return docs, exp


async def _seed(uri: str, name: str) -> None:
    from motor.motor_asyncio import AsyncIOMotorClient
    db = AsyncIOMotorClient(uri)[name]
    docs, exp = build_demo_docs(datetime.now(timezone.utc) - timedelta(hours=6))
    for collection, rows in docs.items():
        if rows:
            await db[collection].insert_many(rows)
            print(f"  {collection}: {len(rows)} demo rows")
    day = (datetime.now(timezone.utc) - timedelta(hours=6)).date().isoformat()
    print(f"\nOpen the Pilot tab for {day} (or the pilot window). Expected (test/internal OFF):")
    for k, v in exp.items():
        print(f"  {k}: {v}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--db", required=True, help="Demo database name; must end in _demo")
    args = parser.parse_args()
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
    from app.config.settings import settings

    if settings.ENV == "production":
        print("Refusing: ENV=production. This script is for development only.")
        return 1
    if not args.db.endswith("_demo"):
        print("Refusing: the database name must end in _demo, so real pilot data can never be touched.")
        return 1
    from pymongo import uri_parser
    app_db = uri_parser.parse_uri(settings.MONGODB_URI).get("database") or "paw_buddy"
    if args.db == app_db:
        print("Refusing: that is the database the app itself uses.")
        return 1
    print(f"Seeding demo rows into '{args.db}' (inserts only).")
    asyncio.run(_seed(settings.MONGODB_URI, args.db))
    return 0


if __name__ == "__main__":
    sys.exit(main())
