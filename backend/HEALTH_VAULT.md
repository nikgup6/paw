# Health Vault — AI medical-document scanner

The Health Vault is the core store for a dog's medical documents. Every upload is
kept permanently on **Cloudinary**, recorded in the vault with metadata + AI
results + status, and (for vaccination records) parsed by a **provider-agnostic
AI layer** into structured vaccinations, reminders, and a read-only timeline.

## Separation of concerns

| Concern | Module |
|---|---|
| Upload Service | `routes/health_vault.py` + `services/health_vault_service.py::ingest()` |
| Cloudinary Storage | `services/cloudinary_service.py` |
| Health Vault | `models/health_vault.py` + `health_documents` collection |
| AI Processing Service | `services/ai_processing/` (provider + base + registry + processors + validation) |
| Reminder Service | `services/reminder_service.py` + `reminders` collection |
| Vaccination Timeline | `services/timeline_service.py` (read-only projection of `vaccinations`) |

Routes are thin controllers — all logic is in services. The legacy
`/api/vaccination-documents/*` routes re-register the **same** handler functions,
so there is one implementation, not two.

## Pipeline (on every upload)

1. File → **Cloudinary** (original kept permanently).
2. `health_documents` record created (status `Processing`, `ai_metadata.processing_job_id`).
3. `registry.get_processor(document_type)` → run it (only `vaccination` today).
   The processor calls the **provider** (`AI_PROVIDER`) for structured JSON only —
   the raw model text is never returned to the client.
4. Extracted rows are **validated** and **deduplicated** (dog + vaccine +
   administration date). Each is saved to `vaccinations`.
5. **Confidence gate:** confidence ≥ `AI_AUTO_REMINDER_THRESHOLD` (0.8) **and**
   valid → status `Completed` + reminders auto-created. Otherwise → `Needs Review`
   (no reminders) until the user confirms via `PATCH /vaccinations/{id}`.
6. On AI error → `Failed` with `ai_metadata.last_error`. No key → `Pending`. The
   file is always kept. A short **AI summary** is stored per document.

## Provider abstraction (Gemini / OpenAI / Claude)

`services/ai_processing/provider.py` exposes `generate_structured_json()`.
Business logic never imports a vendor SDK. Choose with `AI_PROVIDER=gemini`
(default) | `openai` | `anthropic`. Gemini + Anthropic SDKs ship already; OpenAI
needs `pip install openai`.

## Adding a new document type (prescriptions, blood tests, X-rays, …)

Write a `DocumentProcessor` subclass, register it in
`services/ai_processing/registry.py`. Nothing in the upload service, storage,
vault, routes, or UI changes.

## Collections

- **`health_documents`** — `id`, `dog_id`, `document_type`, cloudinary fields,
  `original_filename`/`mime_type`/`file_size`, `uploaded_at`, `processing_status`
  (`Pending`|`Processing`|`Completed`|`Needs Review`|`Failed`), `ai_extraction`,
  `ai_summary`, `confidence_score`, `ai_metadata` (`ai_provider`, `ai_model`,
  `ai_version`, `prompt_version`, `processing_job_id`, `processed_at`, `last_error`).
- **`vaccinations`** — `id`, `dog_id`, `source_document_id`, `vaccine_name`,
  `administration_date`, `due_date`, `booster_interval`, `manufacturer`,
  `batch_number`, `veterinarian`, `clinic_name`, `confidence_score`,
  `needs_review`, `reviewed`, `created_at`. Single source of truth for the timeline.
- **`reminders`** — `id`, `dog_id`, `vaccination_id`, `source_document_id`,
  `vaccine_name`, `due_date`, `created_at`. Status derived at read time.

MongoDB is schemaless — no table migration. Indexes are ensured idempotently on
startup by `app/database/indexes.py`.

## Endpoints (`/api/health-vault`, aliased at `/api/vaccination-documents`)

| method | path | purpose |
|---|---|---|
| POST | `/upload` | `dog_id` + `document_type` + `file` → store + process |
| GET | `/dog/{id}/documents` | vault documents (opt `?type=`) |
| GET | `/dog/{id}/vaccinations` | timeline (read-only) |
| GET | `/dog/{id}/reminders` | upcoming/overdue reminders |
| PATCH | `/vaccinations/{id}` | confirm/correct a Needs-Review record → reminder |
| PATCH | `/documents/{id}/status` | update processing status |
| DELETE | `/documents/{id}` | remove + cascade vaccinations & reminders |

## Setup

```bash
pip install -r requirements.txt
```
`backend/.env` (see `.env.example`): Cloudinary creds, `AI_PROVIDER`,
`GEMINI_API_KEY` (or the OpenAI/Anthropic equivalents), optional
`AI_AUTO_REMINDER_THRESHOLD`. Accepted files: JPG, JPEG, PNG, PDF, max 10 MB.
