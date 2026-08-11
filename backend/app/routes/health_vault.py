"""Health Vault routes (`/api/health-vault`).

Thin controllers only — every handler delegates to a service. The legacy
`/api/vaccination-documents/*` router re-registers these same handler functions
(see routes/vaccination.py), so there is one implementation, not two.
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import Response
from pydantic import BaseModel
from urllib.parse import quote
import logging

from app.models.vaccination import StatusUpdate, VaccinationEdit
from app.models.health_vault import DocumentType
from app.models.custom_reminder import CustomReminderIn
from app.services import (
    custom_reminder_service, dog_profile_service, emergency_card_service,
    health_summary_service, health_vault_service, reminder_service,
    schedule_dismissal_service, timeline_service,
)


class ScheduleEntryRef(BaseModel):
    """Which generated entry to hide. Sent in a body rather than the path because
    the keys contain colons (`schedule:DHPP:primary`)."""
    key: str
from app.database.connection import get_database

router = APIRouter()
logger = logging.getLogger(__name__)

ALLOWED_MIME = {"image/jpeg", "image/jpg", "image/png", "application/pdf"}
ALLOWED_EXT = {"jpg", "jpeg", "png", "pdf"}
EXT_TO_MIME = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "pdf": "application/pdf"}
MAX_BYTES = 10 * 1024 * 1024

NO_PROFILE = "Save your dog's profile before adding health records."


def _require_db():
    db = get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database is unavailable. Please try again later.")
    return db


async def _require_dog(db, dog_id: str) -> dict:
    """Health records only exist against a saved dog. The UI hides the vault
    until then; this is the server-side half of the same rule, so a stray client
    can't create orphan documents."""
    dog = await dog_profile_service.get(db, dog_id)
    if not dog:
        raise HTTPException(status_code=409, detail=NO_PROFILE)
    return dog


# --------------------------------- handlers --------------------------------- #

async def upload_document(
    dog_id: str = Form(...),
    document_type: str = Form(DocumentType.VACCINATION.value),
    file: UploadFile = File(...),
):
    """Store a medical document (Cloudinary + Health Vault) and run AI processing."""
    if not dog_id.strip():
        raise HTTPException(status_code=400, detail="A dog_id is required.")

    db = _require_db()
    await _require_dog(db, dog_id.strip())

    ext = (file.filename or "").rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else ""
    if file.content_type not in ALLOWED_MIME and ext not in ALLOWED_EXT:
        raise HTTPException(status_code=415, detail="Only JPG, JPEG, PNG or PDF files are allowed.")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds the 10MB limit.")

    # AI being unconfigured is handled gracefully inside the service (the file is
    # still stored and the document is left Pending). Cloudinary is required.
    from app.services import cloudinary_service
    if not cloudinary_service.is_configured():
        raise HTTPException(status_code=503, detail="File storage is not configured on the server.")

    mime_type = file.content_type if file.content_type in ALLOWED_MIME else EXT_TO_MIME.get(ext, "application/octet-stream")
    try:
        return await health_vault_service.ingest(db, dog_id.strip(), data, file.filename or "document", mime_type, document_type)
    except Exception:
        logger.exception("Health Vault ingest failed for dog_id=%s", dog_id)
        raise HTTPException(status_code=502, detail="Upload failed. Please try again.")


async def list_documents(dog_id: str, type: str = Query(default=None)):
    """All Health Vault documents for a dog (optionally filtered by ?type=)."""
    db = _require_db()
    return await health_vault_service.list_documents(db, dog_id, type)


async def list_vaccinations(dog_id: str):
    """Flat vaccination records with a live status — the legacy projection."""
    db = _require_db()
    return await timeline_service.build(db, dog_id)


async def health_records(dog_id: str):
    """The Health Records Center: the dog's stored shots merged with the standard
    Indian schedule for its age and breed, grouped into Completed / Due Today /
    Upcoming / Overdue against the server's current date."""
    db = _require_db()
    dog = await dog_profile_service.get(db, dog_id)
    if not dog:
        raise HTTPException(status_code=409, detail=NO_PROFILE)
    return await timeline_service.build_health_records(db, dog_id, dog)


