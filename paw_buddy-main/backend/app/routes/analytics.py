from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from datetime import datetime
from app.database.connection import get_database

router = APIRouter()

class VisitRequest(BaseModel):
    visitor_id: str

@router.post("/visit")
async def record_anonymous_visit(visit: VisitRequest):
    db = get_database()
    
    # Check if this visitor ID already visited today to prevent spam, or just log all.
    # The requirement says "track whenever someone visits without logging in".
    # We will just insert the record.
    record = {
        "visitor_id": visit.visitor_id,
        "visited_at": datetime.utcnow()
    }
    
    await db["anonymous_visits"].insert_one(record)
    return {"status": "success"}
