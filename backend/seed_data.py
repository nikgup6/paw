import asyncio
import json
import logging
from motor.motor_asyncio import AsyncIOMotorClient
from app.config.settings import settings
import uuid

logging.basicConfig(level=logging.INFO)

async def seed_data():
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    try:
        db = client.get_default_database()
    except Exception:
        db = client["paw_buddy"]
        
    logging.info(f"Connected to db: {db.name}")

    # Seed Breeds
    with open("breeds.json", "r", encoding="utf-8") as f:
        breeds = json.load(f)
        
    breeds_col = db["breeds"]
    await breeds_col.delete_many({}) # Clear existing
    
    for breed in breeds:
        if "id" not in breed:
            breed["id"] = str(uuid.uuid4())
            
    if breeds:
        await breeds_col.insert_many(breeds)
        logging.info(f"Seeded {len(breeds)} breeds.")
    else:
        logging.warning("No breeds found to seed.")
        
    # Seed Questions (Optional, but good for backend logic)
    with open("questions.json", "r", encoding="utf-8") as f:
        questions = json.load(f)
        
    questions_col = db["questions"]
    await questions_col.delete_many({}) # Clear existing
    
    if questions:
        await questions_col.insert_many(questions)
        logging.info(f"Seeded {len(questions)} questions.")
    else:
        logging.warning("No questions found to seed.")
        
    client.close()
    logging.info("Seeding complete.")

if __name__ == "__main__":
    asyncio.run(seed_data())
