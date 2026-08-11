import React, { useState } from 'react';
import { reviewVaccination } from '../utils/healthVault';

/* Correcting one record.

   Opened two ways: when the scanner wasn't confident and wants confirming, and
   whenever the owner spots something wrong — a misread date, a vet's name the
   OCR mangled. Same form either way; only the wording changes, because "review
   this" and "fix this" are the same edit.

   Only the fields the owner actually touched are sent. That matters more than
   it looks: the same stored row can be shown as a completed dose AND as the
   next-due entry it names, and the due entry carries no batch, vet or clinic.
   Posting the whole form from there would blank all three on the real record.
   A field nobody edited is simply absent from the request, and the server
   leaves it alone. */

const VACCINE_FIELDS = [
  { key: 'vaccine_name', label: 'Vaccine name', type: 'text', placeholder: 'e.g. Anti-Rabies', full: true },
  { key: 'administration_date', label: 'Date given', type: 'date' },
  { key: 'due_date', label: 'Next due date', type: 'date' },
  { key: 'booster_interval', label: 'Booster interval', type: 'text', placeholder: 'e.g. 1 year' },
  { key: 'manufacturer', label: 'Manufacturer', type: 'text' },
  { key: 'batch_number', label: 'Batch number', type: 'text' },
  { key: 'veterinarian', label: 'Veterinarian', type: 'text' },
  { key: 'clinic_name', label: 'Clinic', type: 'text' },
];

/* A dewormer is a medicine, not a shot: no manufacturer batch to trace and no
   booster cycle. Offering those boxes would invite data that means nothing. */
const DEWORMING_FIELDS = [
  { key: 'vaccine_name', label: 'Dewormer', type: 'text', placeholder: 'e.g. Lemasole', full: true },
  { key: 'administration_date', label: 'Date given', type: 'date' },
  { key: 'due_date', label: 'Next due date', type: 'date' },
  { key: 'dose', label: 'Dose', type: 'text', placeholder: 'e.g. 0.7ml' },
  { key: 'veterinarian', label: 'Veterinarian', type: 'text' },
  { key: 'clinic_name', label: 'Clinic', type: 'text' },
];

const isoOrEmpty = (s) => {
  if (!s) return '';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
};

const VaccinationEditModal = ({ vaccination, onClose, onSaved }) => {
  const deworming = vaccination.category === 'deworming' || vaccination.record_type === 'deworming';
  const fields = deworming ? DEWORMING_FIELDS : VACCINE_FIELDS;
  const reviewing = Boolean(vaccination.needs_review);
  const noun = deworming ? 'deworming' : 'vaccination';

  const initial = React.useMemo(() => {
    const out = {};
    for (const f of fields) {
      out[f.key] = f.type === 'date'
        ? isoOrEmpty(vaccination[f.key])
        : (vaccination[f.key] || '');
    }
    return out;
  }, [fields, vaccination]);

  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const changed = fields.filter((f) => form[f.key] !== initial[f.key]).map((f) => f.key);

  const save = async () => {
    if (!form.vaccine_name.trim()) { setError(`${fields[0].label} is required.`); return; }
    if (!reviewing && changed.length === 0) { onClose?.(); return; }
    setSaving(true); setError('');
    try {
      const payload = {};
      for (const key of changed) payload[key] = form[key];
      const updated = await reviewVaccination(vaccination.id, payload);
      onSaved?.(updated);
    } catch (e) {
      setError(e?.response?.data?.detail || 'Couldn’t save. Please try again.');
      setSaving(false);
    }
  };

  return (
    <div className="vem" role="dialog" aria-modal="true" aria-label={`Edit ${noun}`} onClick={onClose}>
      <div className="vem__box" onClick={(e) => e.stopPropagation()}>
        <div className="vem__bar">
          <span>{reviewing ? `Review & confirm ${noun}` : `Edit ${noun}`}</span>
          <button type="button" onClick={onClose} aria-label="Close">×</button>
        </div>
        <p className="vem__hint">
          {reviewing
            ? 'Our scanner wasn’t fully confident. Check these details — a reminder is created once you confirm.'
            : 'Change whatever’s wrong. Anything you leave alone stays exactly as it is.'}
        </p>

        <div className="vem__grid">
          {fields.map((f) => (
            <label key={f.key} className={`vem__field ${f.full ? 'vem__field--full' : ''}`}>
              <span>{f.label}</span>
              <input
                type={f.type}
                value={form[f.key]}
                placeholder={f.placeholder || ''}
                onChange={(e) => set(f.key, e.target.value)}
              />
            </label>
          ))}
        </div>

        {error && <p className="vem__error">{error}</p>}

        <div className="vem__actions">
          <button type="button" className="vem__cancel" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="vem__save" onClick={save} disabled={saving}>
            {saving
              ? 'Saving…'
              : reviewing
                ? 'Confirm & create reminder'
                : changed.length
                  ? `Save ${changed.length} change${changed.length > 1 ? 's' : ''}`
                  : 'Save'}
          </button>
        </div>

        <style>{`
          .vem { position: fixed; inset: 0; z-index: 3400; background: rgba(35,22,14,.72);
                 display: flex; align-items: center; justify-content: center; padding: 20px;
                 font-family: 'Poppins', sans-serif; }
          .vem__box { background: #fff; border-radius: 16px; width: 100%; max-width: 560px;
                      max-height: 90dvh; overflow-y: auto; box-shadow: 0 30px 70px rgba(0,0,0,.35); }
          .vem__bar { display: flex; justify-content: space-between; align-items: center;
                      padding: 14px 18px; border-bottom: 1px solid #EFE6DC; background: var(--cream,#FBF5EF); }
          .vem__bar span { font-family: 'Fredoka', sans-serif; color: var(--brown); font-weight: 600; font-size: 16px; }
          .vem__bar button { border: none; background: none; font-size: 24px; line-height: 1; cursor: pointer; color: var(--text-soft); }
          .vem__hint { margin: 14px 18px 4px; color: var(--text-soft); font-size: 13px; line-height: 1.5; }
          .vem__grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 12px 18px; }
          .vem__field { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
          .vem__field--full { grid-column: 1 / -1; }
          .vem__field span { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: var(--text-soft); font-weight: 700; }
          .vem__field input { width: 100%; box-sizing: border-box; padding: 10px 12px; border-radius: 10px;
                              border: 2px solid #EAE4DE; font-size: 14px; font-family: inherit; color: var(--brown); outline: none; }
          .vem__field input:focus { border-color: var(--orange); box-shadow: 0 0 0 3px rgba(227,93,24,.12); }
          .vem__error { margin: 0 18px; padding: 9px 12px; border-radius: 10px; background: #FFF5F5;
                        border: 1px solid #F2C9C9; color: #B23B3B; font-size: 12.5px; }
          .vem__actions { display: flex; justify-content: flex-end; gap: 10px; padding: 16px 18px; }
          .vem__cancel { padding: 11px 18px; border-radius: 50px; border: 1px solid #E3D9CE; background: #fff;
                         color: var(--text-soft); font-weight: 700; font-family: inherit; cursor: pointer; }
          .vem__save { padding: 11px 20px; border-radius: 50px; border: none; background: var(--orange); color: #fff;
                       font-weight: 700; font-family: inherit; cursor: pointer; }
          .vem__save:disabled, .vem__cancel:disabled { opacity: .6; cursor: not-allowed; }
          @media (max-width: 560px) { .vem__grid { grid-template-columns: 1fr; } }
        `}</style>
      </div>
    </div>
  );
};

export default VaccinationEditModal;
