from fastapi import APIRouter, HTTPException
from app.models.interaction import BuyRequest
from app.database.connection import get_database
from typing import List

router = APIRouter()

@router.post("")
async def submit_buy_request(request: BuyRequest):
    db = get_database()
    await db["buy_requests"].insert_one(request.dict())
    return {"status": "success"}

@router.get("")
async def get_buy_requests():
    db = get_database()
    requests = await db["buy_requests"].find().to_list(100)
    for req in requests:
        req["_id"] = str(req["_id"])
    return requests

@router.get("/user/{user_id}")
async def get_user_buy_requests(user_id: str):
    db = get_database()
    cursor = db["buy_requests"].find({"user_id": user_id}).sort("created_at", -1)
    requests = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        requests.append(doc)
    return requests
