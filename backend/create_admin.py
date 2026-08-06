import asyncio
import logging
from motor.motor_asyncio import AsyncIOMotorClient
from app.config.settings import settings
from app.auth.security import get_password_hash
from app.models.user import UserInDB
from datetime import datetime
import uuid

logging.basicConfig(level=logging.INFO)

async def create_admin():
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    try:
        db = client.get_default_database()
    except Exception:
        db = client["paw_buddy"]
        
    users_col = db["users"]
    
    # Check if admin exists
    admin_exists = await users_col.find_one({"mobile": "9999999999"})
    if admin_exists:
        logging.info("Admin user already exists.")
        return

    admin_user = UserInDB(
        id=str(uuid.uuid4()),
        name="Admin",
        mobile="9999999999",
        city="AdminCity",
        email="admin@pawbuddy.in",
        role="ADMIN",
        pwd_hash=get_password_hash("admin123"),
        created_at=datetime.utcnow()
    )
    
    await users_col.insert_one(admin_user.dict())
    logging.info("Admin user created successfully! (Mobile: 9999999999, Password: admin123)")
    client.close()

if __name__ == "__main__":
    asyncio.run(create_admin())
