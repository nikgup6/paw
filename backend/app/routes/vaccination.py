"""Legacy vaccination-document routes (`/api/vaccination-documents`).

Kept as backward-compatible ALIASES. Each path re-registers the exact same
handler function defined in routes/health_vault.py, so there is a single
implementation and zero duplicated logic. New clients should use
`/api/health-vault/*`.
"""
from fastapi import APIRouter

from app.routes import health_vault as hv

router = APIRouter()

# Same handler functions, legacy paths.
router.post("/upload")(hv.upload_document)
router.get("/dog/{dog_id}")(hv.list_documents)
router.get("/dog/{dog_id}/vaccinations")(hv.list_vaccinations)
router.get("/dog/{dog_id}/reminders")(hv.list_reminders)
router.patch("/vaccinations/{vaccination_id}")(hv.review_vaccination)
router.patch("/{document_id}/status")(hv.update_status)
router.delete("/{document_id}")(hv.delete_document)
