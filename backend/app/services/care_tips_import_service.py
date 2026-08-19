"""Care Tips import — reads the "PAW BUDDY Breed Care Tips Database" workbook
and replaces the care-tips collections wholesale.

Every import is a full replace, on purpose: the Care Tips Matrix, the
Fallback Tip and the City Season Calendar sheets are each their own single
source of truth, so a re-upload doesn't leave last week's rows mixed in with
today's.

Approval is keyed to the WORDING, not to the row: a tip whose text and
targeting are byte-identical to one already approved keeps its approval
across the re-import, and anything new or reworded lands unapproved. That
keeps the actual guarantee ("no unreviewed wording ever reaches an owner")
while making a one-cell fix cost one re-review instead of 290.
"""
import io
import json
import logging
import uuid
from datetime import datetime, timezone
from functools import lru_cache

import openpyxl

from app.config.settings import BACKEND_DIR
from app.models.care_tips import MONTH_NAMES

logger = logging.getLogger(__name__)

CARE_TIPS = "care_tips"
CARE_TIP_FALLBACK = "care_tip_fallback"
CITY_SEASON_CALENDAR = "city_season_calendar"

SHEET_MATRIX = "Care Tips Matrix"
SHEET_FALLBACK = "Fallback Tip"
SHEET_SEASON_CALENDAR = "City Season Calendar"

#: Column position is what the sheet's authors actually control; matching by
#: header name (not index) means a reordered column doesn't silently shuffle
#: data into the wrong field.
MATRIX_HEADERS = {
    "Breed Name": "breed_name",
    "Category": "category",
    "Trait / Trigger": "trait_trigger",
    "City Climate Dependency": "city_climate_dependency",
    "Ownership Duration Dependency": "ownership_duration_dependency",
    "Season Dependency": "season_dependency",   # optional — added by this task
    "Tip": "tip",
    "Vet-Verify Flag": "vet_verify_flag",
    "Vet-Verify Note": "vet_verify_note",
}
MATRIX_REQUIRED = ("Breed Name", "Category", "Trait / Trigger", "Tip")

FALLBACK_HEADERS = {
    "Category": "category",
    "Trait / Trigger": "trait_trigger",
    "Tip": "tip",
    "Vet-Verify Flag": "vet_verify_flag",
    "Vet-Verify Note": "vet_verify_note",
}
FALLBACK_REQUIRED = ("Category", "Trait / Trigger", "Tip")

SEASON_CAL_HEADERS = {"City": "city", "Month": "month", "Season Bucket": "season_bucket"}
SEASON_CAL_REQUIRED = ("City", "Month", "Season Bucket")

#: Field separator for approval fingerprints. A unit separator cannot occur
#: in tip prose, so field values can never run together across a boundary.
SEP = "\x1f"


@lru_cache(maxsize=1)
def _city_zones() -> dict:
    """city name -> climate zone, from the catalogue mirrored alongside
    breeds.json/questions.json. Same file the frontend's city selector reads,
    so the two can't drift apart on what zone a city is in."""
    try:
        with open(BACKEND_DIR / "cityZones.json", encoding="utf-8") as fh:
            data = json.load(fh)
        return data.get("cities", {}) or {}
    except Exception:
        logger.warning("cityZones.json unavailable; city lookups will skip", exc_info=True)
        return {}


def _known_cities() -> set:
    """The app's real city list, for flagging a typo'd City Season Calendar row."""
    return set(_city_zones().keys())


def zone_for_city(city) -> str:
    """City (or a "zone:HOT_DRY" literal) -> climate zone, mirroring the
    frontend's zoneForCity so a dog profile and a survey submission resolve
    the same city to the same zone."""
    if not city:
        return None
    text = str(city)
    if text.startswith("zone:"):
        return text[5:]
    return _city_zones().get(text)


