# PAW BUDDY tracking guide

## 1. Tag every link you share

Every link we share must use:

`?utm_source=...&utm_medium=...&utm_campaign=...`

| Channel | utm_source | utm_medium | Example |
|---|---|---|---|
| Instagram reel or bio | `instagram` | `reel` / `bio` | `?utm_source=instagram&utm_medium=reel&utm_campaign=hyd_summer` |
| Meta ads | `meta` | `paid` | `?utm_source=meta&utm_medium=paid&utm_campaign=test1` |
| Breeder share | `breeder` | `link` | `?utm_source=breeder&utm_medium=link&ref=br_12` |
| Gated community WhatsApp | `gated` | `whatsapp` | `?utm_source=gated&utm_medium=whatsapp&utm_campaign=gachibowli` |
| Vet clinic QR | `vet` | `qr` | `?utm_source=vet&utm_medium=qr&ref=vt_3` |
| Posters | `poster` | `qr` | `?utm_source=poster&utm_medium=qr&utm_campaign=campus` |

`ref` is for a partner or breeder code (`br_12`, `vt_3`). With no UTM tag the
channel is worked out from the referrer (Instagram, Google, WhatsApp, or the
site's hostname), otherwise it is `direct`.

The FIRST visit's source is kept for that browser (first touch). A later visit
from a different link does not overwrite it.

## 2. What is tracked

- Funnel (distinct sessions, in order): `site_visit`, `quiz_started`,
  `quiz_completed`, `results_viewed`, `breeder_cta_clicked`, `contact_submitted`.
- Every event also carries `channel` and `device`, so any event can be grouped by source.
- Quiz answers are saved on every answer to `quiz_progress.answers`, so a quiz
  abandoned half way still leaves its answers on file.
- `breeder_cta_clicked`, `breeder_whatsapp_opened` and the lead in `buy_requests`
  carry the same `session_id` and `channel`.
- Fun features (all optional extras, none are steps of the funnel):
  `dog_react {q_id, mood}` (the quiz dog reacted to an answer or the late screens),
  `avatar_card_opened`, `avatar_card_created {breed}`, `avatar_card_shared {method}`,
  `avatar_card_downloaded` (the "See us together" card; the typed name is never sent),
  `game_started`, `game_over {score_bucket}` (2D game: `0-99`, `100-299`, `300+`; 3D game adds `mode: "3d"` and uses
  `0-99`, `100-299`, `300-599`, `600+`; never the exact score),
  `game_cta_clicked {source}` (`game_over`, or `fallback`), `game_fallback_used {reason}` (the 3D "Street Zoomies"
  game could not run, so the 2D one was shown: `no_webgl`, `context_failed`, `load_failed`, `runtime_error`),
  `toy_squeaked {toy, page}` (a squeaky toy was tapped; once per toy per page per visit),
  `zoomies_played {dogs, label}` (the burst of running dogs after the drumroll in the match reveal; `label` is the engine's
  match label, `replay: true` when someone tapped the sitting dog to see it again),
  `bark_played {breed, source}` (`result` or `carousel`), `bark_remix_opened`,
  `bark_remix_saved` (reserved: there is no save feature yet, so it never fires).
  Their share links carry `utm_medium=avatar_card` (`utm_campaign=see_us_together`)
  and `utm_medium=game` (`utm_campaign=walk_the_dog`), so they show up as their own channels.
- Paywall (props never carry a name, mobile, email or age):
  `free_part_completed` (the last free quiz screen was answered),
  `rough_rec_viewed {breeds}` (the three rough breeds as ONE comma-separated text: event
  props may only be text, numbers or true/false),
  `paywall_cta_clicked {source}` (`rough`, `submit` or `matchmaker`),
  `paywall_viewed {amount, mode}`, `payment_dismissed {amount, mode}` (Razorpay Checkout
  closed without paying), `payment_failed {amount, mode}` (shown as "not charged"),
  `unlock_continued {mode}` (the quiz resumed with Part 2).
  `payment_started {amount, mode, channel}` and `payment_success {amount, mode, channel}`
  are written by the SERVER only (when an order is created, and when Razorpay's
  signature is confirmed); the server refuses them from a browser, so a browser can
  never make the dashboard count money that did not arrive. `mode` is `fake_door`,
  `test` or `live`: count only `live` as revenue.
- Contact screen (before question 1; components/auth/ContactCapture.jsx):
  `login_started` (Continue tapped with a valid-looking form) and `login_completed`
  (the account exists). Their props are only `channel` and `device`, with the
  event's own `session_id`: never a name, number, email or age range. The age range
  lives on the user record (`users.age_range`) and the dashboard reads it there.
- "Was this useful?" card after a recommendation (components/results/ResultsPulse.jsx,
  questions in frontend/src/config/pulse.js): `pulse_shown {kind, version}` (`kind` is
  `paid`, `dismissed` or `none`), `pulse_answered {useful}` (`yes`/`some`/`no`),
  `pulse_dismissed {step}` (closed or skipped at `useful`, `breed_known`, `price_fair`
  or `not_paid_reason`), `screener_answered {key, answer}` (codes only). The optional
  comment is NEVER in an event: it goes only to the `feedback` row
  (`context: "rec_useful"`). Screener answers are stored in `screener_answers`, one
  row per session and question. Admin view: Funnel page, "What people told us".
  Tag your own test visits with `?utm_source=test` and they are left out of it.
- **Mobile numbers are unverified.** Nobody has proved a number belongs to the
  person who typed it (there is no OTP yet). Every user row says
  `mobile_verified: false`, and a number typed again gets a new row with
  `duplicate_mobile: true`. Count unique numbers, not rows, and never treat a
  number as proof of who someone is.
- The admin Funnel page has a "Tracking health" strip. It turns amber if the
  server rejected an unknown event name or no event arrived in 24 hours.

## 2a. The Pilot dashboard (Admin -> Funnel page -> Pilot)

Every event also carries `channel`, `campaign` (utm_campaign), `content`
(utm_content, the single reel) and `device`, from the first-touch link. These
are marketing labels, never personal data. Mobile numbers are **unverified**:
a sign-up is a number someone typed, not a proven person.

| Event | Who fires it | Props (besides the four above) | Dashboard number |
|---|---|---|---|
| `site_visit` | App.jsx, once per session | landing_path | Reach: visits; bounced = a visit and nothing else |
| `find_dog_clicked` | Home.jsx, any button that starts the quiz | source (hero, sticky_bar, journey_card, retake, swipe, about, quiz_link), has_account | Entry funnel: Tapped Find my dog; split by button; per-reel "Tapped Find my dog" |
| `contact_form_viewed` | ContactCapture.jsx, once per session | - | Entry funnel: Saw the contact form |
| `contact_form_started` | ContactCapture.jsx, first tap or keystroke, once per session | - | Entry funnel: Started typing |
| `contact_form_error` | ContactCapture.jsx, submit blocked | field (name, mobile, email) or reason (rate_limited, network) - never the value | (errors are counted in Health / last 24h) |
| `contact_form_closed` | ContactCapture.jsx, form left without an account being created, once per session | - | "Saw the form but left without finishing" |
| `login_started` | ContactCapture.jsx, valid-looking submit | - | Entry funnel: Submitted; per-reel "Form submitted" |
| `login_completed` | Contact screen (ContactCapture.jsx); admin sign-in | - | Free engine: gave a contact number; Entry funnel: Account created |
| `otp_verified` | nothing yet (reserved for OTP) | - | shows "not live yet" |
| `quiz_started` | QuizFlow.jsx | - | Free engine: quiz started |
| `question_viewed` / `question_answered` | QuizFlow.jsx | q_index, q_id | Drop-off by question |
| `free_part_completed` | utils/paymentEvents.js | - | Free engine: finished the free questions |
| `rough_rec_viewed` | utils/paymentEvents.js | breeds | Free engine headline; Reach -> Free arrow |
| `paywall_viewed` | utils/paymentEvents.js | amount, mode | Money: paywall viewed; "paid %" denominator |
| `paywall_cta_clicked` | utils/paymentEvents.js | source | Money: unlock taps |
| `payment_started` | SERVER only (paywall_service) | amount, mode | Money: checkout opened |
| `payment_dismissed` / `payment_failed` | utils/paymentEvents.js | amount, mode | Money: checkout (Razorpay) closed / failed |
| `paywall_dismissed` | PaywallSheet.jsx, the sheet closed WITHOUT tapping Pay | how (x, outside, esc, back) | (last 24h in Health) |
| `paywall_abandoned` | PaywallSheet.jsx, page hidden or closed with the sheet open; navigator.sendBeacon (text/plain), once per session | - | What people told us: "Left with the paywall open (no answer)" |
| `not_unlocked_asked` | NotUnlockedCard.jsx, the "What stopped you from unlocking?" card appeared (once per person) | moment (dismissed, next_visit) | asked-once check (pulse/status) |
| `payment_success` | SERVER only, after Razorpay's signature | amount, mode | Cross-check only: the "tracking mismatch" note |
| `unlock_continued` | utils/paymentEvents.js | mode | (not shown) |
| `quiz_completed` | Home.jsx | readiness_code... | Action: finished the full quiz |
| `results_viewed` | Home.jsx, Results.jsx | top_breed, source... | Action headline |
| `breeder_cta_clicked` | BreedModal, BreedProfileModal, Results | breed | Action (and the Funnel tab) |
| `breeder_call_clicked` | BreederDirectory.jsx, once per breeder per session | breeder_id, breeder_name, breed, source | Action: "Call button taps"; Breeder taps tables (one row per breeder_id, calls and WhatsApp together) |
| `breeder_whatsapp_opened` | BreederDirectory.jsx, once per breeder per session | breeder_id, breeder_name, breed, source | Action: WhatsApp taps; Breeder taps tables |
| `contact_submitted` | BreedProfileModal, Results | breed | Action (people) |

`source` on breeder taps is the screen the directory was opened from:
`breed_modal`, `breed_profile`, `results` (or `directory`).

Not from events:

- **Paid** comes from the `payments` collection: status `paid` with mode `live`
  is money. In fake-door mode a "Pay" tap is a row with status `fake_door`:
  shown as "tapped Pay (intent, no money taken)". Razorpay `test` payments are
  left out unless the toggle is on.
- **Unlocked** (Action card, CSV `unlocked`) = paid OR tapped Pay in fake-door
  mode; never called "paid". **Paid** (Money card, CSV `paid`) = real money
  only. With the paywall off, every signed-in person counts as unlocked.
- **Signed-in people** come from `users` (source `contact_form`), **age range**
  from the user record, **city** and **top breed** from `quiz_progress`.
- **Left out by default** (toggle "Include test and internal data" brings them
  back): admins, the numbers in `INTERNAL_TEST_MOBILES` (backend/.env), and
  visits tagged `?utm_source=test`.
- A row with under 30 visits or under 5 paywall views shows "too few" instead
  of a percentage.

## 3. Privacy note

Collected: an anonymous browser id, the traffic source (UTM / referrer hostname),
a device bucket (mobile / tablet / desktop), the browser language, the landing
page, and quiz answers.

Not collected in events: no phone number, no email, no name, no IP address and
no free text (the matchmaker prompt is never sent). The contact form's name and
phone number go only to the existing buy request, as before. The contact screen's
details go only to the user record, and server logs show at most the last 4
digits of a number.

## 4. Production setting

Set `VITE_API_URL` on the frontend host to the backend's public address. Every
tracking call uses it (with a localhost fallback for development only).
