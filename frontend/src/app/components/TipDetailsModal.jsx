import { useEffect, useState } from 'react';
import Portal from './Portal';
import { fetchCareTipsForDog, CATEGORY_ICON } from '../../utils/careTips';
import { ageFromDob } from '../../utils/healthStatus';

/* The dog's COMPLETE approved matching set — Climate and Lifestyle tips,
   grouped, not the dashboard card's rotated 1-3 tip subset. Opened from the
   card's own title, so it always reflects the same dog the card is showing.

   Grooming and Age-category tips never appear here — a deliberate exclusion,
   not a gap. Age-category tips already inform which OTHER tips match (via
   ownership_duration_dependency), so surfacing them again as their own
   section would just repeat that reasoning back as content. */

const LIFESTYLE_CATEGORIES = ['Energy', 'Behavior', 'Health Risk'];

const needsPrecaution = (tip) =>
  !['Any', '', null, undefined].includes(tip.ownership_duration_dependency);

/* precaution is a Lifestyle-section concept per spec — passed in by the
   caller rather than inferred from tip.category, so a Climate tip can never
   pick one up even if its own duration dependency happens to be set. */
const TipRow = ({ tip, precaution }) => (
  <li className="tdm__row">
    <span className="tdm__icon" aria-hidden="true">{CATEGORY_ICON[tip.category] || '🐾'}</span>
    <span className="tdm__body">
      <span className="tdm__text">{tip.tip}</span>
      {precaution && needsPrecaution(tip) && <span className="pb-pill is-precaution">⚠ Precaution</span>}
    </span>
  </li>
);

const TipDetailsModal = ({ dog, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [tips, setTips] = useState([]);

  /* Refetches whenever the dog changes rather than just on mount — the
     overlay blocks the dog switcher underneath, but if the selection ever
     changes out from under this (e.g. programmatic nav), the full set
     should follow it the same way the dashboard card's own tips do. */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { tips: full } = await fetchCareTipsForDog(dog?.id, { full: true });
      if (cancelled) return;
      setTips(full);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [dog?.id]);

  if (!dog) return null;

  const climateTips = tips.filter((t) => t.category === 'Climate');
  const lifestyleTips = tips.filter((t) => LIFESTYLE_CATEGORIES.includes(t.category));
  const nothingFound = !loading && climateTips.length === 0 && lifestyleTips.length === 0;
  const meta = [dog.breed, dog.city, ageFromDob(dog.dob)].filter(Boolean);

  return (
    <Portal>
      <div className="pb-overlay" role="dialog" aria-modal="true" aria-label={`${dog.name}'s care tips`} onClick={onClose}>
        <div className="pb-modal tdm" onClick={(e) => e.stopPropagation()}>
          <div className="pb-modal__bar">
            <span>Tips for {dog.name}</span>
            <button type="button" onClick={onClose} aria-label="Close">×</button>
          </div>

          <div className="pb-modal__body">
            {meta.length > 0 && <p className="tdm__meta">{meta.join(' · ')}</p>}

            {loading ? (
              <div className="pb-loading"><span className="pb-spin" aria-hidden="true" /> Loading tips…</div>
            ) : nothingFound ? (
              <div className="pb-empty">
                <span className="pb-empty__icon" aria-hidden="true">🐾</span>
                <strong>No tips available yet for {dog.name}.</strong>
              </div>
            ) : (
              <>
                {climateTips.length > 0 && (
                  <section className="tdm__section">
                    <h4 className="tdm__section-h">Climate</h4>
                    <ul className="tdm__list">
                      {climateTips.map((tip) => <TipRow key={tip.id} tip={tip} />)}
                    </ul>
                  </section>
                )}
                {lifestyleTips.length > 0 && (
                  <section className="tdm__section">
                    <h4 className="tdm__section-h">Lifestyle</h4>
                    <ul className="tdm__list">
                      {lifestyleTips.map((tip) => <TipRow key={tip.id} tip={tip} precaution />)}
                    </ul>
                  </section>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .tdm__meta {
          margin: 0 0 16px;
          padding-bottom: 14px;
          border-bottom: 1px solid var(--border);
          color: var(--text-soft);
          font-size: 13px;
          font-weight: var(--weight-medium);
        }
        .tdm__section + .tdm__section { margin-top: 20px; }
        .tdm__section-h {
          margin: 0 0 10px;
          font-family: var(--font-display);
          color: var(--brown);
          font-size: 12.5px;
          font-weight: var(--weight-semibold);
          text-transform: uppercase;
          letter-spacing: .04em;
        }
        .tdm__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 9px; }
        .tdm__row {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 11px 12px;
          border-radius: 12px;
          background: var(--cream);
        }
        .tdm__icon { flex: 0 0 auto; font-size: 16px; line-height: 1.55; }
        .tdm__body { flex: 1 1 auto; display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
        .tdm__text { color: var(--brown); font-size: 13.5px; line-height: 1.6; }
        .pb-pill.is-precaution { background: #FBEFD8; color: #9A6B1F; }
      `}</style>
    </Portal>
  );
};

export default TipDetailsModal;
