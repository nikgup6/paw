import axios from 'axios';

/* Client for the dog-profile API.

   Every call needs a signed-in account (utils/apiAuth.js adds the token); the
   server takes the owner from that token, never from anything sent here. One
   owner may keep any number of dogs, and no read ever spans two of them.

   The per-device owner id below is from before sign-in existed. It is now used
   for one thing: moving this browser's old dogs to the account once
   (adoptBrowserDogs). */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const BASE = `${API_URL}/api/dogs`;

const OWNER_ID_KEY = 'pb_owner_id';

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

/* Has this browser ever had the old per-device owner id (it may hold dogs)? */
export const hasBrowserOwnerId = () => !!(readStored(OWNER_ID_KEY) || readCookie(OWNER_ID_KEY));

/* Dogs made on this browser before sign-in were owned by its random id. Once
   someone signs in here, move those dogs to their account (the server only
   moves dogs still owned by that exact id). Once per account per browser. */
export const adoptBrowserDogs = async (userId) => {
  const browserId = readStored(OWNER_ID_KEY) || readCookie(OWNER_ID_KEY);
  const doneKey = `pb_dogs_adopted_${userId}`;
  if (!browserId || readStored(doneKey)) return 0;
  try {
    const { data } = await axios.post(`${BASE}/adopt-browser`, { browser_owner_id: browserId });
    writeStored(doneKey, '1');
    return data?.moved || 0;
  } catch {
    return 0;                          // try again next time
  }
};

/* `ownerId` is ignored: the server lists the signed-in account's dogs. */
export const listDogs = () =>
  axios.get(BASE).then((r) => r.data);

export const getDog = (dogId) =>
  axios.get(`${BASE}/${dogId}`).then((r) => r.data);

export const createDog = (_ownerId, profile) =>
  axios.post(BASE, profile).then((r) => r.data);

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
