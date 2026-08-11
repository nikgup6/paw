import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import VaccinationEditModal from '../../components/VaccinationEditModal';
import {
  deleteVaccination, dismissScheduleEntry, getHealthRecords, restoreScheduleEntries,
} from '../../utils/healthVault';
import {
  COMPLETED, DUE_TODAY, OVERDUE, UPCOMING,
  countdownLabel, entryStatus, formatDay,
} from '../../utils/healthStatus';

/* Vaccinations for one dog, in three sections that never mix.

   The list is the dog's real shots merged with the standard Indian schedule
   generated from its date of birth and breed — so a puppy with nothing uploaded
   still sees what it owes, and a scanned certificate fills in against it rather
   than replacing it.

   Three kinds of record share the page, split the way an Indian health booklet
   splits them: vaccines, anti-rabies, and deworming. The chips filter; the three
   status sections underneath stay exactly as they are, because which category a
   dose belongs to never changes whether it is done, coming or late.

   The server groups against its own date and we regroup against the viewer's,
   using the same four rules, so the page is right on load and stays right while
   it's open. */

const statusClass = (status) => (status || '').toLowerCase().replace(/\s+/g, '-');

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'vaccine', label: 'Vaccines' },
  { id: 'rabies', label: 'Anti-Rabies' },
  { id: 'deworming', label: 'Deworming' },
];

/* What each section is called once a chip narrows it. Left off for "All",
   where "Completed" alone is both shorter and more honest. */
const NOUNS = { vaccine: ' vaccinations', rabies: ' anti-rabies', deworming: ' dewormings' };
const TAGS = { rabies: 'Anti-Rabies', deworming: 'Deworming' };

