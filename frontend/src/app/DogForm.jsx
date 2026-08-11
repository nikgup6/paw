import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useBreedList } from '../context/BreedsContext';
import cityZones from '../config/cityZones.json';
import { useDogs } from '../context/DogsContext';
import { createDog, deleteDog, getDog, updateDog, uploadDogPhoto } from '../utils/dogs';
import { ageFromDob } from '../utils/healthStatus';

/* Create or edit a dog.

   Saving this form is the moment the product actually starts: the dog gets its
   id, the dashboard refreshes, and Health Records unlocks for it. Date of birth
   is what generates the vaccination and deworming schedules, which is why it's
   required rather than an age in years.

   Cities are read from the same catalogue the breed quiz uses, so the two parts
   of the product agree on spellings. */

const GENDERS = ['Male', 'Female'];
const CITIES = Object.keys(cityZones.cities || {}).sort();
const MAX_PHOTO_MB = 5;

const EMPTY = {
  name: '', breed: '', dob: '', gender: '', weight_kg: '', city: '',
  photo_url: '', photo_public_id: '', health_complications: '',
};

const DogForm = () => {
  const breedsData = useBreedList();
  const { dogId } = useParams();
  const isEdit = Boolean(dogId);
  const navigate = useNavigate();
  const { ownerId, refresh } = useDogs();

  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileRef = useRef(null);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    if (!isEdit) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const dog = await getDog(dogId);
        if (cancelled) return;
        setForm({
          name: dog.name || '', breed: dog.breed || '', dob: dog.dob || '',
          gender: dog.gender || '', weight_kg: dog.weight_kg ?? '', city: dog.city || '',
          photo_url: dog.photo_url || '', photo_public_id: dog.photo_public_id || '',
          health_complications: dog.health_complications || '',
        });
      } catch {
        if (!cancelled) setError('Couldn’t load this dog.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [dogId, isEdit]);

  /* The photo is stored as soon as it's chosen, so a slow image upload never
     blocks the rest of the form and a failed one costs nothing else. */
  const onPhoto = async (file) => {
    if (!file) return;
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
      setError(`Photos must be under ${MAX_PHOTO_MB}MB.`);
      return;
    }
    setPhotoBusy(true);
    setError('');
    try {
      const { photo_url, photo_public_id } = await uploadDogPhoto(file);
      setForm((prev) => ({ ...prev, photo_url, photo_public_id }));
    } catch (e) {
      setError(e?.response?.data?.detail || 'Couldn’t upload that photo. Please try another.');
    } finally {
      setPhotoBusy(false);
    }
  };

  /* The photo and the weight are deliberately NOT required: plenty of owners
     are filling this in at the vet with no picture to hand and no scales in the
     room, and blocking the whole health record over either — things they can
     add in ten seconds later — is the wrong trade. */
  const missing = [
    !form.name.trim() && 'name',
    !form.breed && 'breed',
    !form.dob && 'date of birth',
    !form.gender && 'gender',
    !form.city && 'city',
  ].filter(Boolean);

  const onSave = async () => {
    if (missing.length || saving) return;
    setSaving(true);
    setError('');
    const payload = {
      name: form.name.trim(),
      breed: form.breed || null,
      dob: form.dob,
      gender: form.gender || null,
      // Blank means "not measured", which is a fact. Number('') is 0, which
      // would put a zero-kilo dog on the emergency card.
      weight_kg: String(form.weight_kg).trim() ? Number(form.weight_kg) : null,
      city: form.city || null,
      photo_url: form.photo_url || null,
      photo_public_id: form.photo_public_id || null,
      health_complications: form.health_complications || null,
    };
    try {
      const dog = isEdit ? await updateDog(dogId, payload) : await createDog(ownerId, payload);
      await refresh();              // dashboard + sidebar pick the dog up immediately
      navigate(isEdit ? `/app/dogs/${dog.id}/health` : '/app', { replace: true });
    } catch (e) {
      setError(e?.response?.data?.detail || 'Couldn’t save this dog. Please try again.');
      setSaving(false);
    }
  };

  const onDelete = async () => {
    setSaving(true);
    try {
      await deleteDog(dogId);
      await refresh();
      navigate('/app', { replace: true });
    } catch {
      setError('Couldn’t delete this dog. Please try again.');
      setSaving(false);
      setConfirmDelete(false);
    }
  };

  if (loading) {
    return <div className="pb-page"><div className="pb-loading"><span className="pb-spin" aria-hidden="true" /> Loading…</div></div>;
  }

  const age = ageFromDob(form.dob);

  return (
    <div className="pb-page pb-fade" style={{ maxWidth: 720 }}>
      <div className="pb-page__head">
        <div>
          <h2 className="pb-page__title">{isEdit ? `Edit ${form.name || 'dog'}` : 'Add a dog'}</h2>
          <p className="pb-page__sub">
            {isEdit ? 'Date of birth and breed drive the schedule.' : 'Saving unlocks Health Records.'}
          </p>
        </div>
      </div>

      <section className="pb-card">
        {/* Photo */}
        <div className="pb-photo">
          <div className="pb-photo__frame">
            {form.photo_url
              ? <img src={form.photo_url} alt={form.name || 'Dog photo'} />
              : <span aria-hidden="true">🐶</span>}
            {photoBusy && <span className="pb-photo__busy"><span className="pb-spin" aria-hidden="true" /></span>}
          </div>
          <div className="pb-photo__side">
            <span className="pb-photo__label">Photo <span className="pb-photo__opt">optional</span></span>
            <p className="pb-card__sub">JPG, PNG or WebP, up to {MAX_PHOTO_MB}MB. You can add one later.</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <button type="button" className="pb-btn pb-btn--sm" onClick={() => fileRef.current?.click()} disabled={photoBusy}>
                {form.photo_url ? 'Change photo' : 'Upload photo'}
              </button>
              {form.photo_url && (
                <button type="button" className="pb-btn pb-btn--sm" onClick={() => setForm((p) => ({ ...p, photo_url: '', photo_public_id: '' }))}>
                  Remove
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(e) => { onPhoto(e.target.files?.[0]); e.target.value = ''; }}
            />
          </div>
        </div>

        <div className="pb-form-grid" style={{ marginTop: 18 }}>
          <label className="pb-field pb-field--full">
            <span>Name <span className="pb-field__req">*</span></span>
            <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Bruno" />
          </label>

          <label className="pb-field">
            <span>Breed <span className="pb-field__req">*</span></span>
            <select value={form.breed} onChange={(e) => set('breed', e.target.value)}>
              <option value="">Select a breed</option>
              {breedsData.map((b) => <option key={b.name} value={b.name}>{b.name}</option>)}
              <option value="Indie / Mixed breed">Indie / Mixed breed</option>
              <option value="Other">Other / Not sure</option>
            </select>
          </label>

          <label className="pb-field">
            <span>Date of birth <span className="pb-field__req">*</span></span>
            <input
              type="date"
              value={form.dob}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => set('dob', e.target.value)}
            />
            {age && <span className="pb-field__hint">{age} old</span>}
          </label>

          <label className="pb-field">
            <span>Gender <span className="pb-field__req">*</span></span>
            <div className="pb-choices">
              {GENDERS.map((g) => (
                <button
                  key={g}
                  type="button"
                  className={`pb-choice ${form.gender === g ? 'is-on' : ''}`}
                  onClick={() => set('gender', g)}
                >
                  {g}
                </button>
              ))}
            </div>
          </label>

          <label className="pb-field">
            <span>Weight (kg)</span>
            <input
              type="number"
              min="0.5"
              max="120"
              step="0.1"
              value={form.weight_kg}
              onChange={(e) => set('weight_kg', e.target.value)}
              placeholder="e.g. 24.5"
            />
            {/* Said plainly rather than left blank: it's what a vet doses by,
                so it earns the nudge even though nothing depends on it here. */}
            <span className="pb-field__hint">Preferred, but optional.</span>
          </label>

          <label className="pb-field">
            <span>City <span className="pb-field__req">*</span></span>
            <input
              type="text"
              list="pb-cities"
              value={form.city}
              onChange={(e) => set('city', e.target.value)}
              placeholder="e.g. Hyderabad"
            />
            <datalist id="pb-cities">
              {CITIES.map((city) => <option key={city} value={city} />)}
            </datalist>
          </label>

          <label className="pb-field pb-field--full">
            <span>Existing health conditions (optional)</span>
            <textarea
              value={form.health_complications}
              onChange={(e) => set('health_complications', e.target.value)}
              placeholder="Allergies, ongoing treatment, anything a vet should know."
            />
          </label>
        </div>

        {error && <p className="pb-error" role="alert">{error}</p>}
        {missing.length > 0 && (
          <p className="pb-card__sub" style={{ marginTop: 12 }}>
            Still needed: {missing.join(', ')}.
          </p>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="pb-btn pb-btn--primary"
            onClick={onSave}
            disabled={missing.length > 0 || saving || photoBusy}
          >
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Save profile'}
          </button>
          <button type="button" className="pb-btn" onClick={() => navigate('/app')} disabled={saving}>
            Cancel
          </button>
          {isEdit && (
            <button
              type="button"
              className="pb-btn pb-btn--danger"
              style={{ marginLeft: 'auto' }}
              onClick={() => setConfirmDelete(true)}
              disabled={saving}
            >
              Delete dog
            </button>
          )}
        </div>
      </section>

      {confirmDelete && (
        <div className="pb-overlay" role="dialog" aria-modal="true" aria-label="Delete dog" onClick={() => setConfirmDelete(false)}>
          <div className="pb-modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="pb-modal__bar">
              <span>Delete {form.name}?</span>
              <button type="button" onClick={() => setConfirmDelete(false)} aria-label="Cancel">×</button>
            </div>
            <div className="pb-modal__body">
              <p className="pb-card__sub">
                This removes {form.name} and every record filed under them — vaccinations, prescriptions,
                uploaded documents and reminders. It can’t be undone. Your other dogs aren’t affected.
              </p>
            </div>
            <div className="pb-modal__actions">
              <button type="button" className="pb-btn" onClick={() => setConfirmDelete(false)}>Keep</button>
              <button type="button" className="pb-btn pb-btn--danger" onClick={onDelete} disabled={saving}>
                Delete everything
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .pb-photo { display: flex; gap: 16px; align-items: flex-start; flex-wrap: wrap; }
        .pb-photo__frame {
          position: relative; flex: 0 0 104px; width: 104px; height: 104px;
          border-radius: 20px; overflow: hidden; background: var(--orange-pale);
          border: 1px solid #EFE6DC; display: flex; align-items: center; justify-content: center;
          font-size: 42px;
        }
        .pb-photo__frame img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .pb-photo__busy {
          position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
          background: rgba(255,255,255,.72);
        }
        .pb-photo__side { flex: 1 1 220px; min-width: 0; }
        .pb-photo__label {
          display: block; font-size: 11px; font-weight: 700; text-transform: uppercase;
          letter-spacing: .04em; color: var(--text-soft); margin-bottom: 4px;
        }
        .pb-photo__opt {
          margin-left: 4px; padding: 2px 7px; border-radius: 20px;
          background: var(--grey); color: var(--text-soft); font-size: 9.5px; letter-spacing: .03em;
        }
      `}</style>
    </div>
  );
};

export default DogForm;
