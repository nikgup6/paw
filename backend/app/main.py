import logging

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.auth.dependencies import require_admin
from app.config.settings import settings, ENV_FILE
from app.database.connection import connect_to_mongo, close_mongo_connection, get_database
from app.database.indexes import ensure_indexes
from app.routes import auth, breeds, quiz, admin, feedback, buy_requests, analytics, pets, matchmaker, vaccination, health_vault, dogs, funnel, owner_survey, care_tips, daily_care

logger = logging.getLogger(__name__)

app = FastAPI(title=settings.PROJECT_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Update for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def _log_configuration_status():
    """Report missing integration config at boot, so a misconfigured server is
    obvious immediately instead of only when a user's first upload 503s."""
    from app.services import cloudinary_service
    from app.services.ai_processing import provider

    logger.info("Config source: %s (%s)", ENV_FILE, "found" if ENV_FILE.exists() else "MISSING")

    if not cloudinary_service.is_configured():
        logger.warning(
            "Cloudinary is NOT configured -> document uploads will fail with HTTP 503. "
            "Set CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET "
            "(or CLOUDINARY_URL) in %s and restart.", ENV_FILE,
        )
    else:
        logger.info("Cloudinary configured.")

    if not settings.ANTHROPIC_API_KEY:
        logger.warning(
            "ANTHROPIC_API_KEY is NOT set -> the AI Matchmaker falls back to the "
            "local keyword parser. The feature still works, but it is not doing "
            "any AI parsing. Set it in %s to enable it.", ENV_FILE)
    else:
        logger.info("AI Matchmaker configured (Anthropic).")

    if not provider.is_configured():
        logger.warning(
            "AI provider '%s' is NOT configured -> uploads still succeed and the file is "
            "stored, but documents stay 'Pending' with no extraction. Set the provider's "
            "API key in %s and restart.", settings.AI_PROVIDER, ENV_FILE,
        )
    else:
        logger.info("AI provider configured: %s", settings.AI_PROVIDER)


@app.on_event("startup")
async def startup_db_client():
    _log_configuration_status()
    await connect_to_mongo()
    await ensure_indexes(get_database())
    # The readiness reference data, and the one-way move off the old
    # hot/warm/cool/cold tiering. Both idempotent — safe on every boot.
    from app.services import readiness
    await readiness.seed(get_database())
    await readiness.migrate_legacy_tiers(get_database())

@app.on_event("shutdown")
async def shutdown_db_client():
    await close_mongo_connection()

# HEAD as well as GET: uptime monitors and load balancers probe with HEAD, and
# a 405 on the health check reads as an outage.
@app.api_route("/", methods=["GET", "HEAD"])
async def root():
    return {"message": "Welcome to Paw Buddy API"}

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(breeds.router, prefix="/api/breeds", tags=["breeds"])
app.include_router(quiz.router, prefix="/api/quiz", tags=["quiz"])
app.include_router(pets.router, prefix="/api/pets", tags=["pets"])
app.include_router(feedback.router, prefix="/api/feedback", tags=["feedback"])
app.include_router(buy_requests.router, prefix="/api/buy", tags=["buy"])
# Every admin endpoint is behind the token check, applied at the router so a
# route added later is protected by default rather than by remembering.
app.include_router(admin.router, prefix="/api/admin", tags=["admin"],
                   dependencies=[Depends(require_admin)])
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])
app.include_router(funnel.router, prefix="/api/funnel", tags=["funnel"])
# Submitting is public (the form runs pre-login); reading is admin-gated
# per-route inside the module rather than at the router.
app.include_router(owner_survey.router, prefix="/api/owner-survey", tags=["owner-survey"])
# Matching is public (runs right after the survey posts); import/browse/approve
# are admin-gated per-route inside the module, same split as owner_survey.
app.include_router(care_tips.router, prefix="/api/care-tips", tags=["care-tips"])
# Dog-scoped like /api/dogs, so it follows that access model rather than a
# stricter one nothing could satisfy while there is no login.
app.include_router(daily_care.router, prefix="/api/daily-care", tags=["daily-care"])
app.include_router(matchmaker.router, prefix="/api/matchmaker", tags=["matchmaker"])
app.include_router(dogs.router, prefix="/api/dogs", tags=["dogs"])
app.include_router(vaccination.router, prefix="/api/vaccination-documents", tags=["vaccination (legacy alias)"])
app.include_router(health_vault.router, prefix="/api/health-vault", tags=["health-vault"])
