"""Health Vault Service — the upload/ingest orchestrator.

Owns the end-to-end flow for a medical document while delegating each concern to
its own service: Cloudinary (storage), the AI processing registry (extraction),
the reminder service, and the timeline projection. Routes call these functions;
no business logic lives in the route layer.

The original file is always kept, whatever the AI does. Extraction failing marks
the document Failed and leaves it retryable (`reprocess`) — it never costs the
owner the document they uploaded.
"""
import logging
import uuid
from typing import Optional

from app.models.health_vault import HealthDocument, DocumentType
from app.models.vaccination import ProcessingStatus
from app.services import cloudinary_service, reminder_service
from app.services.ai_processing import provider
from app.services.ai_processing.registry import get_processor
from app.services.health_status import utc_now

logger = logging.getLogger(__name__)

DOCUMENTS = "health_documents"
VACCINATIONS = "vaccinations"
PRESCRIPTIONS = "prescriptions"
DEWORMINGS = "dewormings"

#: Collections that hold rows extracted from a document. Deleting a document
#: "with its records" clears the document's rows from all of them.
EXTRACTED_COLLECTIONS = (VACCINATIONS, PRESCRIPTIONS, DEWORMINGS)


def _as_record(row: dict) -> dict:
    """A stored row seen as the extracted record it came from, so a processor's
    duplicate_key() works against both."""
    row = dict(row)
    row.pop("_id", None)
    row.setdefault("administration_date", row.get("date_given"))
    row.setdefault("confidence", row.get("confidence_score"))
    return row


def _norm(s) -> str:
    return (s or "").strip().lower()


def _meta_dict(base: dict, **extra) -> dict:
    out = dict(base or {})
    out.update(extra)
    return out


async def _get_document(db, document_id: str):
    doc = await db[DOCUMENTS].find_one({"id": document_id})
    if doc:
        doc.pop("_id", None)
    return doc


async def ingest(db, dog_id: str, file_bytes: bytes, filename: str, mime_type: str,
                 document_type: str = DocumentType.VACCINATION.value) -> dict:
    """Store the file in Cloudinary + the Health Vault, then run the matching AI
    processor (if any), persisting extraction, summary, confidence, metadata,
    structured records, and reminders. Returns the stored HealthDocument."""
    # 1. Cloudinary first — the permanently-kept original.
    uploaded = await cloudinary_service.upload_document(file_bytes, filename, mime_type)

    # 2. Vault record (Processing).
    job_id = str(uuid.uuid4())
    document = HealthDocument(
        dog_id=dog_id,
        document_type=document_type,
        cloudinary_url=uploaded["secure_url"],
        cloudinary_public_id=uploaded["public_id"],
        cloudinary_resource_type=uploaded["resource_type"],
        original_filename=filename,
        mime_type=mime_type,
        file_size=len(file_bytes),
        processing_status=ProcessingStatus.PROCESSING,
        ai_metadata={"processing_job_id": job_id},
    )
    await db[DOCUMENTS].insert_one(document.dict())

    # 3. Process.
    await _process(db, document.dict(), file_bytes, mime_type)
    return await _get_document(db, document.id)


async def reprocess(db, document_id: str) -> Optional[dict]:
    """Re-run AI processing on a document already in the vault.

    The manual retry behind a Failed (or still-Pending) document: the original
    is pulled back from Cloudinary and put through the processor again, so a
    transient provider outage or a missing API key at upload time costs nothing
    but a second click. Returns the updated document, or None if it's gone."""
    document = await _get_document(db, document_id)
    if not document:
        return None

    await db[DOCUMENTS].update_one(
        {"id": document_id},
        {"$set": {"processing_status": ProcessingStatus.PROCESSING.value}},
    )

    try:
        file_bytes = await cloudinary_service.fetch_document(document["cloudinary_url"])
    except Exception as exc:
        logger.exception("Could not fetch stored original for document %s", document_id)
        await db[DOCUMENTS].update_one({"id": document_id}, {"$set": {
            "processing_status": ProcessingStatus.FAILED.value,
            "ai_metadata": _meta_dict(document.get("ai_metadata"),
                                      processed_at=utc_now(),
                                      last_error=f"Could not read the stored file: {exc}"[:500]),
        }})
        return await _get_document(db, document_id)

    await _process(db, document, file_bytes, document.get("mime_type") or "application/octet-stream")
    return await _get_document(db, document_id)