const Card = ({ entry, onReview, onDelete, deleting }) => {
  const cls = entry.needs_review ? 'needs-review' : statusClass(entry.status);
  const done = entry.status === COMPLETED;
  const [confirming, setConfirming] = useState(false);
  /* A stored shot is deleted outright. A generated one has no row behind it, so
     it is hidden instead — the prompt says which, and hidden ones can be
     restored from the banner at the top of the page. */
  const generated = !entry.vaccination_id;

  return (
    <article className={`pb-vax is-${cls}`}>
      <header className="pb-vax__head">
        <h4 className="pb-vax__name">{entry.vaccine_name || 'Vaccination'}</h4>
        <span className={`pb-pill is-${cls}`}>{entry.needs_review ? 'Needs review' : entry.status}</span>
      </header>

      {entry.dose_label && <span className="pb-vax__dose">{entry.dose_label}</span>}

      <dl className="pb-vax__facts">
        {done ? (
          <>
            <div><dt>Date given</dt><dd>{formatDay(entry.administration_date)}</dd></div>
            {/* A completed dose normally carries no next-due: the booklet records
                what was given, and the next appointment is its own entry. Only
                shown when the document actually stated one. */}
            {entry.due_date && (
              <div><dt>Next due</dt><dd>{formatDay(entry.due_date)}</dd></div>
            )}
            {entry.booster_interval && (
              <div><dt>Booster</dt><dd>{entry.booster_interval}</dd></div>
            )}
          </>
        ) : (
          <>
            <div><dt>Due date</dt><dd>{formatDay(entry.due_date)}</dd></div>
            <div>
              <dt>{entry.status === OVERDUE ? 'Days overdue' : 'Days remaining'}</dt>
              <dd className={`is-${statusClass(entry.status)}`}>{countdownLabel(entry.due_date)}</dd>
            </div>
          </>
        )}
        {/* The quantity written beside the date on a booklet's deworming line. */}
        {entry.dose && <div><dt>Dose</dt><dd>{entry.dose}</dd></div>}
      </dl>

      {entry.needs_review && entry.vaccination_id && (
        <button type="button" className="pb-btn pb-btn--sm pb-btn--block" style={{ marginTop: 10 }} onClick={() => onReview(entry)}>
          Review &amp; confirm →
        </button>
      )}

      {(TAGS[entry.category] || entry.source === 'schedule') && (
        <span className="pb-vax__tags">
          {TAGS[entry.category] && (
            <span className={`pb-vax__tag is-${entry.category}`}>{TAGS[entry.category]}</span>
          )}
          {entry.source === 'schedule' && <span className="pb-vax__tag">Schedule</span>}
        </span>
      )}

      {entry.confidence_notes && (
        <p className="pb-vax__notes">⚠️ {entry.confidence_notes}</p>
      )}

      {(entry.clinic_name || entry.veterinarian || entry.batch_number || entry.product_expiry_date) && (
        <footer className="pb-vax__foot">
          <span>
            {[entry.clinic_name, entry.veterinarian].filter(Boolean).join(' · ')}
            {/* Shown as the vial's shelf life, explicitly not a schedule date. */}
            {entry.product_expiry_date && (
              <span className="pb-vax__exp">Vial exp. {entry.product_expiry_date}</span>
            )}
          </span>
          {entry.batch_number && <span className="pb-vax__batch">Batch {entry.batch_number}</span>}
        </footer>
      )}

      {confirming ? (
        <div className="pb-confirm" role="alertdialog" aria-label="Confirm">
          <span>{generated ? 'Hide this scheduled dose?' : 'Delete this record?'}</span>
          <span className="pb-confirm__btns">
            <button type="button" className="pb-confirm__no" onClick={() => setConfirming(false)} disabled={deleting}>
              Cancel
            </button>
            <button type="button" className="pb-confirm__yes" onClick={() => onDelete(entry)} disabled={deleting}>
              {deleting ? 'Working…' : generated ? 'Hide' : 'Delete'}
            </button>
          </span>
        </div>
      ) : (
        <div className="pb-vax__acts">
          {/* Every stored record can be corrected, not just the ones the
              scanner flagged — OCR gets a date subtly wrong far more often
              than it admits to being unsure. A generated dose has no row
              behind it, so there is nothing to edit. */}
          {!generated && (
            <button
              type="button"
              className="pb-vax__act"
              onClick={() => onReview(entry)}
              aria-label={`Edit ${entry.vaccine_name}`}
            >
              Edit
            </button>
          )}
          <button
            type="button"
            className="pb-vax__act is-del"
            onClick={() => setConfirming(true)}
            aria-label={`${generated ? 'Hide' : 'Delete'} ${entry.vaccine_name}`}
          >
            {generated ? 'Hide' : 'Delete'}
          </button>
        </div>
      )}
    </article>
  );
};

const Section = ({ title, sub, entries, empty, onReview, onDelete, deletingId }) => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <section className="pb-card">
      <div 
        className="pb-card__head" 
        onClick={() => setIsOpen(!isOpen)}
        style={{ cursor: 'pointer', userSelect: 'none' }}
      >
        <div>
          <h3 className="pb-card__title">{title}</h3>
          <p className="pb-card__sub">{sub}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {entries.length > 0 && <span className="pb-pill is-neutral">{entries.length}</span>}
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '24px',
            transition: 'transform 0.2s ease',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            color: 'var(--text-soft)',
            fontSize: '12px'
          }}>
            ▼
          </span>
        </div>
      </div>
      {isOpen && (
        entries.length === 0
          ? <div className="pb-empty" style={{ padding: '18px 10px' }}>{empty}</div>
          : <div className="pb-vax-grid">{entries.map((entry) => (
              <Card key={entry.key} entry={entry} onReview={onReview}
                onDelete={onDelete} deleting={deletingId === entry.key} />
            ))}</div>
      )}
    </section>
  );
};