def _header_map(ws, expected: dict) -> dict:
    """First-row header -> column index, for whichever of `expected` are present."""
    header_row = next(ws.iter_rows(min_row=1, max_row=1, values_only=True), ())
    return {
        expected[str(cell).strip()]: idx
        for idx, cell in enumerate(header_row)
        if cell is not None and str(cell).strip() in expected
    }


def _cell(row: tuple, col_map: dict, field: str, default=None):
    idx = col_map.get(field)
    if idx is None or idx >= len(row):
        return default
    value = row[idx]
    if value is None:
        return default
    value = str(value).strip()
    return value if value else default


def _parse_matrix(ws) -> list:
    col_map = _header_map(ws, MATRIX_HEADERS)
    missing = [h for h in MATRIX_REQUIRED if MATRIX_HEADERS[h] not in col_map]
    if missing:
        raise ValueError(f"'{SHEET_MATRIX}' is missing required column(s): {', '.join(missing)}")

    now = datetime.now(timezone.utc)
    rows = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        if all(c is None for c in row):
            continue
        breed = _cell(row, col_map, "breed_name")
        tip = _cell(row, col_map, "tip")
        if not breed or not tip:
            continue  # a stray blank row rather than real data
        rows.append({
            "id": str(uuid.uuid4()),
            "breed_name": breed,
            "category": _cell(row, col_map, "category", ""),
            "trait_trigger": _cell(row, col_map, "trait_trigger", ""),
            "city_climate_dependency": _cell(row, col_map, "city_climate_dependency", "Any"),
            "ownership_duration_dependency": _cell(row, col_map, "ownership_duration_dependency", "Any"),
            # Absent column (pre-season-schema files) or a blank cell both mean
            # "not season-dependent" — same default as every other dimension.
            "season_dependency": _cell(row, col_map, "season_dependency", "Any"),
            "tip": tip,
            "vet_verify_flag": _cell(row, col_map, "vet_verify_flag"),
            "vet_verify_note": _cell(row, col_map, "vet_verify_note"),
            "is_approved": False,
            "imported_at": now,
        })
    return rows


def _parse_fallback(ws) -> list:
    col_map = _header_map(ws, FALLBACK_HEADERS)
    missing = [h for h in FALLBACK_REQUIRED if FALLBACK_HEADERS[h] not in col_map]
    if missing:
        raise ValueError(f"'{SHEET_FALLBACK}' is missing required column(s): {', '.join(missing)}")

    now = datetime.now(timezone.utc)
    rows = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        if all(c is None for c in row):
            continue
        tip = _cell(row, col_map, "tip")
        if not tip:
            continue
        rows.append({
            "id": str(uuid.uuid4()),
            "category": _cell(row, col_map, "category", ""),
            "trait_trigger": _cell(row, col_map, "trait_trigger", ""),
            "tip": tip,
            "vet_verify_flag": _cell(row, col_map, "vet_verify_flag"),
            "vet_verify_note": _cell(row, col_map, "vet_verify_note"),
            "is_approved": False,
            "imported_at": now,
        })
    return rows


def _fingerprint(row: dict) -> str:
    """Identifies a tip by the text a reviewer actually read and the targeting
    that decides who sees it. Deliberately excludes `id` (regenerated every
    import) and `imported_at`. Editing any of these fields is a real change,
    so the row correctly falls back to unapproved."""
    return SEP.join(str(row.get(field) or "") for field in (
        "breed_name", "category", "trait_trigger", "tip",
        "city_climate_dependency", "ownership_duration_dependency", "season_dependency",
    ))


async def _approved_fingerprints(db, collection: str) -> set:
    cursor = db[collection].find({"is_approved": True})
    return {_fingerprint(row) async for row in cursor}


