# Deploying PAW BUDDY on Vercel

The repo is **two Vercel projects** from the same Git repository:

| Vercel project | Root Directory | What it is | Config already in the repo |
|---|---|---|---|
| API | `backend` | FastAPI (Python) on Vercel serverless | `backend/vercel.json`, `backend/requirements.txt` |
| Website | `frontend` | React + Vite static site | `frontend/vercel.json` (all paths -> `index.html`) |

Deploy the API first (the website needs its address), then the website.

No real secrets are in this repo. `backend/.env.example` and `frontend/.env.example`
list every setting; the real values go into Vercel (Project -> Settings ->
Environment Variables), never into a committed file.

---

## 1. Before the first deploy

1. **MongoDB Atlas -> Network Access:** allow `0.0.0.0/0` (Vercel has no fixed IP).
2. **Atlas database user:** use a fresh password. The connection string is `MONGODB_URI`.
3. **Generate `SECRET_KEY`** on a laptop: `python scripts/gen_secret.py`.
   Set it once and do not change it during the pilot: changing it signs every
   visitor out, and a visitor's account lives in their browser's sign-in, so they
   would come back as a new account and be double-counted.

## 2. API project (Root Directory = `backend`)

Environment variables (Production):

| Variable | Value | Notes |
|---|---|---|
| `MONGODB_URI` | Atlas connection string | **Required** |
| `SECRET_KEY` | from `scripts/gen_secret.py` | **Required**, 32+ characters |
| `ENV` | `production` | Strict checks on, `/docs` off |
| `CORS_ORIGINS` | the website's address(es), e.g. `https://pawbuddy.in,https://www.pawbuddy.in` | Exact, comma separated, no `*`, no trailing `/` |
| `TRUSTED_PROXY_COUNT` | `1` | **Required on Vercel** (rate limits) |
| `RUN_STARTUP_MIGRATIONS` | `false` | Run `init_db.py` instead (step 4) |
| `PAYWALL_MODE` | `fake_door` | Pilot: shows the price, takes no money |
| `PAYWALL_PRICE_PAISE` | `9900` | Rs 99 |
| `PAYWALL_UNLOCK_DAYS` | `30` | |
| `USER_TOKEN_DAYS` | `30` | |
| `PILOT_START` / `PILOT_END` | `2026-10-20` / `2026-11-09` | Pilot dashboard window |
| `PILOT_TARGET_SIGNUPS` | `150` | |
| `PILOT_TARGET_PAYERS` | a number, or leave unset | Unset shows "set a target" |
| `PILOT_PRICE_PAISE` | `9900` | "Would-be revenue" in fake-door mode |
| `INTERNAL_TEST_MOBILES` | team's own numbers, comma separated | Left out of pilot numbers |
| `LEGACY_MOBILE_LOGIN_ALLOWLIST` | team's dog-owner numbers, or unset | **TEMPORARY** (see below) |
| `MATCHMAKER_DAILY_CAP` | `300` | |
| `ANTHROPIC_API_KEY` | key | AI matchmaker; without it the free fallback runs |
| `CLOUDINARY_URL` (or the 3 `CLOUDINARY_*` values) | from Cloudinary | Dog photos + health documents |
| `AI_PROVIDER` + `GEMINI_API_KEY` | `gemini` + key | Reads uploaded documents (optional) |
| `WEATHER_API_KEY` | key | Optional |

Leave unset during the fake-door pilot: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`,
`RAZORPAY_WEBHOOK_SECRET` (only for `PAYWALL_MODE=test` / `live`; those modes
refuse to start without them). `ADMIN_PASSWORD` is not read any more.

After deploying, opening the API address in a browser shows a small JSON reply.

## 3. Website project (Root Directory = `frontend`, preset Vite)

| Variable | Value |
|---|---|
| `VITE_API_URL` | the API address from step 2, e.g. `https://pawbuddy-api.vercel.app` (no trailing `/`) |

It is baked in at build time: change it -> redeploy the website. Then make sure
`CORS_ORIGINS` on the API contains the website's real address (redeploy the API
if you change it).

## 4. Once, after the API is live (from a laptop)

Temporarily put the **production** `MONGODB_URI` and `SECRET_KEY` in `backend/.env`, then from `backend/`:

1. `python init_db.py` - creates indexes (incl. "one answer per visit" for the
   feedback card) and seeds readiness levels. Adds only, never deletes; safe to re-run.
   Re-run it after any deploy that adds indexes.
2. `python create_admin.py --reset-password` - sets the admin password.
3. Put the laptop's own development values back in `backend/.env`. Never leave
   the production database in a laptop `.env`: local testing would land in the
   pilot numbers.

Check: `python scripts/security_check.py` (from the repo root) reports no FAIL.

## 5. Smoke test (phone)

1. Home -> Find my dog -> contact form -> free questions -> close the paywall ->
   answer "What stopped you" -> Find my dog again -> Pay (fake door) -> full Top 5.
2. `/admin` -> admin number + password -> **Pilot** tab: entry funnel, stage
   cards and "events in last 24h" show the visit.
3. Dog owners: open `/app` on the browser the dogs were made on and sign in;
   the old dogs move to the account once.

## Things to know on Vercel

- **4.5 MB request limit:** Vercel refuses larger uploads (413). The app allows
  10 MB documents / 5 MB photos; files over ~4.5 MB fail on Vercel.
- **Function time limit:** document upload runs the AI reading in the same
  request. If uploads time out, raise the function's max duration in Vercel.
- **Preview deployments** have their own addresses, not in `CORS_ORIGINS`, so they
  cannot call the API unless you add that address.
- **Payments later:** `PAYWALL_MODE=test` with `rzp_test_` keys; Razorpay webhook
  -> `https://<api>/api/paywall/webhook` (events payment.captured, order.paid,
  payment.failed) with its secret in `RAZORPAY_WEBHOOK_SECRET`; then `live` with
  `rzp_live_` keys.

## TEMPORARY: number-only sign-in for dog owners

**Delete `POST /api/auth/legacy-login` and `LEGACY_MOBILE_LOGIN_ALLOWLIST` when
OTP is live. Anyone who knows an allowlisted number can open that person's dog
records, which is acceptable only while the list is the team's own numbers.**
Removal steps: `docs/SECURITY.md` section 6a.

## Running it on a laptop

- API: `cd backend`, `pip install -r requirements.txt`, copy `.env.example` to
  `.env` and fill in a **development** database, then
  `uvicorn app.main:app --reload --port 8000`.
- Website: `cd frontend`, `npm install`, copy `.env.example` to `.env.local`, `npm run dev`
  (http://localhost:5173).

More detail: `docs/SECURITY.md` (settings, who can read what), `docs/TRACKING.md`
(every event and which dashboard number uses it).
