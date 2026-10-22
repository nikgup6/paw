# Paw Buddy — security notes

Written 21 Oct 2026, after the security-hardening work (git commits "Step 1" to
"Step 9"). This is a technical record for review. **It is not legal advice**: the
privacy-policy section lists what the code does, so whoever writes the policy
knows what it has to cover.

Run this before every deploy (it changes nothing and never prints a secret):

```
python scripts/security_check.py          # configuration, secret scan, public routes
python scripts/security_check.py --deps   # ...plus pip-audit (if installed) and npm audit
```

---

## 1. Settings the backend needs

All of these are environment variables: `backend/.env` on a laptop (git-ignored),
Vercel → Project → Settings → Environment Variables for the live site.
`backend/.env.example` lists them with blank or placeholder values.

| Variable | Required | Live value | Notes |
|---|---|---|---|
| `MONGODB_URI` | yes | from Atlas | No default any more; the app will not start without it. |
| `SECRET_KEY` | yes | `python scripts/gen_secret.py` | Signs every login token. Production refuses one under 32 characters or one that looks like a placeholder. Use a different key on the laptop. |
| `ENV` | — | `production` | Turns on the strict checks, turns off `/docs`. Default `dev`. |
| `CORS_ORIGINS` | — | your https address(es) | Exact origins, comma separated, no wildcard. Default `http://localhost:5173`. |
| `TRUSTED_PROXY_COUNT` | — | `1` on Vercel | Decides whose address the rate limits count. `0` behind Vercel makes every visitor share one limit. |
| `MATCHMAKER_DAILY_CAP` | — | `300` | Paid AI calls per day across everyone; then the free fallback. |

**To do once:** the old database password and token key were written in the
source code (and in zips shared on 21 Oct 2026). Change the database user's
password in Atlas, generate a new `SECRET_KEY`, and reset the admin password with
`python backend/create_admin.py --reset-password`.

---

## 2. Where personal data lives, and who can read it

"Who can read it" means through the API. Anyone with the Atlas or Cloudinary
login can read everything.

### MongoDB collections