async def get_file(db, document_id: str):
    """The stored original, as (bytes, mime_type, filename).

    Documents are served through the API rather than linked to directly: PDFs
    live in Cloudinary as extension-less raw assets, so only we know what content
    type they really are. Returns None when the document is gone."""
    document = await _get_document(db, document_id)
    if not document:
        return None
    data = await cloudinary_service.fetch_document(document["cloudinary_url"])
    return data, document.get("mime_type") or "application/octet-stream", document.get("original_filename") or "document"


async def _process(db, document: dict, file_bytes: bytes, mime_type: str) -> None:
    """Run the processor for `document` and persist everything it produced.

    Shared by the first upload and by a manual retry so both paths behave
    identically — same statuses, same duplicate handling, same reminders."""
    document_id = document["id"]
    dog_id = document["dog_id"]
    job_id = (document.get("ai_metadata") or {}).get("processing_job_id") or str(uuid.uuid4())

    processor = get_processor(document.get("document_type"))
    if processor is None:
        # No processor for this type yet — file is stored, just not analyzed.
        await db[DOCUMENTS].update_one({"id": document_id},
                                       {"$set": {"processing_status": ProcessingStatus.COMPLETED.value}})
        return

    if not provider.is_configured():
        await db[DOCUMENTS].update_one({"id": document_id},
                                       {"$set": {"processing_status": ProcessingStatus.PENDING.value}})
        logger.warning("AI provider not configured; document %s left Pending.", document_id)
        return

    base_meta = provider.provider_meta()
    try:
        result = await processor.process(file_bytes, mime_type)

        # Duplicate detection against rows this dog already has, using the
        # identity the processor defines. Rows from an earlier attempt at THIS
        # document count too, so retrying a partly-failed scan doesn't double
        # the history. Scoped to dog_id — one dog's records never match another's.
        existing_keys = set()
        for collection in processor.collections():
            async for row in db[collection].find({"dog_id": dog_id}):
                key = processor.duplicate_key(_as_record(row))
                if key is not None:
                    existing_keys.add(key)

        saved = []
        for rec in result.records:
            collection = processor.collection_for(rec)
            replaces = processor.supersedes(rec)

            if replaces is not None:
                # A standing appointment, not a historical event: clear the
                # previous one for this dog instead of adding a second.
                await db[collection].delete_many({"dog_id": dog_id, **replaces})
            else:
                key = processor.duplicate_key(rec)
                if key is not None and key in existing_keys:
                    logger.info("Skipping duplicate %s row for dog %s", processor.document_type, dog_id)
                    continue

            row = processor.build_row(rec, dog_id, document_id)
            await db[collection].insert_one(row)
            if key is not None:
                existing_keys.add(key)
            # Only rows that can carry a future due date feed the reminder
            # engine; a deworming row drives its own schedule instead.
            if processor.collection_for(rec) == processor.collection:
                saved.append(row)

        status = ProcessingStatus.NEEDS_REVIEW if result.needs_review else ProcessingStatus.COMPLETED

        # Reminders for types that produce future due dates. Gated per record,
        # not per document: generate_for already skips anything flagged for
        # review, so one unreadable row on a page shouldn't suppress the
        # reminders for every clean row beside it.
        if processor.creates_reminders:
            await reminder_service.generate_for(db, dog_id, saved)
            # New shots may complete doses an older reminder was still chasing.
            await reminder_service.prune_completed(db, dog_id)

        await db[DOCUMENTS].update_one({"id": document_id}, {"$set": {
            "processing_status": status.value,
            "ai_extraction": result.raw_extraction,
            "ai_summary": result.summary,
            "confidence_score": result.confidence,
            "ai_metadata": _meta_dict(base_meta,
                                      prompt_version=processor.prompt_version,
                                      processing_job_id=job_id,
                                      processed_at=utc_now(),
                                      last_error=None),
        }})
    except Exception as exc:
        logger.exception("AI processing failed for document %s", document_id)
        await db[DOCUMENTS].update_one({"id": document_id}, {"$set": {
            "processing_status": ProcessingStatus.FAILED.value,
            "ai_metadata": _meta_dict(base_meta,
                                      prompt_version=getattr(processor, "prompt_version", None),
                                      processing_job_id=job_id,
                                      processed_at=utc_now(),
                                      last_error=str(exc)[:500]),
        }})


