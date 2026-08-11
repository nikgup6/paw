import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useDogs } from '../context/DogsContext';
import EmergencyCard from './components/EmergencyCard';
import { getHealthSummary } from '../utils/healthVault';
import {
  DUE_TODAY, ageFromDob, countdownLabel, dueStatus, formatDay, formatTimestamp,
} from '../utils/healthStatus';

/* The dashboard the owner lands on.

   With more than one dog, showing every dog's care mixed together is exactly
   how you end up giving the wrong tablet to the wrong dog. So the page works on
   ONE dog at a time: a switcher at the top picks it, and every section below —
   profile, emergency card, care, reminders, activity — belongs to that dog and
   says whose it is. The choice is shared with the sidebar and remembered across
   reloads, so the menu never points somewhere else.

   It reports on Health Records rather than opening them; the owner goes in when
   they choose. */

const statusClass = (status) => (status || '').toLowerCase().replace(/\s+/g, '-');

const DogSwitch = ({ dogs, selectedId, onSelect, onAdd }) => (
  <div className="pb-switch" role="tablist" aria-label="Choose a dog">
    {dogs.map((dog) => (
      <button
        key={dog.id}
        type="button"
        role="tab"
        aria-selected={dog.id === selectedId}
        className={`pb-switch__dog ${dog.id === selectedId ? 'is-on' : ''}`}
        onClick={() => onSelect(dog.id)}
      >
        <span className="pb-switch__avatar" aria-hidden="true">
          {dog.photo_url ? <img src={dog.photo_url} alt="" loading="lazy" /> : '🐶'}
        </span>
        <span className="pb-switch__meta">
          <strong>{dog.name}</strong>
          <em>{dog.breed || 'Dog'}</em>
        </span>
      </button>
    ))}
    <button type="button" className="pb-switch__add" onClick={onAdd}>
      <span aria-hidden="true">＋</span>
      <span>Add a dog</span>
    </button>
  </div>
);

