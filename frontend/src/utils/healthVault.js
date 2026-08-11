import axios from 'axios';

/* Client for the Health Vault API. All medical-document calls go through here so
   the component doesn't hard-code endpoints. */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const BASE = `${API_URL}/api/health-vault`;

/* Every call below takes an explicit dogId. Nothing is read from a global or a
   "current dog" singleton, which is what keeps one dog's records from ever
   appearing under another. Dog CRUD itself lives in utils/dogs.js. */

export const uploadDocument = (dogId, file, documentType = 'vaccination') => {
  const form = new FormData();
  form.append('dog_id', dogId);
  form.append('document_type', documentType);
  form.append('file', file, file.name);
  return axios.post(`${BASE}/upload`, form).then((r) => r.data);
};

export const listDocuments = (dogId) =>
  axios.get(`${BASE}/dog/${dogId}/documents`).then((r) => r.data);

export const listVaccinations = (dogId) =>
  axios.get(`${BASE}/dog/${dogId}/vaccinations`).then((r) => r.data);

/* The merged view: stored shots + the standard Indian schedule for this dog's
   age and breed, grouped into completed / due_today / upcoming / overdue. */
export const getHealthRecords = (dogId) =>
  axios.get(`${BASE}/dog/${dogId}/health-records`).then((r) => r.data);

/* The Overview page's read model — one request instead of five. */
export const getHealthSummary = (dogId) =>
  axios.get(`${BASE}/dog/${dogId}/summary`).then((r) => r.data);

/* The vet-ER card: identity, allergies, current medication, completed shots. */
export const getEmergencyCard = (dogId) =>
  axios.get(`${BASE}/dog/${dogId}/emergency-card`).then((r) => r.data);

export const listPrescriptions = (dogId) =>
  axios.get(`${BASE}/dog/${dogId}/prescriptions`).then((r) => r.data);

export const deletePrescription = (prescriptionId) =>
  axios.delete(`${BASE}/prescriptions/${prescriptionId}`).then((r) => r.data);

/* Vaccinations, deworming and the owner's own reminders, already merged and
   ordered Due Today -> Overdue -> Upcoming. */
export const listReminders = (dogId) =>
  axios.get(`${BASE}/dog/${dogId}/reminders`).then((r) => r.data);

export const createReminder = (dogId, reminder) =>
  axios.post(`${BASE}/dog/${dogId}/reminders`, reminder).then((r) => r.data);

export const updateReminder = (reminderId, reminder) =>
  axios.put(`${BASE}/reminders/${reminderId}`, reminder).then((r) => r.data);

/* Recurring reminders roll to their next occurrence instead of closing. */
export const completeReminder = (reminderId) =>
  axios.post(`${BASE}/reminders/${reminderId}/complete`).then((r) => r.data);

export const deleteReminder = (reminderId) =>
  axios.delete(`${BASE}/reminders/${reminderId}`).then((r) => r.data);

/* Generated schedule doses and boosters aren't rows, so they're hidden rather
   than deleted — reversible with restoreScheduleEntries. */
export const dismissScheduleEntry = (dogId, key) =>
  axios.post(`${BASE}/dog/${dogId}/schedule-entries/dismiss`, { key }).then((r) => r.data);

export const restoreScheduleEntries = (dogId) =>
  axios.post(`${BASE}/dog/${dogId}/schedule-entries/restore`).then((r) => r.data);

/* Removes one recorded shot and its reminders; the source document stays. */
export const deleteVaccination = (vaccinationId) =>
  axios.delete(`${BASE}/vaccinations/${vaccinationId}`).then((r) => r.data);

export const reviewVaccination = (vaccinationId, edits) =>
  axios.patch(`${BASE}/vaccinations/${vaccinationId}`, edits).then((r) => r.data);

/* Manual retry after the AI scanner failed. The stored original is re-read
   server-side, so there's nothing to re-upload. */
export const reprocessDocument = (documentId) =>
  axios.post(`${BASE}/documents/${documentId}/reprocess`).then((r) => r.data);

/* `deleteRecords` is the owner's answer to "also delete the vaccinations we
   read off this document?" — false keeps the extracted history. */
export const deleteDocument = (documentId, deleteRecords = false) =>
  axios.delete(`${BASE}/documents/${documentId}`, { params: { delete_records: deleteRecords } })
    .then((r) => r.data);

/* Stored originals are served by the API, not linked at Cloudinary directly:
   PDFs live there as extension-less raw assets (Cloudinary won't deliver `.pdf`
   unless the account opts in), so only the backend knows the real content type
   and filename. `download` switches inline viewing for a save-as. */
export const fileUrl = (documentId, { download = false } = {}) =>
  (documentId ? `${BASE}/documents/${documentId}/file${download ? '?download=true' : ''}` : null);
