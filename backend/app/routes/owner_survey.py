"""Existing Dog Owner survey endpoints.

Submitting is public — the form runs before any login exists. Reading is not:
the responses are owner-supplied data and sit behind the same admin gate as
every other /api/admin route.
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response

from app.auth.dependencies import require_admin
from app.database.connection import get_database
from app.models.owner_survey import OwnerSurveyIn
from app.services import owner_survey_service

logger = logging.getLogger(__name__)
router = APIRouter()


def _require_db():
    db = get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable.")
    return db


@router.post("/submit")
async def submit_survey(payload: OwnerSurveyIn):
    """Public: one completed 8-question form."""
    db = _require_db()
    data = payload.dict()

    problems = owner_survey_service.validate(data)
    if problems:
        # 422 with the specific fields, so a mismatched build fails loudly in
        # testing instead of writing junk that only shows up in the export.
        raise HTTPException(status_code=422, detail="; ".join(problems))

    return await owner_survey_service.submit(db, data)


@router.get("/responses", dependencies=[Depends(require_admin)])
async def list_responses(
    breed: str = Query(None),
    city: str = Query(None),
):
    """Admin: every submission, newest first, optionally filtered."""
    db = _require_db()
    return {
        "stats": await owner_survey_service.stats(db),
        "responses": await owner_survey_service.list_all(db, breed=breed, city=city),
    }


@router.get("/export.csv", dependencies=[Depends(require_admin)])
async def export_responses():
    """Admin: the same data as a spreadsheet.

    Content-Disposition makes the browser save it rather than render it, and
    the UTF-8 BOM is what stops Excel mangling the en-dashes in answers like
    "5 – 8 hours" into mojibake."""
    db = _require_db()
    csv_text = await owner_survey_service.export_csv(db)
    return Response(
        content="﻿" + csv_text,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="paw-buddy-owner-surveys.csv"'},
    )
