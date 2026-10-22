"""Funnel endpoints: two writes from the quiz, one read for the dashboard.

The writes are deliberately forgiving. Tracking sits on the critical path of
the quiz, and a analytics failure that blocks someone from answering question 3
costs far more than the datapoint is worth — so a rejected or failed write
returns a status the client ignores rather than an error it has to handle.
"""
import csv
import io
import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
from fastapi.responses import Response

from app.auth.dependencies import require_admin
from app.database.connection import get_database
from app.models.funnel import EventIn, Event, ProgressIn, safe_id
from app.services import funnel_service
from app.services import pilot_report as pilot_report_service
from app.security.rate_limit import rate_limit

logger = logging.getLogger(__name__)
router = APIRouter()


def _require_db():
    db = get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable.")
    return db


@router.post("/events", dependencies=[Depends(rate_limit("funnel_events"))])
async def record_event(request: Request):
    """Accepts application/json (every normal event) AND text/plain, which is
    what navigator.sendBeacon sends when a tab is closing (a JSON content type
    would need a CORS preflight, which a closing page never gets to finish).
    Either way the body goes through exactly the same EventIn validation, the
    same rate limit (above) and the same body-size cap (main.py)."""
    try:
        data = json.loads(await request.body() or b"null")
    except ValueError:
        raise HTTPException(status_code=400, detail="Body must be JSON.")
    try:
        payload = EventIn.model_validate(data)
    except ValidationError as err:
        raise RequestValidationError(err.errors())
    db = _require_db()
    stored = await funnel_service.record_event(db, Event(**payload.dict()).dict())
    return {"status": "success" if stored else "ignored"}


@router.post("/progress", dependencies=[Depends(rate_limit("funnel_progress"))])
async def save_progress(payload: ProgressIn):
    """Upserted on every answer, not just at the end. That is the whole point:
    a tab closed at question 4 still leaves questions 1-4 on file."""
    # Same id rules as events. A malformed one is quietly ignored, never an
    # error: tracking must not be able to interrupt the quiz.
    if not safe_id(payload.session_id) or (payload.user_id is not None and not safe_id(payload.user_id)):
        return {"status": "ignored"}
    db = _require_db()
    return await funnel_service.upsert_progress(db, payload.dict(exclude_unset=True))


@router.get("/report", dependencies=[Depends(require_admin)])
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


CSV_COLUMNS = ["session_id", "started_at", "channel", "device", "city", "status",
               "readiness_code", "top_breed", "breeder_cta_clicked"]


@router.get("/export.csv", dependencies=[Depends(require_admin)])
async def funnel_export():
    """One row per quiz session, for pasting numbers into updates. Admin only."""
    db = _require_db()
    rows = await funnel_service.export_rows(db)
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=CSV_COLUMNS)
    writer.writeheader()
    writer.writerows(rows)
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="paw-buddy-funnel.csv"'},
    )


# ------------------------------------------------------------------------- #
# Pilot dashboard (services/pilot_report.py). Read-only and admin only, like
# everything above. Default range: PILOT_START..PILOT_END from settings.
# ------------------------------------------------------------------------- #

@router.get("/pilot-report", dependencies=[Depends(require_admin)])
async def pilot_report(
    start: str = Query(None, description="ISO date, inclusive (default PILOT_START)"),
    end: str = Query(None, description="ISO date, inclusive (default PILOT_END)"),
    days: int = Query(None, ge=1, le=365, description="Last N days instead of a date range"),
    include_test: bool = Query(False, description="Include admins, INTERNAL_TEST_MOBILES, ?utm_source=test and Razorpay test payments"),
):
    db = _require_db()
    try:
        return await pilot_report_service.build_pilot_report(db, start=start, end=end, include_test=include_test, days=days)
    except ValueError:
        raise HTTPException(status_code=400, detail="Dates must be ISO (YYYY-MM-DD).")


@router.get("/pilot-export.csv", dependencies=[Depends(require_admin)])
async def pilot_export(
    start: str = Query(None), end: str = Query(None),
    days: int = Query(None, ge=1, le=365), include_test: bool = Query(False),
):
    """One row per signed-in person: no name, no email, mobile as its last 4
    digits only (unverified). A UTF-8 BOM so Excel shows ₹ and names correctly."""
    db = _require_db()
    try:
        rows = await pilot_report_service.export_people(db, start=start, end=end, include_test=include_test, days=days)
    except ValueError:
        raise HTTPException(status_code=400, detail="Dates must be ISO (YYYY-MM-DD).")
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=pilot_report_service.CSV_COLUMNS)
    writer.writeheader()
    writer.writerows(rows)
    return Response(
        content="﻿" + buf.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="paw-buddy-pilot.csv"'},
    )
