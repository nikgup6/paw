"""Dismissals — hiding a generated schedule entry the owner doesn't want.

Most things on the timeline are rows: a shot that was recorded, a reminder that
was typed in. Deleting those deletes a row. But the standard-schedule doses and
the projected boosters aren't stored anywhere — they're computed from the dog's
date of birth every time the page loads, so there is nothing to delete and they
would simply reappear.

This is the store that makes them deletable: dismissing one records its stable
key against the dog, and the timeline skips it from then on. Nothing is
destroyed, so a dismissal can be undone — which matters, because the thing being
hidden is a vaccination the schedule says is owed.
"""
import logging
import uuid

from app.services.health_status import utc_now

DISMISSALS = "schedule_dismissals"

logger = logging.getLogger(__name__)


async def list_keys(db, dog_id: str) -> set:
    """The schedule keys this dog has hidden."""
    cursor = db[DISMISSALS].find({"dog_id": dog_id}, {"entry_key": 1})
    return {row["entry_key"] async for row in cursor}


async def count(db, dog_id: str) -> int:
    return await db[DISMISSALS].count_documents({"dog_id": dog_id})


async def dismiss(db, dog_id: str, entry_key: str) -> dict:
    """Hide one generated entry. Idempotent — dismissing twice is not an error."""
    existing = await db[DISMISSALS].find_one({"dog_id": dog_id, "entry_key": entry_key})
    if existing:
        existing.pop("_id", None)
        return existing
    row = {
        "id": str(uuid.uuid4()),
        "dog_id": dog_id,
        "entry_key": entry_key,
        "created_at": utc_now(),
    }
    await db[DISMISSALS].insert_one(dict(row))
    logger.info("Dismissed schedule entry %s for dog %s", entry_key, dog_id)
    return row


async def restore_all(db, dog_id: str) -> int:
    """Bring every hidden entry back."""
    result = await db[DISMISSALS].delete_many({"dog_id": dog_id})
    return result.deleted_count
