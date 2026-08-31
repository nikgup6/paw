"""Care Tips endpoints (`/api/care-tips`).

Matching is public — it runs right after the Existing Dog Owner survey posts,
before any login exists. Import, browsing and approval are admin-only: this
is vet-reviewed medical-adjacent content, gated the same way owner-survey
responses are.
"""
import logging
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query, UploadFile, File

from app.auth.dependencies import require_admin
from app.database.connection import get_database
from app.services import care_tips_import_service, care_tips_service, conditions, dog_profile_service
from app.services.care_tips_import_service import zone_for_city

logger = logging.getLogger(__name__)
router = APIRouter()

MAX_WORKBOOK_BYTES = 10 * 1024 * 1024


def _require_db():
    db = get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable.")
    return db


@router.get("/match")
async def match(
    breed: str = Query(...),
    city: str = Query(...),
    climate_zone: Optional[str] = Query(None),
    tenure: Optional[str] = Query(None),
    challenge: List[str] = Query(default=[]),
    month_override: Optional[str] = Query(
        None, description="Testing only — overrides the server's current month so a "
                           "season bucket can be checked without waiting for the season."),
):
    """Public: up to 3 personalised tips for one breed+city+tenure+challenge
    combination, shown on the Existing Dog Owner survey's post-submit screen."""
    db = _require_db()
    return await care_tips_service.match_tips(
        db, breed=breed, city=city, climate_zone=climate_zone, tenure=tenure,
        challenges=challenge, month_override=month_override,
    )


@router.get("/teaser")
async def teaser_tip(
    breed: str = Query(..., description="The breed answered at Q1."),
    city: Optional[str] = Query(None, description="The city answered at Q2."),
    month_override: Optional[str] = Query(
        None, description="Testing only — overrides the server's current month."),
):
    """Public: ONE tip for the survey's inline teaser, part-way through the form.

    Deliberately the dashboard card's matcher (`match_tips_for_profile`) rather
    than the survey's own `match_tips` above. The survey matcher filters on
    Category, which is derived from Q7 — a question this teaser appears five
    questions before, so there is nothing to filter on yet and it would return
    nothing every time. The profile matcher takes no category, which is exactly
    the shape of what is known at Q2.

    No new query: `match_tips_for_profile` already takes breed/city/dob as
    plain arguments — reading them off a stored dog is something the `/for-dog`
    route does, not the service. Here `dob` is simply None, since no dog profile
    exists yet; the age dimension then stops narrowing the match instead of
    erroring, the same way it already does for a dog saved without a birthday.

    Returns the breed-specific match only. `_combine` substitutes the generic
    Fallback Tip when nothing matches a breed, and presenting that under
    "based on what you've told us so far" would be a claim about their answers
    that isn't true — so a fallback is reported as no tip, and the card is
    simply not rendered."""
    db = _require_db()
    result = await care_tips_service.match_tips_for_profile(
        db,
        breed=breed,
        city=city,
        climate_zone=zone_for_city(city),
        dob=None,
        month_override=month_override,
        # Stable per breed+city, so re-answering Q2 or stepping back and
        # forward shows the same tip rather than reshuffling under them.
        rotate_seed=f"{breed}|{city or ''}",
    )
    tips = result.get("tips") or []
    if result.get("source") != "general" or not tips:
        return {"tip": None}
    return {"tip": tips[0]}


