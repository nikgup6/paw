from fastapi import APIRouter, Depends, HTTPException, Query, Request
from typing import Optional

from app.auth.dependencies import optional_user, require_admin
from app.models.interaction import EXPERIENCE_QUESTIONS, ExperienceFeedback, Feedback
from app.models.funnel import safe_id
from app.models.pulse import PULSE_VERSION, PulseIn, ScreenerIn
from app.database.connection import get_database
from app.security import rate_limit as rl
from app.security.rate_limit import rate_limit
from app.services import pulse_service

router = APIRouter()

#: Kept apart from the "feedback" collection on purpose — different shape,
#: different guarantees (this one is always attributable), different reader.
EXPERIENCE_COLLECTION = "experience_feedback"

#: Only these may be sorted or filtered on. A whitelist rather than passing the
#: caller's string to Mongo: `sort` takes arbitrary field paths, so an open
#: parameter lets an admin sort by — and thereby probe — anything in the row.
SORTABLE_FIELDS = frozenset(EXPERIENCE_QUESTIONS) | {"created_at"}


@router.post("", dependencies=[Depends(rate_limit("feedback"))])
async def submit_feedback(feedback: Feedback):
    """Public: anyone can leave feedback, signed in or not.

    Stays public deliberately — this is fired from one-tap prompts all over
    the product, including screens a logged-out visitor sees. The read side
    below is the part that needed locking down."""
    db = get_database()
    await db["feedback"].insert_one(feedback.dict())
    return {"status": "success"}


@router.get("", dependencies=[Depends(require_admin)])
async def get_feedback(
    context: Optional[str] = Query(None, description="Filter to one context, e.g. care_tip"),
):
    """Admin only.

    This was public, and it returns user_id, user_name and free-text comments —
    the same class of leak as the buy-request listing. Gated per-route rather
    than at the router so POST above stays reachable.

    Newest first: an unordered list of the last 100 inserted was effectively
    arbitrary once feedback started arriving from several places at once."""
    db = get_database()
    query = {"context": context} if context else {}
    feedback_list = await db["feedback"].find(query).sort("created_at", -1).to_list(100)
    for fb in feedback_list:
        fb["_id"] = str(fb["_id"])
    return feedback_list


@router.post("/experience", dependencies=[Depends(rate_limit("feedback_experience"))])
async def submit_experience_feedback(entry: ExperienceFeedback):
    """Public: the 5-question survey from the app's "More" sheet.

    Public for the same reason the POST above is — it is fired from the client
    with no bearer token — but unlike that one it cannot be anonymous: the
    model requires `owner_id`, so a submission missing it is rejected as a 422
    instead of landing as an unattributable row."""
    db = get_database()
    await db[EXPERIENCE_COLLECTION].insert_one(entry.dict())
    return {"status": "success"}


@router.get("/experience", dependencies=[Depends(require_admin)])
async def list_experience_feedback(
    owner_id: Optional[str] = Query(None, description="Filter to one owner."),
    sort_by: str = Query("created_at", description="created_at or any of the five question keys."),
    order: str = Query("desc", description="asc or desc."),
    score_field: Optional[str] = Query(None, description="Which question score_min/score_max apply to."),
    score_min: Optional[int] = Query(None, ge=1, le=5),
    score_max: Optional[int] = Query(None, ge=1, le=5),
    limit: int = Query(200, ge=1, le=1000),
):
    """Admin: every survey, each score its own column.

    Sortable and filterable by owner and by any single question, which is the
    entire point of storing the five separately — "show me everyone who rated
    match_accuracy 2 or below" is the question this data exists to answer, and
    it is unaskable of an averaged score.

    Also returns per-question averages across the whole (filtered) set, so the
    weak dimension is visible without eyeballing the column."""
    if sort_by not in SORTABLE_FIELDS:
        raise HTTPException(status_code=400, detail=f"Cannot sort by {sort_by!r}.")
    if score_field is not None and score_field not in EXPERIENCE_QUESTIONS:
        raise HTTPException(status_code=400, detail=f"Unknown question {score_field!r}.")
    if (score_min is not None or score_max is not None) and score_field is None:
        raise HTTPException(
            status_code=400,
            detail="score_min/score_max need score_field — a bound is meaningless without the question it applies to.",
        )

    query = {}
    if owner_id:
        query["owner_id"] = owner_id
    if score_field is not None:
        bounds = {}
        if score_min is not None:
            bounds["$gte"] = score_min
        if score_max is not None:
            bounds["$lte"] = score_max
        if bounds:
            query[score_field] = bounds

    db = get_database()
    direction = 1 if order == "asc" else -1
    rows = await db[EXPERIENCE_COLLECTION].find(query).sort(sort_by, direction).to_list(limit)
    for row in rows:
        row["_id"] = str(row["_id"])

    # Averaged for DISPLAY only, over whatever the filter selected — the stored
    # rows keep their five separate scores untouched.
    averages = {}
    for key in EXPERIENCE_QUESTIONS:
        values = [r[key] for r in rows if isinstance(r.get(key), int)]
        averages[key] = round(sum(values) / len(values), 2) if values else None

    return {"entries": rows, "count": len(rows), "averages": averages}


