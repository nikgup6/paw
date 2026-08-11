import axios from 'axios';
import bundledBreeds from '../constants/breeds.json';

/* Breed catalogue — fetched from the backend, which is the source of truth.

   It used to be a synchronous `import breeds from 'breeds.json'` in ten
   different components. That worked, but it meant the catalogue existed in
   three places at once — the frontend bundle, backend/breeds.json, and the
   Mongo collection — and they had already drifted: the Indian Pariah Dog was
   "2BHK min" in one copy and "3BHK min" in another, which is the field that
   decides whether a breed is eliminated outright in a small flat.

   One fetch, shared. The bundled JSON stays as the fallback for one release
   cycle: if the API is unreachable the quiz still works rather than showing an
   empty results page, and `source` says which copy is in use. */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/** Fields the scoring engine reads. A response missing them would still render
    a ranked list — a meaningless one — so it's rejected in favour of the
    bundled copy instead of quietly producing bad recommendations. */
const ENGINE_FIELDS = ['name', 'minApartmentSize', 'monthlyCostMin', 'experienceLevel', 'energy'];

const isUsable = (breeds) =>
  Array.isArray(breeds)
  && breeds.length > 0
  && ENGINE_FIELDS.every((f) => breeds[0][f] !== undefined && breeds[0][f] !== null);

/* Module-level cache plus in-flight de-duplication: the ten consumers mount at
   different times, and without this a single page load would issue a handful
   of identical requests. */
let cache = null;
let inFlight = null;

export const BUNDLED_BREEDS = bundledBreeds;

export async function fetchBreeds() {
  if (cache) return cache;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/breeds/`, { timeout: 10000 });
      if (isUsable(data)) {
        cache = { breeds: data, source: 'api', error: null };
        return cache;
      }
      // Reached the server but the payload can't drive the engine — treat it
      // exactly like an outage rather than scoring against half a record.
      console.warn('Breed API returned an unusable shape; using the bundled catalogue.');
      cache = { breeds: bundledBreeds, source: 'fallback', error: 'shape' };
      return cache;
    } catch (err) {
      console.warn('Breed API unavailable; using the bundled catalogue.', err?.message);
      // Not cached: a later mount should get a chance to reach a recovered API.
      return { breeds: bundledBreeds, source: 'fallback', error: 'unreachable' };
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

/** Test seam — lets a reload re-hit the API after a failure. */
export function resetBreedCache() {
  cache = null;
  inFlight = null;
}
