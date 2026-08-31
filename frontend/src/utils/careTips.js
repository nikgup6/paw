import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/* Fetches the vet-reviewed Care Tips match for one survey submission.

   `monthOverride` exists ONLY for testing the season-aware second pass
   without waiting for the actual season — see OwnerSurvey.jsx, which reads
   it from a `?test_month=` URL param. A real submission never sends it, so
   the server always uses its own current date. */
export async function fetchCareTips({ breed, city, climateZone, tenure, challenges, monthOverride }) {
  const params = new URLSearchParams();
  params.set('breed', breed);
  params.set('city', city);
  if (climateZone) params.set('climate_zone', climateZone);
  if (tenure) params.set('tenure', tenure);
  (challenges || []).forEach((c) => params.append('challenge', c));
  if (monthOverride) params.set('month_override', monthOverride);

  try {
    const { data } = await axios.get(`${API_URL}/api/care-tips/match?${params.toString()}`);
    return Array.isArray(data?.tips) ? data.tips : [];
  } catch {
    // A network hiccup here shouldn't block the CTA that actually matters —
    // an empty tip list is exactly how "nothing approved yet" already renders.
    return [];
  }
}

/* The single tip teased inline part-way through the owner survey, once breed
   and city are both known but no dog profile exists yet.

   Returns the tip object or null — never throws and never a placeholder. The
   caller renders nothing at all on null, so a breed with no approved tip and a
   backend that is down look the same from the survey's point of view, which is
   correct: neither is something to interrupt someone mid-form about. */
export async function fetchTeaserTip({ breed, city, monthOverride } = {}) {
  if (!breed) return null;
  const qs = new URLSearchParams({ breed });
  if (city) qs.set('city', city);
  if (monthOverride) qs.set('month_override', monthOverride);
  try {
    const { data } = await axios.get(`${API_URL}/api/care-tips/teaser?${qs}`);
    return data?.tip || null;
  } catch {
    return null;
  }
}

/* Tips for a dog that already has a profile (the dashboard card).

   Breed, city and age are read server-side from the stored profile, so this
   only needs the dog id. `monthOverride` is the same testing-only escape
   hatch the survey version has. `full: true` asks for the dog's complete
   approved matching set instead of the rotated 3-tip card subset — the Tip
   Details modal's fetch, not the dashboard card's. */
export async function fetchCareTipsForDog(dogId, { monthOverride, slotOverride, full } = {}) {
  const EMPTY = { tips: [], conditions: null, rotation: null };
  if (!dogId) return EMPTY;
  const qs = new URLSearchParams();
  if (monthOverride) qs.set('month_override', monthOverride);
  if (slotOverride != null) qs.set('slot_override', String(slotOverride));
  if (full) qs.set('full', 'true');
  const suffix = qs.toString() ? `?${qs}` : '';
  try {
    const { data } = await axios.get(`${API_URL}/api/care-tips/for-dog/${dogId}${suffix}`);
    return {
      tips: Array.isArray(data?.tips) ? data.tips : [],
      // Derived from the city's climate zone + month, not measured — the
      // payload says so via conditions.source, and the UI wording follows it.
      conditions: data?.conditions || null,
      rotation: data?.rotation || null,
    };
  } catch {
    // The card hides itself on an empty list, which is also the right
    // outcome for a failed request — never a broken card on the dashboard.
    return EMPTY;
  }
}

export const CATEGORY_ICON = {
  Climate: '🌡️',
  'Health Risk': '🩺',
  Grooming: '🪮',
  Energy: '🎾',
  Age: '🐾',
  Behavior: '🎓',
};
