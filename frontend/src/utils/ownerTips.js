import cityZones from '../config/cityZones.json';

/* City -> climate zone, the one thing this file still does.

   The per-breed personalised tip that used to live here (buildOwnerTip) was
   replaced by the server-side Care Tips engine (GET /api/care-tips/match,
   backed by the vet-reviewed Breed Care Tips spreadsheet) — see careTips.js.
   zoneForCity survives because both the survey submission payload and the
   new match call still need the owner's city resolved to a climate band. */

/** City (or "zone:HOT_DRY" fallback) → climate band. */
export const zoneForCity = (city) => {
  if (!city) return null;
  if (String(city).startsWith('zone:')) return String(city).slice(5);
  return cityZones.cities[city] || null;
};
