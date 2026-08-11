"""Deworming records — what the booklet says was actually given.

Separate from the generated schedule (deworming_schedule.py), which only knows
what *should* happen from the dog's age. This is the evidence side: doses read
off a health booklet, each with the dose notation written beside the date.
"""
from typing import Optional

from app.services.ai_processing.validation import parse_iso_date

DEWORMINGS = "dewormings"


async def list_for(db, dog_id: str) -> list:
    """This dog's recorded dewormings, newest first."""
    cursor = db[DEWORMINGS].find({"dog_id": dog_id})
    rows = [row async for row in cursor]
    for row in rows:
        row.pop("_id", None)
    rows.sort(key=lambda r: r.get("administration_date") or "", reverse=True)
    return rows


async def latest_administered(db, dog_id: str) -> Optional[str]:
    """The most recent confirmed deworming date, as ISO, or None.

    Review-flagged rows are excluded: an ambiguous date the scanner couldn't
    read is not evidence a dose was given, and treating it as one would move the
    next due date on a guess."""
    latest = None
    async for row in db[DEWORMINGS].find({"dog_id": dog_id}):
        if row.get("needs_review"):
            continue
        given = row.get("administration_date")
        if given and parse_iso_date(given) and (latest is None or given > latest):
            latest = given
    return latest
