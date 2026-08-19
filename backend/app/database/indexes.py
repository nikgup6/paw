"""Index setup for MongoDB collections.

MongoDB is schemaless, so there is no table migration to run — collections and
fields appear on first insert. The equivalent of a migration here is ensuring
the indexes a collection needs. This runs on startup and is idempotent (calling
create_index repeatedly is a no-op once the index exists), so it doubles as the
"migration" for the vaccination_documents collection.
"""
import logging

logger = logging.getLogger(__name__)


async def ensure_indexes(db) -> None:
    if db is None:
        logger.warning("ensure_indexes skipped: no database connection")
        return
    try:
        vax = db["vaccination_documents"]
        await vax.create_index("id", unique=True)      # our app-level document id
        await vax.create_index("dog_id")               # list a dog's documents fast
        await vax.create_index("processing_status")    # pipeline queries
        await vax.create_index("upload_date")

        vaccinations = db["vaccinations"]
        await vaccinations.create_index("id", unique=True)
        await vaccinations.create_index("dog_id")               # timeline lookups
        await vaccinations.create_index("source_document_id")   # cascade delete
        await vaccinations.create_index("needs_review")

        # Health Vault (generalized medical-document store)
        health = db["health_documents"]
        await health.create_index("id", unique=True)
        await health.create_index("dog_id")
        await health.create_index("document_type")
        await health.create_index("processing_status")

        # Dog profiles — the anchor every health record hangs off.
        dogs = db["dog_profiles"]
        await dogs.create_index("id", unique=True)
        await dogs.create_index("owner_id")          # list an owner's dogs fast

        # Prescriptions (Medical Logs) and owner-created reminders. Both are
        # dog-scoped, so dog_id is the index that matters for every read.
        prescriptions = db["prescriptions"]
        await prescriptions.create_index("id", unique=True)
        await prescriptions.create_index("dog_id")
        await prescriptions.create_index("source_document_id")   # cascade delete

        # Deworming doses read off a health booklet — the evidence side of the
        # generated deworming schedule.
        dewormings = db["dewormings"]
        await dewormings.create_index("id", unique=True)
        await dewormings.create_index("dog_id")
        await dewormings.create_index("source_document_id")   # cascade delete

        custom = db["custom_reminders"]
        await custom.create_index("id", unique=True)
        await custom.create_index("dog_id")
        await custom.create_index("due_date")

        # Generated schedule entries the owner has hidden.
        dismissals = db["schedule_dismissals"]
        await dismissals.create_index("id", unique=True)
        await dismissals.create_index([("dog_id", 1), ("entry_key", 1)], unique=True)

        reminders = db["reminders"]
        await reminders.create_index("id", unique=True)
        await reminders.create_index("dog_id")
        await reminders.create_index("vaccination_id")          # one reminder per vaccination
        await reminders.create_index("source_document_id")      # cascade delete
        await reminders.create_index("due_date")

        # ---- Acquisition funnel ------------------------------------------- #
        # `events` is append-only and is the source of truth for what happened.
        # Every dashboard read filters by event_name over a date window, or
        # replays one session, so those are the two indexes that matter.
        events = db["events"]
        await events.create_index([("event_name", 1), ("created_at", -1)])
        await events.create_index("session_id")
        await events.create_index("created_at")

        # `quiz_progress` is mutable: one row per session, rewritten on every
        # answer. session_id is the upsert key, so it has to be unique — two
        # rows for one session would silently double every count built off it.
        progress = db["quiz_progress"]
        await progress.create_index("session_id", unique=True)
        await progress.create_index("status")
        await progress.create_index("readiness_code")
        await progress.create_index("updated_at")

        # The reference table behind readiness_code. One row per level, so the
        # code is the natural key.
        await db["readiness_levels"].create_index("code", unique=True)

        # Existing Dog Owner survey. Reads are "newest first" and filtered by
        # breed or city from the admin table, so those are the three that matter.
        surveys = db["owner_surveys"]
        await surveys.create_index("id", unique=True)
        await surveys.create_index("created_at")
        await surveys.create_index("breed")
        await surveys.create_index("city")

        # Care Tips — replaced wholesale on every workbook import, so the
        # indexes just need to make matching (breed+category+approval) and
        # the admin browse (breed/category filters) fast, not enforce
        # uniqueness the source spreadsheet doesn't itself guarantee.
        care_tips = db["care_tips"]
        await care_tips.create_index("id", unique=True)
        await care_tips.create_index([("breed_name", 1), ("category", 1), ("is_approved", 1)])

        await db["care_tip_fallback"].create_index("id", unique=True)

        season_cal = db["city_season_calendar"]
        await season_cal.create_index("id", unique=True)
        await season_cal.create_index([("city", 1), ("month", 1)])

        # Today's routine wellness care. (dog_id, day) is the upsert key and
        # must be unique — two rows for one dog-day would let a tick vanish
        # depending on which document a read happened to find first.
        daily = db["daily_care"]
        await daily.create_index([("dog_id", 1), ("day", 1)], unique=True)
        await daily.create_index("day")

        # The per-dog habit list. One document per dog, so dog_id is unique.
        await db["daily_care_items"].create_index("dog_id", unique=True)

        logger.info("Indexes ensured for dog_profiles + vaccination_documents + vaccinations "
                    "+ health_documents + prescriptions + reminders + custom_reminders "
                    "+ events + quiz_progress + care_tips")
    except Exception:
        logger.warning("Failed to ensure indexes", exc_info=True)
