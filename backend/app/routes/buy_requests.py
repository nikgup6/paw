from fastapi import APIRouter, Depends, HTTPException
from app.auth.dependencies import require_admin, require_self_or_admin
from app.models.interaction import BuyRequest
from app.database.connection import get_database
from typing import List

router = APIRouter()

@router.post("")
async def submit_buy_request(request: BuyRequest):
    db = get_database()
    await db["buy_requests"].insert_one(request.dict())
    return {"status": "success"}

# Lead data (name, mobile, city, breed) — reads are admin-gated per-route
# rather than at the router, so POST above (the site's public lead-capture
# submit) stays reachable. The full listing is admin-only; the per-user
# route is self-or-admin, because Profile.jsx calls it for an ordinary
# signed-in user to read their OWN buy history (see require_self_or_admin's
# docstring — admin-only here would 401 every logged-in user's Profile page).
@router.get("", dependencies=[Depends(require_admin)])
async def get_buy_requests():
    db = get_database()
    requests = await db["buy_requests"].find().to_list(100)
    for req in requests:
        req["_id"] = str(req["_id"])
    return requests

@router.get("/user/{user_id}", dependencies=[Depends(require_self_or_admin)])
async def get_user_buy_requests(user_id: str):
    db = get_database()
    cursor = db["buy_requests"].find({"user_id": user_id}).sort("created_at", -1)
    requests = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        requests.append(doc)
    return requests
