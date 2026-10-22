from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from app.auth.dependencies import optional_user, require_self_or_admin
from app.models.interaction import QuizResult
from app.database.connection import get_database
# from app.services.recommendation import get_recommendations

router = APIRouter()

@router.post("/submit", response_model=QuizResult)
async def submit_quiz(quiz_data: dict, claims: Optional[dict] = Depends(optional_user)):
    """Public: anyone can take the quiz and have the result saved.

    Signed in, the result is filed under the account in the token. Not signed
    in (or a stale token), it is saved as anonymous. The `user_id` in the body
    is ignored: believing it let anyone file results into a stranger's history."""
    db = get_database()

    # Persist the actual recommendations the client computed (quiz or AI matchmaker).
    # Coerce to a list of breed-name strings so the record is always well-formed.
    raw_top = quiz_data.get("top_breeds") or []
    top_breeds = [str(b) for b in raw_top if b]

    result = QuizResult(
        user_id=claims["sub"] if claims else None,
        answers=quiz_data.get("answers", {}),
        top_breeds=top_breeds,
    )

    doc = result.dict()
    # Tag the source so admins can tell quiz runs from AI-matchmaker runs.
    doc["source"] = "matchmaker" if quiz_data.get("answers", {}).get("_prompt") else "quiz"

    await db["quiz_results"].insert_one(doc)
    return result

# The owner, or an admin. Quiz answers include city, home, family and budget.
@router.get("/user/{user_id}", dependencies=[Depends(require_self_or_admin)])
async def get_user_quizzes(user_id: str):
    db = get_database()
    cursor = db["quiz_results"].find({"user_id": user_id}).sort("created_at", -1)
    quizzes = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        quizzes.append(doc)
    return quizzes