const Vaccinations = () => {
  const { dogId } = useOutletContext();
  const [records, setRecords] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviewing, setReviewing] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [category, setCategory] = useState('all');

  const load = useCallback(async (spinner = false) => {
    if (spinner) setLoading(true);
    try {
      setRecords(await getHealthRecords(dogId));
      setError('');
    } catch {
      setError('Couldn’t load vaccinations for this dog. Please try again.');
    } finally {
      if (spinner) setLoading(false);
    }
  }, [dogId]);

  /* The first fetch owns the page spinner. Later calls to load() — after an
     upload, a delete, a retry — refresh in place instead of blanking the page. */
  useEffect(() => {
    (async () => { await load(true); })();
  }, [load]);

  const remove = async (entry) => {
    setDeletingId(entry.key);
    try {
      if (entry.vaccination_id) await deleteVaccination(entry.vaccination_id);
      else await dismissScheduleEntry(dogId, entry.key);
      await load();
    } catch {
      setError('That didn’t work. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  const restore = async () => {
    try { await restoreScheduleEntries(dogId); await load(); }
    catch { setError('Couldn’t restore the hidden doses.'); }
  };

  const live = useMemo(() => {
    const all = records
      ? [...records.completed, ...records.due_today, ...records.upcoming, ...records.overdue]
      : [];
    return all.map((entry) => ({
      ...entry,
      status: entryStatus(entry) || entry.status,
      category: entry.category || 'vaccine',
    }));
  }, [records]);

  const counts = useMemo(() => {
    const tally = { all: live.length, vaccine: 0, rabies: 0, deworming: 0 };
    live.forEach((entry) => { tally[entry.category] = (tally[entry.category] || 0) + 1; });
    return tally;
  }, [live]);

  /* Derived rather than corrected in an effect: deleting the last dewormer
     while the Deworming chip is on would otherwise leave the page filtered to
     nothing, looking broken. */
  const active = counts[category] ? category : 'all';

  const sections = useMemo(() => {
    const shown = active === 'all' ? live : live.filter((e) => e.category === active);
    return {
      completed: shown.filter((e) => e.status === COMPLETED)
        .sort((a, b) => String(b.administration_date || '').localeCompare(String(a.administration_date || ''))),
      upcoming: shown.filter((e) => e.status === DUE_TODAY || e.status === UPCOMING)
        .sort((a, b) => String(a.due_date || '').localeCompare(String(b.due_date || ''))),
      overdue: shown.filter((e) => e.status === OVERDUE)
        .sort((a, b) => String(a.due_date || '').localeCompare(String(b.due_date || ''))),
    };
  }, [live, active]);

  if (loading) {
    return <div className="pb-loading"><span className="pb-spin" aria-hidden="true" /> Building the timeline…</div>;
  }
  if (error) {
    return (
      <section className="pb-card">
        <p className="pb-error" role="alert">{error}</p>
        <button type="button" className="pb-btn" style={{ marginTop: 12 }} onClick={() => load(true)}>Retry</button>
      </section>
    );
  }

  const base = `/app/dogs/${dogId}/health`;

  return (
    <>
      {records?.dismissed_count > 0 && (
        <p className="pb-hidden-note">
          {records.dismissed_count} scheduled dose{records.dismissed_count > 1 ? 's' : ''} hidden.
          <button type="button" onClick={restore}>Restore</button>
        </p>
      )}

      <div className="pb-cats" role="tablist" aria-label="Record type">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            role="tab"
            aria-selected={active === cat.id}
            className={`pb-cat${active === cat.id ? ' is-on' : ''}`}
            disabled={cat.id !== 'all' && !counts[cat.id]}
            onClick={() => setCategory(cat.id)}
          >
            {cat.label}<span className="pb-cat__n">{counts[cat.id] || 0}</span>
          </button>
        ))}
      </div>

      <Section
        title={`Completed${NOUNS[active] || ''}`}
        sub="Newest first."
        entries={sections.completed}
        empty={<>Nothing yet — <Link to={`${base}/documents`}>upload a certificate</Link>.</>}
        onReview={setReviewing}
        onDelete={remove}
        deletingId={deletingId}
      />
      <Section
        title={`Upcoming${NOUNS[active] || ''}`}
        sub="Soonest first."
        entries={sections.upcoming}
        empty={records?.has_schedule ? 'Nothing coming up.' : 'Add a date of birth to build the schedule.'}
        onReview={setReviewing}
        onDelete={remove}
        deletingId={deletingId}
      />
      <Section
        title={`Overdue${NOUNS[active] || ''}`}
        sub="Book these first."
        entries={sections.overdue}
        empty="All caught up."
        onReview={setReviewing}
        onDelete={remove}
        deletingId={deletingId}
      />

      {reviewing && (
        <VaccinationEditModal
          vaccination={{ ...reviewing, id: reviewing.vaccination_id || reviewing.key }}
          onClose={() => setReviewing(null)}
          onSaved={() => { setReviewing(null); load(); }}
        />
      )}

      <style>{`
        .pb-vax-grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(238px, 1fr)); }
        .pb-vax {
          background: var(--white); border: 1px solid #EFE6DC; border-radius: 14px;
          padding: 14px 15px; border-left: 4px solid #D8CCBE;
          transition: transform .2s ease, box-shadow .2s ease;
        }
        .pb-vax:hover { transform: translateY(-3px); box-shadow: 0 12px 24px -14px rgba(61,41,28,.4); }
        .pb-vax.is-completed { border-left-color: #1E9E52; }
        .pb-vax.is-upcoming { border-left-color: var(--orange); }
        .pb-vax.is-due-today { border-left-color: #9A6B1F; background: #FFFDF8; }
        .pb-vax.is-overdue { border-left-color: #C62828; }
        .pb-vax.is-needs-review { border-left-color: #9A6B1F; background: #FFFBF4; }

        .pb-vax__head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 6px; }
        .pb-vax__name {
          font-family: 'Fredoka', sans-serif; color: var(--brown);
          font-size: 15px; font-weight: 600; line-height: 1.3; margin: 0;
        }
        .pb-vax__dose {
          display: inline-block; margin-bottom: 10px; font-size: 10.5px; font-weight: 700;
          text-transform: uppercase; letter-spacing: .04em; color: var(--text-soft);
        }
        .pb-vax__facts { display: flex; gap: 16px; flex-wrap: wrap; margin: 0; }
        .pb-vax__facts > div { display: flex; flex-direction: column; gap: 2px; }
        .pb-vax__facts dt {
          font-size: 10px; text-transform: uppercase; letter-spacing: .04em;
          color: var(--text-soft); font-weight: 700;
        }
        .pb-vax__facts dd { margin: 0; font-size: 13px; color: var(--brown); font-weight: 600; }
        .pb-vax__facts dd.is-overdue { color: #C62828; }
        .pb-vax__facts dd.is-due-today { color: #9A6B1F; }
        .pb-vax__facts dd.is-upcoming { color: var(--orange-strong); }
        .pb-hidden-note {
          display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
          margin: 0 0 16px; padding: 10px 14px; border-radius: 12px;
          background: var(--white); border: 1px dashed #E3D9CE;
          color: var(--text-soft); font-size: 12.5px;
        }
        .pb-hidden-note button {
          border: none; background: none; cursor: pointer; padding: 0;
          color: var(--orange-strong); font-family: inherit; font-size: 12.5px; font-weight: 700;
          text-decoration: underline;
        }

        /* Always visible, not hover-revealed: a control the owner has to hunt
           for isn't leverage. Subdued until hovered so it never competes with
           the record itself. */
        .pb-vax__acts { display: flex; gap: 7px; margin-top: 11px; }
        .pb-vax__act {
          flex: 1; padding: 7px; border-radius: 9px; cursor: pointer;
          border: 1px solid #EFE6DC; background: none; color: var(--text-soft);
          font-family: inherit; font-size: 12px; font-weight: 700;
          transition: color var(--pb-fast) var(--pb-ease), border-color var(--pb-fast) var(--pb-ease), background-color var(--pb-fast) var(--pb-ease);
        }
        .pb-vax__act:hover { border-color: var(--orange); color: var(--orange-strong); background: var(--orange-pale); }
        .pb-vax__act.is-del:hover { border-color: #E08A8A; color: #C62828; background: #FFF5F5; }

        .pb-confirm {
          margin-top: 11px; padding: 9px 11px; border-radius: 10px;
          background: #FFF5F5; border: 1px solid #F2C9C9;
          display: flex; align-items: center; justify-content: space-between; gap: 9px; flex-wrap: wrap;
          animation: pb-fade-in var(--pb-fast) var(--pb-ease) both;
        }
        .pb-confirm > span:first-child { color: #B23B3B; font-size: 12px; font-weight: 700; }
        .pb-confirm__btns { display: flex; gap: 6px; }
        .pb-confirm__no, .pb-confirm__yes {
          padding: 5px 11px; border-radius: 8px; cursor: pointer;
          font-family: inherit; font-size: 11.5px; font-weight: 700; border: 1px solid transparent;
          transition: background-color var(--pb-fast) var(--pb-ease);
        }
        .pb-confirm__no { background: none; border-color: #E3D9CE; color: var(--text-soft); }
        .pb-confirm__no:hover { background: #fff; }
        .pb-confirm__yes { background: #C62828; color: #fff; }
        .pb-confirm__yes:hover { background: #A81E1E; }
        .pb-confirm__no:disabled, .pb-confirm__yes:disabled { opacity: .6; cursor: not-allowed; }

        .pb-vax__exp { display: block; margin-top: 2px; color: var(--text-soft); font-size: 11px; }
        .pb-vax__notes {
          margin: 8px 0 0; padding: 7px 10px; border-radius: 9px;
          background: #FFFBF4; border: 1px solid #E9D8B8;
          color: #9A6B1F; font-size: 11.5px; line-height: 1.45;
        }

        .pb-cats { display: flex; gap: 8px; flex-wrap: wrap; margin: 0 0 16px; }
        .pb-cat {
          display: inline-flex; align-items: center; gap: 7px; cursor: pointer;
          padding: 8px 14px; border-radius: 50px; background: var(--white);
          border: 1px solid #EFE6DC; color: var(--text-soft);
          font-family: inherit; font-size: 12.5px; font-weight: 700;
          transition: color var(--pb-fast) var(--pb-ease), border-color var(--pb-fast) var(--pb-ease),
                      background-color var(--pb-fast) var(--pb-ease);
        }
        .pb-cat:hover:not(:disabled) { border-color: var(--orange); color: var(--brown); }
        .pb-cat.is-on { background: var(--brown); border-color: var(--brown); color: #fff; }
        /* A category the dog has no records in is shown, not hidden — "0
           dewormings" is the answer to a question the owner might be asking. */
        .pb-cat:disabled { opacity: .45; cursor: default; }
        .pb-cat__n {
          min-width: 18px; padding: 1px 5px; border-radius: 20px; text-align: center;
          background: var(--grey); color: var(--text-soft); font-size: 11px; font-weight: 800;
        }
        .pb-cat.is-on .pb-cat__n { background: rgba(255,255,255,.22); color: #fff; }

        .pb-vax__tags { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
        .pb-vax__tag {
          display: inline-block; padding: 2px 8px; border-radius: 20px;
          background: var(--grey); color: var(--text-soft);
          font-size: 10px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase;
        }
        .pb-vax__tag.is-rabies { background: #FBE9E7; color: #B23B3B; }
        .pb-vax__tag.is-deworming { background: #E8F3EC; color: #1E7A46; }
        .pb-vax__foot {
          margin-top: 11px; padding-top: 10px; border-top: 1px solid #F0EAE3;
          font-size: 11.5px; color: var(--text-soft);
          display: flex; justify-content: space-between; align-items: center; gap: 8px;
        }
        .pb-vax__batch { color: var(--brown); font-weight: 600; white-space: nowrap; }
        @media (max-width: 620px) { .pb-vax-grid { grid-template-columns: 1fr; } }
      `}</style>
    </>
  );
};

export default Vaccinations;
