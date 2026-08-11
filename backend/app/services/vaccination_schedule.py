"""Vaccination Schedule — the standard Indian puppy course and adult boosters.

Everything a dog *should* have is generated here from its date of birth and
breed; everything it *has* had comes from the AI-extracted records. Merging the
two (see timeline_service) is what turns a pile of scanned certificates into a
complete health timeline.

Guidelines
----------
The course below follows WSAVA core-vaccine guidance as it is practised in
India: a DHPPi primary series from 6 weeks with the final puppy dose at 16
weeks, Leptospirosis alongside from 9 weeks (endemic here, so treated as core),
and anti-rabies from 12 weeks. India follows **annual** rabies boosters rather
than the 3-year schedule used in some countries, which is why RABIES carries a
12-month interval. Canine coronavirus and kennel cough are widely offered by
Indian clinics but are non-core, so they are scheduled and tracked without being
counted as gaps.

Large and giant breeds get one extra DHPPi dose at 20 weeks: maternal antibody
interference is documented to persist longer in some large breeds, so a final
dose after 16 weeks is commonly advised for them.

This is a schedule generator, not veterinary advice — the UI presents it as a
guide and the owner's own vet records always win.
"""
from dataclasses import dataclass
from datetime import date, timedelta
from functools import lru_cache
from typing import List, Optional, Set
import json
import logging
import re

from app.config.settings import BACKEND_DIR
from app.services.ai_processing.validation import parse_iso_date
from app.services.health_status import add_months

logger = logging.getLogger(__name__)

COUNTRY = "IN"

# ------------------------------- vaccine families --------------------------- #
# A "family" is what a shot protects against, independent of brand or of how
# many antigens are bundled into one injection. Matching on families is what
# lets "Nobivac DHPPi", "9-in-1" and "Distemper booster" all satisfy the same
# scheduled dose.
DHPP = "DHPP"
LEPTO = "LEPTO"
RABIES = "RABIES"
CORONA = "CORONA"
KENNEL_COUGH = "KC"

FAMILY_LABELS = {
    DHPP: "DHPPi (Distemper, Hepatitis, Parvovirus, Parainfluenza)",
    LEPTO: "Leptospirosis",
    RABIES: "Anti-Rabies",
    CORONA: "Canine Coronavirus",
    KENNEL_COUGH: "Kennel Cough (Bordetella)",
}

# Substrings, lowercased, matched against the vaccine name on a record. A name
# may match several families — combination vaccines are the norm, and a
# "DHPPi + L" shot legitimately satisfies both the DHPP and LEPTO schedules.
FAMILY_PATTERNS = {
    RABIES: ("rabies", "rabisin", "raksharab", "nobivac r"),
    LEPTO: ("lepto", "10 in 1", "10-in-1"),
    CORONA: ("corona", "ccv"),
    KENNEL_COUGH: ("kennel cough", "bordetella", "tracheobronchitis", "kc vaccine"),
    DHPP: ("dhpp", "dhppi", "dapp", "da2pp", "distemper", "parvo", "hepatitis",
           "parainfluenza", "puppy dp", "5 in 1", "5-in-1", "7 in 1", "7-in-1",
           "9 in 1", "9-in-1", "10 in 1", "10-in-1"),
}

# Short abbreviations can't be matched as substrings — they turn up inside
# longer words and quietly claim the wrong family. A bare "L" is how clinics
# write the leptospirosis component of a combination shot ("DHPPi+L", "L4"), and
# "ARV" (Anti-Rabies Vaccine) sits inside "Parvovirus", which was enough to file
# every parvo shot as a rabies dose. Both get word-boundary patterns instead.
FAMILY_REGEXES = {
    LEPTO: (re.compile(r"\bl[24]\b"), re.compile(r"dhppi?\s*\+?\s*l\b")),
    RABIES: (re.compile(r"\barv\b"),),
}

# Non-core vaccines are tracked when the owner has had them, but an Indian dog
# without them is not "behind" — so they are never scheduled from scratch.
CORE_FAMILIES = (DHPP, LEPTO, RABIES)

#: Core boosters are annual in India.
BOOSTER_INTERVAL_MONTHS = 12
BOOSTER_INTERVAL_LABEL = "1 year"

#: A booster given slightly early still counts as having been given.
EARLY_GRACE_DAYS = 30

#: How long after the primary course ends before an unvaccinated adult's missed
#: puppy doses are collapsed into one "primary course overdue" item rather than
#: listed individually.
ADULT_COLLAPSE_WEEKS = 26


def families_of(vaccine_name: Optional[str]) -> Set[str]:
    """Every family a vaccine name covers. Empty for names we don't recognise —
    those records still appear on the timeline, they just don't satisfy a
    scheduled dose."""
    text = (vaccine_name or "").lower()
    if not text.strip():
        return set()
    found = {family for family, patterns in FAMILY_PATTERNS.items()
             if any(p in text for p in patterns)}
    found |= {family for family, patterns in FAMILY_REGEXES.items()
              if any(p.search(text) for p in patterns)}
    return found


