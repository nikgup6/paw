"""Today's routine wellness care (`/api/daily-care`).

Signed-in owners only, like every dog-scoped endpoint: the dog must belong to
the account in the token (app/auth/dog_access.py); otherwise 404.
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, Query

from app.auth.dependencies import require_user
from app.auth.dog_access import owned_dog

from app.database.connection import get_database
from app.models.daily_care import CareItemList, DailyCareToggle
from app.services import daily_care_service

logger = logging.getLogger(__name__)
router = APIRouter()


def _require_db():
    db = get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable.")
    return db


@router.get("/{dog_id}")
async def get_today(dog_id: str, day: str = Query(None, description="ISO date; defaults to the server's today"), claims: dict = Depends(require_user)):
    """The card's whole state — every item, whether it's ticked, and how long
    until it resets."""
    db = _require_db()
    await owned_dog(db, dog_id, claims)
    return await daily_care_service.get_day(db, dog_id, day)


@router.patch("/{dog_id}")
async def toggle_item(dog_id: str, payload: DailyCareToggle, claims: dict = Depends(require_user)):
    """Tick or untick one routine-care item for a day."""
    db = _require_db()
    await owned_dog(db, dog_id, claims)
    try:
        return await daily_care_service.toggle(db, dog_id, payload.item, payload.done, payload.day)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.get("/{dog_id}/items")
async def get_items(dog_id: str, claims: dict = Depends(require_user)):
    """This dog's routine list — its own if customised, otherwise the defaults."""
    db = _require_db()
    await owned_dog(db, dog_id, claims)
    return {"items": await daily_care_service.get_items(db, dog_id)}


@router.put("/{dog_id}/items")
async def put_items(dog_id: str, payload: CareItemList, claims: dict = Depends(require_user)):
    """Replace the whole list. An item keeps its `code` across a rename, which
    is what stops today's ticks detaching when a label changes."""
    db = _require_db()
    await owned_dog(db, dog_id, claims)
    try:
        items = await daily_care_service.set_items(
            db, dog_id, [i.dict() for i in payload.items])
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    # The card's full state back, so the client re-renders from one response.
    return await daily_care_service.get_day(db, dog_id)
