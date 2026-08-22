"""One-off database setup — indexes, readiness seed, legacy-tier migration.

This is the same work `app.main`'s startup event does, pulled out so it can be
run once per DEPLOY instead of once per process.

Why it matters on serverless: every cold start is a fresh process, so the
startup event repeats all of it — roughly fifty create_index round trips to
Atlas plus a seed and a migration — before the first request can be answered.
The user who lands on a cold instance pays for that in latency. Set
RUN_STARTUP_MIGRATIONS=false in the environment and run this instead:

    cd backend
    python init_db.py

Every operation is idempotent, so running it repeatedly is safe; run it after
any deploy that changes indexes or readiness reference data.
"""
import asyncio
import logging

from app.database.connection import connect_to_mongo, close_mongo_connection, get_database
from app.database.indexes import ensure_indexes

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("init_db")


async def main() -> int:
    await connect_to_mongo()
    db = get_database()
    if db is None:
        logger.error("No database connection — check MONGODB_URI in backend/.env.")
        return 1

    try:
        logger.info("Ensuring indexes…")
        await ensure_indexes(db)

        # Imported here, not at module scope, so a failure to connect above is
        # reported as a connection problem rather than an import error.
        from app.services import readiness

        logger.info("Seeding readiness reference data…")
        await readiness.seed(db)

        logger.info("Migrating any legacy readiness tiers…")
        await readiness.migrate_legacy_tiers(db)

        logger.info("Done. Safe to re-run at any time.")
        return 0
    finally:
        await close_mongo_connection()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
