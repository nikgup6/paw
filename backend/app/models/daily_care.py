from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, Field

from app.models.vaccination import utc_now

"""Today's routine wellness care — the small daily nudges on the dashboard.

One document per dog per DAY. The date is part of the key rather than
something a scheduled job clears, so "resets at midnight" needs no cron and
cannot half-fail: tomorrow simply reads a different key and finds nothing
ticked. It also means the history is kept for free, which is what would make
a "fed 6 days out of 7" summary possible later.

Deliberately NOT medical. These are habit nudges (fed, water, walk, groom);
vaccinations, dewormings and prescriptions stay in their own collections
where the evidence rules and the review flow live.
"""

#: The four toggles the dashboard shows, in display order. Codes are stored;
#: labels live here so a rewording can never split one habit into two rows in
#: whatever history we build on top of this.
CARE_ITEMS = ("fed", "water", "walk", "grooming")

CARE_LABELS = {
    "fed": "Fed",
    "water": "Fresh water",
    "walk": "Walked",
    "grooming": "Grooming",
}

CARE_ICONS = {
    "fed": "🍚",
    "water": "💧",
    "walk": "🦮",
    "grooming": "🧴",
}


class DailyCare(BaseModel):
    """One dog's routine-care ticks for one calendar day."""

    id: str
    dog_id: str
    #: ISO date (YYYY-MM-DD) in the SERVER's day, matching how every other
    #: due-date in the app is computed. A device with a wrong clock can't
    #: silently tick tomorrow's box.
    day: str
    #: item code -> when it was ticked. Absent means not done; the timestamp
    #: is kept rather than a bare bool so "fed at 8am" is answerable later.
    done: Dict[str, datetime] = Field(default_factory=dict)
    updated_at: datetime = Field(default_factory=utc_now)


class DailyCareToggle(BaseModel):
    item: str
    done: bool
    #: Optional: lets a client be explicit rather than relying on the server's
    #: idea of "today" when the two could disagree around midnight.
    day: Optional[str] = None


class CareItem(BaseModel):
    """One habit on the routine card. `code` is the stable key the daily ticks
    are recorded against — renaming an item MUST keep its code, or the day's
    history silently detaches from it.

    Optional because a NEW item has no code yet; the server assigns one. An
    existing item must send its code back, which is exactly what preserves
    today's ticks across a rename."""

    code: Optional[str] = None
    label: str
    icon: str = "🐾"


class CareItemList(BaseModel):
    """The whole list, replaced in one call. Sending the complete list rather
    than per-item edits means the order on screen is exactly the order stored,
    with no separate reordering endpoint to keep in sync."""

    items: List[CareItem]
