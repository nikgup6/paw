import { useCallback, useEffect, useState } from 'react';
import { getEmergencyCard, getHealthRecords } from '../../utils/healthVault';
import { COMPLETED, countdownLabel, entryStatus, formatDay } from '../../utils/healthStatus';

/* The card an owner hands a vet ER.

   Every line is a fact already on file — identity, weight, what the dog reacts
   to, what it's currently on, and its cover. A scheduled dose never counts as
   given: telling an ER a dog is covered when it isn't would be worse than
   telling them nothing.

   Cover is three counts, not one long list. A vet triaging in the doorway asks
   "is it done?" three separate times — vaccines, rabies, worming — and a
   twenty-line scroll answers none of them quickly. Tapping a count opens what
   is done and what isn't, which is the follow-up question and not the first
   one.

   The emergency contacts are the clinics and vets read off this dog's own
   certificates and prescriptions, so the card never shows a number the owner
   has no relationship with. */

const GROUPS = [
  { id: 'vaccine', label: 'Vaccines', icon: '💉' },
  { id: 'rabies', label: 'Anti-Rabies', icon: '🦠' },
  { id: 'deworming', label: 'Deworming', icon: '🪱' },
];

const statusClass = (status) => (status || '').toLowerCase().replace(/\s+/g, '-');

const Row = ({ label, value, tone }) => (
  <div className="pb-ec__row">
    <span className={`pb-ec__label ${tone ? `is-${tone}` : ''}`}>{label}</span>
    <span className={`pb-ec__value ${tone ? `is-${tone}` : ''}`}>{value}</span>
  </div>
);