async def list_reminders(dog_id: str):
    """Everything owed for this dog inside the reminder window — vaccinations,
    deworming and the owner's own reminders alike."""
    db = _require_db()
    dog = await dog_profile_service.get(db, dog_id)
    return await reminder_service.list_for(db, dog_id, dog)


async def health_summary(dog_id: str):
    """The Overview page's read model for one dog."""
    db = _require_db()
    dog = await _require_dog(db, dog_id)
    return await health_summary_service.build(db, dog_id, dog)


async def emergency_card(dog_id: str):
    """The vet-ER card: who this dog is, what it reacts to, what it's on, and
    the shots that are actually completed."""
    db = _require_db()
    dog = await _require_dog(db, dog_id)
    return await emergency_card_service.build(db, dog_id, dog)


async def list_prescriptions(dog_id: str):
    """Medical Logs — this dog's prescriptions, newest first."""
    db = _require_db()
    return await health_vault_service.list_prescriptions(db, dog_id)


async def dismiss_schedule_entry(dog_id: str, ref: ScheduleEntryRef):
    """Hide a generated schedule dose or booster for this dog.

    Nothing is destroyed — the schedule still knows about it, it just stops
    being shown, and `restore_schedule_entries` brings it back."""
    db = _require_db()
    await _require_dog(db, dog_id)
    if not ref.key.strip():
        raise HTTPException(status_code=400, detail="A schedule entry key is required.")
    await schedule_dismissal_service.dismiss(db, dog_id, ref.key.strip())
    return {"status": "success", "hidden": await schedule_dismissal_service.count(db, dog_id)}


async def restore_schedule_entries(dog_id: str):
    """Un-hide everything this dog has dismissed."""
    db = _require_db()
    restored = await schedule_dismissal_service.restore_all(db, dog_id)
    return {"status": "success", "restored": restored}


async def delete_vaccination(vaccination_id: str):
    """Delete one recorded shot. The source document is untouched."""
    db = _require_db()
    if not await health_vault_service.delete_vaccination(db, vaccination_id):
        raise HTTPException(status_code=404, detail="Vaccination not found.")
    return {"status": "success"}


async def delete_prescription(prescription_id: str):
    db = _require_db()
    if not await health_vault_service.delete_prescription(db, prescription_id):
        raise HTTPException(status_code=404, detail="Prescription not found.")
    return {"status": "success"}


# ------------------------- owner-created reminders -------------------------- #

async def create_reminder(dog_id: str, payload: CustomReminderIn):
    db = _require_db()
    await _require_dog(db, dog_id)
    data = payload.dict()
    issues = custom_reminder_service.validate(data)
    if issues:
        raise HTTPException(status_code=422, detail=f"Please provide {', '.join(issues)}.")
    return await custom_reminder_service.create(db, dog_id, data)


async def update_reminder(reminder_id: str, payload: CustomReminderIn):
    db = _require_db()
    data = payload.dict()
    issues = custom_reminder_service.validate(data)
    if issues:
        raise HTTPException(status_code=422, detail=f"Please provide {', '.join(issues)}.")
    updated = await custom_reminder_service.update(db, reminder_id, data)
    if updated is None:
        raise HTTPException(status_code=404, detail="Reminder not found.")
    return updated


async def complete_reminder(reminder_id: str):
    """Tick a reminder off — recurring ones roll to their next occurrence."""
    db = _require_db()
    updated = await custom_reminder_service.complete(db, reminder_id)
    if updated is None:
        raise HTTPException(status_code=404, detail="Reminder not found.")
    return updated


async def delete_reminder(reminder_id: str):
    db = _require_db()
    if not await custom_reminder_service.delete(db, reminder_id):
        raise HTTPException(status_code=404, detail="Reminder not found.")
    return {"status": "success"}


async def review_vaccination(vaccination_id: str, edits: VaccinationEdit):
    """Confirm/correct a Needs-Review vaccination, then create its reminder."""
    db = _require_db()
    updated = await health_vault_service.review_vaccination(db, vaccination_id, edits.dict())
    if updated is None:
        raise HTTPException(status_code=404, detail="Vaccination not found.")
    return updated


