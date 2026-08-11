"""Prescription document processor.

Reads a vet prescription into a doctor, clinic, date, diagnosis and a list of
medicines, plus a short plain-English summary. Sibling of the vaccination
processor — it shares the same provider-agnostic AI layer and the same
`DocumentProcessor` contract, so the Health Vault stores its output without
knowing anything about prescriptions.

Prescriptions record what was dispensed, not something falling due, so this
processor creates no reminders. An owner who wants a "give the 8pm tablet"
nudge makes it themselves in the reminder module.
"""
import logging

from app.config.settings import settings
from app.models.prescription import Prescription
from app.services.ai_processing import provider
from app.services.ai_processing.base import DocumentProcessor, ExtractionResult
from app.services.ai_processing.validation import parse_iso_date

logger = logging.getLogger(__name__)

PROMPT = """You are an expert veterinary prescription parser.

Analyze the uploaded veterinary prescription.

Extract:
- Doctor / Veterinarian Name
- Clinic or Hospital Name
- Prescribed Date
- Diagnosis or reason for the visit (if stated)
- For EACH medicine prescribed:
  - name (the drug or brand name)
  - dosage (e.g. "250mg", "1 tablet", "5ml")
  - frequency (e.g. "twice daily", "every 8 hours")
  - duration (e.g. "5 days", "2 weeks")
  - notes (e.g. "after food", "with water")

Also produce:
- summary: one short, plain-English sentence an owner would understand.
- overall_confidence: a number from 0 to 1 for the whole extraction.

Return ONLY valid JSON. No prose, no markdown code fences. Shape:
{
  "doctor": string|null, "clinic_name": string|null,
  "prescribed_date": string|null, "diagnosis": string|null,
  "summary": string,
  "overall_confidence": number,
  "medicines": [
    { "name": string|null, "dosage": string|null, "frequency": string|null,
      "duration": string|null, "notes": string|null }
  ]
}

Rules:
- Missing/absent fields must be null.
- Every date in ISO format YYYY-MM-DD.
- Do not invent dosages or durations that are not written on the document.
- If the document is not a prescription, return an empty "medicines" array and
  overall_confidence 0.
"""


def _clean(value):
    if value is None:
        return None
    text = str(value).strip()
    if text == "" or text.lower() in ("null", "none", "n/a", "na", "-"):
        return None
    return text


def _pick(obj: dict, *keys):
    norm = {str(k).lower().replace(" ", "_"): v for k, v in obj.items()}
    for key in keys:
        cleaned = _clean(norm.get(key.lower().replace(" ", "_")))
        if cleaned is not None:
            return cleaned
    return None


def _num(obj: dict, *keys):
    for key in keys:
        for k, v in obj.items():
            if str(k).lower().replace(" ", "_") == key.lower().replace(" ", "_") and v is not None:
                try:
                    return float(v)
                except (TypeError, ValueError):
                    return None
    return None


def _medicine_from(obj: dict) -> dict:
    return {
        "name": _pick(obj, "name", "medicine", "drug", "medication"),
        "dosage": _pick(obj, "dosage", "dose", "strength"),
        "frequency": _pick(obj, "frequency", "schedule", "how_often"),
        "duration": _pick(obj, "duration", "days", "course"),
        "notes": _pick(obj, "notes", "instructions", "remarks"),
    }


def normalize(parsed):
    """Turn provider JSON into (header dict, [medicine])."""
    header, medicines = {}, []

    if isinstance(parsed, list):
        medicines = [_medicine_from(x) for x in parsed if isinstance(x, dict)]
    elif isinstance(parsed, dict):
        header = {
            "doctor": _pick(parsed, "doctor", "veterinarian", "vet", "doctor_name"),
            "clinic_name": _pick(parsed, "clinic_name", "clinic", "hospital"),
            "prescribed_date": _pick(parsed, "prescribed_date", "date", "prescription_date"),
            "diagnosis": _pick(parsed, "diagnosis", "reason", "complaint"),
            "summary": _pick(parsed, "summary"),
            "confidence": _num(parsed, "overall_confidence", "confidence"),
        }
        for key, value in parsed.items():
            if str(key).lower() in ("medicines", "medications", "drugs", "items") and isinstance(value, list):
                medicines = [_medicine_from(x) for x in value if isinstance(x, dict)]
                break

    medicines = [m for m in medicines if m.get("name")]
    return header, medicines


class PrescriptionProcessor(DocumentProcessor):
    document_type = "prescription"
    prompt_version = "rx-v1"
    collection = "prescriptions"
    creates_reminders = False

    async def process(self, file_bytes: bytes, mime_type: str) -> ExtractionResult:
        parsed = await provider.generate_structured_json(PROMPT, file_bytes, mime_type)
        header, medicines = normalize(parsed)

        threshold = settings.AI_AUTO_REMINDER_THRESHOLD
        confidence = header.get("confidence")
        confidence = float(confidence) if isinstance(confidence, (int, float)) else 0.0

        missing = []
        if not medicines:
            missing.append("medicines")
        if not header.get("prescribed_date"):
            missing.append("prescribed_date")
        elif parse_iso_date(header["prescribed_date"]) is None:
            missing.append("prescribed_date")
        if not header.get("doctor"):
            missing.append("doctor")

        # A prescription is worth showing even when a field is missing, so only
        # a genuinely unsure read (or no medicines at all) goes to review.
        needs_review = (not medicines) or confidence < threshold

        record = {
            **header,
            "confidence": confidence,
            "medicines": medicines,
            "needs_review": needs_review,
        }
        summary = header.get("summary") or _compose_summary(record)
        record["summary"] = summary

        return ExtractionResult(
            records=[record] if (medicines or header.get("doctor")) else [],
            confidence=round(confidence, 3),
            summary=summary,
            needs_review=needs_review,
            missing_fields=sorted(set(missing)),
            raw_extraction=parsed if isinstance(parsed, dict) else {"medicines": medicines},
        )

    def build_row(self, record: dict, dog_id: str, document_id: str) -> dict:
        return Prescription(
            dog_id=dog_id,
            source_document_id=document_id,
            doctor=record.get("doctor"),
            clinic_name=record.get("clinic_name"),
            prescribed_date=record.get("prescribed_date"),
            diagnosis=record.get("diagnosis"),
            medicines=record.get("medicines") or [],
            summary=record.get("summary"),
            confidence_score=record.get("confidence"),
            needs_review=bool(record.get("needs_review")),
        ).dict()

    def duplicate_key(self, record: dict):
        names = ",".join(sorted((m.get("name") or "").lower() for m in record.get("medicines") or []))
        if not names:
            return None
        return (record.get("prescribed_date"), names)


def _compose_summary(record) -> str:
    medicines = record.get("medicines") or []
    if not medicines:
        return "No prescription details could be read from this document."
    names = ", ".join(m["name"] for m in medicines[:3] if m.get("name"))
    extra = f" (+{len(medicines) - 3} more)" if len(medicines) > 3 else ""
    when = f" on {record['prescribed_date']}" if record.get("prescribed_date") else ""
    return f"{len(medicines)} medicine{'s' if len(medicines) != 1 else ''} prescribed{when}: {names}{extra}."
