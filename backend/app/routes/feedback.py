from fastapi import APIRouter, HTTPException
from app.models.interaction import Feedback
from app.database.connection import get_database

router = APIRouter()

@router.post("")
async def submit_feedback(feedback: Feedback):
    db = get_database()
    await db["feedback"].insert_one(feedback.dict())
    return {"status": "success"}

@router.get("")
async def get_feedback():
    db = get_database()
    feedback_list = await db["feedback"].find().to_list(100)
    for fb in feedback_list:
        fb["_id"] = str(fb["_id"])
    return feedback_list