async def list_documents(db, dog_id: str, document_type: str = None) -> list:
    """The dog's vault, newest upload first, each row carrying how many
    vaccinations were read from it so the delete prompt can name a number."""
    query = {"dog_id": dog_id}
    if document_type:
        query["document_type"] = document_type

    # One pass per extracted collection instead of a count per document.
    counts = {}
    for collection in EXTRACTED_COLLECTIONS:
        async for row in db[collection].find({"dog_id": dog_id}, {"source_document_id": 1}):
            key = row.get("source_document_id")
            counts[key] = counts.get(key, 0) + 1

    cursor = db[DOCUMENTS].find(query).sort("uploaded_at", -1)
    out = []
    async for doc in cursor:
        doc.pop("_id", None)
        doc["vaccination_count"] = counts.get(doc.get("id"), 0)
        out.append(doc)
    return out


async def list_prescriptions(db, dog_id: str) -> list:
    """This dog's prescriptions, newest first. Scoped to dog_id like every other read."""
    cursor = db[PRESCRIPTIONS].find({"dog_id": dog_id}).sort("created_at", -1)
    out = []
    async for row in cursor:
        row.pop("_id", None)
        out.append(row)
    out.sort(key=lambda r: r.get("prescribed_date") or "", reverse=True)
    return out


async def delete_vaccination(db, vaccination_id: str) -> bool:
    """Remove one vaccination record and anything derived from it.

    The document it was read from stays in the vault — this deletes the reading,
    not the certificate, so the owner can re-scan or correct it later.

    Dewormings live in their own collection but sit on the same timeline and
    carry the same Delete button, so an id that isn't a vaccination is looked
    for there before giving up. Ids are UUIDs, so there is nothing to collide."""
    vax = await db[VACCINATIONS].find_one({"id": vaccination_id})
    if not vax:
        removed = await db[DEWORMINGS].delete_one({"id": vaccination_id})
        return removed.deleted_count > 0
    await db[VACCINATIONS].delete_one({"id": vaccination_id})
    await reminder_service.delete_for_vaccinations(db, [vaccination_id])
    await reminder_service.prune_completed(db, vax.get("dog_id"))
    return True


async def delete_prescription(db, prescription_id: str) -> bool:
    result = await db[PRESCRIPTIONS].delete_one({"id": prescription_id})
    return result.deleted_count > 0


#: Fields the review form posts that a deworming row spells differently or
#: doesn't have at all — a dewormer has no manufacturer batch or booster cycle.
DEWORMING_EDIT_FIELDS = {
    "vaccine_name": "product_name", "administration_date": "administration_date",
    "due_date": "due_date", "dose": "dose",
    "veterinarian": "veterinarian", "clinic_name": "clinic_name",
}


