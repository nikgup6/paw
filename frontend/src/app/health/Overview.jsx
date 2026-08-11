import { useCallback, useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import EmergencyCard from '../components/EmergencyCard';
import { getHealthRecords, getHealthSummary } from '../../utils/healthVault';
import {
  COMPLETED, countdownLabel, dueStatus, entryStatus, formatDay, formatTimestamp,
} from '../../utils/healthStatus';

/* The medical dashboard for one dog.

   A summary, not a fifth list: each block shows the few rows that matter and
   links to the page that owns them. Everything comes from one summary request
   composed server-side, so the numbers here can't drift from the detail pages.
   Statuses are recomputed locally on render, so a tab left open still rolls
   over at midnight. */

const statusClass = (status) => (status || '').toLowerCase().replace(/\s+/g, '-');

/* Booklets write the dewormer's name and its quantity in the same cell
   ("Lemasole 0.7ml"), so the raw dose repeats the heading. Show only the part
   that adds something. */
const doseNote = (entry) => {
  const dose = String(entry.dose || '').trim();
  const name = String(entry.vaccine_name || '').trim();
  if (!dose || !name) return dose;
  return dose.toLowerCase().startsWith(name.toLowerCase())
    ? dose.slice(name.length).trim()
    : dose;
};

const Stat = ({ value, label, tone }) => (
  <div className={`pb-stat ${tone ? `is-${tone}` : ''}`}>
    <div className="pb-stat__value">{value}</div>
    <div className="pb-stat__label">{label}</div>
  </div>
);

/* The three groups, in the order an Indian health booklet prints them. */
const GROUPS = [
  { id: 'vaccine', label: 'Vaccines', icon: '💉' },
  { id: 'rabies', label: 'Anti-Rabies', icon: '🦠' },
  { id: 'deworming', label: 'Deworming', icon: '🪱' },
];

/* One group's full picture, on demand.

   The tile only carries a count; the answer to "which ones?" is a whole list,
   and a whole list on the Overview is the thing this page is trying not to be.
   So it's fetched when the tile is opened, from the same endpoint the Vaccines
   page reads — the popup can never disagree with the page behind it. */
const GroupModal = ({ dogId, dogName, group, onClose }) => {
  const [records, setRecords] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getHealthRecords(dogId);
        if (!cancelled) setRecords(data);
      } catch {
        if (!cancelled) setError('Couldn’t load these records. Please try again.');
      }
    })();
    return () => { cancelled = true; };
  }, [dogId]);

  const all = records
    ? [...records.completed, ...records.due_today, ...records.upcoming, ...records.overdue]
      .map((e) => ({ ...e, status: entryStatus(e) || e.status }))
      .filter((e) => (e.category || 'vaccine') === group.id)
    : [];

  const done = all.filter((e) => e.status === COMPLETED)
    .sort((a, b) => String(b.administration_date || '').localeCompare(String(a.administration_date || '')));
  const owed = all.filter((e) => e.status !== COMPLETED)
    .sort((a, b) => String(a.due_date || '').localeCompare(String(b.due_date || '')));

  return (
    <div className="pb-overlay" role="dialog" aria-modal="true" aria-label={group.label} onClick={onClose}>
      <div className="pb-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pb-modal__bar">
          <span>{dogName} · {group.label}</span>
          <button type="button" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="pb-modal__body">
          {error && <p className="pb-error" role="alert">{error}</p>}
          {!records && !error && (
            <div className="pb-loading"><span className="pb-spin" aria-hidden="true" /> Loading…</div>
          )}

          {records && (
            <>
              <h4 className="pb-grp__head">Completed <span className="pb-pill is-completed">{done.length}</span></h4>
              {done.length === 0 ? (
                <p className="pb-grp__none">Nothing recorded yet.</p>
              ) : (
                <ul className="pb-list">
                  {done.map((entry) => (
                    <li key={entry.key} className="pb-list__row">
                      <span className="pb-list__main">
                        <strong>{entry.vaccine_name}</strong>
                        <span className="pb-list__meta">
                          {[formatDay(entry.administration_date), doseNote(entry)].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      <span className="pb-pill is-completed">Given</span>
                    </li>
                  ))}
                </ul>
              )}

              <h4 className="pb-grp__head" style={{ marginTop: 18 }}>
                Not done <span className="pb-pill is-neutral">{owed.length}</span>
              </h4>
              {/* "All caught up" is a lie if the owner hid the thing that was
                  owed. Say so, and say where to get it back. */}
              {records.dismissed_count > 0 && (
                <p className="pb-grp__hidden">
                  {records.dismissed_count} scheduled dose{records.dismissed_count > 1 ? 's are' : ' is'} hidden.{' '}
                  <Link to={`/app/dogs/${dogId}/health/vaccinations`}>Restore</Link>
                </p>
              )}
              {owed.length === 0 ? (
                <p className="pb-grp__none">All caught up.</p>
              ) : (
                <ul className="pb-list">
                  {owed.map((entry) => (
                    <li key={entry.key} className="pb-list__row">
                      <span className="pb-list__main">
                        <strong>{entry.vaccine_name}</strong>
                        <span className="pb-list__meta">
                          {[entry.dose_label, formatDay(entry.due_date)].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      <span className={`pb-pill is-${statusClass(entry.status)}`}>
                        {countdownLabel(entry.due_date)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
        <div className="pb-modal__actions">
          <Link className="pb-btn" to={`/app/dogs/${dogId}/health/vaccinations`}>Open the full list</Link>
          <button type="button" className="pb-btn pb-btn--primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
};

const Overview = () => {
  const { dog, dogId } = useOutletContext();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openGroup, setOpenGroup] = useState(null);
  const [showEmergency, setShowEmergency] = useState(false);

  const load = useCallback(async (spinner = false) => {
    if (spinner) setLoading(true);
    try {
      setSummary(await getHealthSummary(dogId));
      setError('');
    } catch {
      setError('Couldn’t load this dog’s health summary. Please try again.');
    } finally {
      if (spinner) setLoading(false);
    }
  }, [dogId]);

  /* The first fetch owns the page spinner. Later calls to load() — after an
     upload, a delete, a retry — refresh in place instead of blanking the page. */
  useEffect(() => {
    (async () => { await load(true); })();
  }, [load]);

  if (loading) {
    return <div className="pb-loading"><span className="pb-spin" aria-hidden="true" /> Building the summary…</div>;
  }
  if (error) {
    return (
      <section className="pb-card">
        <p className="pb-error" role="alert">{error}</p>
        <button type="button" className="pb-btn" style={{ marginTop: 12 }} onClick={() => load(true)}>
          Retry
        </button>
      </section>
    );
  }

  const health = summary.health;
  // Older cached summaries (a tab open across a deploy, a service-worker hit)
  // predate this block; an empty one renders the same as "nothing recorded".
  const deworming = summary.deworming || { recent: [], next: null, total: 0, hidden: false };
  const categories = summary.categories || {};
  const base = `/app/dogs/${dogId}/health`;
  const nothingYet = health.documents === 0 && health.vaccinations_completed === 0;

  return (
    <>
      {/* ---- Health summary ---- */}
      <section className="pb-card">
        <div className="pb-card__head">
          <div>
            <h3 className="pb-card__title">Health summary</h3>
            <p className="pb-card__sub">
              {health.has_schedule
                ? `Measured against the standard Indian schedule for ${dog.breed || 'this breed'}.`
                : 'Add a date of birth to generate the expected schedule.'}
            </p>
          </div>
        </div>
        <div className="pb-stats">
          <Stat value={health.vaccinations_completed} label="Vaccinations done" tone="good" />
          <Stat value={health.vaccinations_overdue} label="Overdue" tone={health.vaccinations_overdue ? 'bad' : undefined} />
          <Stat value={health.vaccinations_upcoming + health.vaccinations_due_today} label="Coming up" tone="brand" />
          <Stat value={health.dewormings ?? 0} label="Dewormings" />
          <Stat value={health.active_reminders} label="Active reminders" tone="warn" />
          <Stat value={health.documents} label="Documents" />
          <Stat value={health.prescriptions} label="Prescriptions" />
        </div>

        {(health.needs_review > 0 || health.failed_scans > 0) && (
          <p className="pb-error" style={{ background: '#FFFBF4', borderColor: '#E9D8B8', color: '#9A6B1F' }}>
            {health.needs_review > 0 && <>{health.needs_review} document{health.needs_review > 1 ? 's need' : ' needs'} review. </>}
            {health.failed_scans > 0 && <>{health.failed_scans} scan{health.failed_scans > 1 ? 's' : ''} failed and can be retried. </>}
            <Link to={`${base}/documents`}>Open the Document Vault →</Link>
          </p>
        )}
      </section>

      {nothingYet && (
        <section className="pb-card">
          <div className="pb-empty">
            <span className="pb-empty__icon" aria-hidden="true">💉</span>
            <strong>No records yet</strong>
            Upload {dog.name}’s vaccination certificate and we’ll read it, build the timeline
            against the Indian schedule, and set the reminders automatically.
            <div style={{ marginTop: 16 }}>
              <Link className="pb-btn pb-btn--primary" to={`${base}/documents`}>Upload a record</Link>
            </div>
          </div>
        </section>
      )}

      {/* ---- The three groups, plus the emergency card ----
           Counts here, lists behind a tap: the Overview answers "am I covered?"
           and the popup answers "on what?". */}
      <section className="pb-card" style={{ marginTop: 16 }}>
        <div className="pb-card__head">
          <div>
            <h3 className="pb-card__title">Vaccination record</h3>
            <p className="pb-card__sub">Completed doses. Tap a group to see what’s still owed.</p>
          </div>
          <button type="button" className="pb-btn pb-btn--danger" onClick={() => setShowEmergency(true)}>
            🚨 Emergency card
          </button>
        </div>
        <div className="pb-groups">
          {GROUPS.map((group) => {
            const counts = categories[group.id] || { completed: 0, pending: 0 };
            return (
              <button
                key={group.id}
                type="button"
                className="pb-group"
                onClick={() => setOpenGroup(group)}
              >
                <span className="pb-group__icon" aria-hidden="true">{group.icon}</span>
                <span className="pb-group__n">{counts.completed}</span>
                <span className="pb-group__label">{group.label}</span>
                <span className={`pb-group__sub ${counts.pending ? 'is-owed' : ''}`}>
                  {counts.pending ? `${counts.pending} still owed` : 'All caught up'}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="pb-grid pb-grid--2" style={{ marginTop: 16 }}>
        {/* ---- Overdue ---- */}
        <section className="pb-card">
          <div className="pb-card__head">
            <div>
              <h3 className="pb-card__title">Overdue vaccinations</h3>
              <p className="pb-card__sub">Book first.</p>
            </div>
            {health.vaccinations_overdue > 0 && <span className="pb-pill is-overdue">{health.vaccinations_overdue}</span>}
          </div>
          {summary.overdue_vaccinations.length === 0 ? (
            <div className="pb-empty" style={{ padding: '16px 8px' }}>All caught up.</div>
          ) : (
            <ul className="pb-list">
              {summary.overdue_vaccinations.map((entry) => (
                <li key={entry.key} className="pb-list__row">
                  <span className="pb-list__main">
                    <strong>{entry.vaccine_name}</strong>
                    <span className="pb-list__meta">{entry.dose_label} · {formatDay(entry.due_date)}</span>
                  </span>
                  <span className="pb-pill is-overdue">{countdownLabel(entry.due_date)}</span>
                </li>
              ))}
            </ul>
          )}
          <Link className="pb-btn pb-btn--sm" style={{ marginTop: 12 }} to={`${base}/vaccinations`}>All vaccinations →</Link>
        </section>

        {/* ---- Upcoming ---- */}
        <section className="pb-card">
          <div className="pb-card__head">
            <div>
              <h3 className="pb-card__title">Upcoming vaccinations</h3>
              <p className="pb-card__sub">Soonest first.</p>
            </div>
          </div>
          {summary.upcoming_vaccinations.length === 0 ? (
            <div className="pb-empty" style={{ padding: '16px 8px' }}>Nothing coming up.</div>
          ) : (
            <ul className="pb-list">
              {summary.upcoming_vaccinations.map((entry) => (
                <li key={entry.key} className="pb-list__row">
                  <span className="pb-list__main">
                    <strong>{entry.vaccine_name}</strong>
                    <span className="pb-list__meta">{entry.dose_label} · {formatDay(entry.due_date)}</span>
                  </span>
                  <span className={`pb-pill is-${statusClass(dueStatus(entry.due_date))}`}>
                    {countdownLabel(entry.due_date)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---- Deworming ---- */}
        <section className="pb-card">
          <div className="pb-card__head">
            <div>
              <h3 className="pb-card__title">Deworming</h3>
              <p className="pb-card__sub">
                {deworming.next?.source === 'schedule' && deworming.next.dose_label
                  ? `Due ${deworming.next.dose_label} at this age.`
                  : 'Last doses and what’s next.'}
              </p>
            </div>
            {deworming.total > 0 && <span className="pb-pill is-neutral">{deworming.total}</span>}
          </div>

          {deworming.next ? (
            <div className={`pb-next is-${statusClass(dueStatus(deworming.next.due_date))}`}>
              <span className="pb-next__main">
                <strong>{deworming.next.vaccine_name}</strong>
                <span className="pb-list__meta">
                  Next due {formatDay(deworming.next.due_date)}
                  {/* Projected from age, not counted from a dose on file — the
                      difference decides whether "missed" is a fair word. */}
                  {deworming.next.source === 'schedule' && ' · from age'}
                </span>
              </span>
              <span className={`pb-pill is-${statusClass(dueStatus(deworming.next.due_date))}`}>
                {countdownLabel(deworming.next.due_date)}
              </span>
            </div>
          ) : (
            <div className="pb-empty" style={{ padding: '16px 8px' }}>
              {deworming.hidden
                ? <>You hid the deworming reminder. <Link to={`${base}/vaccinations`}>Restore it</Link>.</>
                : health.has_schedule
                  ? 'Nothing due.'
                  : 'Add a date of birth to work out when the next dose is due.'}
            </div>
          )}

          {deworming.recent.length > 0 && (
            <ul className="pb-list" style={{ marginTop: 12 }}>
              {deworming.recent.map((entry) => (
                <li key={entry.key} className="pb-list__row">
                  <span className="pb-list__main">
                    <strong>{entry.vaccine_name}</strong>
                    <span className="pb-list__meta">
                      {[formatDay(entry.administration_date), doseNote(entry)].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className="pb-pill is-completed">Given</span>
                </li>
              ))}
            </ul>
          )}
          <Link className="pb-btn pb-btn--sm" style={{ marginTop: 12 }} to={`${base}/vaccinations`}>
            All deworming →
          </Link>
        </section>

        {/* ---- Prescriptions ---- */}
        <section className="pb-card">
          <div className="pb-card__head">
            <div>
              <h3 className="pb-card__title">Prescription summary</h3>
              <p className="pb-card__sub">Latest from Medical Logs.</p>
            </div>
            {health.prescriptions > 0 && <span className="pb-pill is-neutral">{health.prescriptions}</span>}
          </div>
          {summary.recent_prescriptions.length === 0 ? (
            <div className="pb-empty" style={{ padding: '16px 8px' }}>None yet.</div>
          ) : (
            <ul className="pb-list">
              {summary.recent_prescriptions.map((rx) => (
                <li key={rx.id} className="pb-list__row">
                  <span className="pb-list__main">
                    <strong>{rx.summary || `${(rx.medicines || []).length} medicines`}</strong>
                    <span className="pb-list__meta">
                      {[rx.doctor, rx.clinic_name, rx.prescribed_date && formatDay(rx.prescribed_date)]
                        .filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link className="pb-btn pb-btn--sm" style={{ marginTop: 12 }} to={`${base}/documents`}>Documents →</Link>
        </section>

        {/* ---- Recent documents ---- */}
        <section className="pb-card">
          <div className="pb-card__head">
            <div>
              <h3 className="pb-card__title">Recent documents</h3>
              <p className="pb-card__sub">Latest uploads.</p>
            </div>
          </div>
          {summary.recent_documents.length === 0 ? (
            <div className="pb-empty" style={{ padding: '16px 8px' }}>None yet.</div>
          ) : (
            <ul className="pb-list">
              {summary.recent_documents.map((doc) => (
                <li key={doc.id} className="pb-list__row">
                  <span className="pb-list__main">
                    <strong>{doc.original_filename}</strong>
                    <span className="pb-list__meta">{formatTimestamp(doc.uploaded_at)}</span>
                  </span>
                  <span className="pb-pill is-neutral">{doc.processing_status}</span>
                </li>
              ))}
            </ul>
          )}
          <Link className="pb-btn pb-btn--sm" style={{ marginTop: 12 }} to={`${base}/documents`}>Document Vault →</Link>
        </section>

        {/* ---- Reminder activity ---- */}
        <section className="pb-card">
          <div className="pb-card__head">
            <div>
              <h3 className="pb-card__title">Recent activity</h3>
              <p className="pb-card__sub">Latest changes.</p>
            </div>
          </div>
          {summary.recent_activity.length === 0 ? (
            <div className="pb-empty" style={{ padding: '16px 8px' }}>Nothing yet.</div>
          ) : (
            <ul className="pb-list">
              {summary.recent_activity.map((item, index) => (
                <li key={`${item.title}-${index}`} className="pb-list__row">
                  <span className="pb-list__main">
                    <strong>{item.title}</strong>
                    <span className="pb-list__meta">{[item.detail, formatTimestamp(item.at)].filter(Boolean).join(' · ')}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link className="pb-btn pb-btn--sm" style={{ marginTop: 12 }} to={`${base}/reminders`}>All reminders →</Link>
        </section>

        {/* ---- Quick actions ---- */}
        <section className="pb-card">
          <div className="pb-card__head">
            <div>
              <h3 className="pb-card__title">Quick actions</h3>
              
            </div>
          </div>
          <div className="pb-quick">
            <Link className="pb-btn pb-btn--block" to={`${base}/documents`}>📄 Upload a record</Link>
            <Link className="pb-btn pb-btn--block" to={`${base}/documents`}>📝 Add a prescription</Link>
            <Link className="pb-btn pb-btn--block" to={`${base}/reminders`}>🔔 New reminder</Link>
            <Link className="pb-btn pb-btn--block" to={`/app/dogs/${dogId}/edit`}>🐶 Edit profile</Link>
          </div>
        </section>
      </div>

      {openGroup && (
        <GroupModal
          dogId={dogId}
          dogName={dog.name}
          group={openGroup}
          onClose={() => setOpenGroup(null)}
        />
      )}

      {showEmergency && (
        <div className="pb-overlay" role="dialog" aria-modal="true" aria-label="Emergency card" onClick={() => setShowEmergency(false)}>
          <div className="pb-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pb-modal__bar">
              <span>{dog.name} · emergency card</span>
              <button type="button" onClick={() => setShowEmergency(false)} aria-label="Close">×</button>
            </div>
            <div className="pb-modal__body">
              <EmergencyCard dogId={dogId} onClose={() => setShowEmergency(false)} />
            </div>
          </div>
        </div>
      )}

      <style>{`
        .pb-groups { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .pb-group {
          display: flex; flex-direction: column; align-items: flex-start; gap: 1px;
          padding: 14px 15px; border-radius: 14px; cursor: pointer; text-align: left;
          background: var(--white); border: 1px solid #EFE6DC; border-left: 4px solid #D8CCBE;
          font-family: inherit;
          transition: transform var(--pb-fast) var(--pb-ease), box-shadow var(--pb-fast) var(--pb-ease),
                      border-color var(--pb-fast) var(--pb-ease);
        }
        .pb-group:hover {
          transform: translateY(-3px); border-color: var(--orange);
          box-shadow: 0 12px 24px -14px rgba(61,41,28,.4);
        }
        .pb-group:active { transform: translateY(0); }
        .pb-group__icon { font-size: 17px; line-height: 1; margin-bottom: 6px; }
        .pb-group__n {
          font-family: 'Fredoka', sans-serif; color: var(--brown);
          font-size: 27px; font-weight: 600; line-height: 1.05;
        }
        .pb-group__label { color: var(--brown); font-size: 13px; font-weight: 700; }
        .pb-group__sub { color: var(--text-soft); font-size: 11.5px; font-weight: 600; }
        .pb-group__sub.is-owed { color: #C62828; }

        .pb-grp__head {
          display: flex; align-items: center; gap: 8px; margin: 0 0 8px;
          font-family: 'Fredoka', sans-serif; color: var(--brown); font-size: 15px; font-weight: 600;
        }
        .pb-grp__none { margin: 0; color: var(--text-soft); font-size: 12.5px; }
        .pb-grp__hidden {
          margin: 0 0 8px; padding: 8px 11px; border-radius: 10px;
          background: var(--white); border: 1px dashed #E3D9CE;
          color: var(--text-soft); font-size: 12px;
        }
        .pb-grp__hidden a { color: var(--orange-strong); font-weight: 700; }

        @media (max-width: 560px) { .pb-groups { grid-template-columns: 1fr; } }

        .pb-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
        .pb-list__row {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          padding: 11px 0; border-bottom: 1px solid #F4EEE7;
        }
        .pb-list__row:last-child { border-bottom: none; padding-bottom: 0; }
        .pb-list__row:first-child { padding-top: 0; }
        .pb-list__main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .pb-list__main strong {
          color: var(--brown); font-size: 13.5px; font-weight: 600;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .pb-list__meta { color: var(--text-soft); font-size: 11.5px; }
        /* The one row on a card that is a decision rather than a record. */
        .pb-next {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          padding: 11px 13px; border-radius: 12px;
          background: #FBF7F2; border: 1px solid #EFE6DC; border-left: 4px solid #D8CCBE;
        }
        .pb-next.is-overdue { background: #FFF5F5; border-color: #F2C9C9; border-left-color: #C62828; }
        .pb-next.is-due-today { background: #FFFDF8; border-left-color: #9A6B1F; }
        .pb-next.is-upcoming { border-left-color: var(--orange); }
        .pb-next__main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .pb-next__main strong { color: var(--brown); font-size: 13.5px; font-weight: 600; }

        .pb-quick { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
        @media (max-width: 480px) { .pb-quick { grid-template-columns: 1fr; } }
      `}</style>
    </>
  );
};

export default Overview;
