"""Acquisition funnel — writes from the quiz, reads for the admin dashboard.

Every number the dashboard shows is recomputed from `events` and
`quiz_progress` on each request. Nothing is precomputed or cached, so a count
can never drift from the log it came from, and changing the date range is just
another read.

Counts are always of DISTINCT SESSIONS, never of rows. A user who reloads the
results page fires `results_viewed` twice; counting rows would inflate that
step and quietly deflate every conversion rate downstream of it.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from app.models.funnel import FUNNEL_EVENTS, KNOWN_EVENTS
from app.services import readiness

logger = logging.getLogger(__name__)

EVENTS = "events"
PROGRESS = "quiz_progress"

#: A session with no activity for this long is treated as walked away, not
#: mid-thought. It only affects the "abandoned" list — nothing is written.
ABANDON_AFTER_MINUTES = 60

#: How many rows the two tables on the dashboard carry. Enough to scan, few
#: enough that the page stays a dashboard.
TABLE_LIMIT = 50


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------- writes ---------------------------------- #

async def record_event(db, event: dict) -> bool:
    """Append one event. Returns False for an unrecognised name.

    Best-effort by design: tracking must never be able to break the quiz, so
    the caller treats a False or an exception as "carry on".
    """
    if event.get("event_name") not in KNOWN_EVENTS:
        logger.warning("Rejected unknown event_name: %r", event.get("event_name"))
        return False
    await db[EVENTS].insert_one(event)
    return True


async def upsert_progress(db, patch: dict) -> dict:
    """Merge a partial update into this session's row, creating it if needed.

    Only the keys actually supplied are written. The quiz sends one answer at a
    time and nothing else knows the rest of the row, so a full replace would
    wipe the fields it wasn't told about — the timeline answer would erase the
    city, the completion would erase the answers."""
    session_id = patch.pop("session_id")
    fields = {k: v for k, v in patch.items() if v is not None}
    fields["updated_at"] = utc_now()

    # The CHECK constraint and the rank trigger, in application code. The rank
    # is never taken from the client — it is derived from the code every time,
    # so a stale build sending a mismatched pair cannot desync the two. An
    # unrecognised code falls back rather than being stored.
    fields.pop("readiness_rank", None)
    if "readiness_code" in fields:
        code = readiness.validate_code(fields["readiness_code"])
        fields["readiness_code"] = code
        fields["readiness_rank"] = readiness.rank_for(code)

    on_insert = {"session_id": session_id, "started_at": utc_now()}
    # A field may appear in $set or $setOnInsert but never both — Mongo rejects
    # the update outright as a conflicting path. So the default status is only
    # offered when this particular patch isn't setting one itself.
    if "status" not in fields:
        on_insert["status"] = "in_progress"

    await db[PROGRESS].update_one(
        {"session_id": session_id},
        {"$set": fields, "$setOnInsert": on_insert},
        upsert=True,
    )
    row = await db[PROGRESS].find_one({"session_id": session_id})
    return _clean(row)


def _aware(value):
    """Mongo stores UTC but hands it back without a tzinfo, so anything read
    from a document is naive even though it was written aware. Left alone, it
    poisons two things: arithmetic against `utc_now()` raises outright, and an
    ISO string with no offset gets parsed by the browser as LOCAL time, which
    silently shifts every "3 hours ago" by the timezone offset."""
    if isinstance(value, datetime) and value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _clean(row: Optional[dict]) -> dict:
    if not row:
        return {}
    row.pop("_id", None)
    for key in ("started_at", "updated_at"):
        if isinstance(row.get(key), datetime):
            row[key] = _aware(row[key]).isoformat()
    return row


# ---------------------------------- reads ----------------------------------- #

def _window(days: int, start: Optional[str], end: Optional[str]) -> dict:
    """The created_at filter for a report. An explicit range wins; otherwise the
    last `days` days."""
    if start or end:
        clause = {}
        if start:
            clause["$gte"] = _parse(start)
        if end:
            # An end date is inclusive of that whole day — a picker showing
            # "to 6 Aug" that drops everything logged on the 6th is a bug.
            clause["$lt"] = _parse(end) + timedelta(days=1)
        return clause
    return {"$gte": utc_now() - timedelta(days=days)}


def _parse(value: str) -> datetime:
    return datetime.fromisoformat(str(value)[:10]).replace(tzinfo=timezone.utc)


async def _distinct_sessions(db, window: dict) -> dict:
    """One pass over the window: sessions per event name."""
    pipeline = [
        {"$match": {"created_at": window}},
        {"$group": {"_id": {"event": "$event_name", "session": "$session_id"}}},
        {"$group": {"_id": "$_id.event", "sessions": {"$sum": 1}}},
    ]
    return {row["_id"]: row["sessions"] async for row in db[EVENTS].aggregate(pipeline)}


async def _dropoff(db, window: dict) -> list:
    """Viewed vs answered, per question index.

    The gap between the two is the drop-off: a question that was shown 200
    times and answered 140 lost 60 people, and it lost them *there* rather than
    somewhere vague upstream."""
    pipeline = [
        {"$match": {
            "created_at": window,
            "event_name": {"$in": ["question_viewed", "question_answered"]},
        }},
        {"$group": {"_id": {
            "q_index": "$props.q_index",
            "q_id": "$props.q_id",
            "event": "$event_name",
            "session": "$session_id",
        }}},
        {"$group": {
            "_id": {"q_index": "$_id.q_index", "q_id": "$_id.q_id"},
            "viewed": {"$sum": {"$cond": [{"$eq": ["$_id.event", "question_viewed"]}, 1, 0]}},
            "answered": {"$sum": {"$cond": [{"$eq": ["$_id.event", "question_answered"]}, 1, 0]}},
        }},
    ]
    rows = []
    async for row in db[EVENTS].aggregate(pipeline):
        index = row["_id"].get("q_index")
        if index is None:
            continue
        viewed, answered = row["viewed"], row["answered"]
        rows.append({
            "q_index": int(index),
            "q_id": row["_id"].get("q_id"),
            "viewed": viewed,
            "answered": answered,
            "dropped": max(viewed - answered, 0),
            "drop_rate": round((viewed - answered) / viewed * 100, 1) if viewed else 0.0,
        })
    rows.sort(key=lambda r: r["q_index"])
    return rows


async def _readiness(db, window: dict) -> list:
    """Completed quizzes per readiness level, rank order, zeros included.

    The labels come from the `readiness_levels` collection rather than from a
    constant in here — the equivalent of the LEFT JOIN in the SQL reference.
    That is what stops a raw code like "ready_now" ever reaching a screen, and
    it means renaming a level is a data edit, not a deploy.

    Levels with no leads still appear: a zero next to "Ready Now" is the single
    most useful number on the section, and a missing row would just look like a
    bug."""
    pipeline = [
        {"$match": {"status": "completed", "updated_at": window}},
        {"$group": {"_id": "$readiness_code", "count": {"$sum": 1}}},
    ]
    counts = {row["_id"]: row["count"] async for row in db[PROGRESS].aggregate(pipeline)}
    levels = await readiness.list_levels(db)
    total = sum(counts.values())

    out = [{
        "code": level["code"],
        "label": level["label"],
        "description": level.get("description"),
        "rank": level["rank"],
        "count": counts.get(level["code"], 0),
        "share": round(counts.get(level["code"], 0) / total * 100, 1) if total else 0.0,
    } for level in levels]

    # Completed quizzes that never recorded a timeline — old rows, or someone
    # who skipped the question. Shown rather than silently dropped, so the
    # section's counts always add up to the completions table above it.
    unknown = total - sum(row["count"] for row in out)
    if unknown > 0:
        out.append({"code": None, "label": "Not answered", "description": None,
                    "rank": 99, "count": unknown,
                    "share": round(unknown / total * 100, 1) if total else 0.0})
    return out


async def _abandoned(db) -> list:
    """Sessions still marked in_progress and quiet for a while.

    Deliberately NOT date-windowed: someone who dropped out five weeks ago is
    still a person we can see and could still call, and hiding them behind the
    report's date filter would defeat the reason for storing partials at all."""
    cutoff = utc_now() - timedelta(minutes=ABANDON_AFTER_MINUTES)
    cursor = (db[PROGRESS]
              .find({"status": "in_progress", "updated_at": {"$lt": cutoff}})
              .sort("updated_at", -1)
              .limit(TABLE_LIMIT))
    now = utc_now()
    rows = []
    async for row in cursor:
        updated = _aware(row.get("updated_at"))
        row = _clean(row)
        row["idle_minutes"] = int((now - updated).total_seconds() // 60) if updated else None
        row["answered_count"] = len(row.get("answers") or {})
        # Someone who answered the timeline question and THEN quit is still a
        # usable signal — arguably the most usable one on this table, because
        # they told us when they're buying before they walked away.
        row["readiness_label"] = (readiness.label_for(row["readiness_code"])
                                  if row.get("readiness_code") else None)
        rows.append(row)
    return rows


async def _completions(db, window: dict) -> list:
    """The most recent finished quizzes, each flagged with whether that session
    went on to click through to a breeder. That flag is what turns this table
    into something you can show a breeder."""
    cursor = (db[PROGRESS]
              .find({"status": "completed", "updated_at": window})
              .sort("updated_at", -1)
              .limit(TABLE_LIMIT))
    rows = [_clean(row) async for row in cursor]
    if not rows:
        return rows

    ids = [row["session_id"] for row in rows]
    clicked = set(await db[EVENTS].distinct(
        "session_id", {"event_name": "breeder_cta_clicked", "session_id": {"$in": ids}}))
    for row in rows:
        row["breeder_cta_clicked"] = row["session_id"] in clicked
        # Resolved server-side so the table can render a label without knowing
        # the code vocabulary. No code should ever reach the screen.
        row["readiness_label"] = (readiness.label_for(row["readiness_code"])
                                  if row.get("readiness_code") else None)
    return rows


async def build_report(db, days: int = 30, start: str = None, end: str = None) -> dict:
    """Everything the dashboard renders, in one request.

    Composed server-side for the same reason the health Overview is: six
    separate fetches can arrive in six different states, and a funnel whose
    steps disagree with each other is worse than no funnel."""
    window = _window(days, start, end)
    sessions = await _distinct_sessions(db, window)

    # Each step's conversion is measured against the step before it, not against
    # the top — "80% of people who saw results clicked" is the actionable number;
    # "12% of everyone who started" hides which step is actually leaking.
    steps, previous = [], None
    for name in FUNNEL_EVENTS:
        count = sessions.get(name, 0)
        steps.append({
            "event": name,
            "count": count,
            "from_previous": round(count / previous * 100, 1) if previous else None,
            "from_start": round(count / steps[0]["count"] * 100, 1) if steps and steps[0]["count"] else None,
        })
        previous = count or None

    results_viewed = sessions.get("results_viewed", 0)
    cta_clicks = sessions.get("breeder_cta_clicked", 0)

    return {
        "generated_at": utc_now().isoformat(),
        "range": {
            "days": None if (start or end) else days,
            "start": start,
            "end": end,
        },
        "funnel": steps,
        "dropoff": await _dropoff(db, window),
        "readiness": await _readiness(db, window),
        "abandoned": await _abandoned(db),
        "completions": await _completions(db, window),
        # The headline number: of the people who got as far as seeing a
        # recommendation, how many asked to be put in touch with a breeder.
        "cta_rate": {
            "results_viewed": results_viewed,
            "cta_clicked": cta_clicks,
            "rate": round(cta_clicks / results_viewed * 100, 1) if results_viewed else 0.0,
        },
    }
