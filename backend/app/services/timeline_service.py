"""Vaccination Timeline Service — a READ-ONLY projection of a dog's health records.

The `vaccinations` collection is the single source of truth for what a dog has
actually had; `vaccination_schedule` supplies what it *should* have. This service
merges the two and groups the result into the three sections the UI shows —
Completed, Upcoming (incl. Due Today) and Overdue.

It never writes, and nothing it returns is stored: every status is recomputed
from the current date on each call, so the timeline is correct whenever it is
asked for without a job to keep it fresh.

Each entry is one *dose*, not one record, which is what keeps the sections
unambiguous:

* a shot that was given produces a `given` entry (always Completed);
* a shot that is still owed — the follow-up printed on a certificate, a puppy
  dose from the schedule, or a projected annual booster — produces a `due`
  entry, judged purely on its due date.
"""
from datetime import date, timedelta
from typing import List, Optional

from app.services import vaccination_schedule as schedule
from app.services.ai_processing.validation import parse_iso_date
from app.services.health_status import (
    COMPLETED, DUE_TODAY, OVERDUE, UPCOMING,
    days_until, due_status, iso, today as server_today,
)

VACCINATIONS = "vaccinations"

#: Two due dates for the same vaccine this close together are the same visit,
#: not two separate doses.
SAME_APPOINTMENT_DAYS = 30


# ------------------------------ record loading ------------------------------ #

def _normalise(vax: dict) -> dict:
    """Tolerate the legacy field names so older rows still render."""
    vax.pop("_id", None)
    vax.setdefault("administration_date", vax.get("date_given"))
    vax.setdefault("due_date", vax.get("next_due"))
    return vax


async def load_records(db, dog_id: str) -> List[dict]:
    cursor = db[VACCINATIONS].find({"dog_id": dog_id}).sort("created_at", -1)
    return [_normalise(vax) async for vax in cursor]


async def build(db, dog_id: str) -> List[dict]:
    """Flat list of stored vaccination records with a live status attached.

    Kept for the `/vaccinations` endpoint (and its legacy alias) — the grouped
    Health Records view uses `build_health_records` instead."""
    records = await load_records(db, dog_id)
    ref = server_today()
    for vax in records:
        vax["status"] = COMPLETED if vax.get("administration_date") else (due_status(vax.get("due_date"), ref) or COMPLETED)
        vax["days_until_due"] = days_until(vax.get("due_date"), ref)
    return records


# -------------------------------- categories -------------------------------- #
# The three groups the owner filters by. Rabies is split out from the other
# vaccines because that is how an Indian booklet is laid out — "Anti Rabies" is
# its own titled section, tracked and boosted separately — and deworming is a
# medicine on its own cadence rather than a vaccine at all.
CAT_RABIES = "rabies"
CAT_VACCINE = "vaccine"
CAT_DEWORMING = "deworming"


def _category(vaccine_name: Optional[str], *, family: Optional[str] = None,
              deworming: bool = False) -> str:
    if deworming:
        return CAT_DEWORMING
    if family == schedule.RABIES or schedule.RABIES in schedule.families_of(vaccine_name):
        return CAT_RABIES
    return CAT_VACCINE


# --------------------------------- entries ---------------------------------- #

def _given_entry(record: dict, family: Optional[str]) -> dict:
    return {
        "key": f"given:{record.get('id')}",
        "kind": "given",
        "source": "record",
        "status": COMPLETED,
        "family": family,
        "vaccine_name": record.get("vaccine_name") or "Vaccination",
        "dose_label": None,
        "core": True,
        "administration_date": record.get("administration_date"),
        "due_date": record.get("due_date"),
        "days_until_due": None,
        "booster_interval": record.get("booster_interval"),
        "manufacturer": record.get("manufacturer"),
        "batch_number": record.get("batch_number"),
        "veterinarian": record.get("veterinarian"),
        "clinic_name": record.get("clinic_name"),
        "vaccination_id": record.get("id"),
        "source_document_id": record.get("source_document_id"),
        "needs_review": bool(record.get("needs_review")),
        "confidence_score": record.get("confidence_score"),
        "confidence_notes": record.get("confidence_notes"),
        "category": _category(record.get("vaccine_name"), family=family,
                              deworming=bool(record.get("_deworming"))),
        "dose": record.get("dose"),
        #: Recorded off the vial for provenance only — never a schedule date.
        "product_expiry_date": record.get("product_expiry_date"),
        #: The dose was given, but the card never said when the next one is due.
        #: That is genuinely unknown rather than "nothing needed", and the
        #: scanner is forbidden from inventing a date, so it has to be visible —
        #: otherwise a dog with no follow-up on file looks identical to one
        #: that is fully up to date.
        "next_due_known": bool(parse_iso_date(record.get("due_date"))),
    }


