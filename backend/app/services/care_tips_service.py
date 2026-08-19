"""Care Tips matching + admin read/write.

Two independent passes, straight from the workbook's own "Legend & Matching
Logic" sheet:

1. General match (always attempted first): approved rows for this breed,
   filtered on Category (mapped from the owner's Q7 answer(s)), City Climate
   Dependency (or "Any"), Ownership Duration Dependency (or "Any"). The
   workbook doesn't say what to do if more than one row survives that filter,
   so this file adds one rule of its own: specificity wins — a row that
   actually names the owner's city bucket AND duration bucket beats one that
   says "Any" to both, since it's the more targeted piece of advice. Nothing
   found -> the single approved Fallback Tip, if any -> otherwise no general
   tip at all.

2. Season pass (independent of the general match's source): up to 2 more
   approved rows for the same breed whose Season Dependency equals the
   city's current season bucket, excluding whatever the general pass picked.
"""
import hashlib
import logging
from datetime import datetime, timezone
from typing import Optional

from app.models.care_tips import (
    CHALLENGE_TO_CATEGORY, CITY_ZONE_TO_CLIMATE_BUCKET, MONTH_NAMES,
    TENURE_TO_DURATION_BUCKET,
)
from app.services.ai_processing.validation import parse_iso_date
from app.services.health_status import today
from app.services.care_tips_import_service import CARE_TIPS, CARE_TIP_FALLBACK, CITY_SEASON_CALENDAR

logger = logging.getLogger(__name__)


#: Reviewer-only columns from the workbook. `vet_verify_note` is the vet's
#: working note ABOUT the tip — e.g. "Confirm typical age of onset before
#: stating this as actionable advice" — which is guidance for the reviewer,
#: not for the owner, and reads as the product doubting its own advice.
#: All 290 rows carry a flag and 40 carry a note, so this is not an edge case.
INTERNAL_TIP_FIELDS = ("vet_verify_flag", "vet_verify_note")


def _clean(doc):
    if not doc:
        return doc
    doc.pop("_id", None)
    imported = doc.get("imported_at")
    if isinstance(imported, datetime):
        if imported.tzinfo is None:
            imported = imported.replace(tzinfo=timezone.utc)
        doc["imported_at"] = imported.isoformat()
    return doc


def _public(doc):
    """`_clean` plus the reviewer-only columns removed.

    Used on every PUBLIC path (survey match, dashboard card). The admin review
    listing deliberately keeps calling `_clean` — the whole point of that
    screen is to show the vet their own notes. Same build-time-drop rule the
    vet directory follows: internal data decides what ships, then doesn't
    ship itself."""
    doc = _clean(doc)
    if not doc:
        return doc
    for field in INTERNAL_TIP_FIELDS:
        doc.pop(field, None)
    return doc


# --------------------------------------------------------------------------- #
# bucket resolution — survey answers -> the sheet's own vocabulary
# --------------------------------------------------------------------------- #

def climate_zone_to_bucket(zone: Optional[str]) -> Optional[str]:
    return CITY_ZONE_TO_CLIMATE_BUCKET.get(zone) if zone else None


def duration_bucket_for(tenure: Optional[str]) -> Optional[str]:
    return TENURE_TO_DURATION_BUCKET.get(tenure) if tenure else None


def age_bracket_for_dob(dob, ref=None) -> Optional[str]:
    """A dog's real age -> the same bucket strings the sheet's "Ownership
    Duration Dependency" column uses.

    The workbook's own legend flags this as its weakest assumption: it treats
    ownership duration as a stand-in for life stage, which only holds if the
    dog was acquired as a puppy, and misfires for an adopted adult. A stored
    date of birth is the real thing, so matching a dashboard card on actual
    age is strictly more correct than matching on how long someone has owned
    the dog. The bucket NAMES still say "ownership duration" because that is
    what the spreadsheet column is called — the values are what matter."""
    birth = parse_iso_date(dob)
    if birth is None:
        return None
    ref = ref or today()
    if birth > ref:
        return None  # a future date of birth is bad data, not a newborn

    months = (ref.year - birth.year) * 12 + (ref.month - birth.month)
    if ref.day < birth.day:
        months -= 1
    months = max(months, 0)

    if months < 6:
        return "<6 months"
    if months < 12:
        return "6 months-1 year"
    if months < 36:
        return "1-3 years"
    return "3+ years"