| Collection | Personal data in it | Written by | Who can read it |
|---|---|---|---|
| `users` | name, **mobile**, email, city, password hash, role | `/api/auth/register`, `/quick-register` | Admins (`/api/admin/users`, `/leads`). A user sees their own record at sign-in. |
| `quiz_results` | account id (if signed in), quiz answers: city, home type, who lives at home (children / seniors), budget, hours alone, allergies, activity, experience | `/api/quiz/submit` | The account owner, or an admin |
| `quiz_progress` | browser session id, account id, the same quiz answers, city, readiness, top breed, **traffic source** (utm tags, referring site's name, landing page, device type, browser language) | `/api/funnel/progress` | Admins (funnel report, CSV export) |
| `events` | browser session id, account id, what was tapped; some events carry a breed or a city | `/api/funnel/events` | Admins (funnel report) |
| `anonymous_visits` | browser visitor id, session id, time | `/api/analytics/visit` | Admins |
| `buy_requests` | name, **mobile**, city, breed, intent, account id, session id, channel | `/api/buy` | Admins; the account owner sees their own |
| `feedback` | account id, name, rating, free-text comment, where it was given | `/api/feedback` | Admins |
| `experience_feedback` | dog-owner id, account id, name, five scores, comment | `/api/feedback/experience` | Admins |
| `owner_surveys` | session id, city, breed, survey answers (labelled "Anonymous N", no name or number) | `/api/owner-survey/submit` | Admins |
| `pets` | account id, pet name, date of birth, gender, breed, health notes, vaccines, reminders | `/api/pets/` (sign-in needed) | The account owner, or an admin |
| `dog_profiles` | **owner id** (the signed-in account's user id; older dogs: a per-browser id until that browser signs in and they move), dog name, date of birth, gender, weight, **city**, photo link, health notes | `/api/dogs` | **The signed-in owner only** (admins too). Someone else's dog answers 404. |
| `health_documents`, `vaccination_documents` | dog id, stored-file link, **original filename** (often contains a person's name), text the AI read from the document | health-vault upload | The signed-in owner of the dog only. The file itself through `/documents/{id}/file`, fetched with the token. |
| `vaccinations`, `prescriptions`, `dewormings`, `reminders`, `custom_reminders`, `daily_care`, `daily_care_items`, `schedule_dismissals` | the dog's medical history, medicines, owner's notes | health-vault and daily-care routes | The signed-in owner of the dog only |
| `rate_limits` | a keyed hash of an IP address or admin mobile — not reversible without `SECRET_KEY` | the rate limiter | Nobody through the API; each row deletes itself within an hour |
| `analytics_meta` | the name of the last rejected tracking event | tracking | Admins |

**Age range:** not stored anywhere today.

### Outside MongoDB

| Where | What | Notes |
|---|---|---|
| Cloudinary | dog photos; vaccination documents and prescriptions (images and PDFs) | Stored at **public** addresses with random names. Photos uploaded from 21 Oct 2026 have no metadata. **Older photos still carry their EXIF data, often including the GPS position of the owner's home.** Document images still keep theirs (see §6). |
| The visitor's browser | `pb_token` (login token), `pb_user` (name, mobile, email), `pb_sid`, `pb_visitor_id`, `pb_owner_id` (also a cookie), quiz state | On their device; cleared by signing out (token and user) or clearing site data. |
| Server logs (Vercel) | request paths, error details | Login tokens, keys, database passwords and mobile numbers are masked by `app/security/log_safety.py`. Paths can contain dog or document ids. |
| Supabase | unknown | `index.html` at the project root (an old prototype) contains a Supabase **anon** key. If that project still holds data, it is readable by anyone unless every table has Row Level Security on. |

### Other companies that receive personal data

| Service | What it receives |
|---|---|
| MongoDB Atlas | everything in the table above (the database host; check which region the cluster is in) |
| Cloudinary | every uploaded photo and document |
| Vercel | every request (hosting) and the logs |
| Anthropic (Claude) | the free text a visitor types into the AI matchmaker, which may describe their family and home |
| Google Gemini (or OpenAI / Anthropic, per `AI_PROVIDER`) | every uploaded vaccination document and prescription, for reading. A vet's card often shows the owner's name, phone and address. |
| OpenWeatherMap | the city, for weather-based care tips |
| Google Fonts, Fontshare | every visitor's IP address, when the page loads its fonts |
| WhatsApp (user's own app) | when a visitor taps a breeder's WhatsApp or call button, *they* contact the breeder; Paw Buddy does not pass their number on |

---

## 3. Deleting one person's data on request

There is no delete tool yet, and nobody should run hand-written delete commands
against the live database. Build an **admin-only** "delete this person" tool that
shows a dry-run count first, and test it on the test database. Until then, this
is the procedure it should follow:

1. **Find them.** Ask for the mobile number. `users` → their account `id`.
2. **By account id:** `quiz_results`, `pets`, `buy_requests`, `feedback`,
   `experience_feedback`, `quiz_progress`, `events` — every row with
   `user_id` = that id.
3. **By mobile:** `buy_requests` rows with that `mobile` (leads left before they
   had an account).
4. **By browser session:** `quiz_progress` rows for that account give its
   `session_id`s. Delete `events` and `anonymous_visits` rows with those session
   ids too, to remove what they did before signing in.
5. **Their dogs — the hard part.** Dogs belong to a per-browser `owner_id`, which
   is **not linked to the account**. To find them, the person must give their
   owner id (shown nowhere in the app today; it is `pb_owner_id` in their
   browser's storage), or you match by `experience_feedback.owner_id`. Then:
   `DELETE /api/dogs/{dog_id}` for each dog removes the dog and all its records.
   Also delete each dog's photo, and every document's file in Cloudinary, by the
   stored public id.
6. **Last:** the `users` row.
7. **Backups:** Atlas snapshots keep deleted data until they expire. Know the
   retention period, and say it in the policy.

The account-to-dog gap in step 5 disappears once dogs are linked to accounts —
see item F below.

---

## 4. What the privacy policy has to cover

*Not legal advice — a list of facts from the code for whoever writes the policy.
India's Digital Personal Data Protection Act, 2023 applies to this kind of data;
get the policy reviewed.*

- **What is collected:** name, mobile, email, city; quiz answers about home,
  household (including whether young children or seniors live there), budget and
  schedule; dog details and the dog's medical records and documents; photos;
  feedback text; how the visitor arrived (utm tags, referring site); device type
  and browser language; IDs stored in the browser; IP addresses (counted, hashed,
  deleted within an hour).
- **Why:** matching, saving results, breeder requests, health reminders, product
  analytics, abuse prevention.
- **Who else receives it:** every service in the table in §2, including that
  uploaded documents are read by an AI service and matchmaker text goes to
  Anthropic.
- **Where it is stored:** the Atlas cluster's region, Cloudinary, Vercel.
- **How long it is kept,** including backups.
- **How to ask for deletion** — and that dog records need the browser's owner id
  until accounts and dogs are linked.
- **What is stored in the browser** (local storage and the `pb_owner_id` cookie).
- **Payments:** once the paywall is live, what the payment provider receives.

---

## 5. What the hardening changed (summary)

| | Before | After |
|---|---|---|
| Secrets | Database password and token key written in `settings.py`; the running app used them | Environment only; the app refuses to start without them |
| Admin accounts | `/register` accepted `role: ADMIN` from anyone | New accounts are always USER |
| CORS | any website | listed origins only |
| Abuse | no limits | per-connection limits, AI daily cap, admin lockout (`app/security/rate_limit.py`) |
| Other users' data | readable / overwritable by user id | owner or admin only; writes filed under the signed-in account |
| Account lookup | quick-register returned the account for any mobile | same short reply for every number |
| Money events | any browser could post `payment_success` | server-only |
| Uploads | trusted the name / label | checked by content; photos lose their GPS; random names |
| Production | `/docs` public | docs off, plain errors, security headers, masked logs |

---

## 6. Still open, most important first

1. **D — the shared placeholder password. Do not take live payments until OTP
   sign-in replaces it.** Every non-admin account has the same password, and it
   is in the JavaScript every visitor downloads. Anyone who knows a mobile number
   can sign in as that person and see everything an account sees. Steps 5 and 9
   close the side doors; this is the front door. `security_check.py` lists every
   place the placeholder appears.

2. **F — dog routes are open to anyone with an id.** By design (dogs belong to a
   per-browser id, not a sign-in), and not changed. Exactly what someone can do:
   - **With an owner id:** list every dog that browser has (`GET /api/dogs`) —
     name, date of birth, city, photo, health notes — then everything below for
     each dog.
   - **With a dog id:** read the profile, all health records, every vaccination
     document and prescription **including downloading the original files**,
     reminders and the emergency card; **change** the profile, reminders and
     reviewed vaccinations; **delete** documents, vaccinations, prescriptions,
     reminders, or **the whole dog with all its records**.
   - **`claim`:** only takes a dog that has *no* owner yet (from the first,
     single-dog build). It cannot take a dog that already has one.
   - **How someone could learn an id:** the ids are random UUIDs, so guessing is
     not realistic. The risk is leaking: an id copied from a shared screenshot,
     the browser's storage on a shared device, URLs in logs. The owner id is also
     a cookie on the frontend's domain.

   **Proposed fix, for approval** (after OTP, which provides the sign-in it needs):
   1. Add `user_id` to `dog_profiles`.
   2. On sign-in, the app calls a new "link my dogs" route (token + the
      browser's owner id) that stamps `user_id` on the dogs with that owner id.
   3. One dependency, `require_dog_owner(dog_id)`, on every dog, daily-care,
      health-vault and legacy vaccination route. It loads the dog and allows the
      signed-in owner or an admin, nobody else — the same pattern as
      `require_self_or_admin`.
   4. Retire the `owner_id` query parameter.
   5. If an emergency card ever needs to be shared, give it its own random,
      expiring, read-only share link instead of the dog id.

   **Meanwhile, cheap wins without sign-in:** rate-limit dog-scoped reads per
   connection, and send the owner id in a header rather than the URL so it stays
   out of access logs.

3. **Rotate the credentials** (§1). Until then the old database password and
   token key are known to anyone who has the code.
4. **Old photos still have GPS data** in Cloudinary. Cleaning them means
   rewriting stored files, so it needs a deliberate, tested tool with a dry-run
   — not a quick script against live data.
5. **Document images keep their metadata.** The switch is
   `STRIP_DOCUMENT_IMAGE_METADATA` in `backend/app/security/uploads.py`
   (recommended: on). It was left off because the brief covered dog photos and
   these images also go to the document AI.
6. **The Supabase key in `index.html`.** If that Supabase project is unused,
   delete the project; if it is used, check Row Level Security on every table.
   Either way, consider removing the old prototype pages from the project root.
7. **Dependencies.** `npm audit` reports 24 issues. In code that reaches
   visitors: **axios** and **react-router-dom**, both fixable within the current
   version (`npm audit fix`, then rebuild and test). The rest are in tools that
   run only on the developer's machine (vite, esbuild, puppeteer); several need
   major upgrades — decide by hand. **puppeteer** is listed under
   `dependencies`, so every deploy downloads a full Chrome; it belongs in
   `devDependencies`. `pip-audit` is not installed, so the Python packages were
   not audited: `python -m pip install pip-audit`.
8. **Admin numbers are discoverable.** The Login page needs the
   `admin_password_required` reply to show the password box, so trying a number
   reveals whether it is an admin's. Goes away when OTP replaces this flow.
9. **An admin removed from the role keeps access until their token expires**
   (at most 2 hours): the admin check trusts the role inside the token.
10. **Tracking still trusts the browser's `user_id` on events and progress.**
    Low risk (it only mislabels analytics), left so tracking needs no sign-in.
11. **Shared Wi-Fi and the tracking limits.** A campus session with many people
    on one connection can pass 300 events a minute. The quiz is unaffected, but
    the dashboard would undercount; raise the numbers in `RULES` for such events.
12. **The rate limiter fails open** if the database errors (on purpose: tracking
    must never break the quiz). During a database outage there are no limits.

---

## 6a. TEMPORARY number-only sign-in for dog owners (review item 7b)

**TEMPORARY. Delete this endpoint and the allowlist when OTP is live. Anyone who
knows an allowlisted number can open that person's dog records, which is
acceptable only while the list is the team's own numbers.**

- Endpoint: `POST /api/auth/legacy-login` in `backend/app/routes/auth.py`.
- Setting: `LEGACY_MOBILE_LOGIN_ALLOWLIST` in `backend/.env` (blank = nobody).
- Only role USER accounts that own at least one dog; never an admin. Same reply
  for every refusal. 5 an hour per connection, 3 an hour per number.
- To remove: delete the endpoint, `LegacyLoginIn`, the two `legacy_login_*`
  rate-limit rules, the setting, `frontend/src/components/auth/LegacyNumberLogin.jsx`
  and its two links (Login page, `app/components/DogSignIn.jsx`), and the
  reviewed-route line in `scripts/security_check.py`.

## 7. For the OTP build

What this work expects from it:

- Use `app/security/rate_limit.py` for the OTP limits — add rules to `RULES`;
  do not build a second limiter.
- **Never log an OTP.** The log redaction cannot recognise one.
- Remove the shared placeholder everywhere `security_check.py` lists it, and
  `_SHARED_PLACEHOLDER` in `backend/app/routes/auth.py`.
- Raising `ACCESS_TOKEN_EXPIRE_MINUTES` for users is safe: admin tokens stay
  capped at `ADMIN_TOKEN_MAX_MINUTES` (2 hours).
- The money events (`payment_*`) must be recorded by the server with
  `record_event(..., trusted=True)`, only after the payment provider confirms.