def _due_entry(key: str, vaccine_name: str, due: Optional[str], ref: date, *,
               source: str, family: Optional[str] = None, dose_label: Optional[str] = None,
               core: bool = True, record: Optional[dict] = None,
               deworming: bool = False) -> dict:
    base = record or {}
    return {
        "key": key,
        "kind": "due",
        "source": source,
        "status": due_status(due, ref),
        "family": family,
        "vaccine_name": vaccine_name,
        "dose_label": dose_label,
        "core": core,
        "administration_date": None,
        "due_date": due,
        "days_until_due": days_until(due, ref),
        "booster_interval": base.get("booster_interval") or (schedule.BOOSTER_INTERVAL_LABEL if source == "schedule" and dose_label == "Annual booster" else None),
        "manufacturer": None,
        "batch_number": None,
        "veterinarian": None,
        "clinic_name": None,
        "vaccination_id": base.get("id"),
        "source_document_id": base.get("source_document_id"),
        "needs_review": False,
        "confidence_score": None,
        "category": _category(vaccine_name, family=family, deworming=deworming),
    }


# ----------------------------- the merged timeline -------------------------- #

async def build_health_records(db, dog_id: str, dog: Optional[dict] = None) -> dict:
    """The grouped Health Records Center payload for one dog."""
    from app.services import schedule_dismissal_service

    records = await load_records(db, dog_id)
    dismissed = await schedule_dismissal_service.list_keys(db, dog_id)
    ref = server_today()
    entries: List[dict] = []

    # Records the AI is unsure about are shown, but they neither satisfy a
    # scheduled dose nor create anything due until the owner confirms them.
    confirmed = [r for r in records if not r.get("needs_review")]

    # 1. Everything that has actually been given.
    for record in records:
        fams = schedule.families_of(record.get("vaccine_name"))
        if record.get("administration_date"):
            entries.append(_given_entry(record, next(iter(sorted(fams)), None)))

    # 2. Follow-ups printed on the certificates, unless a later shot covered them.
    for record in confirmed:
        due = record.get("due_date")
        if not due or not parse_iso_date(due):
            continue
        fams = schedule.families_of(record.get("vaccine_name"))
        fulfilled = any(
            schedule.is_fulfilled_by(due, family, confirmed, after=record.get("administration_date"))
            for family in fams
        )
        if fulfilled:
            continue
        entries.append(_due_entry(
            f"due:{record.get('id')}", record.get("vaccine_name") or "Vaccination", due, ref,
            source="record", family=next(iter(sorted(fams)), None), dose_label="Next dose", record=record,
        ))

    # 3. The standard course, for whatever the records don't already cover.
    dob = schedule.parse_dob(dog)
    if dob:
        entries.extend(_schedule_entries(dob, (dog or {}).get("breed"), confirmed, entries, ref))

    # 4. Deworming. A separate collection and a separate cadence, but it belongs
    #    on the same timeline — the owner reads it off the same booklet page.
    entries.extend(await _deworming_entries(db, dog_id, dob, ref))

    # A dog with nothing on file yet starts clean.
    #
    # The schedule is generated from date of birth alone, so the moment a
    # profile is saved every dose that fell before today is technically past
    # its date — a 3-year-old showed 3 overdue vaccines and a 4-month-old
    # showed 7, before the owner had uploaded anything at all. That is an
    # accusation the data cannot support: with no records we do not know
    # whether those shots were given, and most owners adding an adult dog have
    # a booklet full of them.
    #
    # So past-dated *generated* doses are withheld until there is at least one
    # vaccination record to reason from. Future doses still show, so the
    # schedule is not lost — only the claim that the dog is behind. As soon as
    # anything is uploaded the normal overdue logic resumes, and doses read off
    # a certificate are never affected because those come from evidence.
    if not records:
        entries = [
            e for e in entries
            if not (e["source"] == "schedule"
                    and e["status"] == OVERDUE
                    and e.get("category") != CAT_DEWORMING)
        ]

    # Generated entries the owner has hidden never make it out of here — which
    # also removes their reminders, since those are derived from this list.
    entries = [e for e in entries if e["key"] not in dismissed]

    grouped = _group(entries, ref, dob)
    grouped["dismissed_count"] = len(dismissed)
    # Which ones, not just how many: a page that has nothing to show needs to
    # say whether that's because there is nothing, or because the owner hid it.
    grouped["dismissed_keys"] = sorted(dismissed)
    return grouped