# ------------------------------------------------------------------------- #
# "Was this useful?" pop-up (frontend/src/components/results/ResultsPulse.jsx).
# The whitelists are in models/pulse.py; the logic in services/pulse_service.py.
# Everything above this line is unchanged.
# ------------------------------------------------------------------------- #

def _db():
    db = get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable.")
    return db


async def _limit(request: Request, session_id: str) -> None:
    """200 an hour per connection (a college Wi-Fi is one address for everyone
    on it) and 10 an hour per visit (one person answers at most 5 times)."""
    await rl.enforce("pulse_ip", rl.client_ip(request))
    await rl.enforce("pulse_session", session_id, whose="from this visit")


@router.post("/pulse")
async def submit_pulse(payload: PulseIn, request: Request, claims: Optional[dict] = Depends(optional_user)):
    """"Was this recommendation useful to you?" One row per session in the
    existing feedback collection; posting again (say, with a comment) updates
    it. A code outside yes/some/no, or a comment with a link, is a 422."""
    await _limit(request, payload.session_id)
    await pulse_service.save_pulse(_db(), payload, claims)
    return {"status": "success"}


@router.post("/screener")
async def submit_screener(payload: ScreenerIn, request: Request, claims: Optional[dict] = Depends(optional_user)):
    """One screener answer. Key and answer are checked against the whitelist;
    a repeat tap for the same key replaces the answer."""
    await _limit(request, payload.session_id)
    await pulse_service.save_screener(_db(), payload, claims)
    return {"status": "success"}


@router.get("/pulse/status")
async def pulse_status(
    request: Request,
    session_id: str = Query(...),
    version: int = Query(PULSE_VERSION, ge=1, le=1000),
    claims: Optional[dict] = Depends(optional_user),
):
    """Public. Was this visit (or this signed-in account) already asked? Returns
    booleans and question keys only - nothing personal."""
    if not safe_id(session_id):
        raise HTTPException(status_code=422, detail="bad session_id")
    await rl.enforce("pulse_status", rl.client_ip(request))
    return await pulse_service.status(_db(), session_id, claims["sub"] if claims else None, version)


@router.get("/pulse/summary", dependencies=[Depends(require_admin)])
async def pulse_summary(
    start: Optional[str] = Query(None, description="ISO date, inclusive"),
    end: Optional[str] = Query(None, description="ISO date, inclusive"),
    days: int = Query(30, ge=1, le=365),
    include_test: bool = Query(False, description="Include visits tagged ?utm_source=test"),
):
    """Admin only. Counts, distributions, response rate and the latest comments
    (with date, breed and paywall state - never a name, number or email)."""
    try:
        return await pulse_service.summary(_db(), start, end, include_test, days)
    except ValueError:
        raise HTTPException(status_code=400, detail="Dates must be ISO (YYYY-MM-DD).")