const Dashboard = () => {
  const { dogs, loading, error, hasDogs, selectedDog, selectedDogId, selectDog } = useDogs();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [showEmergency, setShowEmergency] = useState(false);

  /* Only the selected dog's summary is fetched, and it's re-fetched when the
     selection changes — so what's on screen always belongs to the dog named at
     the top. */
  const loadSummary = useCallback(async (dogId) => {
    if (!dogId) { setSummary(null); return; }
    setLoadingSummary(true);
    try {
      setSummary(await getHealthSummary(dogId));
    } catch {
      setSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  useEffect(() => {
    (async () => { await loadSummary(selectedDogId); })();
  }, [selectedDogId, loadSummary]);

  const reminders = useMemo(
    () => (summary?.recent_reminders || []).map((r) => ({ ...r, status: dueStatus(r.due_date) || r.status })),
    [summary],
  );
  const today = useMemo(() => reminders.filter((r) => r.status === DUE_TODAY), [reminders]);
  const upcoming = useMemo(
    () => reminders.filter((r) => r.status !== DUE_TODAY)
      .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date))).slice(0, 5),
    [reminders],
  );
  const activity = useMemo(() => (summary?.recent_activity || []).slice(0, 5), [summary]);

  if (loading) {
    return <div className="pb-page"><div className="pb-loading"><span className="pb-spin" aria-hidden="true" /> Loading…</div></div>;
  }

  /* Step 2 of the flow: no dog yet means the profile comes first. */
  if (!hasDogs) return <Navigate to="/app/dogs/new" replace />;

  const dog = selectedDog;
  const health = summary?.health;

  return (
    <div className="pb-page pb-fade">
      <DogSwitch
        dogs={dogs}
        selectedId={selectedDogId}
        onSelect={selectDog}
        onAdd={() => navigate('/app/dogs/new')}
      />

      {error && <p className="pb-error" role="alert">{error}</p>}

      <div className="pb-page__head" style={{ marginTop: 18 }}>
        <div>
          <h2 className="pb-page__title">{dog.name}</h2>
          <p className="pb-page__sub">
            {[dog.breed, ageFromDob(dog.dob), dog.weight_kg && `${dog.weight_kg} kg`, dog.city]
              .filter(Boolean).join(' · ')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link className="pb-btn pb-btn--primary" to={`/app/dogs/${dog.id}/health`}>Health Records</Link>
          <button type="button" className="pb-btn pb-btn--danger" onClick={() => setShowEmergency(true)}>
            🚨 Emergency
          </button>
        </div>
      </div>

      {/* ---- Health at a glance, for the selected dog ---- */}
      <section className="pb-card">
        <div className="pb-card__head">
          <div>
            <h3 className="pb-card__title">Health</h3>
            <p className="pb-card__sub">{dog.name}’s records.</p>
          </div>
        </div>
        {loadingSummary && !summary ? (
          <div className="pb-loading"><span className="pb-spin pb-spin--sm" aria-hidden="true" /> Checking…</div>
        ) : !health ? (
          <div className="pb-empty" style={{ padding: '16px 8px' }}>Couldn’t load this dog’s health summary.</div>
        ) : (
          <div className="pb-stats">
            <div className="pb-stat is-good">
              <div className="pb-stat__value">{health.vaccinations_completed}</div>
              <div className="pb-stat__label">Vaccinations done</div>
            </div>
            <div className={`pb-stat ${health.vaccinations_overdue ? 'is-bad' : ''}`}>
              <div className="pb-stat__value">{health.vaccinations_overdue}</div>
              <div className="pb-stat__label">Overdue</div>
            </div>
            <div className="pb-stat is-brand">
              <div className="pb-stat__value">{health.vaccinations_upcoming + health.vaccinations_due_today}</div>
              <div className="pb-stat__label">Coming up</div>
            </div>
            <div className="pb-stat is-warn">
              <div className="pb-stat__value">{health.active_reminders}</div>
              <div className="pb-stat__label">Reminders</div>
            </div>
            <div className="pb-stat">
              <div className="pb-stat__value">{health.documents}</div>
              <div className="pb-stat__label">Documents</div>
            </div>
            <div className="pb-stat">
              <div className="pb-stat__value">{health.prescriptions}</div>
              <div className="pb-stat__label">Prescriptions</div>
            </div>
          </div>
        )}
      </section>

      <div className="pb-grid pb-grid--2" style={{ marginTop: 16 }}>
        {/* ---- Profile ---- */}
        <section className="pb-card">
          <div className="pb-card__head">
            <div>
              <h3 className="pb-card__title">Profile</h3>
              <p className="pb-card__sub">{dog.name}’s details.</p>
            </div>
            <Link className="pb-btn pb-btn--sm" to={`/app/dogs/${dog.id}/edit`}>Edit</Link>
          </div>
          <div className="pb-prof">
            <div className="pb-prof__head">
              <span className="pb-prof__avatar" aria-hidden="true">
                {dog.photo_url ? <img src={dog.photo_url} alt="" /> : '🐶'}
              </span>
              <strong>{dog.name}</strong>
            </div>
            <dl className="pb-prof__facts">
              <div><dt>Breed</dt><dd>{dog.breed || '—'}</dd></div>
              <div><dt>Born</dt><dd>{dog.dob ? formatDay(dog.dob) : '—'}</dd></div>
              <div><dt>Age</dt><dd>{ageFromDob(dog.dob) || '—'}</dd></div>
              <div><dt>Sex</dt><dd>{dog.gender || '—'}</dd></div>
              <div><dt>Weight</dt><dd>{dog.weight_kg ? `${dog.weight_kg} kg` : '—'}</dd></div>
              <div><dt>City</dt><dd>{dog.city || '—'}</dd></div>
            </dl>
            {dog.health_complications && <p className="pb-prof__note">⚠️ {dog.health_complications}</p>}
          </div>
        </section>

        {/* ---- Emergency ---- */}
        <section className="pb-card pb-emg">
          <div className="pb-card__head">
            <div>
              <h3 className="pb-card__title">🚨 Emergency</h3>
              <p className="pb-card__sub">Critical info for the vet ER.</p>
            </div>
          </div>
          <p className="pb-emg__copy">
            {dog.name}’s identity, allergies, current medication and completed vaccinations
            on one screen.
          </p>
          <button type="button" className="pb-emg__open" onClick={() => setShowEmergency(true)}>
            Show {dog.name}’s health card
          </button>
        </section>

        {/* ---- Today ---- */}
        <section className="pb-card">
          <div className="pb-card__head">
            <div>
              <h3 className="pb-card__title">Today’s care</h3>
              <p className="pb-card__sub">Due today for {dog.name}.</p>
            </div>
            {today.length > 0 && <span className="pb-pill is-due-today">{today.length}</span>}
          </div>
          {today.length === 0 ? (
            <div className="pb-empty" style={{ padding: '16px 8px' }}>Nothing due today.</div>
          ) : (
            <ul className="pb-list">
              {today.map((item) => (
                <li key={item.id} className="pb-list__row">
                  <span className="pb-list__main">
                    <strong>{item.title || item.vaccine_name}</strong>
                    <span className="pb-list__meta">{item.category}</span>
                  </span>
                  <Link className="pb-btn pb-btn--sm" to={`/app/dogs/${dog.id}/health/reminders`}>Open</Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---- Upcoming ---- */}
        <section className="pb-card">
          <div className="pb-card__head">
            <div>
              <h3 className="pb-card__title">Upcoming reminders</h3>
              <p className="pb-card__sub">Soonest first.</p>
            </div>
          </div>
          {upcoming.length === 0 ? (
            <div className="pb-empty" style={{ padding: '16px 8px' }}>Nothing on the horizon.</div>
          ) : (
            <ul className="pb-list">
              {upcoming.map((item) => (
                <li key={item.id} className="pb-list__row">
                  <span className="pb-list__main">
                    <strong>{item.title || item.vaccine_name}</strong>
                    <span className="pb-list__meta">{formatDay(item.due_date)}</span>
                  </span>
                  <span className={`pb-pill is-${statusClass(item.status)}`}>{countdownLabel(item.due_date)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---- Activity ---- */}
        <section className="pb-card">
          <div className="pb-card__head">
            <div>
              <h3 className="pb-card__title">Recent activity</h3>
              <p className="pb-card__sub">Latest changes.</p>
            </div>
          </div>
          {activity.length === 0 ? (
            <div className="pb-empty" style={{ padding: '16px 8px' }}>Nothing yet.</div>
          ) : (
            <ul className="pb-list">
              {activity.map((item, index) => (
                <li key={`${item.title}-${index}`} className="pb-list__row">
                  <span className="pb-list__main">
                    <strong>{item.title}</strong>
                    <span className="pb-list__meta">
                      {[item.detail, formatTimestamp(item.at)].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---- Quick actions ---- */}
        <section className="pb-card">
          <div className="pb-card__head">
            <div>
              <h3 className="pb-card__title">Quick actions</h3>
              <p className="pb-card__sub">For {dog.name}.</p>
            </div>
          </div>
          <div className="pb-quick">
            <Link className="pb-btn pb-btn--block" to={`/app/dogs/${dog.id}/health/documents`}>📄 Upload</Link>
            <Link className="pb-btn pb-btn--block" to={`/app/dogs/${dog.id}/health/reminders`}>🔔 Reminder</Link>
            <Link className="pb-btn pb-btn--block" to={`/app/dogs/${dog.id}/health/vaccinations`}>💉 Vaccines</Link>
            <Link className="pb-btn pb-btn--block" to={`/app/dogs/${dog.id}/profile`}>🐶 Profile</Link>
          </div>
        </section>
      </div>

      {showEmergency && (
        <div className="pb-overlay" role="dialog" aria-modal="true" aria-label="Emergency card" onClick={() => setShowEmergency(false)}>
          <div className="pb-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pb-modal__bar">
              <span>{dog.name} · emergency card</span>
              <button type="button" onClick={() => setShowEmergency(false)} aria-label="Close">×</button>
            </div>
            <div className="pb-modal__body">
              <EmergencyCard dogId={dog.id} onClose={() => setShowEmergency(false)} />
            </div>
          </div>
        </div>
      )}

      <style>{`
        /* ---- dog switcher ---- */
        .pb-switch {
          display: flex; gap: 9px; flex-wrap: wrap; align-items: stretch;
          padding: 8px; border-radius: 16px; background: var(--white); border: 1px solid #EFE6DC;
        }
        .pb-switch__dog {
          display: flex; align-items: center; gap: 10px; min-width: 0;
          padding: 8px 14px 8px 8px; border-radius: 12px; cursor: pointer;
          border: 2px solid transparent; background: none; font-family: inherit; text-align: left;
          transition: all .18s ease;
        }
        .pb-switch__dog:hover { background: var(--cream); }
        .pb-switch__dog.is-on { border-color: var(--orange); background: var(--orange-pale); }
        .pb-switch__avatar {
          flex: 0 0 38px; width: 38px; height: 38px; border-radius: 12px; overflow: hidden;
          background: var(--orange-pale); border: 1px solid #EFE6DC;
          display: flex; align-items: center; justify-content: center; font-size: 19px;
        }
        .pb-switch__dog.is-on .pb-switch__avatar { border-color: rgba(227,93,24,.35); background: var(--white); }
        .pb-switch__avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .pb-switch__meta { display: flex; flex-direction: column; min-width: 0; }
        .pb-switch__meta strong {
          color: var(--brown); font-size: 14px; font-weight: 700; line-height: 1.25;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .pb-switch__dog.is-on .pb-switch__meta strong { color: var(--orange-strong); }
        .pb-switch__meta em {
          color: var(--text-soft); font-size: 11.5px; font-style: normal;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .pb-switch__add {
          display: flex; align-items: center; gap: 7px; padding: 8px 15px; border-radius: 12px;
          border: 1px dashed #E3D9CE; background: none; cursor: pointer;
          color: var(--text-soft); font-family: inherit; font-size: 13px; font-weight: 700;
          transition: all .18s ease;
        }
        .pb-switch__add:hover { border-color: var(--orange); color: var(--orange-strong); background: #FFFAF6; }
        .pb-switch__add span:first-child { font-size: 15px; }

        /* ---- emergency ---- */
        .pb-emg { border-color: #F2C9C9; background: #FFFAFA; }
        .pb-emg__copy { margin: 0 0 14px; color: var(--text-soft); font-size: 13px; line-height: 1.55; }
        .pb-emg__open {
          width: 100%; padding: 12px; border-radius: 12px; border: none; cursor: pointer;
          background: #E12D2D; color: #fff; font-family: inherit; font-size: 14px; font-weight: 700;
          transition: background .2s ease;
        }
        .pb-emg__open:hover { background: #C62828; }

        /* ---- profile ---- */
        .pb-prof__head { display: flex; align-items: center; gap: 9px; margin-bottom: 12px; }
        .pb-prof__head strong { color: var(--brown); font-size: 14.5px; }
        .pb-prof__avatar {
          flex: 0 0 30px; width: 30px; height: 30px; border-radius: 9px; overflow: hidden;
          background: var(--orange-pale); display: flex; align-items: center; justify-content: center; font-size: 15px;
        }
        .pb-prof__avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .pb-prof__facts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 0; }
        .pb-prof__facts dt {
          font-size: 10px; text-transform: uppercase; letter-spacing: .04em;
          color: var(--text-soft); font-weight: 700;
        }
        .pb-prof__facts dd { margin: 2px 0 0; font-size: 13px; color: var(--brown); font-weight: 600; }
        .pb-prof__note {
          margin: 12px 0 0; padding: 8px 11px; border-radius: 10px;
          background: #FFFBF4; border: 1px solid #E9D8B8; color: #9A6B1F; font-size: 12px;
        }

        .pb-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
        .pb-list__row {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          padding: 10px 0; border-bottom: 1px solid #F4EEE7;
        }
        .pb-list__row:last-child { border-bottom: none; padding-bottom: 0; }
        .pb-list__row:first-child { padding-top: 0; }
        .pb-list__main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .pb-list__main strong {
          color: var(--brown); font-size: 13.5px; font-weight: 600;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .pb-list__meta { color: var(--text-soft); font-size: 11.5px; }

        .pb-quick { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
        @media (max-width: 480px) {
          .pb-quick { grid-template-columns: 1fr; }
          .pb-prof__facts { grid-template-columns: repeat(2, 1fr); }
          .pb-switch__dog, .pb-switch__add { flex: 1 1 100%; }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
