"""Processor registry — maps a DocumentType to its processor.

To support a new medical document type (blood test, X-ray, lab report, ...),
add a processor class and register it here. Nothing in the upload service,
Cloudinary storage, Health Vault, routes, or UI needs to change: the vault
reads `collection`, `build_row` and `creates_reminders` off the processor.

Types with no processor are still accepted and stored — the file is kept, it
just isn't analysed. That is what keeps the "Coming Soon" document types honest
rather than fake.
"""
from typing import Optional

from app.services.ai_processing.base import DocumentProcessor
from app.services.ai_processing.prescription_processor import PrescriptionProcessor
from app.services.ai_processing.vaccination_processor import VaccinationProcessor

_PROCESSORS = {
    VaccinationProcessor.document_type: VaccinationProcessor(),
    PrescriptionProcessor.document_type: PrescriptionProcessor(),
    # "blood_test": BloodTestProcessor(),   # <- future, no other changes needed
}


def get_processor(document_type: str) -> Optional[DocumentProcessor]:
    return _PROCESSORS.get((document_type or "").lower())


def supported_types() -> list:
    return sorted(_PROCESSORS)
