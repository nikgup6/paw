import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import VaccinationEditModal from '../../components/VaccinationEditModal';
import {
  completeReminder, createReminder, deleteReminder, deleteVaccination,
  dismissScheduleEntry, listReminders, updateReminder,
} from '../../utils/healthVault';
import {
  DUE_TODAY, OVERDUE, UPCOMING, countdownLabel, dueStatus, formatDay, isActiveReminder,
} from '../../utils/healthStatus';

/* Everything owed for one dog, in one place.

   Three sources are merged server-side and all of them are this dog's alone:
   vaccinations and boosters derived from the timeline, deworming generated from
   the date of birth, and whatever the owner added themselves. Generated
   reminders can't be edited or deleted — they aren't rows, they're consequences
   of the schedule, and they disappear on their own once the shot is recorded.
   The owner's own reminders are fully editable and can recur. */

const CATEGORIES = ['Medicine', 'Vet Visit', 'Grooming', 'Bath', 'Nail Trimming', 'Food', 'Exercise', 'Other'];
const RECURRENCE = [
  { value: 'none', label: 'One-off' },
  { value: 'daily', label: 'Every day' },
  { value: 'weekly', label: 'Every week' },
  { value: 'monthly', label: 'Every month' },
  { value: 'quarterly', label: 'Every 3 months' },
  { value: 'yearly', label: 'Every year' },
];

const CATEGORY_ICON = {
  Medicine: '💊', 'Vet Visit': '🩺', Grooming: '✂️', Bath: '🛁',
  'Nail Trimming': '💅', Food: '🍖', Exercise: '🎾', Other: '📌',
  Vaccination: '💉', 'Anti-Rabies': '🦠', Deworming: '🪱',
};

const statusClass = (status) => (status || '').toLowerCase().replace(/\s+/g, '-');
const todayIso = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

/* ------------------------------- time of day ------------------------------ */
/* Stored as 24-hour "HH:MM" — sortable, unambiguous, and what every date
   library expects. Shown and entered as 12-hour with AM/PM, because that is
   how the time is said out loud in India and a reminder read as "17:30" is a
   reminder read twice. The native <input type="time"> was doing neither
   reliably: its clock format follows the browser locale, so the same field was
   24-hour on one machine and 12-hour on the next. */

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

const splitTime = (value) => {
  const [h, m] = String(value || '').split(':');
  const hour = Number(h);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return { hour: 9, minute: '00', period: 'AM' };
  return {
    hour: hour % 12 === 0 ? 12 : hour % 12,
    minute: (m || '00').padStart(2, '0'),
    period: hour < 12 ? 'AM' : 'PM',
  };
};

const joinTime = ({ hour, minute, period }) => {
  const h = period === 'AM' ? (hour === 12 ? 0 : hour) : (hour === 12 ? 12 : hour + 12);
  return `${String(h).padStart(2, '0')}:${minute}`;
};

/** "17:30" -> "5:30 PM". Empty for anything unparseable, never a broken string. */
const formatTime12 = (value) => {
  if (!value) return '';
  const { hour, minute, period } = splitTime(value);
  return `${hour}:${minute} ${period}`;
};

const DEFAULT_TIME = '09:00';