def _schedule_entries(dob: date, breed: Optional[str], records: List[dict],
                      existing: List[dict], ref: date) -> List[dict]:
    course = schedule.course_for(breed)
    out: List[dict] = []

    # Due dates the certificates already name, per family. The vet's own "next
    # due" and the scheduled dose it corresponds to are the same appointment, so
    # whenever the two land close together the certificate wins and the
    # scheduled copy is dropped.
    pending_dates: dict = {}
    for entry in existing:
        if entry["kind"] == "due" and entry.get("family"):
            due = parse_iso_date(entry.get("due_date"))
            if due:
                pending_dates.setdefault(entry["family"], []).append(due)
    pending_families = set(pending_dates)

    course_end = schedule.primary_course_end(dob, course)
    adult_cutoff = course_end + timedelta(weeks=schedule.ADULT_COLLAPSE_WEEKS)
    past_course = ref > adult_cutoff

    for family in _families_in(course):
        fam_doses = sorted([d for d in course if d.family == family], key=lambda d: d.age_weeks)
        fam_records = sorted(
            [r for r in records if family in schedule.families_of(r.get("vaccine_name"))
             and parse_iso_date(r.get("administration_date"))],
            key=lambda r: r["administration_date"],
        )
        core = family in schedule.CORE_FAMILIES

        # While the dog is still inside its primary-course window, doses are
        # matched to shots in order: the 1st recorded DHPPi satisfies the 1st
        # scheduled DHPPi, and so on.
        unmatched = fam_doses[len(fam_records):]

        # Once that window is well past, the puppy series stops being a useful
        # checklist. An adult that has *some* record of this vaccine is under a
        # vet's care and only needs its boosters tracked — listing "2nd puppy
        # dose overdue" against a shot given at eight months old would be noise.
        # An adult with no record of it at all gets one actionable item instead
        # of five stale ones.
        collapsed = core and past_course and not fam_records and bool(unmatched)
        skip_puppy_doses = past_course and bool(fam_records)

        if collapsed:
            first = fam_doses[0]
            out.append(_due_entry(
                f"schedule:{family}:primary", schedule.FAMILY_LABELS[family],
                iso(schedule.due_date_for(dob, first)), ref,
                source="schedule", family=family, dose_label="Primary course", core=True,
            ))
        elif not skip_puppy_doses:
            absorbed = _absorbed_by_certificates(dob, unmatched, pending_dates.get(family, ()))
            for index, dose in enumerate(unmatched):
                due = schedule.due_date_for(dob, dose)
                # Non-core shots are tracked when given but never chased: an
                # Indian dog without a coronavirus shot isn't behind on anything.
                if not dose.core and due < ref:
                    continue
                if index in absorbed:
                    continue    # the certificate already names this appointment
                out.append(_due_entry(
                    f"schedule:{family}:{dose.age_weeks}", dose.vaccine_name, iso(due), ref,
                    source="schedule", family=family, dose_label=dose.label, core=dose.core,
                ))

        # Annual booster — only once the primary series is behind the dog, and
        # only when the certificates don't already name the next date. A dog
        # whose primary course is still outstanding isn't due a booster yet.
        if not core or collapsed or family in pending_families:
            continue
        series_done = len(fam_records) >= len(fam_doses)
        if not (series_done or skip_puppy_doses):
            continue
        anchor = (parse_iso_date(fam_records[-1]["administration_date"]) if fam_records
                  else schedule.due_date_for(dob, fam_doses[-1]))
        if anchor > ref:
            continue
        booster_due = schedule.next_booster_date(anchor, ref)
        if schedule.is_fulfilled_by(iso(booster_due), family, records):
            continue
        out.append(_due_entry(
            f"schedule:{family}:booster", schedule.FAMILY_LABELS[family], iso(booster_due), ref,
            source="schedule", family=family, dose_label="Annual booster", core=True,
        ))

    return out


