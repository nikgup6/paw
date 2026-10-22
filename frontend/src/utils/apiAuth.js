import axios from 'axios';

/* Sends the signed-in user's token with every request to OUR API, and only ours.

   Why one hook instead of a header on each call: the server now checks who is
   asking before it hands over or changes someone's data (quiz history, pet
   profile, breeder requests). Adding the header call by call missed some - the
   Profile page sent it for one of its three reads. An interceptor runs for every
   axios request, so a call added next month is covered without anyone
   remembering to.

   Only requests whose URL starts with the API's own address get the token. A
   token sent to any other site would let that site act as the user.

   An explicit Authorization header on a request (the admin screens set their
   own) is left exactly as it is. Tracking (utils/analytics.js) uses fetch, not
   axios, so it is untouched. */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const TOKEN_KEY = 'pb_token';

/* Where the token lives when the browser refuses to store it (private mode,
   blocked site data). Kept in memory only, so it lasts for this visit. */
let visitToken = null;
export function setVisitToken(token) { visitToken = token || null; }

function savedToken() {
  let stored = null;
  try { stored = localStorage.getItem(TOKEN_KEY); } catch { /* storage blocked */ }
  return stored || visitToken;
}

function isOurApi(url = '') {
  // a trailing slash on the base must not stop "http://x/api" matching "http://x/"
  const base = API_URL.replace(/\/+$/, '');
  return url === base || url.startsWith(`${base}/`);
}

let installed = false;

export function installApiAuth() {
  if (installed) return;           // StrictMode / hot reload: one hook, not two
  installed = true;
  axios.interceptors.request.use((config) => {
    const token = savedToken();
    if (token && isOurApi(config.url) && !config.headers?.Authorization) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });
}
