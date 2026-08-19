from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from app.models.vaccination import utc_now


"""The Existing Dog Owner intake survey — eight questions, one row per submission.

Identity is deliberately absent for now. There is no login on this flow yet, so
a submission is labelled `Anonymous <n>` from a per-record sequence rather than
carrying a name or mobile that we cannot actually verify. When OTP lands, the
verified name/mobile attach to the same row via `session_id`, which is already
recorded — so no migration is needed to join a person to what they told us.

Answers are stored as the option CODES, not the display labels. Rewording
"5 – 8 hours" later must not silently split one answer into two in the export.
"""

#: Allowed values per question. Anything else is rejected at the API boundary —
#: a survey whose answer set drifts is a survey you cannot aggregate.
TENURE = ("lt_6_months", "6_12_months", "1_3_years", "3_plus_years")
LIVING = ("apt_no_outdoor", "apt_balcony_or_shared", "house_no_yard", "house_with_yard")
ALONE_HOURS = ("lt_2", "2_5", "5_8", "8_plus")
CHALLENGE = ("grooming", "energy", "health", "training")
RECOMMEND = ("yes", "no", "depends")

#: Human labels, kept server-side so the admin table and the CSV export read
#: the same way without the frontend having to send prose.
LABELS = {
    "tenure": {
        "lt_6_months": "Less than 6 months",
        "6_12_months": "6 months – 1 year",
        "1_3_years": "1 – 3 years",
        "3_plus_years": "3+ years",
    },
    "living_situation": {
        "apt_no_outdoor": "Apartment, no balcony/yard",
        "apt_balcony_or_shared": "Apartment, with balcony or shared yard",
        "house_no_yard": "Independent house, no yard",
        "house_with_yard": "Independent house, with yard",
    },
    "hours_alone": {
        "lt_2": "Less than 2 hours",
        "2_5": "2 – 5 hours",
        "5_8": "5 – 8 hours",
        "8_plus": "8+ hours",
    },
    "biggest_challenge": {
        "grooming": "Grooming & maintenance",
        "energy": "Energy & exercise needs",
        "health": "Health issues",
        "training": "Training & behavior",
    },
    "would_recommend": {"yes": "Yes", "no": "No", "depends": "Depends"},
}

#: Question text, so the admin view and export label columns the way the owner
#: read them rather than by field name.
QUESTIONS = {
    "breed": "Q1. What breed is your dog?",
    "city": "Q2. Which city do you live in?",
    "tenure": "Q3. How long have you had your dog?",
    "living_situation": "Q4. What's your living situation?",
    "hours_alone": "Q5. Hours alone on an average day?",
    "satisfaction": "Q6. Satisfaction with this breed (1-5)",
    "biggest_challenge": "Q7. Biggest challenge with this breed? (select all that apply)",
    "would_recommend": "Q8. Recommend to a first-time owner?",
    "recommend_note": "Q8b. \"Depends\" — why?",
}


class OwnerSurveyIn(BaseModel):
    """What the form posts. Every question is required except the conditional
    free-text on Q8, which only exists when the answer is 'depends'."""

    session_id: str

    breed: str                      # Q1 — canonical breed name from the shared list
    city: str                       # Q2 — a cityZones key, or a "zone:*" fallback
    tenure: str                     # Q3
    living_situation: str           # Q4
    hours_alone: str                # Q5
    satisfaction: int = Field(ge=1, le=5)   # Q6 — 5 paws, never a 1-10 scale
    biggest_challenge: List[str]    # Q7 — multi-select; codes checked against CHALLENGE in validate()
    would_recommend: str            # Q8
    recommend_note: Optional[str] = None    # Q8b, only when would_recommend == 'depends'

    #: Resolved by the city selector, which already holds the canonical
    #: city→zone map. Sent rather than re-derived here so that mapping lives in
    #: exactly one place — copying cityZones.json to the backend would recreate
    #: the same drift problem the breed catalogue just had.
    climate_zone: Optional[str] = None


class OwnerSurvey(OwnerSurveyIn):
    id: str
    #: "Anonymous 1", "Anonymous 2", … assigned server-side in submission order.
    #: Sequence lives on the server because two browsers cannot agree on a
    #: counter, and a duplicate label in the export is worse than no label.
    respondent_label: str
    #: Climate band resolved from the city at write time, so the export can be
    #: grouped by climate without re-deriving it from a config that may change.
    climate_zone: Optional[str] = None
    created_at: datetime = Field(default_factory=utc_now)
