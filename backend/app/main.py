import logging

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from app.auth.dependencies import require_admin
from app.config.settings import settings, ENV_FILE
from app.database.connection import connect_to_mongo, close_mongo_connection, get_database
from app.database.indexes import ensure_indexes
from app.security.body_limit import BodySizeLimit
from app.security.errors import CatchUnexpected, body_for, log_and_reference
from app.security.headers import SecurityHeaders
from app.security.log_safety import install_log_redaction

# Before anything logs: every log record from here on is checked for secrets and
# phone numbers (app/security/log_safety.py).
install_log_redaction()
from app.routes import auth, breeds, quiz, admin, feedback, buy_requests, analytics, pets, matchmaker, vaccination, health_vault, dogs, funnel, owner_survey, care_tips, daily_care, paywall

logger = logging.getLogger(__name__)

# The interactive API docs (/docs, /redoc) and the machine-readable map of every
# endpoint (/openapi.json) are a gift to anyone probing the live API. Kept on a
# laptop, where they are useful; switched off when ENV=production.
_PRODUCTION = settings.ENV == "production"
app = FastAPI(
    title=settings.PROJECT_NAME,
    docs_url=None if _PRODUCTION else "/docs",
    redoc_url=None if _PRODUCTION else "/redoc",
    openapi_url=None if _PRODUCTION else "/openapi.json",
)

# Middleware order: Starlette wraps each new one AROUND the ones added before,
# so the first added is the innermost. Innermost to outermost here:
#   CatchUnexpected -> BodySizeLimit -> CORS -> SecurityHeaders
# so an unexpected error's 500 still passes through CORS and gets the headers.
app.add_middleware(CatchUnexpected)

# Tracking bodies are a few hundred bytes; 10 KB is a generous ceiling. Added
# BEFORE the CORS middleware on purpose: Starlette wraps each new middleware
# around the earlier ones, so this one sits inside CORS and even its 413 carries
# the CORS headers (otherwise the browser reports a confusing CORS error).
app.add_middleware(BodySizeLimit, limits={
    "/api/funnel/events": 10 * 1024,
    "/api/funnel/progress": 10 * 1024,
    "/api/analytics/visit": 10 * 1024,
    "/api/feedback/pulse": 2 * 1024,       # a 200-character comment plus codes
    "/api/feedback/screener": 1024,
})

# CORS decides which WEBSITES may call this API from a browser. It was "*"
# (every site on the internet) together with allow_credentials=True. Now:
#  - origins: only the ones listed in CORS_ORIGINS (no wildcard; see settings.py)
#  - credentials off: the frontend sends its login token in the Authorization
#    header and never uses cookies, so there is nothing for this to allow
#  - methods and headers: exactly what the frontend sends, nothing more
#  - Retry-After exposed, so the page can read how long a rate limit lasts
# CORS is a browser rule only. It does not stop curl or a script calling the API
# directly - the rate limits and the login checks are what do that.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
    expose_headers=["Retry-After"],
    max_age=600,
)

# Added last, so it is the outermost layer: every response gets these headers,
# including CORS refusals and the size limit's 413. See app/security/headers.py.
app.add_middleware(SecurityHeaders, frame_origins=settings.cors_origins)


@app.exception_handler(Exception)
async def unexpected_error(request: Request, exc: Exception):
    """Last resort, for an error raised inside a middleware. Errors from the
    routes are caught earlier by CatchUnexpected (app/security/errors.py), whose
    reply carries the CORS and security headers - this one, run by Starlette
    outside every middleware, cannot."""
    ref = log_and_reference(request.method, request.url.path, exc)
    return Response(content=body_for(ref), status_code=500, media_type="application/json")

def _log_configuration_status():
    """Report missing integration config at boot, so a misconfigured server is
    obvious immediately instead of only when a user's first upload 503s."""
    from app.services import cloudinary_service
    from app.services.ai_processing import provider

    logger.info("Config source: %s (%s)", ENV_FILE, "found" if ENV_FILE.exists() else "MISSING")

    if settings.ENV == "production" and settings.TRUSTED_PROXY_COUNT == 0:
        logger.warning(
            "ENV=production with TRUSTED_PROXY_COUNT=0. Behind a proxy (Vercel is one) every "
            "visitor then looks like the proxy and they all share ONE rate limit. Set "
            "TRUSTED_PROXY_COUNT=1 on Vercel.")

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

    # Index creation, seeding and the legacy-tier migration are all idempotent,
    # which made running them on every boot look free. On a long-lived server it
    # is. On serverless it is not: a cold start is a whole new process, so all
    # of it runs again before the first request gets a response — dozens of
    # round trips to Atlas, paid for by whoever happens to arrive on a cold
    # instance. Set RUN_STARTUP_MIGRATIONS=false there and run init_db.py as a
    # deploy step instead.
    if not settings.RUN_STARTUP_MIGRATIONS:
        logger.info(
            "RUN_STARTUP_MIGRATIONS=false — skipping index/seed/migration on boot. "
            "Run `python init_db.py` after deploying if the schema changed."
        )
        return

    await ensure_indexes(get_database())
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
# Status is public (the quiz needs the mode before sign-in); order and verify
# need a sign-in per route; the webhook is proven by Razorpay's signature.
app.include_router(paywall.router, prefix="/api/paywall", tags=["paywall"])
app.include_router(dogs.router, prefix="/api/dogs", tags=["dogs"])
app.include_router(vaccination.router, prefix="/api/vaccination-documents", tags=["vaccination (legacy alias)"])
app.include_router(health_vault.router, prefix="/api/health-vault", tags=["health-vault"])
