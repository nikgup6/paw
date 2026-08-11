"""Vaccination document processor.

Extracts structured vaccination records (with per-record confidence, booster
interval, and a short summary) from an uploaded image/PDF, using the
provider-agnostic AI layer. Adding another document type later means writing a
sibling processor — nothing here or upstream changes.
"""
import logging

from app.config.settings import settings
from app.models.deworming import Deworming
from app.models.vaccination import Vaccination
from app.services.ai_processing import provider
from app.services.ai_processing.base import DocumentProcessor, ExtractionResult
from app.services.ai_processing.validation import to_iso, validate_vaccination

logger = logging.getLogger(__name__)

PROMPT = """You are reading a photo of a dog's health booklet or vaccination card from
an Indian vet — a handwritten log of vaccination and deworming dates, sometimes
split into sections (e.g. "Anti Rabies", "Deworming Particulars").

THE RULE — this is the entire job. Apply it to every date on the page:

1. A date WITH a vaccine/dewormer name written next to it → that dose was GIVEN.
   status = "completed". The date is the date it was given.
   (A sticker, a dose amount like "0.7ml"/"1 tab", or a vet signature beside the
   date counts the same way — it is a record of something that happened.)

2. A date with NOTHING next to it — no name, no sticker, no dose, no signature →
   that dose has NOT been given. It is the next appointment, written in advance.
   status = "due".

That is the only distinction. Do not overthink it, do not weigh where the date
sits in the table, and do not trust printed column headers ("Due Date" /
"Vaccination Date") — handwritten entries routinely ignore them. Decide only on
whether something is written beside the date.

ALSO:
- Never calculate or infer a date that is not written on the page.
- Report every date as its own entry. Never merge two dates into one.
- product_expiry_date = the expiry printed on the vaccine vial ("Exp: 06/2027").
  That is the PRODUCT's shelf life, not the dog's schedule. Never report it as a
  date entry and never as a given or due date, even if it is the boldest date on
  the page. Put it only in product_expiry_date.
- If a date is genuinely illegible, return null for the date, confidence "low",
  and still report the entry — never silently drop it.
- Photos may be rotated or warped; read the handwriting wherever it starts.

OUTPUT — strict JSON, no prose outside it. All dates best-effort DD-MM-YYYY.
{
  "dog_name": string|null, "breed": string|null, "date_of_birth": string|null,
  "summary": string,
  "overall_confidence": number,
  "sections": [
    {
      "section_name": string,
      "kind": "vaccination" | "deworming",
      "vaccine_name": string|null,
      "manufacturer": string|null,
      "veterinarian": string|null,
      "clinic_name": string|null,
      "entries": [
        {
          "date": string|null,
          "status": "completed" | "due",
          "written_beside_date": string|null,   // what you saw next to it, null if nothing
          "confidence": "high" | "medium" | "low",
          "vaccine_name": string|null,
          "batch_number": string|null,
          "product_expiry_date": string|null,
          "booster_interval": string|null
        }
      ]
    }
  ]
}

If the document contains no vaccination or deworming records, return an empty
"sections" array and overall_confidence 0.
"""

#: The prompt reports confidence as a word, because asking a model for a
#: calibrated decimal on a handwritten scan is false precision. The pipeline
#: gates on a number (AI_AUTO_REMINDER_THRESHOLD, default 0.8), so the words map
#: onto it here: only "high" clears the bar and can create a reminder unattended.
CONFIDENCE_SCORE = {"high": 0.95, "medium": 0.7, "low": 0.35}

DEWORMING_COLLECTION = "dewormings"


def _clean(value):
    if value is None:
        return None
    text = str(value).strip()
    if text == "" or text.lower() in ("null", "none", "n/a", "na", "-"):
        return None
    return text


def _pick(obj: dict, *keys):
    norm = {k.lower().replace(" ", "_"): v for k, v in obj.items()}
    for key in keys:
        k = key.lower().replace(" ", "_")
        if k in norm:
            cleaned = _clean(norm[k])
            if cleaned is not None:
                return cleaned
    return None


def _num(obj: dict, *keys):
    for key in keys:
        for k, v in obj.items():
            if k.lower().replace(" ", "_") == key.lower().replace(" ", "_") and v is not None:
                try:
                    return float(v)
                except (TypeError, ValueError):
                    return None
    return None


def _date(obj: dict, *keys):
    """Pick a date field and normalise it to ISO. See validation.to_iso for why
    nothing downstream is allowed to see the model's DD-MM-YYYY spelling."""
    return to_iso(_pick(obj, *keys))


