from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional

from app.auth.dependencies import require_admin
from app.models.interaction import Feedback
from app.database.connection import get_database

router = APIRouter()


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
