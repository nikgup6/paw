"""Emergency Card Service — the one screen a vet ER needs in thirty seconds.

Everything on the card is a fact already in this dog's records: who it is, what
it weighs, what it reacts to, what it's currently on, and which shots are
genuinely done. Nothing is inferred and nothing is invented — an emergency is
the worst possible place to show a guess.

The vet contacts come from the clinics and vets already read off this dog's own
certificates and prescriptions, so the number on the card is one the owner has
actually been to.
"""
from app.services import health_vault_service, timeline_service
from app.services.ai_processing.validation import parse_iso_date
from app.services.health_status import iso, today as server_today

#: Only the most recent few of each, so the card stays scannable.
MAX_VACCINES = 8
MAX_MEDICINES = 6
MAX_CONTACTS = 3


def _age_label(dob) -> str:
    birth = parse_iso_date(dob)
    if birth is None:
        return "Unknown"
    today = server_today()
    months = (today.year - birth.year) * 12 + (today.month - birth.month)
    if today.day < birth.day:
        months -= 1
    months = max(months, 0)
    years, rem = divmod(months, 12)
    if years and rem:
        return f"{years} yr {rem} mo"
    if years:
        return f"{years} yr"
    return f"{months} mo"


async def build(db, dog_id: str, dog: dict) -> dict:
    """The emergency card payload for one dog."""
    records = await timeline_service.build_health_records(db, dog_id, dog)
    prescriptions = await health_vault_service.list_prescriptions(db, dog_id)

    # Completed shots only. A dose that is merely scheduled has not been given,
    # and telling an ER that a dog is covered when it isn't would be dangerous.
    # Deworming shares the timeline but is not immunity — a vet reading
    # "covered" off a dewormer line would be badly misled, so it stays off.
    completed = [
        {
            "vaccine_name": entry.get("vaccine_name"),
            "administration_date": entry.get("administration_date"),
            "due_date": entry.get("due_date"),
        }
        for entry in records["completed"]
        if entry.get("administration_date")
        and entry.get("category") != timeline_service.CAT_DEWORMING
    ][:MAX_VACCINES]

    medicines, contacts, seen_contacts = [], [], set()
    for rx in prescriptions:
        for med in (rx.get("medicines") or []):
            if med.get("name") and len(medicines) < MAX_MEDICINES:
                medicines.append({
                    "name": med.get("name"),
                    "dosage": med.get("dosage"),
                    "frequency": med.get("frequency"),
                    "prescribed_date": rx.get("prescribed_date"),
                })

    # Clinics and vets this dog has actually been seen by, newest first.
    for source in (prescriptions, await timeline_service.load_records(db, dog_id)):
        for row in source:
            clinic = (row.get("clinic_name") or "").strip()
            vet = (row.get("veterinarian") or row.get("doctor") or "").strip()
            key = (clinic.lower(), vet.lower())
            if (clinic or vet) and key not in seen_contacts and len(contacts) < MAX_CONTACTS:
                seen_contacts.add(key)
                contacts.append({"clinic_name": clinic or None, "veterinarian": vet or None})

    return {
        "today": iso(server_today()),
        "dog": {
            "id": dog.get("id"),
            "name": dog.get("name"),
            "breed": dog.get("breed"),
            "gender": dog.get("gender"),
            "dob": dog.get("dob"),
            "age_label": _age_label(dog.get("dob")),
            "weight_kg": dog.get("weight_kg"),
            "city": dog.get("city"),
            "photo_url": dog.get("photo_url"),
        },
        "allergies": (dog.get("health_complications") or "").strip() or None,
        "medications": medicines,
        "completed_vaccinations": completed,
        "vet_contacts": contacts,
        "counts": {
            "completed": len(completed),
            "overdue": records["counts"]["overdue"],
        },
    }
