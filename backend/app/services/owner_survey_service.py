"""Existing Dog Owner survey — writes, reads and the CSV export.

One document per submission. Nothing is aggregated or derived at write time
beyond the respondent label and the climate band, so the raw answers stay
exactly as the owner gave them and any later analysis starts from source.
"""
import csv
import io
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from app.models.owner_survey import (
    ALONE_HOURS, CHALLENGE, LABELS, LIVING, QUESTIONS, RECOMMEND, TENURE,
)

logger = logging.getLogger(__name__)

SURVEYS = "owner_surveys"

#: Each answer field and the set it must belong to. Free-text fields are absent
#: on purpose — breed and city are validated against their own catalogues by
#: the client, and the note is genuinely free text. `biggest_challenge` is
#: checked separately below — it's a list now, not a single code.
ENUMS = {
    "tenure": TENURE,
    "living_situation": LIVING,
    "hours_alone": ALONE_HOURS,
    "would_recommend": RECOMMEND,
}


def _clean(row: Optional[dict]) -> dict:
    if not row:
        return {}
    row.pop("_id", None)
    created = row.get("created_at")
    if isinstance(created, datetime):
        # Mongo hands back naive datetimes even for aware writes; without the
        # offset the browser reads them as local time and shifts every stamp.
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        row["created_at"] = created.isoformat()
    # Q7 was single-select before multi-select shipped, so rows written earlier
    # hold one code as a bare string. Read them as a one-item list so every
    # consumer — the admin table, the CSV export — sees one consistent shape
    # without a migration touching the stored documents.
    challenge = row.get("biggest_challenge")
    if isinstance(challenge, str):
        row["biggest_challenge"] = [challenge] if challenge else []
    return row


def validate(payload: dict) -> list:
    """Answers outside the known sets are rejected rather than stored.

    A survey is only worth having if the same answer always means the same
    thing; one stray value quietly becomes its own bucket in every count."""
    problems = []
    for field, allowed in ENUMS.items():
        value = payload.get(field)
        if value not in allowed:
            problems.append(f"{field}={value!r} is not one of {', '.join(allowed)}")

    challenges = payload.get("biggest_challenge")
    if not isinstance(challenges, list) or not challenges:
        problems.append("biggest_challenge must be a non-empty list")
    else:
        bad = [c for c in challenges if c not in CHALLENGE]
        if bad:
            problems.append(f"biggest_challenge contains {bad!r}, must be one of {', '.join(CHALLENGE)}")

    satisfaction = payload.get("satisfaction")
    if not isinstance(satisfaction, int) or not 1 <= satisfaction <= 5:
        problems.append("satisfaction must be an integer 1-5")

    for field in ("breed", "city"):
        if not str(payload.get(field) or "").strip():
            problems.append(f"{field} is required")

    return problems


async def submit(db, payload: dict) -> dict:
    """Store one submission and hand back the saved row.

    The respondent label is a running count taken at insert time. It is only a
    display handle until logins exist — `session_id` is the durable key, so a
    verified name and mobile can attach to this exact row later without any
    migration."""
    already = await db[SURVEYS].count_documents({})

    # `recommend_note` only means something for "depends"; storing a stray note
    # against a plain Yes would show up as an unexplained comment in the export.
    note = (payload.get("recommend_note") or "").strip()
    if payload.get("would_recommend") != "depends":
        note = ""

    record = {
        **payload,
        "id": str(uuid.uuid4()),
        "respondent_label": f"Anonymous {already + 1}",
        "recommend_note": note or None,
        "created_at": datetime.now(timezone.utc),
    }
    await db[SURVEYS].insert_one(dict(record))
    logger.info("Owner survey stored: %s (%s, %s)",
                record["respondent_label"], record.get("breed"), record.get("city"))
    return _clean(record)


async def list_all(db, breed: str = None, city: str = None, limit: int = 500) -> list:
    """Newest first, optionally narrowed by breed or city."""
    query = {}
    if breed:
        query["breed"] = {"$regex": breed, "$options": "i"}
    if city:
        query["city"] = {"$regex": city, "$options": "i"}

    cursor = db[SURVEYS].find(query).sort("created_at", -1).limit(limit)
    return [_clean(row) async for row in cursor]


async def stats(db) -> dict:
    """The few counts the admin header shows. Cheap enough to recompute per
    request, so it can never disagree with the table underneath it."""
    total = await db[SURVEYS].count_documents({})
    pipeline = [{"$group": {"_id": "$breed", "n": {"$sum": 1}}}, {"$sort": {"n": -1}}, {"$limit": 1}]
    top = [row async for row in db[SURVEYS].aggregate(pipeline)]

    avg_pipeline = [{"$group": {"_id": None, "avg": {"$avg": "$satisfaction"}}}]
    avg = [row async for row in db[SURVEYS].aggregate(avg_pipeline)]

    return {
        "total": total,
        "top_breed": top[0]["_id"] if top else None,
        "avg_satisfaction": round(avg[0]["avg"], 1) if avg and avg[0].get("avg") else None,
    }


#: Column order for the export — the eight questions in the order they were
#: asked, so the sheet reads like the form.
EXPORT_COLUMNS = [
    ("respondent_label", "Respondent"),
    ("created_at", "Submitted"),
    ("breed", QUESTIONS["breed"]),
    ("city", QUESTIONS["city"]),
    ("climate_zone", "Climate zone"),
    ("tenure", QUESTIONS["tenure"]),
    ("living_situation", QUESTIONS["living_situation"]),
    ("hours_alone", QUESTIONS["hours_alone"]),
    ("satisfaction", QUESTIONS["satisfaction"]),
    ("biggest_challenge", QUESTIONS["biggest_challenge"]),
    ("would_recommend", QUESTIONS["would_recommend"]),
    ("recommend_note", QUESTIONS["recommend_note"]),
]


async def export_csv(db) -> str:
    """Every submission as CSV, with the coded answers spelled out.

    The stored value is a code (`5_8`); the sheet shows the label the owner
    actually read (`5 – 8 hours`). Excel is where someone reads this, not a
    parser, so it gets prose."""
    rows = await list_all(db, limit=100000)

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow([header for _, header in EXPORT_COLUMNS])

    for row in rows:
        line = []
        for field, _ in EXPORT_COLUMNS:
            value = row.get(field)
            # Translate coded answers to the wording the owner saw. A list
            # (Q7's multi-select codes) becomes a "; "-joined list of labels
            # instead of one lookup — plain `in` on a dict can't test a list.
            if field in LABELS:
                if isinstance(value, list):
                    value = "; ".join(LABELS[field].get(v, v) for v in value)
                elif value in LABELS[field]:
                    value = LABELS[field][value]
            line.append("" if value is None else value)
        writer.writerow(line)

    return buffer.getvalue()