@router.get("/for-dog/{dog_id}")
async def match_for_dog(
    dog_id: str,
    month_override: Optional[str] = Query(
        None, description="Testing only — overrides the server's current month."),
    slot_override: Optional[int] = Query(
        None, description="Testing only — forces a rotation window so the 6-hourly "
                          "change can be checked without waiting 6 hours."),
    full: bool = Query(
        False, description="Return the dog's complete approved matching set — no "
                           "rotation, no 3-tip cap — instead of the dashboard card's "
                           "rotated subset. Powers the Tip Details modal."),
):
    """Public: tips for a dog that already has a profile (the dashboard card).

    Breed, city and date of birth are read from the stored profile rather than
    taken from the query string, so the card always reflects what the owner
    actually saved. A dog with no city or no date of birth still works — those
    dimensions simply stop narrowing the match instead of erroring.

    Also returns the current local `conditions`, which the card shows as a
    weather-aware line. Conditions are DERIVED from the city's climate zone
    and the month (see services/conditions.py) — no live reading is taken, so
    the payload carries source="derived" rather than implying a measurement."""
    db = _require_db()
    dog = await dog_profile_service.get(db, dog_id)
    if not dog:
        raise HTTPException(status_code=404, detail="Dog not found.")

    city = dog.get("city")

    if full:
        result = await care_tips_service.full_tips_for_profile(
            db,
            breed=dog.get("breed"),
            city=city,
            climate_zone=zone_for_city(city),
            dob=dog.get("dob"),
            month_override=month_override,
        )
        result["conditions"] = conditions.conditions_for(city)
        return result

    now = None
    if slot_override is not None:
        # Move "now" to the start of the requested rotation window, so the
        # whole rotation path is exercised rather than special-cased.
        now = datetime.fromtimestamp(
            slot_override * care_tips_service.ROTATION_HOURS * 3600, tz=timezone.utc)

    result = await care_tips_service.match_tips_for_profile(
        db,
        breed=dog.get("breed"),
        city=city,
        climate_zone=zone_for_city(city),
        dob=dog.get("dob"),
        month_override=month_override,
        rotate_seed=dog_id,
        now=now,
    )
    result["conditions"] = conditions.conditions_for(city, month=now.month if now else None)
    return result


@router.post("/import", dependencies=[Depends(require_admin)])
async def import_workbook(file: UploadFile = File(...)):
    """Admin: upload the Care Tips Database workbook. Replaces every sheet's
    collection wholesale — every row lands unapproved, no exceptions."""
    if not (file.filename or "").lower().endswith(".xlsx"):
        raise HTTPException(status_code=415, detail="Please upload the .xlsx workbook.")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="The file is empty.")
    if len(data) > MAX_WORKBOOK_BYTES:
        raise HTTPException(status_code=413, detail="Workbook must be under 10MB.")

    db = _require_db()
    try:
        return await care_tips_import_service.import_workbook(db, data)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.get("", dependencies=[Depends(require_admin)])
async def list_tips(
    breed: str = Query(None),
    category: str = Query(None),
    approved: Optional[bool] = Query(None),
):
    """Admin: browse the Care Tips Matrix, optionally filtered."""
    db = _require_db()
    return {
        "stats": await care_tips_service.stats(db),
        "tips": await care_tips_service.list_all(db, breed=breed, category=category, approved=approved),
        "fallback": await care_tips_service.list_fallback(db),
    }


@router.patch("/{tip_id}/approve", dependencies=[Depends(require_admin)])
async def approve_tip(tip_id: str, approved: bool = Body(..., embed=True)):
    db = _require_db()
    updated = await care_tips_service.set_approval(db, tip_id, approved)
    if updated is None:
        raise HTTPException(status_code=404, detail="Tip not found.")
    return updated


@router.patch("/approve-bulk", dependencies=[Depends(require_admin)])
async def approve_bulk(
    approved: bool = Body(True, embed=True),
    ids: Optional[List[str]] = Body(None, embed=True),
    breed: Optional[str] = Body(None, embed=True),
    category: Optional[str] = Body(None, embed=True),
):
    """Admin: approve/unapprove a filtered set — one breed, one category, or
    an explicit list. Deliberately refuses an unfiltered "approve everything"."""
    db = _require_db()
    try:
        updated = await care_tips_service.set_approval_bulk(
            db, ids=ids, breed=breed, category=category, approved=approved)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"updated": updated, "approved": approved}


@router.patch("/fallback/{tip_id}/approve", dependencies=[Depends(require_admin)])
async def approve_fallback(tip_id: str, approved: bool = Body(..., embed=True)):
    db = _require_db()
    updated = await care_tips_service.set_fallback_approval(db, tip_id, approved)
    if updated is None:
        raise HTTPException(status_code=404, detail="Fallback tip not found.")
    return updated
