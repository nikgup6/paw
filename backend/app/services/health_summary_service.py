"""Health Summary Service — the read model behind the Overview page.

The Overview is a medical dashboard, not another list, so this composes one
payload from the other services rather than making the client fan out to five
endpoints and stitch them together. Everything is scoped to a single dog, and
nothing here is stored — it is recomputed per request from the same sources the
detail pages use, so the summary can never disagree with them.
"""
from app.services import (
    custom_reminder_service, health_vault_service, reminder_service, timeline_service,
)
from app.services.health_status import COMPLETED, DUE_TODAY, OVERDUE, UPCOMING, iso, today as server_today

#: How many rows each "recent" strip carries. Enough to be useful, few enough
#: that the page stays a summary.
RECENT_LIMIT = 3


async def build(db, dog_id: str, dog: dict) -> dict:
    records = await timeline_service.build_health_records(db, dog_id, dog)
    raw_vaccinations = await timeline_service.load_records(db, dog_id)
    documents = await health_vault_service.list_documents(db, dog_id)
    prescriptions = await health_vault_service.list_prescriptions(db, dog_id)
    reminders = await reminder_service.list_for(db, dog_id, dog)
    reminder_log = await custom_reminder_service.list_all(db, dog_id)

    by_status = {status: 0 for status in (DUE_TODAY, OVERDUE, UPCOMING)}
    for reminder in reminders:
        by_status[reminder["status"]] = by_status.get(reminder["status"], 0) + 1

    needs_review = [d for d in documents if d.get("processing_status") == "Needs Review"]
    failed = [d for d in documents if d.get("processing_status") == "Failed"]

    # Deworming shares the timeline but is counted on its own — the vaccination
    # tiles have to mean vaccinations.
    vax = timeline_service.vaccination_counts(records)

    return {
        "today": iso(server_today()),
        "dog": dog,
        "health": {
            "vaccinations_completed": vax["completed"],
            "vaccinations_due_today": vax["due_today"],
            "vaccinations_upcoming": vax["upcoming"],
            "vaccinations_overdue": vax["overdue"],
            "dewormings": records["category_counts"]["deworming"],
            "documents": len(documents),
            "prescriptions": len(prescriptions),
            "active_reminders": len(reminders),
            "needs_review": len(needs_review),
            "failed_scans": len(failed),
            "has_schedule": records["has_schedule"],
        },
        "reminders_by_status": by_status,
        # Named "vaccinations", so they hold vaccinations. A deworming that is
        # due still reaches the owner — it is a reminder like any other.
        "upcoming_vaccinations": _shots(records["due_today"] + records["upcoming"]),
        "overdue_vaccinations": _shots(records["overdue"]),
        # For the Dashboard's tap-to-expand vaccination tiles specifically —
        # deliberately UNCAPPED (recent_reminders etc. above cut to
        # RECENT_LIMIT=3, which is right for a "recent activity" strip but
        # would make a tile reading "7 upcoming" expand to only 3 names).
        # "Due" merges overdue + due-today into one urgent bucket, matching
        # the single blinking tile shown for both — a shot overdue by a week
        # and one due today are both "needs action now," and splitting them
        # into two tiles doesn't change what the owner has to do about either.
        # Same non-deworming filter as the tile COUNTS above (vax, not
        # vax+worming), so a tile's number always matches the length of the
        # list it expands to.
        "vaccination_tiles": {
            "completed": _shots_all(records["completed"]),
            "due": _shots_all(records["overdue"] + records["due_today"]),
            "upcoming": _shots_all(records["upcoming"]),
        },
        "recent_documents": documents[:RECENT_LIMIT],
        "recent_prescriptions": prescriptions[:RECENT_LIMIT],
        "recent_reminders": reminders[:RECENT_LIMIT],
        "deworming": _deworming(records),
        "categories": timeline_service.category_breakdown(records),
        "recent_activity": _activity(raw_vaccinations, prescriptions, reminder_log),
    }


def _deworming(records: dict) -> dict:
    """The deworming block: the last few doses given, and the one still owed.

    Deworming runs on its own cadence and has its own evidence — a tablet name
    and a dose written beside a date — so it gets its own summary rather than
    being folded into the vaccination lists, where "12 vaccinations done" would
    quietly start counting worming tablets."""
    from app.services import deworming_schedule

    def mine(entries):
        return [e for e in entries if e.get("category") == timeline_service.CAT_DEWORMING]

    given = mine(records["completed"])
    due = mine(records["overdue"] + records["due_today"] + records["upcoming"])
    return {
        "recent": given[:RECENT_LIMIT],
        "next": due[0] if due else None,
        "total": len(given),
        # Hidden by the owner rather than absent — an empty card that blames a
        # missing date of birth when they hid the row themselves is a lie.
        "hidden": deworming_schedule.SCHEDULE_KEY in set(records.get("dismissed_keys") or ()),
    }


def _shots(entries: list) -> list:
    return [e for e in entries
            if e.get("category") != timeline_service.CAT_DEWORMING][:RECENT_LIMIT]


def _shots_all(entries: list) -> list:
    """Same non-deworming filter as `_shots`, without the RECENT_LIMIT cut."""
    return [e for e in entries if e.get("category") != timeline_service.CAT_DEWORMING]


def _activity(vaccinations, prescriptions, reminder_log) -> list:
    """A chronological feed of what has actually happened to this dog's own
    records — vaccinations logged, prescriptions added, reminders ticked off.

    Every entry is read straight from its live collection rather than a document
    upload event, and nothing here is stored — so deleting a vaccination or a
    reminder in its own section removes it from this feed on the very next read,
    with no separate cleanup step. Document uploads themselves stay off this
    list; "Recent documents" already covers those, and a document surviving the
    deletion of what was read off it is correct, not an activity to relive."""
    feed = []

    for vax in vaccinations[:RECENT_LIMIT * 2]:
        if vax.get("needs_review"):
            continue   # not confirmed yet — not something to tout as done
        if not vax.get("administration_date"):
            continue   # a pending next-dose hasn't happened; it isn't activity
        feed.append({
            "kind": "vaccination",
            "title": vax.get("vaccine_name") or "Vaccination recorded",
            "detail": vax.get("clinic_name") or vax.get("veterinarian") or "Vaccination",
            "at": vax.get("created_at"),
        })

    for rx in prescriptions[:RECENT_LIMIT]:
        feed.append({
            "kind": "prescription",
            "title": rx.get("summary") or "Prescription added",
            "detail": rx.get("clinic_name") or rx.get("doctor") or "",
            "at": rx.get("created_at"),
        })

    for reminder in reminder_log:
        if reminder.get("completed_at"):
            feed.append({
                "kind": "reminder",
                "title": f"{reminder.get('title')} marked done",
                "detail": reminder.get("category") or "",
                "at": reminder.get("completed_at"),
            })
        else:
            feed.append({
                "kind": "reminder",
                "title": f"{reminder.get('title')} added",
                "detail": reminder.get("category") or "",
                "at": reminder.get("created_at"),
            })

    feed.sort(key=lambda item: str(item.get("at") or ""), reverse=True)
    return feed[:6]
