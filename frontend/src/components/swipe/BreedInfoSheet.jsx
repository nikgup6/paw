import React, { useEffect, useMemo, useRef } from 'react';
import { generateMatchReasons, generatePersonalizedReason, generateProsCons, flagLabel, NOT_RECOMMENDED_LABEL } from '../../utils/breedUtils';
import { cities, climateInfo, healthItems, monthlyRange, puppyRange, splitLead } from '../../utils/swipeFacts';
import { MatchBadge } from './SwipeCard';
import { CheckIcon, AlertIcon, HeartIcon, XIcon } from './swipeIcons';

/* Bottom sheet with everything about one breed, in a fixed order.
   Escape and focus return are handled by BreedSwipe (the parent). */

const sizeLong = (b) => {
  const word = { S: 'Small', M: 'Medium', L: 'Large', X: 'Giant' }[(b.size || 'M').trim()[0]] || '';
  const detail = (b.size || '').match(/\(([^)]*)\)/);
  return detail ? `${word} (${detail[1]})` : word;
};

const Fact = ({ label, value, sub }) => (
  <div className="pbsw__fact">
    <dt>{label}</dt>
    <dd>{value}{sub ? <span>{sub}</span> : null}</dd>
  </div>
);

export default function BreedInfoSheet({ breed, answers, hasAnswers, shortlisted, onToggleShortlist, onClose, onBuy, onFullProfile, onCompare, onTakeQuiz }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus({ preventScroll: true }); }, [breed.name]);

  const notRecommended = hasAnswers && breed.label === NOT_RECOMMENDED_LABEL;

  const why = useMemo(() => {
    if (!hasAnswers) return [];
    if (notRecommended) {
      const flags = (breed.flags || []).map(flagLabel);
      const reasons = [...(breed.warnings || []), ...flags, ...(generateProsCons(breed, answers).matchedCons || [])];
      const real = [...new Set(reasons.filter(Boolean))].slice(0, 4);
      // The engine can mark a breed "Not recommended" on overall score alone, with no single flag.
      return real.length ? real : [`It scored ${breed.matchPercentage}% against your answers, which is below the level we recommend.`];
    }
    const pros = (generateMatchReasons(breed, answers).pros || []).slice(0, 4);
    return pros.length ? pros : [generatePersonalizedReason(breed, answers)].filter(Boolean);
  }, [breed, answers, hasAnswers, notRecommended]);

  const pc = useMemo(() => generateProsCons(breed, hasAnswers ? answers : null), [breed, answers, hasAnswers]);
  const climate = climateInfo(breed);
  const [energyLead, energyRest] = splitLead(breed.energy || '');
  const [groomLead, groomRest] = splitLead(breed.grooming || '');
  const [riskLead, riskRest] = splitLead(breed.risk || '');
  const [houseLead, houseRest] = splitLead(breed.house || '');
  const flat = /^yes/i.test((breed.apt || '').trim());
  const health = healthItems(breed);

  return (
    <div className="pbsw__sheetwrap" onClick={onClose}>
      <div
        className="pbsw__sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`About ${breed.name}`}
        tabIndex={-1}
        ref={ref}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="pbsw__handle" aria-label="Close details" onClick={onClose}><span /></button>
        <button type="button" className="pbsw__sheetx" aria-label="Close details" onClick={onClose}><XIcon size={20} /></button>

        <div className="pbsw__sheetbody">
          <header className="pbsw__sheethead">
            <img src={`/${breed.img}`} alt="" width="72" height="72" />
            <div>
              <h2>{breed.name}</h2>
              <p>{(breed.purpose || '').split('/')[0].trim()}</p>
            </div>
            <MatchBadge breed={breed} hasAnswers={hasAnswers} onTakeQuiz={onTakeQuiz} />
          </header>

          {hasAnswers && why.length > 0 && (
            <section className="pbsw__sec">
              <h3>{notRecommended ? 'Why it may not suit you' : 'Why it matches you'}</h3>
              <ul className={`pbsw__list ${notRecommended ? 'is-warn' : 'is-good'}`}>
                {why.map((r) => (
                  <li key={r}>{notRecommended ? <AlertIcon size={18} /> : <CheckIcon size={18} />}<span>{r}</span></li>
                ))}
              </ul>
            </section>
          )}

          <section className="pbsw__sec">
            <h3>Good to know</h3>
            <div className="pbsw__two">
              <ul className="pbsw__list is-good">
                {pc.pros.slice(0, 4).map((t) => <li key={t}><CheckIcon size={18} /><span>{t}</span></li>)}
              </ul>
              <ul className="pbsw__list is-warn">
                {pc.cons.slice(0, 4).map((t) => <li key={t}><AlertIcon size={18} /><span>{t}</span></li>)}
              </ul>
            </div>
          </section>

          <section className="pbsw__sec">
            <h3>Living with it</h3>
            <dl className="pbsw__facts2">
              <Fact label="Size" value={sizeLong(breed)} />
              <Fact label="Energy" value={energyLead} sub={[energyRest, breed.time && `About ${breed.time} a day`].filter(Boolean).join('. ')} />
              <Fact label="Grooming" value={groomLead} sub={groomRest} />
              <Fact label="Shedding" value={breed.shedding} />
              <Fact label="Coat" value={breed.hair} />
              <Fact label="Space" value={flat ? 'Flat OK' : 'Needs a house'} sub={[breed.minApartmentSize, houseLead && `Outdoor space: ${houseLead.toLowerCase()}`].filter(Boolean).join('. ')} />
              <Fact label="Experience" value={breed.experienceLevel} />
              <Fact label="Temperament and children" value={riskLead} sub={riskRest} />
            </dl>
          </section>

          <section className="pbsw__sec">
            <h3>Climate in India</h3>
            <div className="pbsw__chips">{cities(breed).map((c) => <span key={c}>{c}</span>)}</div>
            {(climate.band || climate.note) && (
              <p className="pbsw__p">{climate.band}{climate.band && climate.note ? '. ' : ''}{climate.note}</p>
            )}
          </section>

          {health.length > 0 && (
            <section className="pbsw__sec">
              <h3>Health watch-outs</h3>
              <p className="pbsw__small">Common issues to ask a breeder about</p>
              <ul className="pbsw__bullets">{health.map((h) => <li key={h}>{h}</li>)}</ul>
            </section>
          )}

          <section className="pbsw__sec">
            <h3>Cost</h3>
            <dl className="pbsw__facts2">
              <Fact label="Monthly" value={monthlyRange(breed)} />
              <Fact label="Puppy price" value={puppyRange(breed)} />
            </dl>
            <p className="pbsw__small">Estimates. Ask the breeder for the actual price.</p>
          </section>
        </div>

        <div className="pbsw__actions2">
          <button type="button" className={`pbsw__heart${shortlisted ? ' is-on' : ''}`} aria-pressed={shortlisted} onClick={() => onToggleShortlist(breed)}>
            <HeartIcon size={20} filled={shortlisted} /> <span>{shortlisted ? 'Shortlisted' : 'Shortlist'}</span>
          </button>
          <button type="button" className="pbsw__primary" onClick={() => onBuy(breed)}>Find breeders</button>
          <button type="button" className="pbsw__secondary" onClick={() => onFullProfile(breed)}>Full profile</button>
          <button type="button" className="pbsw__textbtn" onClick={() => onCompare(breed)}>Compare</button>
        </div>
      </div>
    </div>
  );
}
