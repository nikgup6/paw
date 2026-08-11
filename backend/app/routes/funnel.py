"""Funnel endpoints: two writes from the quiz, one read for the dashboard.

The writes are deliberately forgiving. Tracking sits on the critical path of
the quiz, and a analytics failure that blocks someone from answering question 3
costs far more than the datapoint is worth — so a rejected or failed write
returns a status the client ignores rather than an error it has to handle.
"""
import logging

from fastapi import APIRouter, HTTPException, Query

from app.database.connection import get_database
from app.models.funnel import EventIn, Event, ProgressIn
from app.services import funnel_service

logger = logging.getLogger(__name__)
router = APIRouter()


def _require_db():
    db = get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable.")
    return db


@router.post("/events")
async def record_event(payload: EventIn):
    db = _require_db()
    stored = await funnel_service.record_event(db, Event(**payload.dict()).dict())
    return {"status": "success" if stored else "ignored"}


@router.post("/progress")
async def save_progress(payload: ProgressIn):
    """Upserted on every answer, not just at the end. That is the whole point:
    a tab closed at question 4 still leaves questions 1-4 on file."""
    db = _require_db()
    return await funnel_service.upsert_progress(db, payload.dict(exclude_unset=True))


@router.get("/report")
async def funnel_report(
    days: int = Query(30, ge=1, le=365),
    start: str = Query(None, description="ISO date, inclusive"),
    end: str = Query(None, description="ISO date, inclusive"),
):
    """Everything the admin dashboard renders. Recomputed per request."""
    db = _require_db()
    try:
        return await funnel_service.build_report(db, days=days, start=start, end=end)
    except ValueError:
        raise HTTPException(status_code=400, detail="Dates must be ISO (YYYY-MM-DD).")