async def update_status(document_id: str, update: StatusUpdate):
    db = _require_db()
    ok = await health_vault_service.set_status(db, document_id, update.processing_status.value)
    if not ok:
        raise HTTPException(status_code=404, detail="Document not found.")
    return {"status": "success", "processing_status": update.processing_status.value}


async def reprocess_document(document_id: str):
    """Manual retry for a document whose AI processing failed (or never ran)."""
    db = _require_db()
    updated = await health_vault_service.reprocess(db, document_id)
    if updated is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    return updated


async def get_file(document_id: str, download: bool = Query(default=False)):
    """Serve the stored original — inline for viewing, or as an attachment.

    Going through the API rather than linking straight at Cloudinary is what
    makes PDFs work: they are stored as extension-less raw assets (Cloudinary
    refuses to deliver `.pdf` unless the account opts in), so the real content
    type and the original filename only exist here."""
    db = _require_db()
    try:
        found = await health_vault_service.get_file(db, document_id)
    except Exception as exc:
        # A 404 from storage means the asset is gone, not that the server is
        # broken — the document row outlived the file it points at. 502 sent the
        # owner (and anyone reading the logs) hunting for a server fault; 410
        # says plainly that the file itself is no longer there.
        status = getattr(getattr(exc, "response", None), "status_code", None)
        if status == 404:
            logger.warning("Stored file is missing for document %s", document_id)
            raise HTTPException(
                status_code=410,
                detail="This file is no longer in storage. The record was kept; re-upload the document to restore it.",
            )
        logger.exception("Could not read stored file for document %s", document_id)
        raise HTTPException(status_code=502, detail="Couldn’t read that document from storage.")
    if found is None:
        raise HTTPException(status_code=404, detail="Document not found.")

    data, mime_type, filename = found
    disposition = "attachment" if download else "inline"
    return Response(
        content=data,
        media_type=mime_type,
        headers={
            "Content-Disposition": f"{disposition}; filename*=UTF-8''{quote(filename)}",
            "Cache-Control": "private, max-age=300",
        },
    )


async def delete_document(document_id: str, delete_records: bool = Query(default=False)):
    """Delete a document. `?delete_records=true` also removes the vaccinations
    that were extracted from it; by default they are kept."""
    db = _require_db()
    ok = await health_vault_service.delete_document(db, document_id, delete_records)
    if not ok:
        raise HTTPException(status_code=404, detail="Document not found.")
    return {"status": "success", "deleted_records": delete_records}


# ------------------------------- registration ------------------------------- #

router.post("/upload")(upload_document)
router.get("/dog/{dog_id}/documents")(list_documents)
router.get("/dog/{dog_id}/vaccinations")(list_vaccinations)
router.get("/dog/{dog_id}/health-records")(health_records)
router.get("/dog/{dog_id}/summary")(health_summary)
router.get("/dog/{dog_id}/emergency-card")(emergency_card)
router.get("/dog/{dog_id}/prescriptions")(list_prescriptions)
router.get("/dog/{dog_id}/reminders")(list_reminders)
router.post("/dog/{dog_id}/reminders")(create_reminder)
router.put("/reminders/{reminder_id}")(update_reminder)
router.post("/reminders/{reminder_id}/complete")(complete_reminder)
router.delete("/reminders/{reminder_id}")(delete_reminder)
router.delete("/prescriptions/{prescription_id}")(delete_prescription)
router.patch("/vaccinations/{vaccination_id}")(review_vaccination)
router.delete("/vaccinations/{vaccination_id}")(delete_vaccination)
router.post("/dog/{dog_id}/schedule-entries/dismiss")(dismiss_schedule_entry)
router.post("/dog/{dog_id}/schedule-entries/restore")(restore_schedule_entries)
router.patch("/documents/{document_id}/status")(update_status)
router.post("/documents/{document_id}/reprocess")(reprocess_document)
router.get("/documents/{document_id}/file")(get_file)
router.delete("/documents/{document_id}")(delete_document)