def _record_from(obj: dict) -> dict:
    """One extracted dose. Field names are read leniently — the prompt asks for
    `date_administered`/`next_due_date`, but older prompt versions and other
    providers say `administration_date`/`due_date`, and a re-scan of a document
    stored under the previous prompt must still parse."""
    record = {
        "vaccine_name": _pick(obj, "Vaccine Name", "vaccine"),
        "administration_date": _date(obj, "date_administered", "Administration Date",
                                     "Date Administered", "administration_date", "date_given"),
        "due_date": _date(obj, "next_due_date", "Due Date", "Next Due Date", "due_date", "next_due"),
        # Kept as written when it won't parse: vial expiries are usually printed
        # month-year ("Exp: 06/2027"), which is not a full date but is still
        # worth recording. Nothing calculates with it, so it doesn't need to be
        # ISO — only the equality guard below cares, and that only fires when
        # both sides parsed to real dates anyway.
        "product_expiry_date": _date(obj, "product_expiry_date", "product_expiry",
                                     "expiry_date", "expiry", "exp")
        or _pick(obj, "product_expiry_date", "product_expiry", "expiry_date", "expiry", "exp"),
        "booster_interval": _pick(obj, "Booster Interval", "booster_interval", "booster"),
        "manufacturer": _pick(obj, "Manufacturer"),
        "batch_number": _pick(obj, "Batch Number", "batch", "lot", "lot_number"),
        "veterinarian": _pick(obj, "Veterinarian Name", "veterinarian", "vet", "vet_name_or_clinic"),
        "clinic_name": _pick(obj, "Clinic Name", "clinic", "hospital", "vet_name_or_clinic"),
        "confidence": _num(obj, "confidence"),
        "confidence_notes": _pick(obj, "confidence_notes", "notes"),
    }

    # Last line of defence behind the prompt's "NEVER map this to next_due_date".
    # On an Indian vaccination card the vial expiry is often the boldest date on
    # the page, so a model that slips will usually slip by putting the SAME date
    # in both. A reminder fired off a product shelf life would be years wrong, so
    # drop the due date rather than trust it, and say why in the notes — the
    # dose still lands in the timeline, it just has no invented follow-up.
    if record["due_date"] and record["due_date"] == record["product_expiry_date"]:
        logger.info("Dropping due_date equal to product expiry (%s) for '%s'",
                    record["due_date"], record["vaccine_name"])
        record["due_date"] = None
        note = "Next-due matched the vial expiry date, so it was discarded — confirm the real next-due date."
        record["confidence_notes"] = f"{record['confidence_notes']} {note}".strip() if record["confidence_notes"] else note

    return record


def _entry_record(entry: dict, section: dict) -> dict:
    """One classified date from STEP 2, as a partial record.

    Section-level details fall through to every entry in it, because a booklet
    usually names the vaccine once in the section heading and then just lists
    dates underneath."""
    section_name = _pick(section, "section_name", "section") or ""
    kind = (_pick(section, "kind") or "").lower()
    is_deworming = kind == "deworming" or "deworm" in section_name.lower()

    beside = _pick(entry, "written_beside_date", "evidence_note", "evidence_detail")
    own_name = _pick(entry, "vaccine_name")
    word = (_pick(entry, "confidence") or "").lower()

    # The rule, enforced here and not merely asked for: something written beside
    # the date means the dose was given; nothing beside it means it is still
    # owed. The model's own label is honoured when it says one of the two, but a
    # missing or unexpected status resolves the same way rather than becoming a
    # third outcome the owner has to adjudicate.
    said = (_pick(entry, "status") or "").lower()
    if said in ("completed", "administered", "given", "done"):
        status = "administered"
    elif said == "due":
        status = "due"
    else:
        status = "administered" if (beside or own_name) else "due"

    return {
        "record_type": "deworming" if is_deworming else "vaccination",
        "section": section_name or None,
        "date": _date(entry, "date"),
        "status": status,
        "evidence_note": beside,
        "confidence": CONFIDENCE_SCORE.get(word, _num(entry, "confidence") or 0.35),
        "vaccine_name": _pick(entry, "vaccine_name") or _pick(section, "vaccine_name") or section_name or None,
        "manufacturer": _pick(entry, "manufacturer") or _pick(section, "manufacturer"),
        "batch_number": _pick(entry, "batch_number", "batch", "lot"),
        "booster_interval": _pick(entry, "booster_interval", "booster"),
        "veterinarian": _pick(entry, "veterinarian", "vet", "vet_name_or_clinic") or _pick(section, "veterinarian"),
        "clinic_name": _pick(entry, "clinic_name", "clinic", "hospital") or _pick(section, "clinic_name"),
        # Never a schedule date — see the prompt.
        "product_expiry_date": _date(entry, "product_expiry_date", "product_expiry", "expiry")
        or _pick(entry, "product_expiry_date", "product_expiry", "expiry"),
        # Whatever was written beside the date — a dose amount, a batch, a name.
        "dose": beside,
    }


