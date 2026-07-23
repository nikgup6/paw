from pydantic_settings import BaseSettings
from typing import Optional

import os


class Settings(BaseSettings):
    PROJECT_NAME: str = "Paw Buddy API"
    MONGODB_URI: str = "mongodb+srv://pawbuddyacc_db_user:HQuFJb5NP0I5A5Wb@pawbuddy.dz5by2f.mongodb.net/?appName=pawBuddy"
    SECRET_KEY: str = "super_secret_key_change_in_production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    ANTHROPIC_API_KEY: Optional[str] = None  # set in backend/.env for the AI Matchmaker

    class Config:
        env_file = ".env"


settings = Settings()
