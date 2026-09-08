import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useDogs } from '../context/DogsContext';
import EmergencyCard from './components/EmergencyCard';
import Portal from './components/Portal';
import QuickFeedback from '../components/QuickFeedback';
import RoutineEditor from './components/RoutineEditor';
import TipDetailsModal from './components/TipDetailsModal';
import { getHealthSummary } from '../utils/healthVault';
import {
  DUE_TODAY, ageFromDob, countdownLabel, dueStatus, formatDay, formatTimestamp,
} from '../utils/healthStatus';
import { CATEGORY_ICON, fetchCareTipsForDog } from '../utils/careTips';
import { fetchDailyCare, resetLabel, toggleDailyCare } from '../utils/dailyCare';
import { thumb } from '../utils/images';

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

/* The 3 tappable vaccination tiles, in display order. `tone` reuses the same
   is-good/is-bad/is-brand modifiers Overview.jsx's own stat tiles already use,
   so a completed count is green everywhere in the app, not just here. */
const VAX_TILES = [
  { key: 'completed', label: 'Completed', tone: 'is-good' },
  { key: 'due', label: 'Due', tone: 'is-bad' },
  { key: 'upcoming', label: 'Upcoming', tone: 'is-brand' },
];

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
          {dog.photo_url ? <img src={thumb(dog.photo_url, 46)} alt="" loading="lazy" /> : '🐶'}
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
  const [showTipDetails, setShowTipDetails] = useState(false);
  const [tips, setTips] = useState([]);
  const [conditions, setConditions] = useState(null);
  const [care, setCare] = useState(null);        // today's routine wellness
  const [careBusy, setCareBusy] = useState('');  // item code mid-request
  const [editingRoutine, setEditingRoutine] = useState(false);
  const [openTip, setOpenTip] = useState(null);   // which tip is expanded
  const [openStat, setOpenStat] = useState(null); // 'completed' | 'due' | 'upcoming' | null

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

  /* While any overlay is open the page behind it must not scroll. Without
     this the emergency card opens over a page that is still scrollable, and
     a stray touch scrolls the dashboard instead of the card — which is what
     made the card feel like it needed hunting for. */
  useEffect(() => {
    const open = showEmergency || editingRoutine || showTipDetails;
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [showEmergency, editingRoutine, showTipDetails]);

  /* Whichever tip or stat tile was expanded belongs to the PREVIOUS dog —
     carrying it across a switch risks showing dog B's data under a chip that
     is actually keyed to one of dog A's records (a tip id, a status string
     that means nothing for the new dog). Collapse both the instant the
     selection changes, before either dog's data has even been refetched. */
  useEffect(() => {
    setOpenTip(null);
    setOpenStat(null);
  }, [selectedDogId]);

  /* Tips belong to the selected dog, so they're refetched on every switch —
     and cleared first, so the previous dog's tips can never sit under the
     next dog's name while the request is in flight. */
  useEffect(() => {
    let cancelled = false;
    setTips([]);
    setConditions(null);
    if (!selectedDogId) return undefined;
    (async () => {
      const { tips: matched, conditions: local } = await fetchCareTipsForDog(selectedDogId);
      if (cancelled) return;
      setTips(matched);
      setConditions(local);
    })();
    return () => { cancelled = true; };
  }, [selectedDogId]);

  /* Today's routine care, same per-dog reload rule as the tips above. */
  useEffect(() => {
    let cancelled = false;
    setCare(null);
    if (!selectedDogId) return undefined;
    (async () => {
      const state = await fetchDailyCare(selectedDogId);
      if (!cancelled) setCare(state);
    })();
    return () => { cancelled = true; };
  }, [selectedDogId]);

  /* Optimistic: the tick flips immediately and is reconciled with whatever the
     server returns. A failed request restores the previous state rather than
     leaving a tick that was never stored. */
  const onToggleCare = async (item, next) => {
    if (!selectedDogId || careBusy) return;
    const previous = care;
    setCareBusy(item.code);
    setCare((state) => (state ? {
      ...state,
      items: state.items.map((i) => (i.code === item.code ? { ...i, done: next } : i)),
      done_count: state.done_count + (next ? 1 : -1),
    } : state));
    try {
      const fresh = await toggleDailyCare(selectedDogId, item.code, next);
      setCare(fresh);
    } catch {
      setCare(previous);
    } finally {
      setCareBusy('');
    }
  };

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

      {/* ---- Hero ----
           Only fields the profile actually stores. No registration number
           (there is no such field) and no verified tick — these are the
           owner's own details, not something anyone has checked. */}
      <section className="pb-hero">
        <div className="pb-hero__photo">
          {dog.photo_url
            ? <img src={thumb(dog.photo_url, 92)} alt="" />   /* hero frame is 92px */
            : <span aria-hidden="true">🐶</span>}
        </div>

        <h2 className="pb-hero__name">
          {dog.name}
          {dog.gender && <span className="pb-hero__tag">{dog.gender}</span>}
        </h2>
        {dog.breed && <p className="pb-hero__breed">{dog.breed}</p>}

        <dl className="pb-hero__stats">
          {ageFromDob(dog.dob) && (
            <div><dt>Age</dt><dd>{ageFromDob(dog.dob)}</dd></div>
          )}
          {dog.weight_kg != null && dog.weight_kg !== '' && (
            <div><dt>Weight</dt><dd>{dog.weight_kg} kg</dd></div>
          )}
          {dog.city && (
            <div><dt>City</dt><dd>{dog.city}</dd></div>
          )}
        </dl>

        <div className="pb-hero__acts">
          <Link className="pb-hero__btn pb-hero__btn--primary" to={`/app/dogs/${dog.id}/health`}>
            <span aria-hidden="true">💚</span> Health Records
          </Link>
          <button
            type="button"
            className="pb-hero__btn pb-hero__btn--danger"
            onClick={() => setShowEmergency(true)}
          >
            <span aria-hidden="true">🚨</span> Emergency
          </button>
        </div>
      </section>

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
          <>
            <div className="pb-stats">
              {/* Completed / Due / Upcoming — tap to see which shots. "Due"
                  merges overdue with due-today into one urgent bucket, which
                  is also why it's the only one that blinks: a shot overdue by
                  a week and one due today are both "needs action now," and a
                  vaccination stat is exactly where urgency SHOULD read as
                  urgency rather than a neutral number. It only blinks while
                  the count is actually > 0 — a caught-up dog gets a calm 0. */}
              {VAX_TILES.map(({ key, label, tone }) => {
                const count = key === 'due'
                  ? health.vaccinations_overdue + health.vaccinations_due_today
                  : key === 'completed' ? health.vaccinations_completed : health.vaccinations_upcoming;
                const open = openStat === key;
                return (
                  <button
                    key={key}
                    type="button"
                    className={`pb-stat pb-stat--tap ${tone} ${open ? 'is-open' : ''} ${key === 'due' && count > 0 ? 'is-urgent' : ''}`}
                    aria-expanded={open}
                    onClick={() => setOpenStat(open ? null : key)}
                  >
                    <div className="pb-stat__value">{count}</div>
                    <div className="pb-stat__label">{label}</div>
                  </button>
                );
              })}

              {/* Unchanged: plain counts, not clickable. */}
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

            {/* The expanded list. Sized to actually hold the names rather than
                a cramped popover — it takes the Health card's full width,
                pushing everything below it down, so a dog with a long list
                doesn't get a tiny scrollable box. */}
            {openStat && (
              <div className="pb-stat-detail">
                {(summary?.vaccination_tiles?.[openStat] || []).length === 0 ? (
                  <div className="pb-empty" style={{ padding: '10px 4px' }}>
                    {openStat === 'completed' ? 'Nothing recorded yet.'
                      : openStat === 'due' ? 'Nothing due — all caught up.'
                      : 'Nothing coming up yet.'}
                  </div>
                ) : (
                  <ul className="pb-list">
                    {summary.vaccination_tiles[openStat].map((entry) => (
                      <li key={entry.key} className="pb-list__row">
                        <span className="pb-list__main">
                          <strong>{entry.vaccine_name}</strong>
                          {entry.dose_label && <span className="pb-list__meta">{entry.dose_label}</span>}
                        </span>
                        <span className={`pb-pill is-${openStat === 'due' ? statusClass(entry.status) : openStat}`}>
                          {openStat === 'completed' ? formatDay(entry.administration_date)
                            : openStat === 'due' ? countdownLabel(entry.due_date)
                            : formatDay(entry.due_date)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <Link
                  className="pb-btn pb-btn--sm"
                  style={{ marginTop: 12 }}
                  to={`/app/dogs/${dog.id}/health/vaccinations`}
                >
                  Open full list →
                </Link>
              </div>
            )}
          </>
        )}
      </section>

      <div className="pb-grid pb-grid--2" style={{ marginTop: 16 }}>
        {/* ---- Quick actions ----
             Was "Profile" (breed/born/age/sex/weight/city). Removed — the hero
             tile already shows name/breed/age/city, and the full profile is
             one tap away (this card's own "Profile" button, the tab bar, the
             sidebar), so the details table was mostly a second copy of the
             hero. Quick actions moved up into that slot instead, since it's
             what an owner actually DOES from the dashboard. */}
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

        {/* The Emergency CARD used to sit here. Removed — the hero tile at the
            top already carries an Emergency button, and in an actual emergency
            two entry points to the same screen is one more thing to read. The
            modal itself is untouched and still opens from the hero. */}

        {/* ---- Routine wellness ----
             Habit nudges, deliberately separate from the medical cards below:
             ticking "fed" is not a health record and must never look like one.
             State lives server-side per dog per day, so it survives a refresh
             and a different device, and resets on its own at midnight. */}
        {care && (
          <section className="pb-card">
            <div className="pb-card__head">
              <div>
                <h3 className="pb-card__title">Today’s routine care</h3>
                <p className="pb-card__sub">{resetLabel(care.seconds_until_reset)}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={`pb-pill ${care.done_count === care.total ? 'is-ok' : 'is-neutral'}`}>
                  {care.done_count}/{care.total}
                </span>
                <button type="button" className="pb-btn pb-btn--sm" onClick={() => setEditingRoutine(true)}>
                  Edit
                </button>
              </div>
            </div>
            <div className="pb-routine">
              {care.items.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  className={`pb-routine__item ${item.done ? 'is-done' : ''}`}
                  onClick={() => onToggleCare(item, !item.done)}
                  disabled={careBusy === item.code}
                  aria-pressed={item.done}
                >
                  <span className="pb-routine__icon" aria-hidden="true">{item.icon}</span>
                  <span className="pb-routine__label">{item.label}</span>
                  <span className="pb-routine__state" aria-hidden="true">{item.done ? '✓' : ''}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ---- Care tips ----
             Placed right after Today's routine care (Vibhuvan's ordering):
             the tips are the day's care context, so they sit with the routine.
             Hidden entirely when nothing approved matches this dog, rather
             than showing an empty shell. An owner reading "no tips" learns
             nothing; a missing card asks no questions. */}
        {tips.length > 0 && (
          <section className="pb-card pb-tips-card">
            <div className="pb-card__head">
              <div>
                <h3
                  className="pb-card__title pb-card__title--tap"
                  role="button"
                  tabIndex={0}
                  onClick={() => setShowTipDetails(true)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowTipDetails(true); } }}
                >
                  Tips for {dog.name}
                </h3>
                <p className="pb-card__sub">From {dog.breed || 'your dog'}’s care guide.</p>
              </div>
            </div>
            <ul className="pb-tips">
              {tips.map((tip, index) => {
                const key = tip.id || String(index);
                const open = openTip === key;
                /* What actually made this tip apply to THIS dog. Every value
                   here is stored on the tip — nothing is inferred, and the
                   dimensions that say "Any" are dropped because "applies to
                   any city" is not a reason. */
                const why = [
                  tip.trait_trigger,
                  tip.category && `${tip.category} guidance`,
                  !['Any', '', null, undefined].includes(tip.ownership_duration_dependency)
                    && `Age: ${tip.ownership_duration_dependency}`,
                  !['Any', '', null, undefined].includes(tip.city_climate_dependency)
                    && `Climate: ${tip.city_climate_dependency}`,
                  !['Any', '', null, undefined].includes(tip.season_dependency)
                    && `Season: ${tip.season_dependency}`,
                ].filter(Boolean);

                return (
                  <li key={key} className={`pb-tips__row ${open ? 'is-open' : ''}`}>
                    <button
                      type="button"
                      className="pb-tips__btn"
                      aria-expanded={open}
                      onClick={() => setOpenTip(open ? null : key)}
                    >
                      <span className="pb-tips__icon" aria-hidden="true">{CATEGORY_ICON[tip.category] || '🐾'}</span>
                      <span className="pb-tips__text">{tip.tip}</span>
                      <span className="pb-tips__chev" aria-hidden="true">{open ? '▲' : '▼'}</span>
                    </button>

                    {open && (
                      <div className="pb-tips__detail">
                        <p className="pb-tips__why-h">Why this applies to {dog.name}</p>
                        <ul className="pb-tips__why">
                          {why.map((w) => <li key={w}>{w}</li>)}
                        </ul>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            {/* Feedback is asked about the tip they OPENED, not the card as a
                whole — the card rotates every 6 hours, so it has to point at
                what they actually read. Only once a tip is opened, and only
                when it has an id: a fallback tip has none, and unattributable
                feedback isn't worth the interruption. */}
            {openTip && tips.find((t) => (t.id || '') === openTip)?.id && (
              <QuickFeedback
                context="care_tip"
                contextId={openTip}
                question="Was this tip useful?"
              />
            )}
          </section>
        )}

        {/* ---- Seasonal conditions ----
             Its own card rather than a line inside the tips card, because the
             tips card hides when nothing approved matches this breed — and the
             seasonal advice is useful regardless of whether the vet-reviewed
             library happens to cover this dog yet.

             Worded as what the season is TYPICALLY like, never as a live
             reading: it is derived from the city's climate zone and the month
             (services/conditions.py), and nothing is measured. Swapping in a
             weather provider later changes the wording, not this card. */}
        {conditions?.advisory && (
          <section className="pb-card pb-season">
            <div className="pb-card__head">
              <div>
                <h3 className="pb-card__title">
                  <span aria-hidden="true">🌡️</span> {conditions.city} right now
                </h3>
                <p className="pb-card__sub">Typically {conditions.summary} at this time of year.</p>
              </div>
            </div>
            <p className="pb-season__body">{conditions.advisory}</p>
          </section>
        )}

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

      </div>

      {editingRoutine && care && (
        <RoutineEditor
          dogId={dog.id}
          items={care.items}
          onSaved={setCare}
          onClose={() => setEditingRoutine(false)}
        />
      )}

      {showTipDetails && (
        <TipDetailsModal dog={dog} onClose={() => setShowTipDetails(false)} />
      )}

      {showEmergency && (
        <Portal>
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
        </Portal>
      )}

      <style>{`
        /* ---- dog switcher ---- */
        .pb-switch {
          display: flex; gap: 9px; flex-wrap: wrap; align-items: stretch;
          padding: 8px; border-radius: 16px; background: var(--white); border: 1px solid var(--border);
        }
        /* Hidden below the sidebar breakpoint: it's a third way to do what the
           tab bar's "Switch Dog" already does, and it pushed the dog's own
           tile below the fold. Lives here rather than in app.css because this
           block defines .pb-switch and is injected after that stylesheet —
           the rule has to be in the same cascade layer to win.
           "Add a dog" is in the More sheet at this width.

           :not(--stack) is load-bearing. The Switch dog MODAL reuses this same
           base class (.pb-switch.pb-switch--stack), so hiding .pb-switch flatly
           also emptied the modal — the one control the tab bar sends you to on
           mobile. Only the inline dashboard strip is hidden. */
        @media (max-width: 1023.98px) {
          .pb-switch:not(.pb-switch--stack) { display: none; }
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
          background: var(--orange-pale); border: 1px solid var(--border);
          display: flex; align-items: center; justify-content: center; font-size: 19px;
        }
        .pb-switch__dog.is-on .pb-switch__avatar { border-color: rgba(227,93,24,.35); background: var(--white); }
        .pb-switch__avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .pb-switch__meta { display: flex; flex-direction: column; min-width: 0; }
        .pb-switch__meta strong {
          color: var(--brown); font-size: 14px; font-weight: var(--weight-bold); line-height: 1.25;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .pb-switch__dog.is-on .pb-switch__meta strong { color: var(--orange-strong); }
        .pb-switch__meta em {
          color: var(--text-soft); font-size: 11.5px; font-style: normal;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .pb-switch__add {
          display: flex; align-items: center; gap: 7px; padding: 8px 15px; border-radius: 12px;
          border: 1px dashed var(--border-strong); background: none; cursor: pointer;
          color: var(--text-soft); font-family: inherit; font-size: 13px; font-weight: var(--weight-bold);
          transition: all .18s ease;
        }
        .pb-switch__add:hover { border-color: var(--orange); color: var(--orange-strong); background: #FFFAF6; }
        .pb-switch__add span:first-child { font-size: 15px; }

        /* ---- emergency ---- */
        .pb-emg { border-color: #F2C9C9; background: #FFFAFA; }
        .pb-emg__copy { margin: 0 0 14px; color: var(--text-soft); font-size: 13px; line-height: 1.55; }
        .pb-emg__open {
          width: 100%; padding: 12px; border-radius: 12px; border: none; cursor: pointer;
          background: #E12D2D; color: #fff; font-family: inherit; font-size: 14px; font-weight: var(--weight-bold);
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
          color: var(--text-soft); font-weight: var(--weight-bold);
        }
        .pb-prof__facts dd { margin: 2px 0 0; font-size: 13px; color: var(--brown); font-weight: var(--weight-semibold); }
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
          color: var(--brown); font-size: 13.5px; font-weight: var(--weight-semibold);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .pb-list__meta { color: var(--text-soft); font-size: 11.5px; }

        .pb-quick { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }

        /* ---- care tips ---- */
        /* Darker than the surrounding cards and very gently breathing, so it
           pulls the eye without ever flashing. 4s cycle and a ~6% swing —
           slow and shallow enough to read as ambient rather than as an alert,
           which matters on a screen that also carries an emergency button. */
        .pb-card__title--tap { cursor: pointer; }
        .pb-card__title--tap:hover, .pb-card__title--tap:focus-visible {
          text-decoration: underline; text-underline-offset: 3px;
        }
        .pb-card__title--tap:focus-visible { outline: 2px solid var(--orange); outline-offset: 3px; border-radius: 4px; }
        .pb-tips-card {
          background: linear-gradient(155deg, #47311F 0%, #33210F 100%);
          border: 1px solid rgba(255,255,255,.10);
          animation: pb-tip-breathe 4s var(--pb-ease) infinite;
        }
        .pb-tips-card .pb-card__title { color: #fff; }
        .pb-tips-card .pb-card__sub { color: rgba(255,255,255,.6); }
        @keyframes pb-tip-breathe {
          0%, 100% { box-shadow: 0 0 0 0 rgba(227,93,24,0); }
          50%      { box-shadow: 0 0 0 5px rgba(227,93,24,.16); }
        }
        /* Anything vestibular-sensitive gets the styling without the motion. */
        @media (prefers-reduced-motion: reduce) {
          .pb-tips-card { animation: none; box-shadow: 0 0 0 3px rgba(227,93,24,.14); }
        }

        .pb-tips { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 9px; }
        .pb-tips__row {
          position: relative; overflow: hidden;
          border-radius: 12px;
          background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.09);
          transition: border-color var(--pb-fast) var(--pb-ease), background-color var(--pb-fast) var(--pb-ease);
        }
        /* A slow sheen drifting across an unopened tip — the cue that it opens.
           8s cycle with a long dead pause, so it catches the eye once and then
           leaves you alone; it stops entirely once the tip is open, because by
           then it has done its job. */
        .pb-tips__row:not(.is-open)::after {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(100deg, transparent 35%, rgba(255,255,255,.11) 50%, transparent 65%);
          transform: translateX(-120%);
          animation: pb-tip-shine 8s var(--pb-ease) infinite;
          pointer-events: none;
        }
        @keyframes pb-tip-shine {
          0%   { transform: translateX(-120%); }
          22%  { transform: translateX(120%); }
          100% { transform: translateX(120%); }   /* long rest — not a strobe */
        }
        .pb-tips__row.is-open { border-color: rgba(255,255,255,.22); background: rgba(255,255,255,.10); }
        @media (hover: hover) {
          .pb-tips__row:hover { border-color: rgba(255,255,255,.22); }
        }

        .pb-tips__btn {
          display: flex; gap: 10px; align-items: flex-start; width: 100%;
          padding: 11px 12px; text-align: left;
          background: none; border: none; cursor: pointer; font-family: inherit;
          -webkit-tap-highlight-color: transparent;
        }
        .pb-tips__btn:focus-visible { outline: 2px solid var(--orange); outline-offset: -2px; border-radius: 12px; }
        .pb-tips__icon { flex: 0 0 auto; font-size: 16px; line-height: 1.5; }
        /* Collapsed to 3 lines so one long tip can't blow up the card on a
           phone — the chevron already promises "there's more", the clamp is
           what keeps that promise honest. Full text reappears once the row
           is open, right above the "Why this applies" detail. */
        .pb-tips__text {
          flex: 1 1 auto; color: rgba(255,255,255,.88); font-size: 12.5px; line-height: 1.6;
          display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
        }
        .pb-tips__row.is-open .pb-tips__text { -webkit-line-clamp: unset; display: block; overflow: visible; }
        .pb-tips__chev { flex: 0 0 auto; color: rgba(255,255,255,.45); font-size: 9px; line-height: 2.1; }

        .pb-tips__detail {
          padding: 0 12px 12px 38px;
          animation: pb-fade-in var(--pb-fast) var(--pb-ease) both;
        }
        .pb-tips__why-h {
          margin: 0 0 6px; font-size: 10px; font-weight: var(--weight-bold);
          letter-spacing: .06em; text-transform: uppercase; color: rgba(255,255,255,.5);
        }
        .pb-tips__why { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
        .pb-tips__why li {
          padding: 4px 9px; border-radius: 50px;
          background: rgba(255,255,255,.09); border: 1px solid rgba(255,255,255,.12);
          color: rgba(255,255,255,.82); font-size: 11px; font-weight: var(--weight-medium);
        }

        @media (prefers-reduced-motion: reduce) {
          .pb-tips__row:not(.is-open)::after { animation: none; opacity: 0; }
        }

        /* ---- hero tile ---- */
        /* Deep warm brown rather than the reference's near-black, so it reads
           as Paw Buddy turned up rather than as a different product. */
        .pb-hero {
          position: relative;
          margin: 18px 0 4px;
          padding: 26px 20px 20px;
          border-radius: 22px;
          background:
            radial-gradient(120% 90% at 50% -10%, rgba(255,255,255,.10), transparent 60%),
            linear-gradient(160deg, #3D291C 0%, #2A1B12 100%);
          color: #fff;
          text-align: center;
          overflow: hidden;
          box-shadow: 0 18px 40px -24px rgba(35,22,14,.9);
        }
        .pb-hero::after {
          /* Faint paw watermark, purely decorative. */
          content: '🐾';
          position: absolute; right: -6px; bottom: -14px;
          font-size: 92px; opacity: .06; pointer-events: none;
        }
        .pb-hero__photo {
          width: 92px; height: 92px; margin: 0 auto 12px;
          border-radius: 50%; overflow: hidden;
          background: rgba(255,255,255,.10);
          border: 3px solid var(--orange);
          display: flex; align-items: center; justify-content: center;
          font-size: 40px;
          box-shadow: 0 0 0 6px rgba(227,93,24,.14);
        }
        .pb-hero__photo img { width: 100%; height: 100%; object-fit: cover; }
        .pb-hero__name {
          margin: 0; font-family: var(--font-display); color: #fff;
          font-size: clamp(24px, 6vw, 32px); line-height: 1.15;
          display: flex; align-items: center; justify-content: center; gap: 9px; flex-wrap: wrap;
        }
        .pb-hero__tag {
          font-size: 10px; font-weight: var(--weight-bold); letter-spacing: .08em; text-transform: uppercase;
          padding: 4px 9px; border-radius: 50px;
          background: rgba(255,255,255,.14); color: rgba(255,255,255,.9);
        }
        .pb-hero__breed { margin: 4px 0 0; color: rgba(255,255,255,.72); font-size: 13px; }

        .pb-hero__stats {
          display: flex; justify-content: center; flex-wrap: wrap; gap: 10px;
          margin: 16px 0 0; padding: 13px 0 0;
          border-top: 1px solid rgba(255,255,255,.12);
        }
        .pb-hero__stats > div { flex: 1 1 90px; min-width: 78px; }
        .pb-hero__stats dt {
          font-size: 9.5px; letter-spacing: .09em; text-transform: uppercase;
          color: rgba(255,255,255,.5); font-weight: var(--weight-bold);
        }
        .pb-hero__stats dd {
          /* A stat figure (age, weight), same treatment as .pb-stat__value —
             stays on the Fredoka accent token, not the heading face. */
          margin: 3px 0 0; font-family: var(--font-accent);
          font-size: 15px; font-weight: var(--weight-semibold); color: #fff;
        }

        .pb-hero__acts { display: flex; gap: 9px; margin-top: 18px; }
        .pb-hero__btn {
          flex: 1 1 0; display: inline-flex; align-items: center; justify-content: center; gap: 7px;
          min-height: 46px; padding: 12px 16px; border: none; border-radius: 50px;
          font-family: inherit; font-size: 13.5px; font-weight: var(--weight-bold); text-decoration: none;
          cursor: pointer; -webkit-tap-highlight-color: transparent;
          transition: transform var(--pb-fast) var(--pb-ease), filter var(--pb-fast) var(--pb-ease);
        }
        .pb-hero__btn--primary { background: var(--orange); color: #fff; }
        .pb-hero__btn--danger { background: #fff; color: #B3261E; }
        .pb-hero__btn:active { transform: translateY(1px); }
        @media (hover: hover) { .pb-hero__btn:hover { filter: brightness(1.06); } }

        /* ---- seasonal conditions ---- */
        /* Warm tint so it reads as local context, distinct from the medical
           cards around it. */
        .pb-season { background: #FFF6EE; border: 1px solid #F3DEC9; }
        .pb-season__body { margin: 0; color: var(--brown); font-size: 12.5px; line-height: 1.65; }

        /* ---- today's routine care ---- */
        .pb-routine { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
        .pb-routine__item {
          display: flex; align-items: center; gap: 9px;
          /* 48px keeps every tile a comfortable tap target on a phone */
          min-height: 48px; padding: 11px 12px; text-align: left;
          border: 1px solid var(--border); border-radius: 12px; background: var(--white);
          font-family: inherit; color: var(--brown); cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          transition: border-color .18s ease, background-color .18s ease;
        }
        .pb-routine__item.is-done { background: #F2FAF4; border-color: #C9E9D4; }
        .pb-routine__item:disabled { opacity: .6; cursor: wait; }
        .pb-routine__item:focus-visible { outline: 2px solid var(--orange); outline-offset: 2px; }
        @media (hover: hover) { .pb-routine__item:not(.is-done):hover { border-color: #D8CCBE; } }
        .pb-routine__icon { flex: 0 0 auto; font-size: 16px; }
        .pb-routine__label { flex: 1 1 auto; font-size: 12.5px; font-weight: var(--weight-semibold); }
        .pb-routine__state { flex: 0 0 auto; color: #1B8046; font-weight: var(--weight-bold); }

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
