"""Today's routine wellness care (`/api/daily-care`).

Public, like the rest of the dog-scoped endpoints — an owner is a per-device
id and there is no login yet, so this follows the same access model as
/api/dogs rather than inventing a stricter one that nothing could satisfy.
"""
import logging

from fastapi import APIRouter, HTTPException, Query

from app.database.connection import get_database
from app.models.daily_care import CareItemList, DailyCareToggle
from app.services import daily_care_service, dog_profile_service

logger = logging.getLogger(__name__)
router = APIRouter()


def _require_db():
    db = get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable.")
    return db


@router.get("/{dog_id}")
async def get_today(dog_id: str, day: str = Query(None, description="ISO date; defaults to the server's today")):
    """The card's whole state — every item, whether it's ticked, and how long
    until it resets."""
    db = _require_db()
    if not await dog_profile_service.exists(db, dog_id):
        raise HTTPException(status_code=404, detail="Dog not found.")
    return await daily_care_service.get_day(db, dog_id, day)


@router.patch("/{dog_id}")
async def toggle_item(dog_id: str, payload: DailyCareToggle):
    """Tick or untick one routine-care item for a day."""
    db = _require_db()
    if not await dog_profile_service.exists(db, dog_id):
        raise HTTPException(status_code=404, detail="Dog not found.")
    try:
        return await daily_care_service.toggle(db, dog_id, payload.item, payload.done, payload.day)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.get("/{dog_id}/items")
async def get_items(dog_id: str):
    """This dog's routine list — its own if customised, otherwise the defaults."""
    db = _require_db()
    if not await dog_profile_service.exists(db, dog_id):
        raise HTTPException(status_code=404, detail="Dog not found.")
    return {"items": await daily_care_service.get_items(db, dog_id)}


@router.put("/{dog_id}/items")
async def put_items(dog_id: str, payload: CareItemList):
    """Replace the whole list. An item keeps its `code` across a rename, which
    is what stops today's ticks detaching when a label changes."""
    db = _require_db()
    if not await dog_profile_service.exists(db, dog_id):
        raise HTTPException(status_code=404, detail="Dog not found.")
    try:
        items = await daily_care_service.set_items(
            db, dog_id, [i.dict() for i in payload.items])
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    # The card's full state back, so the client re-renders from one response.
    return await daily_care_service.get_day(db, dog_id)