async def _deworming_entries(db, dog_id: str, dob: Optional[date], ref: date) -> List[dict]:
    """Recorded dewormings, plus the next one that's owed.

    Dewormings never take part in the vaccination schedule matching — no vaccine
    family, no booster projection — so they are built here rather than threaded
    through that logic. The projected next dose counts from the last one on file
    when there is one, and falls back to the dog's age when there isn't."""
    from app.services import deworming_schedule, deworming_service

    rows = await deworming_service.list_for(db, dog_id)
    entries: List[dict] = []
    last = parse_iso_date(await deworming_service.latest_administered(db, dog_id))

    stated = None      # the newest next-due the booklet itself names, if any
    for row in rows:
        row = dict(row, _deworming=True,
                   vaccine_name=row.get("product_name") or deworming_schedule.LABEL)
        if row.get("administration_date"):
            entries.append(_given_entry(row, None))
        # A dewormer's next date is written beside the dose that was given, so
        # unlike a vaccination it usually rides on an administered row. Only the
        # ones a later dose hasn't already answered are still owed, and of those
        # the latest is the live one — a quarterly tablet has exactly one "next".
        due = parse_iso_date(row.get("due_date"))
        if due and (last is None or due > last) and (stated is None or due > stated[0]):
            stated = (due, row)

    if stated is not None:
        due, row = stated
        entries.append(_due_entry(
            deworming_schedule.SCHEDULE_KEY, row["vaccine_name"], iso(due), ref,
            source="record", dose_label="Next dose", record=row, deworming=True))
    else:
        # Nothing on file says when — project it from the last dose, or from the
        # dog's age when there isn't one.
        due = deworming_schedule.next_due(dob, ref, last)
        if due:
            entries.append(_due_entry(
                deworming_schedule.SCHEDULE_KEY, deworming_schedule.LABEL, iso(due), ref,
                # Counted from a dose actually on file vs. projected from age —
                # only the former can honestly be called missed.
                source="record" if last else "schedule",
                dose_label=deworming_schedule.cadence_for(dob, ref), deworming=True))

    for entry in entries:
        if entry["kind"] == "due":
            entry["last_administered"] = iso(last)
    return entries


def _absorbed_by_certificates(dob: date, doses: List, named_dates) -> set:
    """Indices of scheduled doses that a vet's own "next due" already covers.

    Each named date claims the single nearest scheduled dose, and only that one —
    matching everything inside the window would swallow the doses that genuinely
    come after it."""
    absorbed = set()
    for named in sorted(named_dates):
        best = None
        for index, dose in enumerate(doses):
            if index in absorbed:
                continue
            delta = abs((schedule.due_date_for(dob, dose) - named).days)
            if delta <= SAME_APPOINTMENT_DAYS and (best is None or delta < best[0]):
                best = (delta, index)
        if best is not None:
            absorbed.add(best[1])
    return absorbed


def _families_in(course) -> List[str]:
    seen = []
    for dose in course:
        if dose.family not in seen:
            seen.append(dose.family)
    return seen


def _group(entries: List[dict], ref: date, dob: Optional[date]) -> dict:
    completed = [e for e in entries if e["status"] == COMPLETED]
    due_today = [e for e in entries if e["status"] == DUE_TODAY]
    upcoming = [e for e in entries if e["status"] == UPCOMING]
    overdue = [e for e in entries if e["status"] == OVERDUE]

    completed.sort(key=lambda e: e.get("administration_date") or "", reverse=True)  # newest first
    upcoming.sort(key=lambda e: e.get("due_date") or "")                            # soonest first
    overdue.sort(key=lambda e: e.get("due_date") or "")                             # longest overdue first
    due_today.sort(key=lambda e: e.get("vaccine_name") or "")

    return {
        "today": iso(ref),
        "dob": iso(dob),
        "has_schedule": dob is not None,
        "completed": completed,
        "due_today": due_today,
        "upcoming": upcoming,
        "overdue": overdue,
        "counts": {
            "completed": len(completed),
            "due_today": len(due_today),
            "upcoming": len(upcoming),
            "overdue": len(overdue),
        },
        "category_counts": {
            category: sum(1 for e in entries if e.get("category") == category)
            for category in (CAT_VACCINE, CAT_RABIES, CAT_DEWORMING)
        },
    }


def category_breakdown(grouped: dict) -> dict:
    """Done vs still owed, for each of the three groups.

    The whole point of splitting them is that "you're covered" is a different
    answer for each: an adult can be current on rabies and years behind on its
    worming. One number per group, plus what's outstanding behind it."""
    pending_sections = grouped["overdue"] + grouped["due_today"] + grouped["upcoming"]
    return {
        category: {
            "completed": sum(1 for e in grouped["completed"] if e.get("category") == category),
            "pending": sum(1 for e in pending_sections if e.get("category") == category),
        }
        for category in (CAT_VACCINE, CAT_RABIES, CAT_DEWORMING)
    }


def vaccination_counts(grouped: dict) -> dict:
    """The four section counts with deworming left out.

    "12 vaccinations completed" has to mean vaccinations. Deworming shares the
    timeline so the owner reads it in one place, but a dewormer is not a shot,
    and letting it inflate that number would make the Overview quietly wrong."""
    return {
        section: sum(1 for e in grouped[section] if e.get("category") != CAT_DEWORMING)
        for section in ("completed", "due_today", "upcoming", "overdue")
    }
