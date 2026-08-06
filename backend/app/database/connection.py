from motor.motor_asyncio import AsyncIOMotorClient
from app.config.settings import settings
import logging

client = None
db = None

async def connect_to_mongo():
    global client, db
    try:
        client = AsyncIOMotorClient(settings.MONGODB_URI)
        try:
            db = client.get_default_database()
        except Exception:
            db = client["paw_buddy"]
        logging.info("Connected to MongoDB")
    except Exception as e:
        logging.error(f"Error connecting to MongoDB: {e}")

async def close_mongo_connection():
    global client
    if client:
        client.close()
        logging.info("Closed MongoDB connection")

def get_database():
    return db