def categories_for_challenges(challenges) -> list:
    """Q7 codes, in the order the owner picked them -> the Categories they map
    to. Order is preserved so a specificity tie favours whichever category
    the owner listed first — simple, deterministic, not in the sheet either."""
    seen = []
    for code in challenges or []:
        cat = CHALLENGE_TO_CATEGORY.get(code)
        if cat and cat not in seen:
            seen.append(cat)
    return seen


# --------------------------------------------------------------------------- #
# general match
# --------------------------------------------------------------------------- #

def _city_matches(row_value: Optional[str], city_bucket: Optional[str]) -> bool:
    if row_value in (None, "", "Any"):
        return True
    if city_bucket is None:
        return False  # a cold-zone owner — only "Any" rows ever match
    if row_value == "Hot":
        return city_bucket == "Hot"
    if row_value == "Hot & Moderate":
        return city_bucket in ("Hot", "Moderate")
    return False  # an unrecognised value on the row fails safe, not open


def _duration_matches(row_value: Optional[str], duration_bucket: Optional[str]) -> bool:
    if row_value in (None, "", "Any"):
        return True
    return row_value == duration_bucket


def _specificity(row: dict) -> int:
    """+1 for each dimension the row names outright rather than "Any" — how
    targeted this row is, once we already know it matches this owner."""
    score = 0
    if row.get("city_climate_dependency") not in (None, "", "Any"):
        score += 1
    if row.get("ownership_duration_dependency") not in (None, "", "Any"):
        score += 1
    return score


async def _general_candidates(db, breed: str, categories: Optional[list], city_bucket, duration_bucket) -> list:
    """Approved tips for this breed that fit this owner's city and duration
    buckets. `categories=None` means "don't filter by category at all" — the
    dashboard card has no Q7-equivalent signal to filter on, so it matches on
    breed + city + age only."""
    query = {"breed_name": breed, "is_approved": True}
    if categories:
        query["category"] = {"$in": categories}
    rows = [r async for r in db[CARE_TIPS].find(query)]
    return [
        r for r in rows
        if _city_matches(r.get("city_climate_dependency"), city_bucket)
        and _duration_matches(r.get("ownership_duration_dependency"), duration_bucket)
    ]


async def _fallback_tip(db) -> Optional[dict]:
    return _public(await db[CARE_TIP_FALLBACK].find_one({"is_approved": True}))


# --------------------------------------------------------------------------- #
# season pass
# --------------------------------------------------------------------------- #

async def _season_bucket_for(db, city: str, month_name: str) -> Optional[str]:
    row = await db[CITY_SEASON_CALENDAR].find_one({"city": city, "month": month_name})
    return row.get("season_bucket") if row else None


async def _season_candidates(db, breed: str, season_bucket: str, exclude_ids: set, limit: Optional[int] = 2) -> list:
    if not season_bucket or season_bucket == "Any":
        return []
    query = {"breed_name": breed, "is_approved": True, "season_dependency": season_bucket}
    rows = [r async for r in db[CARE_TIPS].find(query)]
    return [r for r in rows if r["id"] not in exclude_ids][:limit]


def _resolve_month(month_override: Optional[str]) -> str:
    """Server date, not the device's — except for the explicit test override
    the spec asks for (Part 5), which exists ONLY so a monsoon tip can be
    checked in August without waiting for July."""
    if month_override:
        candidate = month_override.strip().title()
        if candidate in MONTH_NAMES:
            return candidate
    return datetime.now(timezone.utc).strftime("%B")


# --------------------------------------------------------------------------- #
# the combined pick
# --------------------------------------------------------------------------- #

async def _combine(db, *, breed, city, general, month_name) -> dict:
    """Shared tail of both matchers: the chosen general tip (or the approved
    Fallback Tip, or nothing at all), then up to 2 season-specific tips."""
    source = "general"
    if general is None:
        general = await _fallback_tip(db)
        source = "fallback" if general else "none"

    tips = []
    if general:
        general_id = general["id"]  # read before _clean, which only touches _id/imported_at
        tips.append(_public(general))

        season_bucket = await _season_bucket_for(db, city, month_name)
        season_rows = await _season_candidates(db, breed, season_bucket, exclude_ids={general_id})
        tips.extend(_public(r) for r in season_rows)

    return {"tips": tips[:3], "source": source, "month_used": month_name}


