from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from app.models.user import UserCreate, UserInDB, UserResponse
from app.auth.security import get_password_hash, verify_password, create_access_token
from app.database.connection import get_database
from typing import Optional
from datetime import datetime
import uuid

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

@router.post("/register", response_model=UserResponse)
async def register(user: UserCreate):
    db = get_database()
    users_collection = db["users"]
    
    existing_user = await users_collection.find_one({"mobile": user.mobile})
    if existing_user:
        raise HTTPException(status_code=400, detail="Mobile number already registered")
        
    user_in_db = UserInDB(
        id=str(uuid.uuid4()),
        name=user.name,
        mobile=user.mobile,
        city=user.city,
        email=user.email,
        role=user.role,
        pwd_hash=get_password_hash(user.password),
        created_at=datetime.utcnow()
    )
    
    await users_collection.insert_one(user_in_db.dict())
    return UserResponse(**user_in_db.dict())

@router.post("/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    db = get_database()
    users_collection = db["users"]
    
    # We use username field of OAuth2 to accept mobile
    user = await users_collection.find_one({"mobile": form_data.username})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect mobile",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    access_token = create_access_token(data={"sub": user["id"], "role": user["role"]})
    return {"access_token": access_token, "token_type": "bearer", "user": UserResponse(**user)}
