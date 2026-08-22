from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional

from app.auth.dependencies import require_admin
from app.models.interaction import EXPERIENCE_QUESTIONS, ExperienceFeedback, Feedback
from app.database.connection import get_database

router = APIRouter()

#: Kept apart from the "feedback" collection on purpose — different shape,
#: different guarantees (this one is always attributable), different reader.
EXPERIENCE_COLLECTION = "experience_feedback"

#: Only these may be sorted or filtered on. A whitelist rather than passing the
#: caller's string to Mongo: `sort` takes arbitrary field paths, so an open
#: parameter lets an admin sort by — and thereby probe — anything in the row.
SORTABLE_FIELDS = frozenset(EXPERIENCE_QUESTIONS) | {"created_at"}


@router.post("")
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


@router.post("/experience")
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
