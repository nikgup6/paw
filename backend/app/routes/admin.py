from fastapi import APIRouter, HTTPException, Depends
from app.database.connection import get_database

router = APIRouter()

@router.get("/dashboard")
async def get_dashboard_stats():
    db = get_database()
    users_count = await db["users"].count_documents({})
    feedback_count = await db["feedback"].count_documents({})
    buy_requests_count = await db["buy_requests"].count_documents({})
    quiz_completions = await db["quiz_results"].count_documents({})
    anonymous_count = await db["anonymous_visits"].count_documents({})
    
    return {
        "users": users_count,
        "feedback": feedback_count,
        "buy_requests": buy_requests_count,
        "quiz_completions": quiz_completions,
        "anonymous_visitors": anonymous_count
    }

@router.get("/users")
async def get_all_users(city: str = None):
    db = get_database()
    query = {}
    if city:
        # Case insensitive city search
        query["city"] = {"$regex": f"{city}", "$options": "i"}
    cursor = db["users"].find(query).sort("created_at", -1)
    users = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        if "pwd_hash" in doc:
            del doc["pwd_hash"]
        users.append(doc)
    return users

@router.get("/leads")
async def get_leads():
    db = get_database()
    # Users who have registered but have no quiz results
    users_cursor = db["users"].find({}).sort("created_at", -1)
    leads = []
    
    async for user in users_cursor:
        user_id = user.get("id") or str(user["_id"])
        quiz_count = await db["quiz_results"].count_documents({"user_id": user_id})
        
        if quiz_count == 0:
            user["_id"] = user_id
            if "pwd_hash" in user:
                del user["pwd_hash"]
            user["quiz_status"] = "Not Taken"
            leads.append(user)
            
    return leads

@router.get("/anonymous-visitors")
async def get_anonymous_visitors():
    db = get_database()
    cursor = db["anonymous_visits"].find({}).sort("visited_at", -1)
    visitors = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        if "visited_at" in doc and doc["visited_at"]:
            doc["visited_at"] = doc["visited_at"].isoformat()
        visitors.append(doc)
    return visitors