def _next_dose_name(vaccine_name: str = None) -> str:
    """What a still-owed dose is called on the timeline."""
    name = (vaccine_name or "").strip()
    return f"Next {name} dose" if name else "Next vaccine dose"


def _records_from_section(entries: list, layout_notes: str = None) -> list:
    """One record per date. Two outcomes, no third.

    Date with a name (or sticker/dose/signature) beside it → the dose was given:
    a completed record, no due date, nothing to confirm.

    Date on its own → the next appointment: its own record named "Next <vaccine>
    dose", carrying only the due date, which is what raises the reminder.

    They are never paired. A booklet row records what was given; it says nothing
    about when the next one is owed, so inventing that link would put a
    commitment on the page the vet never wrote — and would mean deleting one
    silently changed the other."""
    dated = sorted((e for e in entries if e.get("date")), key=lambda e: e["date"])
    undated = [e for e in entries if not e.get("date")]

    records = []
    for entry in dated:
        base = {k: v for k, v in entry.items() if k not in ("date", "status")}

        if entry["status"] == "due":
            records.append({**base,
                            "vaccine_name": _next_dose_name(base.get("vaccine_name")),
                            "administration_date": None, "due_date": entry["date"],
                            "needs_review": False})
        else:
            records.append({**base, "administration_date": entry["date"], "due_date": None,
                            "needs_review": False})

    # The one case that genuinely can't be decided: the date itself is unreadable.
    # Reported and flagged rather than dropped, so the owner can fill it in.
    for entry in undated:
        records.append({**{k: v for k, v in entry.items() if k not in ("date", "status")},
                        "administration_date": None, "due_date": None, "needs_review": True,
                        "confidence_notes": "A date in this section couldn’t be read — "
                                            "please check the original and add it."})
    return records


def normalize(parsed):
    """Turn provider JSON into (summary, overall_confidence, [record]).

    Accepts the current section/entry shape and the older flat shapes, so a
    document scanned under a previous prompt still re-processes cleanly."""
    summary, overall = None, None
    records = []

    if isinstance(parsed, list):
        records = [_record_from(x) for x in parsed if isinstance(x, dict)]
    elif isinstance(parsed, dict):
        summary = _pick(parsed, "summary")
        overall = _num(parsed, "overall_confidence", "confidence")

        sections = parsed.get("sections")
        if isinstance(sections, list):
            for section in sections:
                if not isinstance(section, dict):
                    continue
                entries = section.get("entries")
                if not isinstance(entries, list):
                    continue
                classified = [_entry_record(e, section) for e in entries if isinstance(e, dict)]
                records.extend(_records_from_section(classified, _pick(section, "layout_notes")))
        else:
            array = None
            for key, value in parsed.items():
                if key.lower() in ("vaccinations", "vaccines", "vaccination_records", "records") and isinstance(value, list):
                    array = value
                    break
            records = ([_record_from(x) for x in array if isinstance(x, dict)]
                       if array is not None else [_record_from(parsed)])

    # Drop fully-empty rows — but never a row flagged for review. "Illegible
    # date → still report the entry, never silently drop it": a dose the scanner
    # couldn't read is exactly the one the owner most needs to see.
    records = [
        r for r in records
        if r.get("vaccine_name") or r.get("administration_date") or r.get("due_date")
        or r.get("needs_review")
    ]
    return summary, overall, records


