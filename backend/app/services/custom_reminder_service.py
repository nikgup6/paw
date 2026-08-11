"""Custom Reminder Service — the reminders an owner makes themselves.

Automatic reminders (vaccinations, boosters, deworming) are derived from the
schedules; these are the ones the owner types in: give the 8pm tablet, book the
grooming appointment, trim nails on Sunday. Same status rules, same dog
scoping, stored in their own collection so generated and hand-made reminders
never overwrite each other.
"""
import logging
from datetime import timedelta

from app.models.custom_reminder import CustomReminder, Recurrence
from app.services.ai_processing.validation import parse_iso_date
from app.services.health_status import add_months, iso, utc_now

logger = logging.getLogger(__name__)

CUSTOM_REMINDERS = "custom_reminders"

#: How far each recurrence advances the due date when the owner ticks it off.
_STEP = {
    Recurrence.DAILY.value: lambda d: d + timedelta(days=1),
    Recurrence.WEEKLY.value: lambda d: d + timedelta(weeks=1),
    Recurrence.MONTHLY.value: lambda d: add_months(d, 1),
    Recurrence.QUARTERLY.value: lambda d: add_months(d, 3),
    Recurrence.YEARLY.value: lambda d: add_months(d, 12),
}


def _clean(row):
    if row:
        row.pop("_id", None)
    return row


def validate(payload: dict) -> list:
    issues = []
    if not (payload.get("title") or "").strip():
        issues.append("a title")
    if parse_iso_date(payload.get("due_date")) is None:
        issues.append("a valid due date")
    return issues


async def list_for(db, dog_id: str) -> list:
    """This dog's open reminders. Completed one-offs drop out; recurring ones
    stay because completing them just moves the date."""
    cursor = db[CUSTOM_REMINDERS].find({"dog_id": dog_id, "completed": False})
    return [_clean(row) async for row in cursor]


async def list_all(db, dog_id: str) -> list:
    """Everything including closed reminders — used by the activity feed."""
    cursor = db[CUSTOM_REMINDERS].find({"dog_id": dog_id}).sort("updated_at", -1)
    return [_clean(row) async for row in cursor]


async def create(db, dog_id: str, payload: dict) -> dict:
    reminder = CustomReminder(dog_id=dog_id, **payload)
    await db[CUSTOM_REMINDERS].insert_one(reminder.dict())
    return reminder.dict()


async def update(db, reminder_id: str, payload: dict):
    existing = _clean(await db[CUSTOM_REMINDERS].find_one({"id": reminder_id}))
    if not existing:
        return None
    changes = {k: v for k, v in payload.items() if v is not None}
    changes["updated_at"] = utc_now()
    await db[CUSTOM_REMINDERS].update_one({"id": reminder_id}, {"$set": changes})
    existing.update(changes)
    return existing


async def complete(db, reminder_id: str):
    """Tick a reminder off.

    A one-off closes. A recurring one advances to its next occurrence and stays
    open — and it advances past today even if it was badly overdue, so ticking
    off a forgotten weekly task doesn't immediately show it as due again."""
    reminder = _clean(await db[CUSTOM_REMINDERS].find_one({"id": reminder_id}))
    if not reminder:
        return None

    from app.services.health_status import today as server_today
    now = utc_now()
    step = _STEP.get(reminder.get("recurrence"))
    changes = {"last_completed_date": iso(server_today()), "completed_at": now, "updated_at": now}

    if step is None:
        changes["completed"] = True
    else:
        due = parse_iso_date(reminder.get("due_date")) or server_today()
        due = step(due)
        while due <= server_today():
            due = step(due)
        changes["due_date"] = iso(due)

    await db[CUSTOM_REMINDERS].update_one({"id": reminder_id}, {"$set": changes})
    reminder.update(changes)
    return reminder


async def delete(db, reminder_id: str) -> bool:
    result = await db[CUSTOM_REMINDERS].delete_one({"id": reminder_id})
    return result.deleted_count > 0
