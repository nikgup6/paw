import axios from 'axios';

/* Client for the dog-profile API.

   An owner is identified by a per-device id. There is no login: creating a dog
   profile IS the sign-up step, and that dog's id is what every health record is
   filed under. One owner may keep any number of dogs, and no read ever spans
   two of them. */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const BASE = `${API_URL}/api/dogs`;

const OWNER_ID_KEY = 'pb_owner_id';
const LEGACY_DOG_ID_KEY = 'pb_dog_id';

/* The owner id is the only thing tying a person to their dogs, and it lived in
   exactly one place: localStorage. Clearing site data — or a browser doing it
   for you after a period of inactivity, which Safari does by design — silently
   orphaned every dog, every uploaded certificate and every reminder. The
   records were never lost, but they became unreachable, which to the owner is
   the same thing.

   So it is written to a long-lived cookie as well, and either copy can restore
   the other. Two independent stores that a single "clear localStorage" cannot
   both take out. */
const OWNER_COOKIE_DAYS = 3650;

const readCookie = (name) => {
  try {
    const hit = document.cookie.split('; ').find((row) => row.startsWith(`${name}=`));
    return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null;
  } catch {
    return null;
  }
};

const writeCookie = (name, value) => {
  try {
    const expires = new Date(Date.now() + OWNER_COOKIE_DAYS * 864e5).toUTCString();
    // SameSite=Lax so it survives normal navigation without riding along on
    // cross-site requests.
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
  } catch { /* cookies disabled — localStorage alone still works */ }
};

const readStored = (key) => {
  try { return localStorage.getItem(key); } catch { return null; }
};

const writeStored = (key, value) => {
  try { localStorage.setItem(key, value); } catch { /* private mode */ }
};

export const getOwnerId = () => {
  const stored = readStored(OWNER_ID_KEY);
  const cookie = readCookie(OWNER_ID_KEY);

  // Whichever survived wins, and it repairs the one that didn't.
  const id = stored || cookie
    || (window.crypto?.randomUUID?.() || `owner-${Date.now()}-${Math.random().toString(36).slice(2)}`);

  if (stored !== id) writeStored(OWNER_ID_KEY, id);
  if (cookie !== id) writeCookie(OWNER_ID_KEY, id);
  return id;
};

/* The first build kept a single dog under `pb_dog_id` with no owner. Adopt it
   once so an existing medical history survives the move to multiple dogs. */
export const claimLegacyDog = async (ownerId) => {
  let legacyId;
  try {
    legacyId = localStorage.getItem(LEGACY_DOG_ID_KEY);
  } catch { return null; }
  if (!legacyId) return null;

  try {
    const dog = await axios.post(`${BASE}/${legacyId}/claim`, null, { params: { owner_id: ownerId } })
      .then((r) => r.data);
    return dog;
  } catch {
    return null;                       // already claimed, or never existed
  } finally {
    try { localStorage.removeItem(LEGACY_DOG_ID_KEY); } catch { /* ignore */ }
  }
};

export const listDogs = (ownerId) =>
  axios.get(BASE, { params: { owner_id: ownerId } }).then((r) => r.data);

export const getDog = (dogId) =>
  axios.get(`${BASE}/${dogId}`).then((r) => r.data);

export const createDog = (ownerId, profile) =>
  axios.post(BASE, profile, { params: { owner_id: ownerId } }).then((r) => r.data);

export const updateDog = (dogId, profile) =>
  axios.put(`${BASE}/${dogId}`, profile).then((r) => r.data);

export const deleteDog = (dogId) =>
  axios.delete(`${BASE}/${dogId}`).then((r) => r.data);

/* Photos upload on their own so a failed image never costs the rest of the form. */
export const uploadDogPhoto = (file) => {
  const form = new FormData();
  form.append('file', file, file.name);
  return axios.post(`${BASE}/photo`, form).then((r) => r.data);
};