class VaccinationProcessor(DocumentProcessor):
    document_type = "vaccination"
    prompt_version = "vax-v5-master"
    collection = "vaccinations"
    creates_reminders = True

    def collections(self) -> tuple:
        return ("vaccinations", DEWORMING_COLLECTION)

    def collection_for(self, record: dict) -> str:
        return (DEWORMING_COLLECTION if record.get("record_type") == "deworming"
                else "vaccinations")

    def supersedes(self, record: dict):
        """A dog has at most one outstanding next-dose per vaccine.

        Given doses are history and accumulate; a next-dose is a standing
        appointment. Without this, re-scanning the booklet — or the model
        reading the handwriting a day differently — leaves the old date behind
        and the owner gets two reminders for one visit."""
        if record.get("administration_date") or not record.get("due_date"):
            return None
        name = record.get("vaccine_name")
        if not name:
            return None
        field = "product_name" if record.get("record_type") == "deworming" else "vaccine_name"
        return {field: name, "administration_date": None}

    def build_row(self, record: dict, dog_id: str, document_id: str) -> dict:
        if record.get("record_type") == "deworming":
            return Deworming(
                dog_id=dog_id,
                source_document_id=document_id,
                product_name=record.get("vaccine_name"),
                administration_date=record.get("administration_date"),
                due_date=record.get("due_date"),
                dose=record.get("dose"),
                veterinarian=record.get("veterinarian"),
                clinic_name=record.get("clinic_name"),
                confidence_score=record.get("confidence"),
                confidence_notes=record.get("confidence_notes"),
                needs_review=bool(record.get("needs_review")),
                reviewed=False,
            ).dict()

        return Vaccination(
            dog_id=dog_id,
            source_document_id=document_id,
            vaccine_name=record.get("vaccine_name"),
            administration_date=record.get("administration_date"),
            due_date=record.get("due_date"),
            product_expiry_date=record.get("product_expiry_date"),
            booster_interval=record.get("booster_interval"),
            manufacturer=record.get("manufacturer"),
            batch_number=record.get("batch_number"),
            veterinarian=record.get("veterinarian"),
            clinic_name=record.get("clinic_name"),
            confidence_score=record.get("confidence"),
            confidence_notes=record.get("confidence_notes"),
            needs_review=bool(record.get("needs_review")),
            reviewed=False,
        ).dict()

    def duplicate_key(self, record: dict):
        name = (record.get("vaccine_name") or record.get("product_name") or "").strip().lower()
        if not name:
            return None
        # Scoped by type so a dewormer and a vaccine of the same name on the
        # same day are not mistaken for each other.
        return (record.get("record_type") or "vaccination", name,
                record.get("administration_date"), record.get("due_date"))

    async def process(self, file_bytes: bytes, mime_type: str) -> ExtractionResult:
        parsed = await provider.generate_structured_json(PROMPT, file_bytes, mime_type)
        summary, overall, records = normalize(parsed)

        threshold = settings.AI_AUTO_REMINDER_THRESHOLD
        missing_all = []
        confidences = []

        for r in records:
            valid, issues = validate_vaccination(r)
            conf = r.get("confidence")
            conf = float(conf) if isinstance(conf, (int, float)) else (overall if overall is not None else 0.5)
            r["confidence"] = conf
            confidences.append(conf)

            # A completed dose has NO due date — that is the rule, not a defect.
            # Requiring one here flagged every single completed dose for review.
            # The only genuinely missing field is a name we couldn't read.
            missing = [] if r.get("vaccine_name") else ["vaccine_name"]
            missing_all.extend(missing)

            # Never downgrade a decision already made: an unreadable date was
            # flagged upstream and stays flagged. Otherwise a record only needs a
            # human when the scan was unsure or the data doesn't hold together.
            r["needs_review"] = bool(r.get("needs_review")) or (conf < threshold) or (not valid) or bool(missing)

        overall_conf = overall if overall is not None else (min(confidences) if confidences else 0.0)
        needs_review = (not records) or any(r["needs_review"] for r in records) or (overall_conf < threshold)

        if not summary:
            summary = _compose_summary(records)

        return ExtractionResult(
            records=records,
            confidence=round(float(overall_conf), 3),
            summary=summary,
            needs_review=needs_review,
            missing_fields=sorted(set(missing_all)),
            raw_extraction=parsed if isinstance(parsed, dict) else {"vaccinations": records},
        )


def _compose_summary(records) -> str:
    if not records:
        return "No vaccination details could be read from this document."
    first = records[0]
    name = first.get("vaccine_name") or "Vaccination"
    parts = [name]
    if first.get("administration_date"):
        parts.append(f"given {first['administration_date']}")
    if first.get("due_date"):
        parts.append(f"next due {first['due_date']}")
    extra = f" (+{len(records) - 1} more)" if len(records) > 1 else ""
    return " · ".join(parts) + extra + "."