const TimePicker = ({ value, onChange }) => {
  const parts = splitTime(value || DEFAULT_TIME);
  const set = (patch) => onChange(joinTime({ ...parts, ...patch }));
  /* A time already on file may not sit on the five-minute grid (an older
     reminder, or one typed before this control existed). Offering it keeps the
     select honest instead of silently rounding the owner's own time. */
  const minutes = MINUTES.includes(parts.minute) ? MINUTES : [...MINUTES, parts.minute].sort();

  return (
    <div className="pb-time">
      <select value={parts.hour} onChange={(e) => set({ hour: Number(e.target.value) })} aria-label="Hour">
        {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
      </select>
      <span className="pb-time__sep" aria-hidden="true">:</span>
      <select value={parts.minute} onChange={(e) => set({ minute: e.target.value })} aria-label="Minute">
        {minutes.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
      <div className="pb-time__ap" role="group" aria-label="AM or PM">
        {['AM', 'PM'].map((p) => (
          <button
            key={p}
            type="button"
            className={`pb-time__btn ${parts.period === p ? 'is-on' : ''}`}
            onClick={() => set({ period: p })}
            aria-pressed={parts.period === p}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
};

const EMPTY_FORM = { title: '', category: 'Medicine', due_date: todayIso(), due_time: DEFAULT_TIME, recurrence: 'none', notes: '' };

const ReminderRow = ({ reminder, onComplete, onEdit, onEditRecord, onDelete, busy }) => {
  const [confirming, setConfirming] = useState(false);
  /* Every row can go, but "delete" means something different for each kind, so
     the prompt says which: your own reminder is deleted, one backed by a record
     on file deletes that record, and a purely generated one (a scheduled dose,
     deworming) is hidden — reversible from the Vaccines page. */
  const prompt = reminder.editable
    ? 'Delete this reminder?'
    : reminder.vaccination_id
      ? 'Delete the record behind it?'
      : 'Hide this reminder?';

  return (
    <li className={`pb-rem is-${statusClass(reminder.status)}`}>
      <span className="pb-rem__icon" aria-hidden="true">{CATEGORY_ICON[reminder.category] || '🔔'}</span>
      <div className="pb-rem__main">
        <span className="pb-rem__title">{reminder.title || reminder.vaccine_name || 'Reminder'}</span>
        <span className="pb-rem__meta">
          {[
            reminder.category,
            reminder.dose_label,
            formatDay(reminder.due_date),
            formatTime12(reminder.due_time),
            reminder.recurrence && reminder.recurrence !== 'none'
              && RECURRENCE.find((r) => r.value === reminder.recurrence)?.label,
          ].filter(Boolean).join(' · ')}
        </span>
        {reminder.notes && <span className="pb-rem__notes">{reminder.notes}</span>}
      </div>
      <span className={`pb-pill is-${statusClass(reminder.status)}`}>{countdownLabel(reminder.due_date)}</span>

      {confirming ? (
        <span className="pb-confirm pb-confirm--inline" role="alertdialog" aria-label="Confirm delete">
          <span>{prompt}</span>
          <span className="pb-confirm__btns">
            <button type="button" className="pb-confirm__no" onClick={() => setConfirming(false)} disabled={busy}>Cancel</button>
            <button type="button" className="pb-confirm__yes" onClick={() => onDelete(reminder)} disabled={busy}>
              {reminder.editable || reminder.vaccination_id ? 'Delete' : 'Hide'}
            </button>
          </span>
        </span>
      ) : (
        <span className="pb-rem__actions">
          {reminder.editable && (
            <>
              <button type="button" className="pb-btn pb-btn--sm" onClick={() => onComplete(reminder)} disabled={busy}>Done</button>
              <button type="button" className="pb-btn pb-btn--sm" onClick={() => onEdit(reminder)} disabled={busy}>Edit</button>
            </>
          )}
          {/* A generated reminder isn't a row, so there's nothing to edit about
              the reminder itself — but the record it came off is editable, and
              a wrong date there is exactly why the reminder looks wrong. */}
          {!reminder.editable && reminder.vaccination_id && (
            <button type="button" className="pb-btn pb-btn--sm" onClick={() => onEditRecord(reminder)} disabled={busy}>
              Edit record
            </button>
          )}
          {!reminder.editable && !reminder.vaccination_id && <span className="pb-rem__auto">Automatic</span>}
          <button type="button" className="pb-btn pb-btn--sm pb-btn--danger" onClick={() => setConfirming(true)} disabled={busy}>
            {reminder.editable || reminder.vaccination_id ? 'Delete' : 'Hide'}
          </button>
        </span>
      )}
    </li>
  );
};

/* Defined at module level, not inside Reminders: a component created during
   render is a brand-new type every time, so React would throw its subtree away
   and rebuild it on each keystroke. */
const Section = ({ title, sub, items, tone, busy, onComplete, onEdit, onEditRecord, onDelete }) => (
  <section className="pb-card">
    <div className="pb-card__head">
      <div>
        <h3 className="pb-card__title">{title}</h3>
        <p className="pb-card__sub">{sub}</p>
      </div>
      {items.length > 0 && <span className={`pb-pill is-${tone}`}>{items.length}</span>}
    </div>
    {items.length === 0 ? (
      <div className="pb-empty" style={{ padding: '16px 8px' }}>Nothing here.</div>
    ) : (
      <ul className="pb-rems">
        {items.map((reminder) => (
          <ReminderRow
            key={reminder.id}
            reminder={reminder}
            busy={busy}
            onComplete={onComplete}
            onEdit={onEdit}
            onEditRecord={onEditRecord}
            onDelete={onDelete}
          />
        ))}
      </ul>
    )}
  </section>
);

const Reminders = () => {
  const { dog, dogId } = useOutletContext();
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);   // reminder being edited, or 'new'
  const [editingRecord, setEditingRecord] = useState(null);  // the shot/dose behind a generated one
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');

  const load = useCallback(async (spinner = false) => {
    if (spinner) setLoading(true);
    try {
      setReminders(await listReminders(dogId));
      setError('');
    } catch {
      setError('Couldn’t load reminders for this dog. Please try again.');
    } finally {
      if (spinner) setLoading(false);
    }
  }, [dogId]);

  /* The first fetch owns the page spinner. Later calls to load() — after an
     upload, a delete, a retry — refresh in place instead of blanking the page. */
  useEffect(() => {
    (async () => { await load(true); })();
  }, [load]);

  /* Recomputed on render so a tab left open rolls "Due today" into "Overdue"
     without a refetch — the same four rules the server used. */
  const groups = useMemo(() => {
    const live = (reminders || [])
      .filter((r) => isActiveReminder(r.due_date))
      .map((r) => ({ ...r, status: dueStatus(r.due_date) || r.status }));
    return {
      today: live.filter((r) => r.status === DUE_TODAY),
      overdue: live.filter((r) => r.status === OVERDUE)
        .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date))),
      upcoming: live.filter((r) => r.status === UPCOMING)
        .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date))),
      total: live.length,
    };
  }, [reminders]);

  const removeReminder = (reminder) => act(() => {
    if (reminder.editable) return deleteReminder(reminder.id);
    if (reminder.vaccination_id) return deleteVaccination(reminder.vaccination_id);
    return dismissScheduleEntry(dogId, reminder.id);   // generated — hide it
  });

  const openNew = () => { setForm(EMPTY_FORM); setFormError(''); setEditing('new'); };
  const openEdit = (reminder) => {
    setForm({
      title: reminder.title || '',
      category: reminder.category || 'Other',
      due_date: reminder.due_date || todayIso(),
      due_time: reminder.due_time || DEFAULT_TIME,
      recurrence: reminder.recurrence || 'none',
      notes: reminder.notes || '',
    });
    setFormError('');
    setEditing(reminder);
  };

  const save = async () => {
    if (!form.title.trim()) { setFormError('Give the reminder a title.'); return; }
    if (!form.due_date) { setFormError('Pick a due date.'); return; }
    if (!form.due_time) { setFormError('Pick a time of day.'); return; }
    setBusy(true);
    const payload = {
      title: form.title.trim(),
      category: form.category,
      due_date: form.due_date,
      due_time: form.due_time,
      recurrence: form.recurrence,
      notes: form.notes || null,
    };
    try {
      if (editing === 'new') await createReminder(dogId, payload);
      else await updateReminder(editing.id, payload);
      setEditing(null);
      await load();
    } catch (e) {
      setFormError(e?.response?.data?.detail || 'Couldn’t save that reminder. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const act = async (fn) => {
    setBusy(true);
    try { await fn(); await load(); }
    catch { setError('That didn’t work. Please try again.'); }
    finally { setBusy(false); }
  };

  const section = (title, sub, items, tone) => (
    <Section title={title} sub={sub} items={items} tone={tone} busy={busy}
      onComplete={(r) => act(() => completeReminder(r.id))}
      onEdit={openEdit}
      onEditRecord={setEditingRecord}
      onDelete={removeReminder}
    />
  );

  if (loading) {
    return <div className="pb-loading"><span className="pb-spin" aria-hidden="true" /> Loading reminders…</div>;
  }

  return (
    <>
      <section className="pb-card">
        <div className="pb-card__head">
          <div>
            <h3 className="pb-card__title">{groups.total} active reminder{groups.total === 1 ? '' : 's'}</h3>
            <p className="pb-card__sub">
              Vaccinations and deworming are generated from {dog.name}’s age and records. Add your own
              for anything else.
            </p>
          </div>
          <button type="button" className="pb-btn pb-btn--primary" onClick={openNew}>+ New reminder</button>
        </div>
        {error && <p className="pb-error" role="alert">{error}</p>}
      </section>

      {section('Due today', 'Needs doing now.', groups.today, 'due-today')}
      {section('Overdue', 'Missed and still owed.', groups.overdue, 'overdue')}
      {section('Upcoming', 'Next 30 days.', groups.upcoming, 'upcoming')}

      {editingRecord && (
        <VaccinationEditModal
          vaccination={{
            id: editingRecord.vaccination_id,
            vaccine_name: editingRecord.vaccine_name,
            due_date: editingRecord.due_date,
            category: editingRecord.kind === 'deworming' ? 'deworming' : undefined,
          }}
          onClose={() => setEditingRecord(null)}
          onSaved={() => { setEditingRecord(null); load(); }}
        />
      )}

      {/* ---- create / edit ---- */}
      {editing && (
        <div className="pb-overlay" role="dialog" aria-modal="true" aria-label="Reminder" onClick={() => !busy && setEditing(null)}>
          <div className="pb-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pb-modal__bar">
              <span>{editing === 'new' ? 'New reminder' : 'Edit reminder'}</span>
              <button type="button" onClick={() => setEditing(null)} aria-label="Close">×</button>
            </div>
            <div className="pb-modal__body">
              <div className="pb-form-grid">
                <label className="pb-field pb-field--full">
                  <span>Title</span>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                    placeholder="e.g. Evening tablet"
                  />
                </label>

                <label className="pb-field">
                  <span>Category</span>
                  <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>

                <label className="pb-field">
                  <span>Repeats</span>
                  <select value={form.recurrence} onChange={(e) => setForm((p) => ({ ...p, recurrence: e.target.value }))}>
                    {RECURRENCE.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </label>

                <label className="pb-field">
                  <span>Due date</span>
                  <input type="date" value={form.due_date} onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))} />
                </label>

                <label className="pb-field">
                  <span>Time <span className="pb-field__req">*</span></span>
                  <TimePicker
                    value={form.due_time}
                    onChange={(due_time) => setForm((p) => ({ ...p, due_time }))}
                  />
                </label>

                <label className="pb-field pb-field--full">
                  <span>Notes (optional)</span>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                    placeholder="Anything you want to remember."
                  />
                </label>
              </div>
              {formError && <p className="pb-error" role="alert">{formError}</p>}
            </div>
            <div className="pb-modal__actions">
              <button type="button" className="pb-btn" onClick={() => setEditing(null)} disabled={busy}>Cancel</button>
              <button type="button" className="pb-btn pb-btn--primary" onClick={save} disabled={busy}>
                {busy ? 'Saving…' : editing === 'new' ? 'Create reminder' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}


      <style>{`
        .pb-rems { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 9px; }
        .pb-rem {
          display: flex; align-items: center; gap: 11px;
          background: var(--white); border: 1px solid var(--border); border-radius: 13px;
          padding: 11px 13px; border-left: 4px solid #D8CCBE;
        }
        .pb-rem.is-due-today { border-left-color: #9A6B1F; background: #FFFDF8; }
        .pb-rem.is-overdue { border-left-color: #C62828; background: #FFF9F9; }
        .pb-rem.is-upcoming { border-left-color: var(--orange); }
        .pb-rem__icon { font-size: 19px; flex-shrink: 0; }
        .pb-rem__main { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .pb-rem__title {
          color: var(--brown); font-size: 14px; font-weight: var(--weight-semibold);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .pb-rem__meta { color: var(--text-soft); font-size: 11.5px; }
        .pb-rem__notes { color: var(--text-soft); font-size: 11.5px; font-style: italic; }
        .pb-rem__actions { display: flex; gap: 6px; flex-shrink: 0; align-items: center; }

        .pb-time { display: flex; align-items: center; gap: 6px; }
        .pb-time select {
          flex: 0 1 auto; width: auto; min-width: 64px;
          padding: 11px 8px 11px 12px;
        }
        .pb-time__sep { color: var(--text-soft); font-weight: var(--weight-bold); }
        .pb-time__ap {
          display: flex; margin-left: 4px; border-radius: 10px;
          border: 2px solid var(--border-strong); overflow: hidden; background: #fff;
        }
        .pb-time__btn {
          padding: 10px 12px; border: none; background: none; cursor: pointer;
          font-family: inherit; font-size: 12.5px; font-weight: var(--weight-bold);
          color: var(--text-soft);
          transition: background-color var(--pb-fast) var(--pb-ease), color var(--pb-fast) var(--pb-ease);
        }
        .pb-time__btn:hover { color: var(--brown); }
        .pb-time__btn.is-on { background: var(--brown); color: #fff; }
        .pb-confirm--inline {
          margin: 0; padding: 7px 10px; border-radius: 10px; flex-shrink: 0;
          background: #FFF5F5; border: 1px solid #F2C9C9;
          display: flex; align-items: center; gap: 9px; flex-wrap: wrap;
          animation: pb-fade-in var(--pb-fast) var(--pb-ease) both;
        }
        .pb-confirm--inline > span:first-child { color: #B23B3B; font-size: 11.5px; font-weight: var(--weight-bold); }
        .pb-rem__auto { font-size: 11px; color: var(--text-soft); font-weight: var(--weight-semibold); white-space: nowrap; }
        @media (max-width: 720px) {
          .pb-rem { flex-wrap: wrap; }
          .pb-rem__main { flex: 1 1 60%; }
          .pb-rem__actions { flex: 1 1 100%; justify-content: flex-end; }
        }
      `}</style>
    </>
  );
};

export default Reminders;
