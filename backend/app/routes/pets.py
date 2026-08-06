from fastapi import APIRouter, HTTPException, Depends
from app.models.pet import PetProfile
from app.database.connection import get_database
from typing import Optional
import logging

router = APIRouter()

@router.post("/")
async def create_or_update_pet(pet_data: PetProfile):
    db = get_database()
    pets_collection = db["pets"]
    
    # Store or update pet profile based on user_id
    pet_dict = pet_data.dict()
    # Check if there is already a pet profile for this user
    existing_pet = await pets_collection.find_one({"user_id": pet_data.user_id})
    if existing_pet:
        await pets_collection.update_one(
            {"user_id": pet_data.user_id},
            {"$set": pet_dict}
        )
        return {"status": "success", "message": "Pet profile updated", "pet": pet_dict}
    else:
        await pets_collection.insert_one(pet_dict)
        return {"status": "success", "message": "Pet profile created", "pet": pet_dict}

@router.get("/user/{user_id}")
async def get_user_pet(user_id: str):
    db = get_database()
    pet = await db["pets"].find_one({"user_id": user_id})
    if not pet:
        raise HTTPException(status_code=404, detail="Pet profile not found for this user")
    
    # Clean MongoDB _id field for JSON serialization
    pet["_id"] = str(pet["_id"])
    return pet