const EmergencyCard = ({ dogId, onClose }) => {
  const [card, setCard] = useState(null);
  const [records, setRecords] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [group, setGroup] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // The card is the summary; the records are what's behind each count. Both
      // are fetched up front so tapping a group is instant — this screen gets
      // opened in a waiting room, not at leisure.
      const [cardData, recordData] = await Promise.all([
        getEmergencyCard(dogId), getHealthRecords(dogId),
      ]);
      setCard(cardData);
      setRecords(recordData);
      setError('');
    } catch {
      setError('Couldn’t load the emergency card.');
    } finally {
      setLoading(false);
    }
  }, [dogId]);

  useEffect(() => { (async () => { await load(); })(); }, [load]);

  if (loading) {
    return <div className="pb-loading"><span className="pb-spin" aria-hidden="true" /> Loading…</div>;
  }
  if (error || !card) {
    return (
      <div className="pb-ec__body">
        <p className="pb-error" role="alert">{error || 'No card available.'}</p>
        <button type="button" className="pb-btn" onClick={load}>Retry</button>
      </div>
    );
  }

  const { dog, allergies, medications, vet_contacts: vets } = card;
  const weight = dog.weight_kg ? `${dog.weight_kg} KG` : '—';

  const entries = records
    ? [...records.completed, ...records.due_today, ...records.upcoming, ...records.overdue]
      .map((e) => ({ ...e, status: entryStatus(e) || e.status, category: e.category || 'vaccine' }))
    : [];
  const inGroup = (id) => entries.filter((e) => e.category === id);
  const done = (id) => inGroup(id).filter((e) => e.status === COMPLETED)
    .sort((a, b) => String(b.administration_date || '').localeCompare(String(a.administration_date || '')));
  const owed = (id) => inGroup(id).filter((e) => e.status !== COMPLETED)
    .sort((a, b) => String(a.due_date || '').localeCompare(String(b.due_date || '')));

  return (
    <div className="pb-ec">
      <div className="pb-ec__head">
        <span className="pb-ec__siren" aria-hidden="true">🚨</span>
        <h3 className="pb-ec__title">Emergency Dog Critical Info</h3>
        <p className="pb-ec__sub">Show this at the vet ER for instant, lifesaving parameters.</p>
      </div>

      <div className="pb-ec__rows">
        <Row label="Pet name" value={<strong className="pb-ec__name">{dog.name}</strong>} />
        <Row label="Breed" value={dog.breed || '—'} />
        <Row label="Age & weight" value={`${dog.age_label} · ${weight}`} />
        <Row label="Sex" value={dog.gender || '—'} />
        <Row
          label="Known allergies"
          value={allergies || 'None logged'}
          tone={allergies ? 'alert' : undefined}
        />
        <Row
          label="Daily medications"
          value={medications.length
            ? medications.map((m) => [m.name, m.dosage, m.frequency].filter(Boolean).join(' · ')).join(' | ')
            : 'None logged'}
          tone={medications.length ? 'alert' : undefined}
        />
      </div>

      <div className="pb-ec__block">
        {group ? (
          <>
            <button type="button" className="pb-ec__crumb" onClick={() => setGroup(null)}>
              ← Cover
            </button>
            <h4 className="pb-ec__block-title">
              {group.icon} {group.label} · given <span>{done(group.id).length}</span>
            </h4>
            {done(group.id).length === 0 ? (
              <p className="pb-ec__none">Nothing on file.</p>
            ) : (
              <ul className="pb-ec__shots">
                {done(group.id).map((entry) => (
                  <li key={entry.key}>
                    <span>{entry.vaccine_name}</span>
                    <em>{formatDay(entry.administration_date)}</em>
                  </li>
                ))}
              </ul>
            )}

            <h4 className="pb-ec__block-title is-owed" style={{ marginTop: 14 }}>
              Not done <span>{owed(group.id).length}</span>
            </h4>
            {owed(group.id).length === 0 ? (
              <p className="pb-ec__none">Nothing outstanding.</p>
            ) : (
              <ul className="pb-ec__shots is-owed">
                {owed(group.id).map((entry) => (
                  <li key={entry.key}>
                    <span>{entry.vaccine_name}</span>
                    <em className={`is-${statusClass(entry.status)}`}>
                      {entry.status === COMPLETED ? formatDay(entry.due_date) : countdownLabel(entry.due_date)}
                    </em>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <>
            <h4 className="pb-ec__block-title">Cover — tap for detail</h4>
            <div className="pb-ec__groups">
              {GROUPS.map((g) => {
                const outstanding = owed(g.id).length;
                return (
                  <button
                    key={g.id}
                    type="button"
                    className={`pb-ec__group ${outstanding ? 'is-owed' : ''}`}
                    onClick={() => setGroup(g)}
                  >
                    <span className="pb-ec__group-icon" aria-hidden="true">{g.icon}</span>
                    <span className="pb-ec__group-n">{done(g.id).length}</span>
                    <span className="pb-ec__group-label">{g.label}</span>
                    <span className="pb-ec__group-sub">
                      {outstanding ? `${outstanding} not done` : 'Up to date'}
                    </span>
                  </button>
                );
              })}
            </div>
            {card.counts.overdue > 0 && (
              <p className="pb-ec__warn">⚠️ {card.counts.overdue} vaccination{card.counts.overdue > 1 ? 's' : ''} overdue — not given.</p>
            )}
          </>
        )}
      </div>

      <div className="pb-ec__contact">
        <strong>📞 This dog’s vets</strong>
        {vets.length === 0 ? (
          <span>No clinic on file yet — it’s filled in automatically from uploaded records.</span>
        ) : (
          <span>{vets.map((v) => [v.clinic_name, v.veterinarian].filter(Boolean).join(' — ')).join(' · ')}</span>
        )}
      </div>

      {onClose && (
        <button type="button" className="pb-ec__back" onClick={onClose}>Go back to vault</button>
      )}

      <style>{`
        .pb-ec { font-family: var(--font-body-family); }
        .pb-ec__head { text-align: center; padding: 4px 0 16px; }
        .pb-ec__siren { font-size: 30px; display: block; margin-bottom: 6px; }
        .pb-ec__title {
          font-family: var(--font-display); color: #C62828; margin: 0 0 5px;
          font-size: 22px; font-weight: var(--weight-bold); letter-spacing: .01em; text-transform: uppercase;
          line-height: 1.15;
        }
        .pb-ec__sub { color: var(--text-soft); font-size: 12.5px; margin: 0; }

        .pb-ec__rows { display: flex; flex-direction: column; }
        .pb-ec__row {
          display: flex; justify-content: space-between; align-items: baseline; gap: 14px;
          padding: 11px 0; border-bottom: 1px solid #F0EAE3;
        }
        .pb-ec__label { color: var(--text-soft); font-size: 12.5px; font-weight: var(--weight-semibold); flex-shrink: 0; }
        .pb-ec__label.is-alert { color: #C62828; }
        .pb-ec__value { color: var(--brown); font-size: 13.5px; font-weight: var(--weight-bold); text-align: right; }
        .pb-ec__value.is-alert { color: #C62828; }
        .pb-ec__name { font-family: var(--font-display); font-size: 17px; text-transform: uppercase; }

        .pb-ec__block { margin-top: 16px; }
        .pb-ec__block-title {
          font-size: 11px; text-transform: uppercase; letter-spacing: .05em; font-weight: var(--weight-bold);
          color: var(--text-soft); margin: 0 0 8px; display: flex; align-items: center; gap: 7px;
        }
        .pb-ec__block-title span {
          background: #E7F6EC; color: #1B8046; border-radius: 20px; padding: 2px 8px; font-size: 10.5px;
        }
        .pb-ec__shots { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
        .pb-ec__shots li {
          display: flex; justify-content: space-between; gap: 12px; align-items: baseline;
          background: #F6FBF7; border: 1px solid #DCEFE2; border-radius: 9px; padding: 7px 11px;
        }
        .pb-ec__shots span { color: var(--brown); font-size: 12.5px; font-weight: var(--weight-semibold); min-width: 0; }
        .pb-ec__shots em { color: #1B8046; font-size: 11.5px; font-style: normal; font-weight: var(--weight-bold); white-space: nowrap; }
        .pb-ec__none { color: var(--text-soft); font-size: 12.5px; margin: 0; }

        /* Outstanding doses are listed in the ER's colour, not the reassuring
           one — this is the half of the answer that changes what they do. */
        .pb-ec__block-title.is-owed span { background: #FDECEC; color: #C62828; }
        .pb-ec__shots.is-owed li { background: #FFF7F7; border-color: #F2C9C9; }
        .pb-ec__shots em.is-overdue { color: #C62828; }
        .pb-ec__shots em.is-due-today { color: #9A6B1F; }
        .pb-ec__shots em.is-upcoming { color: var(--orange-strong); }

        .pb-ec__groups { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .pb-ec__group {
          display: flex; flex-direction: column; align-items: flex-start; gap: 1px;
          padding: 12px 12px 11px; border-radius: 12px; cursor: pointer; text-align: left;
          background: #F6FBF7; border: 1px solid #DCEFE2; font-family: inherit;
          transition: transform var(--pb-fast, .16s) ease, box-shadow var(--pb-fast, .16s) ease;
        }
        .pb-ec__group:hover { transform: translateY(-2px); box-shadow: 0 10px 20px -14px rgba(61,41,28,.5); }
        .pb-ec__group.is-owed { background: #FFF7F7; border-color: #F2C9C9; }
        .pb-ec__group-icon { font-size: 15px; line-height: 1; margin-bottom: 4px; }
        .pb-ec__group-n {
          /* A count (shots given in this group), not a heading. */
          font-family: var(--font-accent); color: var(--brown);
          font-size: 24px; font-weight: var(--weight-semibold); line-height: 1.05;
        }
        .pb-ec__group-label { color: var(--brown); font-size: 12px; font-weight: var(--weight-bold); }
        .pb-ec__group-sub { color: #1B8046; font-size: 11px; font-weight: var(--weight-bold); }
        .pb-ec__group.is-owed .pb-ec__group-sub { color: #C62828; }

        .pb-ec__crumb {
          border: none; background: none; padding: 0; margin-bottom: 9px; cursor: pointer;
          color: var(--orange-strong); font-family: inherit; font-size: 12.5px; font-weight: var(--weight-bold);
        }
        .pb-ec__warn { margin: 9px 0 0; font-size: 12px; color: #C62828; font-weight: var(--weight-semibold); }

        .pb-ec__contact {
          margin-top: 16px; padding: 12px 14px; border-radius: 12px;
          background: #FFF5F5; border: 1px solid #F2C9C9;
          display: flex; flex-direction: column; gap: 3px;
        }
        .pb-ec__contact strong { color: #C62828; font-size: 12.5px; }
        .pb-ec__contact span { color: var(--text-soft); font-size: 12.5px; line-height: 1.5; }

        .pb-ec__back {
          width: 100%; margin-top: 16px; padding: 13px; border-radius: 50px; border: none;
          background: #E12D2D; color: #fff; font-family: inherit; font-size: 15px; font-weight: var(--weight-bold);
          cursor: pointer; transition: background .2s ease;
        }
        .pb-ec__back:hover { background: #C62828; }

        @media (max-width: 480px) {
          .pb-ec__row { flex-direction: column; gap: 3px; }
          .pb-ec__value { text-align: left; }
          .pb-ec__groups { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
};

export default EmergencyCard;
