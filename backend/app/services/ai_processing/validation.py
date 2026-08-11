"""Validation of extracted vaccination data — runs before any reminder is created.

A record must be valid AND carry a usable due date to qualify for a reminder.
Anything that fails validation is forced into the Needs-Review path.
"""
from datetime import date, datetime
from typing import Optional, Tuple, List


def parse_iso_date(value) -> Optional[date]:
    """Parse an ISO-ish date string to a date, else None.

    Day-first formats are listed before month-first: this is an India-first
    product and vets here write 07-06-2012 meaning 7 June, so an ambiguous
    pair like 06-07-2012 must resolve day-first, not US-style."""
    if not value:
        return None
    text = str(value).strip()
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%d-%m-%Y", "%d/%m/%Y", "%d %b %Y", "%d %B %Y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def to_iso(value) -> Optional[str]:
    """Normalise any accepted date spelling to ISO `YYYY-MM-DD`, else None.

    Every date crossing the boundary out of the AI layer goes through here.
    The model is asked for DD-MM-YYYY because that is how Indian vaccination
    cards are written and it misreads them least often — but DD-MM-YYYY does
    not sort lexicographically, and the timeline, reminder ordering and
    "days overdue" maths all compare these values as plain strings. Storing
    anything other than ISO silently breaks that ordering rather than
    erroring, so the conversion happens once, here, at the edge."""
    parsed = parse_iso_date(value)
    return parsed.isoformat() if parsed else None


def validate_vaccination(record: dict) -> Tuple[bool, List[str]]:
    """Return (is_valid, issues). A record is valid when it has a vaccine name and
    any present dates are parseable and consistent."""
    issues: List[str] = []

    if not record.get("vaccine_name"):
        issues.append("missing vaccine name")

    admin = record.get("administration_date")
    due = record.get("due_date")
    admin_d = parse_iso_date(admin)
    due_d = parse_iso_date(due)

    if admin and admin_d is None:
        issues.append("unparseable administration date")
    if due and due_d is None:
        issues.append("unparseable due date")
    if admin_d and due_d and due_d < admin_d:
        issues.append("due date is before administration date")

    return (len(issues) == 0, issues)


def is_reminder_eligible(record: dict) -> bool:
    """A reminder can be created only for a valid record that has a real due date."""
    valid, _ = validate_vaccination(record)
    return valid and parse_iso_date(record.get("due_date")) is not None
