"""Reminder Service — generates, prunes and lists vaccination reminders.

A reminder is only ever about a dose that is still owed. It is created for a
valid, reminder-eligible vaccination that isn't flagged for review, it is
retired the moment a later shot covers it, and it is only *shown* while it is
actually actionable — overdue, due today, or due within the next 30 days.
Completed doses therefore never appear here.

Status is derived from the due date at read time (services/health_status.py);
nothing about "when" is stored on the reminder beyond its due date.
"""
import logging

from app.models.reminder import Reminder
from app.services import vaccination_schedule as schedule
from app.services.ai_processing.validation import is_reminder_eligible
from app.services.health_status import (
    due_status, days_until, is_active_reminder, reminder_sort_key, today as server_today,
)

logger = logging.getLogger(__name__)

REMINDERS = "reminders"
VACCINATIONS = "vaccinations"

#: How a timeline entry's category reads on a reminder. Anti-rabies is called
#: out separately because it is the one shot with a legal weight behind it.
CATEGORY_LABELS = {"vaccine": "Vaccination", "rabies": "Anti-Rabies", "deworming": "Deworming"}
REMINDER_KINDS = {"vaccine": "vaccination", "rabies": "vaccination", "deworming": "deworming"}


async def generate_for(db, dog_id: str, vaccinations: list) -> list:
    """Create reminders for the given (already-saved) vaccination dicts. Skips
    review-flagged, ineligible, and already-reminded ones. Returns those created."""
    created = []
    for vax in vaccinations:
        if vax.get("needs_review"):
            continue
        if not is_reminder_eligible(vax):
            continue
        if await db[REMINDERS].find_one({"vaccination_id": vax["id"]}):
            continue  # no duplicate reminders
        reminder = Reminder(
            dog_id=dog_id,
            vaccination_id=vax["id"],
            source_document_id=vax.get("source_document_id"),
            vaccine_name=vax.get("vaccine_name"),
            due_date=vax.get("due_date"),
        )
        await db[REMINDERS].insert_one(reminder.dict())
        created.append(reminder.dict())
    return created


async def prune_completed(db, dog_id: str) -> int:
    """Drop reminders whose dose has since been given, and any whose vaccination
    has gone away. Returns how many were removed.

    This is what makes "the reminder disappears once the vaccine is completed"
    automatic: uploading the next certificate is enough, no user action and no
    scheduled job. Run after anything that adds or edits vaccinations."""
    reminders = [r async for r in db[REMINDERS].find({"dog_id": dog_id})]
    if not reminders:
        return 0

    records = [r async for r in db[VACCINATIONS].find({"dog_id": dog_id})]
    by_id = {r.get("id"): r for r in records}

    stale = []
    for reminder in reminders:
        source = by_id.get(reminder.get("vaccination_id"))
        if source is None:
            stale.append(reminder["id"])          # its vaccination was deleted
            continue
        families = schedule.families_of(reminder.get("vaccine_name")) \
            or schedule.families_of(source.get("vaccine_name"))
        covered = any(
            schedule.is_fulfilled_by(reminder.get("due_date"), family, records,
                                     after=source.get("administration_date"))
            for family in families
        )
        if covered:
            stale.append(reminder["id"])

    if stale:
        await db[REMINDERS].delete_many({"id": {"$in": stale}})
        logger.info("Pruned %d completed/orphaned reminder(s) for dog %s", len(stale), dog_id)
    return len(stale)


async def list_for(db, dog_id: str, dog: dict = None) -> list:
    """Every active reminder for one dog, ordered Due Today -> Overdue -> Upcoming.

    Two sources are merged here, and both are scoped to this dog:

    * **The health timeline** — vaccinations, anti-rabies, boosters and
      deworming, derived from the merged timeline rather than read straight out
      of the `reminders` collection, because a dose can be owed for two reasons:
      a due date printed on a certificate, or the standard schedule for the
      dog's age. A puppy whose owner hasn't uploaded anything yet still needs
      chasing. Deriving also makes the hard rules automatic: a completed dose
      stops producing a due entry, so it can never appear here, with no
      reconciliation step — and hiding an entry on the Vaccines page removes its
      reminder in the same breath.
    * **Custom** — whatever the owner made themselves.

    Anything further out than the window is left out; overdue always shows.

    The stored `reminders` rows remain the durable, per-vaccination record (and
    the hook a future notification job will read); `prune_completed` keeps them
    honest, and it runs here so both views agree."""
    from app.services import timeline_service   # deferred: timeline imports nothing from us
    from app.services import custom_reminder_service

    await prune_completed(db, dog_id)

    ref = server_today()
    out = []

    def add(**fields):
        due = fields.get("due_date")
        if not is_active_reminder(due, ref):
            return                        # further out than the window, or undated
        out.append({
            **fields,
            "dog_id": dog_id,
            "status": due_status(due, ref),
            "days_until_due": days_until(due, ref),
        })

    # 1. Vaccinations, boosters and deworming — all three come off the one
    #    timeline, which is also what the Vaccines page renders, so a dose can
    #    never be owed in one place and settled in the other. The entry's own
    #    category decides how the reminder is labelled.
    records = await timeline_service.build_health_records(db, dog_id, dog)
    for entry in records["overdue"] + records["due_today"] + records["upcoming"]:
        category = entry.get("category") or timeline_service.CAT_VACCINE
        add(id=entry["key"], kind=REMINDER_KINDS.get(category, "vaccination"),
            category=CATEGORY_LABELS.get(category, "Vaccination"),
            title=entry.get("vaccine_name"), vaccine_name=entry.get("vaccine_name"),
            dose_label=entry.get("dose_label"), source=entry.get("source"),
            vaccination_id=entry.get("vaccination_id"),
            source_document_id=entry.get("source_document_id"),
            last_administered=entry.get("last_administered"),
            due_date=entry.get("due_date"), editable=False)

    # 2. The owner's own reminders.
    for reminder in await custom_reminder_service.list_for(db, dog_id):
        add(id=reminder["id"], kind="custom", category=reminder.get("category"),
            title=reminder.get("title"), notes=reminder.get("notes"),
            due_time=reminder.get("due_time"), recurrence=reminder.get("recurrence"),
            source="owner", due_date=reminder.get("due_date"), editable=True)

    out.sort(key=reminder_sort_key)
    return out


async def delete_for_document(db, document_id: str) -> None:
    await db[REMINDERS].delete_many({"source_document_id": document_id})


async def delete_for_vaccinations(db, vaccination_ids: list) -> None:
    if vaccination_ids:
        await db[REMINDERS].delete_many({"vaccination_id": {"$in": vaccination_ids}})