async def review_vaccination(db, vaccination_id: str, edits: dict) -> dict:
    """Apply a user's manual corrections, confirm the record, and (now that it's
    trusted) generate its reminder. Marks the source document Completed once none
    of its vaccinations still need review. Returns the updated vaccination, or None.

    Dewormings share the timeline and therefore share this Review button, so an
    id that isn't a vaccination is looked for among them and its fields are
    translated. They need no reminder generated: a deworming that is still owed
    produces its due entry from the timeline itself."""
    # The edit form posts every field, so a box the owner cleared arrives as ""
    # rather than absent. Storing that verbatim leaves `due_date: ""` in the
    # record — falsy, so nothing crashes, but it is neither a date nor null and
    # it silently defeats "is a next-due date on file?" checks. Blank means
    # clear the field.
    changes = {}
    for key, value in (edits or {}).items():
        if value is None:
            continue                            # field not supplied at all
        if isinstance(value, str):
            value = value.strip() or None       # blank input clears it
        changes[key] = value
    changes["needs_review"] = False
    changes["reviewed"] = True

    vax = await db[VACCINATIONS].find_one({"id": vaccination_id})
    if not vax:
        return await _review_deworming(db, vaccination_id, changes)

    await db[VACCINATIONS].update_one({"id": vaccination_id}, {"$set": changes})
    vax.update(changes)
    vax.pop("_id", None)

    await reminder_service.generate_for(db, vax["dog_id"], [vax])
    await reminder_service.prune_completed(db, vax["dog_id"])
    await _maybe_complete_document(db, vax.get("source_document_id"))
    return vax


async def _review_deworming(db, deworming_id: str, changes: dict) -> dict:
    row = await db[DEWORMINGS].find_one({"id": deworming_id})
    if not row:
        return None
    mapped = {DEWORMING_EDIT_FIELDS[k]: v for k, v in changes.items() if k in DEWORMING_EDIT_FIELDS}
    mapped["needs_review"] = False
    mapped["reviewed"] = True
    await db[DEWORMINGS].update_one({"id": deworming_id}, {"$set": mapped})
    row.update(mapped)
    row.pop("_id", None)
    row["vaccine_name"] = row.get("product_name")
    await _maybe_complete_document(db, row.get("source_document_id"))
    return row


async def _maybe_complete_document(db, document_id: str) -> None:
    """A document stops needing review once nothing read off it does — across
    every collection it wrote to, not just vaccinations."""
    if not document_id:
        return
    query = {"source_document_id": document_id, "needs_review": True}
    pending = [await db[c].find_one(query) for c in (VACCINATIONS, DEWORMINGS, PRESCRIPTIONS)]
    if not any(p is not None for p in pending):
        await db[DOCUMENTS].update_one(
            {"id": document_id, "processing_status": ProcessingStatus.NEEDS_REVIEW.value},
            {"$set": {"processing_status": ProcessingStatus.COMPLETED.value}},
        )


async def delete_document(db, document_id: str, delete_records: bool = False) -> bool:
    """Remove a document from the vault and Cloudinary.

    `delete_records` is the owner's answer to "delete the extracted vaccinations
    too?". Deleting a scan is usually housekeeping — a duplicate, a bad photo —
    and the vaccination history read off it is the valuable part, so it survives
    by default and only goes when explicitly asked for."""
    doc = await db[DOCUMENTS].find_one({"id": document_id})
    if not doc:
        return False

    await cloudinary_service.delete_document(
        doc.get("cloudinary_public_id"),
        doc.get("cloudinary_resource_type", "image"),
    )
    await db[DOCUMENTS].delete_one({"id": document_id})

    if delete_records:
        ids = [v["id"] async for v in db[VACCINATIONS].find({"source_document_id": document_id}, {"id": 1})]
        for collection in EXTRACTED_COLLECTIONS:
            await db[collection].delete_many({"source_document_id": document_id})
        await reminder_service.delete_for_vaccinations(db, ids)
        await reminder_service.delete_for_document(db, document_id)
    # Records kept: they keep their source_document_id as provenance of where
    # they came from, and their reminders stay live.

    await reminder_service.prune_completed(db, doc.get("dog_id"))
    return True


async def set_status(db, document_id: str, status_value: str) -> bool:
    result = await db[DOCUMENTS].update_one({"id": document_id},
                                            {"$set": {"processing_status": status_value}})
    return result.matched_count > 0