def _parse_season_calendar(ws) -> tuple:
    """Returns (rows, warnings). A bad city or month is flagged, not dropped —
    the spec is explicit that validation here blocks nothing."""
    col_map = _header_map(ws, SEASON_CAL_HEADERS)
    missing = [h for h in SEASON_CAL_REQUIRED if SEASON_CAL_HEADERS[h] not in col_map]
    if missing:
        raise ValueError(f"'{SHEET_SEASON_CALENDAR}' is missing required column(s): {', '.join(missing)}")

    known_cities = _known_cities()
    now = datetime.now(timezone.utc)
    rows, warnings = [], []
    for row in ws.iter_rows(min_row=2, values_only=True):
        if all(c is None for c in row):
            continue
        city = _cell(row, col_map, "city")
        month = _cell(row, col_map, "month")
        bucket = _cell(row, col_map, "season_bucket")
        if not city or not month or not bucket:
            continue
        month_norm = month.strip().title()
        if known_cities and city not in known_cities:
            warnings.append(f"City Season Calendar: {city!r} is not a known app city.")
        if month_norm not in MONTH_NAMES:
            warnings.append(f"City Season Calendar: {month!r} is not a real calendar month.")
        rows.append({
            "id": str(uuid.uuid4()),
            "city": city,
            "month": month_norm if month_norm in MONTH_NAMES else month,
            "season_bucket": bucket,
            "imported_at": now,
        })
    return rows, warnings


async def import_workbook(db, file_bytes: bytes) -> dict:
    """Parse the workbook and replace every sheet's collection in one call.

    The City Season Calendar sheet is optional — the schema that adds it may
    not have shipped yet, and importing an older workbook must not touch
    whatever calendar data (if any) is already stored."""
    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True, read_only=True)

    if SHEET_MATRIX not in wb.sheetnames:
        raise ValueError(f"Workbook has no '{SHEET_MATRIX}' sheet.")
    if SHEET_FALLBACK not in wb.sheetnames:
        raise ValueError(f"Workbook has no '{SHEET_FALLBACK}' sheet.")

    matrix_rows = _parse_matrix(wb[SHEET_MATRIX])
    fallback_rows = _parse_fallback(wb[SHEET_FALLBACK])

    warnings = []
    season_rows = None
    if SHEET_SEASON_CALENDAR in wb.sheetnames:
        season_rows, warnings = _parse_season_calendar(wb[SHEET_SEASON_CALENDAR])

    if not matrix_rows:
        raise ValueError(f"'{SHEET_MATRIX}' has no usable rows (need at least Breed Name + Tip).")

    # Approvals carry over for tips whose wording is byte-identical to one
    # already approved. The safety rule is that no unreviewed WORDING ever
    # reaches an owner — not that a reviewer must re-click 290 unchanged rows
    # because a different row was edited. Any new or reworded tip still lands
    # unapproved, so an edit always costs a fresh review of exactly that edit.
    approved_before = await _approved_fingerprints(db, CARE_TIPS)
    carried = 0
    for row in matrix_rows:
        if _fingerprint(row) in approved_before:
            row["is_approved"] = True
            carried += 1

    approved_fallback_before = await _approved_fingerprints(db, CARE_TIP_FALLBACK)
    for row in fallback_rows:
        if _fingerprint(row) in approved_fallback_before:
            row["is_approved"] = True
            carried += 1

    await db[CARE_TIPS].delete_many({})
    await db[CARE_TIPS].insert_many(matrix_rows)

    await db[CARE_TIP_FALLBACK].delete_many({})
    if fallback_rows:
        await db[CARE_TIP_FALLBACK].insert_many(fallback_rows)

    season_imported = None
    if season_rows is not None:
        await db[CITY_SEASON_CALENDAR].delete_many({})
        if season_rows:
            await db[CITY_SEASON_CALENDAR].insert_many(season_rows)
        season_imported = len(season_rows)

    logger.info(
        "Care Tips import: %d matrix rows, %d fallback rows, season_calendar=%s, "
        "%d approval(s) carried over, %d warning(s)",
        len(matrix_rows), len(fallback_rows), season_imported, carried, len(warnings))

    return {
        "approvals_carried_over": carried,
        "matrix_imported": len(matrix_rows),
        "fallback_imported": len(fallback_rows),
        "season_calendar_imported": season_imported,  # None = sheet absent, not just empty
        "warnings": warnings,
    }
