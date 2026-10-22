from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.database.connection import get_database
from app.models.funnel import safe_id
from app.security.rate_limit import rate_limit

router = APIRouter()

class VisitRequest(BaseModel):
    visitor_id: str
    # The funnel's own session id (pb_sid), so a visit can be joined to a quiz.
    session_id: Optional[str] = None

@router.post("/visit", dependencies=[Depends(rate_limit("analytics_visit"))])
async def record_anonymous_visit(visit: VisitRequest):
    # Browser UUIDs only; anything else is quietly ignored (see models/funnel.py).
    if not safe_id(visit.visitor_id) or (visit.session_id is not None and not safe_id(visit.session_id)):
        return {"status": "ignored"}
    db = get_database()
    
    # Check if this visitor ID already visited today to prevent spam, or just log all.
    # The requirement says "track whenever someone visits without logging in".
    # We will just insert the record.
    record = {
        "visitor_id": visit.visitor_id,
        "session_id": visit.session_id,
        "visited_at": datetime.utcnow()
    }
    
    await db["anonymous_visits"].insert_one(record)
    return {"status": "success"}
