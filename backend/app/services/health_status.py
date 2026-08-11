"""Health status engine — the single source of truth for date + status logic.

Nothing about a vaccination's status is ever stored. Every status is derived at
read time from the current date, so a record that was "Upcoming" yesterday
becomes "Due Today" and then "Overdue" on its own, with no job to run and no
date baked into the code.

Two kinds of time live in this feature and they are deliberately different:

* **Timestamps** (`uploaded_at`, `created_at`) are instants. They are stored in
  UTC as timezone-aware datetimes and rendered in the viewer's local timezone by
  the frontend.
* **Calendar dates** (`administration_date`, `due_date`) are days, not instants.
  A shot given on 12 March is on 12 March in every timezone, so they stay plain
  ISO `YYYY-MM-DD` strings and are compared as days.

`frontend/src/utils/healthStatus.js` mirrors these four rules exactly so the UI
recomputes live while a tab is open. The frontend compares against the viewer's
local day and the server against its own UTC day; they only differ for a due
date falling inside the few hours where the two calendars disagree.
"""
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from app.services.ai_processing.validation import parse_iso_date

# Status vocabulary. These strings are part of the API contract.
COMPLETED = "Completed"
DUE_TODAY = "Due Today"
UPCOMING = "Upcoming"
OVERDUE = "Overdue"

#: How far ahead a due date may be and still count as an active reminder.
REMINDER_WINDOW_DAYS = 30


def utc_now() -> datetime:
    """The current instant, timezone-aware and in UTC. Every stored timestamp
    comes from here — never `datetime.utcnow()`, which returns a naive value
    that clients then misread as local time."""
    return datetime.now(timezone.utc)


def today() -> date:
    """The server's current date. The only place 'now' enters status logic."""
    return utc_now().date()


def days_until(due, ref: Optional[date] = None) -> Optional[int]:
    """Whole days from `ref` (default: today) to `due`. Negative when past."""
    parsed = parse_iso_date(due)
    if parsed is None:
        return None
    return (parsed - (ref or today())).days


def due_status(due, ref: Optional[date] = None) -> Optional[str]:
    """Due Today / Upcoming / Overdue for a due date, or None if unparseable."""
    delta = days_until(due, ref)
    if delta is None:
        return None
    if delta == 0:
        return DUE_TODAY
    return UPCOMING if delta > 0 else OVERDUE


def is_active_reminder(due, ref: Optional[date] = None) -> bool:
    """A reminder is active when it is overdue, due today, or due within the
    next `REMINDER_WINDOW_DAYS`. Anything further out is real but not yet worth
    nagging about, and completed doses never reach here at all."""
    delta = days_until(due, ref)
    if delta is None:
        return False
    return delta <= REMINDER_WINDOW_DAYS


#: Reminder ordering: what needs attention now, then what was missed, then what
#: is coming. Within a bucket, the nearest due date first.
_REMINDER_RANK = {DUE_TODAY: 0, OVERDUE: 1, UPCOMING: 2}


def reminder_sort_key(reminder: dict):
    return (_REMINDER_RANK.get(reminder.get("status"), 3), reminder.get("due_date") or "")


def add_months(start: date, months: int) -> date:
    """`start` shifted by whole months, clamped to the end of the target month
    (29 Feb + 12 months -> 28 Feb). Used for booster intervals."""
    month_index = start.month - 1 + months
    year = start.year + month_index // 12
    month = month_index % 12 + 1
    next_month_start = date(year + (month == 12), (month % 12) + 1, 1)
    last_day = (next_month_start - timedelta(days=1)).day
    return date(year, month, min(start.day, last_day))


def iso(value: Optional[date]) -> Optional[str]:
    return value.isoformat() if value else None
