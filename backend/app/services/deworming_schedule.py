"""Deworming schedule — the standard Indian regimen, generated from date of birth.

Indian practice follows the usual puppy-then-lifelong pattern: every 2 weeks
from 2 weeks of age until 12 weeks, monthly until about 6 months, then every 3
months for life. It is generated rather than stored, so it stays correct as the
dog ages without anything to keep in sync.

Only the *next* dose is ever surfaced. Unlike vaccinations there is no
certificate to read, so the app has no way to know whether a past deworming
actually happened — claiming one was "missed" would be inventing a fact. The
schedule tells the owner when the next one is due and stops there.
"""
from datetime import date, timedelta
from typing import Optional

from app.services.health_status import add_months

#: Ages (in weeks) for the puppy course.
PUPPY_WEEKS = (2, 4, 6, 8, 10, 12)
#: Then monthly to roughly six months.
JUVENILE_WEEKS = (16, 20, 24)
#: After that, every three months for life.
ADULT_INTERVAL_MONTHS = 3

LABEL = "Deworming"

#: Key the generated next-dose entry carries on the timeline. It deliberately
#: has no date in it, so hiding it hides deworming for this dog rather than just
#: this one cycle — otherwise "delete" would look like it did nothing next month.
SCHEDULE_KEY = "deworming"


def _course(dob: date) -> list:
    return [dob + timedelta(weeks=w) for w in PUPPY_WEEKS + JUVENILE_WEEKS]


def _interval_after(dob: date, when: date) -> date:
    """The next dose after `when`, at whatever cadence applies at that age."""
    course = _course(dob)
    if when < course[len(PUPPY_WEEKS) - 1]:
        return when + timedelta(weeks=2)
    if when < course[-1]:
        return add_months(when, 1)
    return add_months(when, ADULT_INTERVAL_MONTHS)


def next_due(dob: Optional[date], ref: date, last_recorded: Optional[date] = None) -> Optional[date]:
    """The next deworming, from the last one actually recorded if we have it.

    Without a record this can only be projected from age, and a projected date
    is never called overdue — the app has no idea whether the owner dewormed the
    dog last week. Once a real dose is on file that changes: the next one is one
    cadence interval after it, and if that has passed it genuinely is overdue,
    because now there IS evidence of when the last dose happened."""
    if last_recorded is not None:
        return _interval_after(dob or last_recorded, last_recorded)

    if dob is None:
        return None

    for due in _course(dob):
        if due >= ref:
            return due

    # Past the juvenile course: roll the quarterly cycle forward from its end.
    due = dob + timedelta(weeks=JUVENILE_WEEKS[-1])
    while due < ref:
        due = add_months(due, ADULT_INTERVAL_MONTHS)
    return due


def cadence_for(dob: Optional[date], ref: date) -> str:
    """How often deworming is due at the dog's current age — shown next to the
    reminder so the owner knows why the date is what it is."""
    if dob is None:
        return ""
    course = _course(dob)
    if ref <= course[len(PUPPY_WEEKS) - 1]:
        return "every 2 weeks"
    if ref <= course[-1]:
        return "monthly"
    return "every 3 months"