# --------------------------------- the course ------------------------------- #

@dataclass(frozen=True)
class ScheduledDose:
    family: str
    age_weeks: int
    label: str
    core: bool = True
    large_breed_only: bool = False

    @property
    def vaccine_name(self) -> str:
        return FAMILY_LABELS[self.family]


PUPPY_COURSE: List[ScheduledDose] = [
    ScheduledDose(DHPP, 6, "1st dose"),
    ScheduledDose(CORONA, 6, "1st dose", core=False),
    ScheduledDose(KENNEL_COUGH, 8, "Single dose", core=False),
    ScheduledDose(DHPP, 9, "2nd dose"),
    ScheduledDose(LEPTO, 9, "1st dose"),
    ScheduledDose(CORONA, 9, "2nd dose", core=False),
    ScheduledDose(DHPP, 12, "3rd dose"),
    ScheduledDose(LEPTO, 12, "2nd dose"),
    ScheduledDose(RABIES, 12, "1st dose"),
    ScheduledDose(DHPP, 16, "Final puppy dose"),
    ScheduledDose(DHPP, 20, "Extra large-breed dose", large_breed_only=True),
]


# ------------------------------- breed sizing ------------------------------- #

@lru_cache(maxsize=1)
def _breed_sizes() -> dict:
    """breed name -> size token(s), read from the breeds catalogue that already
    ships with the backend. Missing file just means no breed tuning."""
    try:
        with open(BACKEND_DIR / "breeds.json", encoding="utf-8") as fh:
            catalogue = json.load(fh)
    except Exception:
        logger.warning("breeds.json unavailable; schedule will skip breed sizing", exc_info=True)
        return {}
    sizes = {}
    for breed in catalogue:
        name = (breed.get("name") or "").strip().lower()
        # "L (25-36 kg, 55-62 cm)" / "S-M (9-11 kg...)" -> the code before " ("
        code = str(breed.get("size") or "").split("(")[0]
        if name:
            sizes[name] = {t for t in re.split(r"[^A-Za-z]+", code.upper()) if t}
    return sizes


def is_large_breed(breed: Optional[str]) -> bool:
    tokens = _breed_sizes().get((breed or "").strip().lower(), set())
    return bool(tokens & {"L", "XL"})


def course_for(breed: Optional[str]) -> List[ScheduledDose]:
    large = is_large_breed(breed)
    return [d for d in PUPPY_COURSE if large or not d.large_breed_only]


# ------------------------------ schedule building --------------------------- #

def due_date_for(dob: date, dose: ScheduledDose) -> date:
    return dob + timedelta(weeks=dose.age_weeks)


def last_core_dose_age_weeks(course: List[ScheduledDose], family: str) -> Optional[int]:
    ages = [d.age_weeks for d in course if d.family == family]
    return max(ages) if ages else None


def primary_course_end(dob: date, course: List[ScheduledDose]) -> date:
    """When the puppy series finishes — the point after which annual boosters
    take over."""
    return dob + timedelta(weeks=max((d.age_weeks for d in course), default=16))


def next_booster_date(anchor: date, ref: date) -> date:
    """The next annual booster on or after `ref`, counting from `anchor`.

    Rolling forward rather than listing every year keeps a dog that missed three
    boosters at exactly one overdue item instead of three, while a dog that is
    up to date sees the real next appointment. A missed booster still surfaces:
    the first projection lands in the past and reads as Overdue."""
    due = add_months(anchor, BOOSTER_INTERVAL_MONTHS)
    if due >= ref:
        return due
    # Already missed at least one — show the one that was owed most recently.
    while True:
        following = add_months(due, BOOSTER_INTERVAL_MONTHS)
        if following >= ref:
            return due
        due = following


def is_fulfilled_by(due_value, family: str, records: list, after=None) -> bool:
    """True when some record in `records` already covers a dose of `family` due
    on `due_value` — i.e. it was administered on or after that date (allowing a
    short early-booster grace), and later than `after` if given.

    This is what retires a reminder automatically: once the next shot is on
    file, the dose it was chasing is done."""
    due = parse_iso_date(due_value)
    if due is None or not family:
        return False
    earliest = due - timedelta(days=EARLY_GRACE_DAYS)
    after_date = parse_iso_date(after)
    for record in records:
        if family not in families_of(record.get("vaccine_name")):
            continue
        given = parse_iso_date(record.get("administration_date"))
        if given is None or given < earliest:
            continue
        if after_date is not None and given <= after_date:
            continue
        return True
    return False


def parse_dob(dog: Optional[dict]) -> Optional[date]:
    return parse_iso_date((dog or {}).get("dob"))