async def match_tips(
    db, *, breed: str, city: str, climate_zone: Optional[str], tenure: Optional[str],
    challenges: list, month_override: Optional[str] = None,
) -> dict:
    """Up to 3 tips for one Owner Survey submission: the general best-match
    first (or the Fallback Tip if nothing else is approved for this breed),
    then up to 2 approved season-specific tips for the same breed."""
    city_bucket = climate_zone_to_bucket(climate_zone)
    duration_bucket = duration_bucket_for(tenure)
    categories = categories_for_challenges(challenges)
    month_name = _resolve_month(month_override)

    general = None
    if categories:
        candidates = await _general_candidates(db, breed, categories, city_bucket, duration_bucket)
        if candidates:
            candidates.sort(key=_specificity, reverse=True)
            general = candidates[0]

    return await _combine(db, breed=breed, city=city, general=general, month_name=month_name)


#: How long one set of dashboard tips stays put. The dashboard is glanced at
#: several times a day; re-picking on every load would make it feel random and
#: make a tip impossible to come back to.
ROTATION_HOURS = 6


def rotation_slot(now=None, hours: int = ROTATION_HOURS) -> int:
    """Which rotation window we're in. Whole hours since the epoch divided by
    the window, so every device and every request inside the same window
    agrees without storing anything."""
    now = now or datetime.now(timezone.utc)
    return int(now.timestamp() // (hours * 3600))


def seconds_until_next_slot(now=None, hours: int = ROTATION_HOURS) -> int:
    now = now or datetime.now(timezone.utc)
    window = hours * 3600
    return int(window - (now.timestamp() % window))


def _rotate(candidates: list, seed: str, now=None) -> list:
    """Deterministically rotate a candidate list for this dog and this window.

    Deterministic on purpose: a refresh must show the same tip, two devices
    must agree, and no state has to be stored to achieve it. The dog id is
    folded into the offset so two dogs on the same account don't move through
    the list in lockstep."""
    if len(candidates) <= 1:
        return candidates
    ordered = sorted(candidates, key=lambda r: r["id"])  # stable base order
    dog_offset = int(hashlib.sha1(str(seed or "").encode()).hexdigest()[:8], 16)
    start = (rotation_slot(now) + dog_offset) % len(ordered)
    return ordered[start:] + ordered[:start]


async def match_tips_for_profile(
    db, *, breed: str, city: Optional[str], climate_zone: Optional[str],
    dob: Optional[str], month_override: Optional[str] = None,
    rotate_seed: Optional[str] = None, now=None,
) -> dict:
    """Up to 3 tips for a dog that already has a profile — the dashboard card.

    Same engine as the survey matcher, two deliberate differences:
      * no category filter, because a stored profile carries no "what are you
        struggling with?" signal to filter on; and
      * the age bucket comes from the dog's real date of birth rather than
        from how long its owner has had it.

    A profile missing breed entirely can't match anything breed-specific, so
    it goes straight to the fallback rule rather than guessing.

    The chosen tip rotates every ROTATION_HOURS. Specificity still decides
    which tips are *eligible* to lead — rotation only picks among equally
    specific ones, so a rotation can never promote a vaguer tip over a
    better-targeted one."""
    month_name = _resolve_month(month_override)

    general = None
    if breed:
        city_bucket = climate_zone_to_bucket(climate_zone)
        age_bucket = age_bracket_for_dob(dob)
        candidates = await _general_candidates(db, breed, None, city_bucket, age_bucket)
        if candidates:
            best = max(_specificity(c) for c in candidates)
            top = [c for c in candidates if _specificity(c) == best]
            general = _rotate(top, rotate_seed or breed, now)[0]

    combined = await _combine(db, breed=breed, city=city, general=general, month_name=month_name)
    combined["rotation"] = {
        "hours": ROTATION_HOURS,
        "slot": rotation_slot(now),
        "seconds_until_next": seconds_until_next_slot(now),
    }
    return combined


async def full_tips_for_profile(
    db, *, breed: str, city: Optional[str], climate_zone: Optional[str],
    dob: Optional[str], month_override: Optional[str] = None,
) -> dict:
    """Every approved tip matching this dog's breed — for the Tip Details
    modal, which shows the dog's complete matching set rather than the
    dashboard card's rotated single pick.

    Same two passes as `match_tips_for_profile` (general breed+city+age,
    then season), but neither is narrowed: the general pass returns every
    surviving candidate instead of the single most-specific/rotated winner,
    and the season pass is uncapped instead of stopping at 2. No specificity
    tie-break and no rotation, since there is nothing here to break a tie
    for — the modal shows everything, not one pick.

    Deliberately no Fallback Tip substitution, unlike the card: the fallback's
    own category is "General Fallback", which is neither "Climate" nor one of
    the Lifestyle categories, so it would never land in either of the modal's
    two sections anyway — fetching it would add a query without changing what
    the modal shows. A dog whose card is only showing the fallback (common
    right now, with approvals still sparse) correctly sees "no tips yet" in
    the modal: no breed-specific, categorized tip is approved for it yet,
    which is exactly what the empty state is for."""
    month_name = _resolve_month(month_override)

    general = []
    if breed:
        city_bucket = climate_zone_to_bucket(climate_zone)
        age_bucket = age_bracket_for_dob(dob)
        general = await _general_candidates(db, breed, None, city_bucket, age_bucket)

    seen_ids = {r["id"] for r in general}
    tips = [_public(r) for r in general]

    if breed and tips:
        season_bucket = await _season_bucket_for(db, city, month_name)
        season_rows = await _season_candidates(db, breed, season_bucket, seen_ids, limit=None)
        tips.extend(_public(r) for r in season_rows)

    return {"tips": tips, "month_used": month_name}


# --------------------------------------------------------------------------- #
# admin: browse + approve
# --------------------------------------------------------------------------- #

async def list_all(db, breed: str = None, category: str = None, approved: bool = None, limit: int = 1000) -> list:
    query = {}
    if breed:
        query["breed_name"] = {"$regex": breed, "$options": "i"}
    if category:
        query["category"] = category
    if approved is not None:
        query["is_approved"] = approved
    cursor = db[CARE_TIPS].find(query).sort([("breed_name", 1), ("category", 1)]).limit(limit)
    return [_clean(row) async for row in cursor]


async def list_fallback(db) -> list:
    return [_clean(row) async for row in db[CARE_TIP_FALLBACK].find({})]


async def stats(db) -> dict:
    total = await db[CARE_TIPS].count_documents({})
    approved = await db[CARE_TIPS].count_documents({"is_approved": True})
    fallback_total = await db[CARE_TIP_FALLBACK].count_documents({})
    fallback_approved = await db[CARE_TIP_FALLBACK].count_documents({"is_approved": True})
    season_calendar_rows = await db[CITY_SEASON_CALENDAR].count_documents({})

    pipeline = [{"$group": {"_id": "$category", "n": {"$sum": 1}}}]
    by_category = {row["_id"]: row["n"] async for row in db[CARE_TIPS].aggregate(pipeline)}

    return {
        "total": total,
        "approved": approved,
        "pending": total - approved,
        "by_category": by_category,
        "fallback_total": fallback_total,
        "fallback_approved": fallback_approved,
        "season_calendar_rows": season_calendar_rows,
    }


async def set_approval(db, tip_id: str, approved: bool) -> Optional[dict]:
    result = await db[CARE_TIPS].update_one({"id": tip_id}, {"$set": {"is_approved": approved}})
    if result.matched_count == 0:
        return None
    return _clean(await db[CARE_TIPS].find_one({"id": tip_id}))


async def set_approval_bulk(db, *, ids: list = None, breed: str = None,
                            category: str = None, approved: bool = True) -> int:
    """Approve/unapprove many rows at once.

    Reviewing 290 tips one click at a time is its own kind of unsafe — it
    invites rubber-stamping. Filtering to one breed or category and acting on
    that set is the way a reviewer actually works."""
    query = {}
    if ids:
        query["id"] = {"$in": ids}
    if breed:
        query["breed_name"] = breed
    if category:
        query["category"] = category
    if not query:
        # No filter would mean "approve all 290 in one unreviewed click".
        raise ValueError("A bulk approval needs ids, a breed, or a category — refusing to act on everything at once.")

    result = await db[CARE_TIPS].update_many(query, {"$set": {"is_approved": approved}})
    logger.info("Bulk approval: %s -> is_approved=%s (%d rows)", query, approved, result.modified_count)
    return result.modified_count


async def set_fallback_approval(db, tip_id: str, approved: bool) -> Optional[dict]:
    result = await db[CARE_TIP_FALLBACK].update_one({"id": tip_id}, {"$set": {"is_approved": approved}})
    if result.matched_count == 0:
        return None
    return _clean(await db[CARE_TIP_FALLBACK].find_one({"id": tip_id}))
