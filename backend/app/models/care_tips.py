from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.models.vaccination import utc_now

"""Breed Care Tips — a vet-reviewed lookup table imported from the
"PAW BUDDY Breed Care Tips Database" spreadsheet, matched against a submitted
Existing Dog Owner survey to show up to 3 personalised tips.

Nothing here is invented at runtime: every tip is a row someone wrote and a
vet approved. The matching engine only picks WHICH approved rows to show.

Schema and matching rules come straight from the workbook's own
"Legend & Matching Logic" sheet:
  - Filter Care Tips Matrix on Breed Name, City Climate Dependency (or "Any"),
    Ownership Duration Dependency (or "Any"), Category (mapped from the
    owner's Q7 answer). If nothing approved matches, fall back to the single
    Fallback Tip row (if it's approved) — otherwise show no tip section.
  - Season Dependency is a second, independent pass: up to 2 additional
    approved tips for the same breed whose Season Dependency equals the
    city's current season bucket (never "Any" — "Any" tips are already
    covered by the general match), excluding whatever was already picked.

Every row defaults to is_approved = False on import, no exceptions — a vet
has to flip it on in the admin panel before it can ever reach an owner.
Re-importing the spreadsheet replaces every row and resets every approval;
that's deliberate, not a bug, so edited content always gets re-reviewed.
"""

#: The workbook's own category set. "Climate" and "Age" exist in the sheet
#: but have no Q7 equivalent in the Existing Dog Owner survey (Q7 only offers
#: grooming/energy/health/training), so they are reachable only via a row's
#: own City Climate / Ownership Duration dependency, never as someone's
#: selected "biggest challenge" — a fact worth knowing, not a bug to patch.
CATEGORIES = ("Climate", "Health Risk", "Grooming", "Energy", "Age", "Behavior")

#: Q7 (`biggest_challenge`, now multi-select) -> the Category it maps to.
#: Grooming/Energy/Health map by name; "training" maps to the sheet's
#: "Behavior" category since Q7's own label is "Training & behavior".
CHALLENGE_TO_CATEGORY = {
    "grooming": "Grooming",
    "energy": "Energy",
    "health": "Health Risk",
    "training": "Behavior",
}

CITY_CLIMATE_VALUES = ("Hot", "Hot & Moderate", "Any")
DURATION_VALUES = ("<6 months", "6 months-1 year", "1-3 years", "3+ years", "Any")
SEASON_VALUES = ("Warm", "Mild", "Cool", "Any")

#: `tenure` code (from the Existing Dog Owner survey, Q3) -> the sheet's own
#: prose bucket. Kept as an explicit map rather than a string transform so a
#: rewording on either side fails loudly instead of silently stopping matching.
TENURE_TO_DURATION_BUCKET = {
    "lt_6_months": "<6 months",
    "6_12_months": "6 months-1 year",
    "1_3_years": "1-3 years",
    "3_plus_years": "3+ years",
}

#: The workbook was built for exactly 5 launch cities, all Hot or Moderate —
#: it has no notion of a genuinely cold city. Extending it to the app's full
#: city list (which spans hill stations too) is a judgment call, not
#: something the sheet specifies: HOT_HUMID and HOT_DRY both carry real
#: overheating risk, so both map to "Hot"; MODERATE maps to "Moderate";
#: COLD maps to nothing, so only "Any" rows can ever match a hill-station
#: owner (correct — a Husky in Shimla has no heat-mismatch tip to show).
CITY_ZONE_TO_CLIMATE_BUCKET = {
    "HOT_HUMID": "Hot",
    "HOT_DRY": "Hot",
    "MODERATE": "Moderate",
    "COLD": None,
}

MONTH_NAMES = (
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
)


class CareTip(BaseModel):
    """One row of the Care Tips Matrix sheet."""

    id: str
    breed_name: str
    category: str
    trait_trigger: str
    city_climate_dependency: str = "Any"
    ownership_duration_dependency: str = "Any"
    #: Absent from the sheet until the season-awareness schema lands; a row
    #: without the column, or with a blank cell, is climate-independent by
    #: season same as any other "Any" dimension.
    season_dependency: str = "Any"
    tip: str
    vet_verify_flag: Optional[str] = None
    vet_verify_note: Optional[str] = None
    is_approved: bool = False
    imported_at: datetime = Field(default_factory=utc_now)


class CareTipFallback(BaseModel):
    """The single "nothing else matched" row — still vet-gated like everything
    else; Part 3 of the spec is explicit that an unapproved fallback shows
    nothing, same as an unapproved regular tip."""

    id: str
    category: str
    trait_trigger: str
    tip: str
    vet_verify_flag: Optional[str] = None
    vet_verify_note: Optional[str] = None
    is_approved: bool = False
    imported_at: datetime = Field(default_factory=utc_now)


class CitySeasonEntry(BaseModel):
    """One City + Month -> Season Bucket row of the City Season Calendar."""

    id: str
    city: str
    month: str
    season_bucket: str
    imported_at: datetime = Field(default_factory=utc_now)
