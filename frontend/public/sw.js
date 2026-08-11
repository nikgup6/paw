/* Paw Buddy — offline document cache.

   Health Records depends on the backend for almost everything, but a document
   an owner has already opened — a vaccination certificate, a prescription —
   should still open with no signal, because a vet visit is exactly when
   connectivity drops.

   Two kinds of request are cached, both read-only:
   - the document list and file bytes themselves;
   - the owner's dog list and a single dog's profile, which is what the app
     needs just to ROUTE to the vault. Without this, a hard reload while
     offline can never reach the documents at all: the dog lookup fails first
     and the app redirects to "add a dog" before the cached vault is ever
     rendered — caching the file was necessary but not sufficient.

   Everything else (health records, vaccinations, reminders, uploads, deletes,
   anything that writes) goes straight to the network untouched. Showing a
   cached vaccination *status* as if it were current would be actively
   misleading; showing a document you've already looked at is not.

   Strategy is network-first: while online, every response is fresh and the
   cache is kept in step with it silently. Only a failed network request falls
   back to the last response that succeeded — "last known state", not "live
   state", which is the honest thing to show with no connection. */

const CACHE_NAME = 'pb-documents-v2';

// Path only — deliberately not anchored to an origin, so this keeps working
// whether the API is same-origin or on a different port/domain than the app.
const CACHEABLE = [
  /\/api\/health-vault\/documents\/[^/?]+\/file(?:\?.*)?$/,
  /\/api\/health-vault\/dog\/[^/?]+\/documents(?:\?.*)?$/,
  /\/api\/health-vault\/dog\/[^/?]+\/prescriptions(?:\?.*)?$/,   // shown inline under their document
  /\/api\/dogs(?:\?.*)?$/,          // the owner's dog list
  /\/api\/dogs\/[^/?]+$/,           // a single dog's profile
];

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // Downloads set Content-Disposition: attachment and should always be a live
  // fetch — caching a "save as" response has no benefit and one stale byte
  // would be worse than just failing when offline.
  if (request.url.includes('download=true')) return;
  if (!CACHEABLE.some((re) => re.test(request.url))) return;

  event.respondWith(networkFirst(request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    // Cross-origin <img>/<iframe> loads arrive as opaque responses — status
    // and body are hidden from us, but they cache and replay fine for display.
    if (response && (response.ok || response.type === 'opaque')) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}
