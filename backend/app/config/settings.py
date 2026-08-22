from pydantic_settings import BaseSettings
from typing import Optional
from pathlib import Path

import os

# backend/app/config/settings.py -> backend/
BACKEND_DIR = Path(__file__).resolve().parents[2]
ENV_FILE = BACKEND_DIR / ".env"


class Settings(BaseSettings):
    PROJECT_NAME: str = "Paw Buddy API"
    MONGODB_URI: str = "mongodb+srv://pawbuddyacc_db_user:HQuFJb5NP0I5A5Wb@pawbuddy.dz5by2f.mongodb.net/?appName=pawBuddy"
    SECRET_KEY: str = "super_secret_key_change_in_production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # No longer read anywhere (admin sign-in is mobile-only, same as every
    # other account) — kept as a declared field only so the existing
    # backend/.env entry doesn't crash Settings() under extra_forbidden.
    ADMIN_PASSWORD: Optional[str] = None

    # Whether boot-time database setup (indexes, readiness seed, legacy-tier
    # migration) runs inside the app's startup event.
    #
    # Leave True for a long-lived server, where it runs once and costs nothing.
    # Set False on serverless — on Vercel every cold start is a fresh process,
    # so this work is redone before the first request can be served: ~51
    # create_index round trips to Atlas plus a seed and a migration, which is
    # seconds of latency charged to whichever user happened to arrive first.
    # With it False, run `python init_db.py` once per deploy instead; the
    # operations are idempotent, so running it more often is harmless.
    RUN_STARTUP_MIGRATIONS: bool = True

    ANTHROPIC_API_KEY: Optional[str] = None  # set in backend/.env for the AI Matchmaker

    # Cloudinary — stores uploaded vaccination documents. Set either the three
    # split vars, OR a single CLOUDINARY_URL, in backend/.env.
    CLOUDINARY_CLOUD_NAME: Optional[str] = None
    CLOUDINARY_API_KEY: Optional[str] = None
    CLOUDINARY_API_SECRET: Optional[str] = None
    CLOUDINARY_URL: Optional[str] = None
    CLOUDINARY_UPLOAD_FOLDER: str = "paw_buddy/vaccination_records"

    # AI processing — provider-agnostic. AI_PROVIDER picks the backend used by the
    # Health Vault: "gemini" (default), "openai", or "anthropic". Business logic
    # never depends on which one is set.
    AI_PROVIDER: str = "gemini"
    # A record must reach this confidence AND pass validation to auto-create a
    # reminder; anything below is routed to Needs Review for user confirmation.
    AI_AUTO_REMINDER_THRESHOLD: float = 0.8

    # Google Gemini (default provider)
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-2.0-flash"

    # OpenAI (optional alternative provider)
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: str = "gpt-4o-mini"

    # Anthropic / Claude (optional alternative provider; ANTHROPIC_API_KEY above)
    ANTHROPIC_MODEL: str = "claude-sonnet-4-5"

    class Config:
        # Absolute path: a bare ".env" resolves against the process working
        # directory, so starting uvicorn from anywhere other than backend/ would
        # silently load no config at all (uploads then fail with "storage is not
        # configured"). Anchoring to BACKEND_DIR makes it work from any CWD.
        env_file = str(ENV_FILE)


settings = Settings()
