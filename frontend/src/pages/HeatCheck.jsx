import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { HEAT } from '../constants/heatData';
import { getHeatVerdict, getYear, HEAT_COLOURS } from '../utils/heat';
import { track, trackOnce } from '../utils/analytics';
import { shareBase } from '../constants/site';
import { useShareFlow, ShareSheet } from '../components/results/shareFlow';
import BreedSelect from '../components/heat/BreedSelect';
import HeatShareCard, { HEAT_CARD_ID } from '../components/heat/HeatShareCard';

/* "Will it survive?" — pick a breed, a city and a month, get a plain verdict.

   Everything on this page is a lookup from constants/heatData.js. There is no network call, no AI
   and no weather feed: the same three inputs always give the same answer. The rule itself lives in
   utils/heat.js (getHeatVerdict) so it can be tested on its own.

   WHAT THIS PAGE MUST NEVER DO
   - Give veterinary advice. The disclaimer under the verdict is not optional.
   - Guess. A breed or city outside the data gets "we don't have that yet", never an invented answer.

   HOW TO EDIT
   - Verdict wording, advice lines, city numbers, breed tiers: constants/heatData.js (that file is the
     source of truth — do not copy any of it in here).
   - Colours: HEAT_COLOURS in utils/heat.js.
   - The share image: components/heat/HeatShareCard.jsx. */

const BREED_NAMES = Object.keys(HEAT.BREEDS);
const DEFAULTS = { breed: 'Labrador Retriever', city: 'Hyderabad' };
const RESULT_EVENT_GAP_MS = 1000;   // at most one heat_check_result per second, however fast the controls move

const shareUrl = (breed, city, m) =>
  shareBase()
  + '/heat-check?breed=' + encodeURIComponent(breed)
  + '&city=' + encodeURIComponent(city)
  + '&month=' + m
  + '&utm_source=share&utm_medium=heat_check&utm_campaign=will_it_survive';

export default function HeatCheck() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();

  /* The way out: back to the Top 5.

     Not history.back(). Almost everyone arrives from the 'Check this breed in your city'
     link on a results card, but the Top 5 is in-page state rather than a route, so going
     back just lands on the hero with the results gone. /?results=1 rebuilds them from the
     saved quiz answers (see the deep-link effect in pages/Home.jsx). Someone who opened a
     shared link and never took the quiz has nothing to rebuild and simply gets the hero,
     which is the right place for them anyway. */
  const goBack = () => navigate('/?results=1');

  /* The URL is the state. A link someone was sent shows exactly what they were sent, and changing a
     control rewrites the address (replace, not push, so Back leaves the page instead of stepping
     through every month someone tapped). Anything unrecognised in the URL falls back to a default. */
  const breed = BREED_NAMES.includes(params.get('breed')) ? params.get('breed') : DEFAULTS.breed;
  const city = HEAT.CITIES.includes(params.get('city')) ? params.get('city') : DEFAULTS.city;
  const monthParam = Number(params.get('month'));
  const month = Number.isInteger(monthParam) && monthParam >= 0 && monthParam <= 11
    ? monthParam
    : new Date().getMonth();

  const setPick = (next) => {
    const merged = { breed, city, month, ...next };
    setParams({ breed: merged.breed, city: merged.city, month: String(merged.month) }, { replace: true });
  };

  const verdict = useMemo(() => getHeatVerdict(breed, city, month), [breed, city, month]);
  const year = useMemo(() => getYear(breed, city), [breed, city]);
  const highs = HEAT.CITY_HIGH_C[city];

  const [howOpen, setHowOpen] = useState(false);
  const shareBtnRef = useRef(null);

  useEffect(() => { trackOnce('heat_check_viewed', 'page'); }, []);

  /* One result event per second at most. Somebody flicking through months fires a burst of renders;
     without this the funnel would fill with a row per frame. */
  const lastSent = useRef({ at: 0, key: '' });
  const resultTimer = useRef(null);
  useEffect(() => {
    if (!verdict) return undefined;
    const key = breed + '|' + city + '|' + month;
    if (key === lastSent.current.key) return undefined;
    const send = () => {
      lastSent.current = { at: Date.now(), key };
      track('heat_check_result', { breed, city, month, verdict: verdict.label });
    };
    const since = Date.now() - lastSent.current.at;
    if (since >= RESULT_EVENT_GAP_MS) { send(); return undefined; }
    clearTimeout(resultTimer.current);
    resultTimer.current = setTimeout(send, RESULT_EVENT_GAP_MS - since);
    return () => clearTimeout(resultTimer.current);
  }, [breed, city, month, verdict]);
  useEffect(() => () => clearTimeout(resultTimer.current), []);

  const flow = useShareFlow({
    getText: () => (verdict
      ? 'Will a ' + breed + ' survive ' + city + ' in ' + HEAT.MONTHS[month] + '? ' + verdict.label + '.'
      : 'Will your dream breed survive your city?'),
    getUrl: () => shareUrl(breed, city, month),
    fileName: 'paw-buddy-heat-check.jpg',
    prepare: async ({ setDrawCard, frames }) => {
      if (!verdict) return null;
      setDrawCard(true);
      await frames();
      const el = document.getElementById(HEAT_CARD_ID);
      return el ? { el, maxScale: 1 } : null;   // the card is already 1080 wide
    },
    onEvent: (kind) => { if (kind === 'clicked') track('heat_check_shared', { breed, city }); },
  });

  return (
    <div className="pbhc">
      <style>{CSS}</style>
      {flow.drawCard && verdict && <HeatShareCard breed={breed} city={city} month={month} verdict={verdict} />}

      <button type="button" className="pbhc__close" onClick={goBack} aria-label="Close heat check and go back to your top 5 breeds">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </button>

      <header className="pbhc__head">
        <p className="pbhc__kicker">Heat check</p>
        <h1 className="pbhc__h1">Will it survive?</h1>
        <p className="pbhc__lede">
          Pick a breed, your city and a month. We will tell you straight whether that dog can cope,
          and what it would take to keep it comfortable.
        </p>
      </header>

      <section className="pbhc__controls" aria-label="Choose a breed, city and month">
        <div className="pbhc__field">
          <span className="pbhc__label">Breed</span>
          <BreedSelect names={BREED_NAMES} value={breed} onChange={(b) => setPick({ breed: b })} label="Breed" />
        </div>

        <div className="pbhc__field">
          <span className="pbhc__label" id="pbhc-city-label">City</span>
          <div className="pbhc__cities" role="group" aria-labelledby="pbhc-city-label">
            {HEAT.CITIES.map((c) => (
              <button
                key={c}
                type="button"
                className={'pbhc__city' + (c === city ? ' is-on' : '')}
                aria-pressed={c === city}
                onClick={() => setPick({ city: c })}
              >
                {c}
              </button>
            ))}
          </div>
          <p className="pbhc__note">More cities coming soon.</p>
        </div>

        <div className="pbhc__field">
          <span className="pbhc__label" id="pbhc-month-label">Month</span>
          <div className="pbhc__months" role="group" aria-labelledby="pbhc-month-label">
            {HEAT.MONTHS.map((mo, i) => (
              <button
                key={mo}
                type="button"
                className={'pbhc__month' + (i === month ? ' is-on' : '')}
                aria-pressed={i === month}
                onClick={() => setPick({ month: i })}
              >
                {mo}
              </button>
            ))}
          </div>
        </div>
      </section>

      {verdict ? (
        <>
          <section className="pbhc__result" aria-live="polite">
            <h2 className="pbhc__q">Will a {breed} survive {city} in {HEAT.MONTHS[month]}?</h2>

            <div className="pbhc__verdict" style={{ background: verdict.colour }}>
              <span className="pbhc__vlabel">{verdict.label}</span>
              {/* At level 4 the verdict and the advice heading are both "Not advised"; showing it twice
                  just looks like a mistake, so the sub-line is dropped when it repeats the label. */}
              {verdict.advice.title !== verdict.label && (
                <span className="pbhc__vsub">{verdict.advice.title}</span>
              )}
            </div>

            <p className="pbhc__reason">{verdict.reason}</p>

            <ul className="pbhc__advice">
              {verdict.advice.lines.map((line) => <li key={line}>{line}</li>)}
            </ul>

            <p className="pbhc__disclaimer">
              A guide, not veterinary advice. Indian summers vary and some years run hotter than these averages.
            </p>
          </section>

          <section className="pbhc__year" aria-label={'Every month for a ' + breed + ' in ' + city}>
            <h3 className="pbhc__h3">The whole year in {city}</h3>
            <div className="pbhc__strip">
              {year.map((v, i) => (
                <button
                  key={HEAT.MONTHS[i]}
                  type="button"
                  className={'pbhc__block' + (i === month ? ' is-on' : '')}
                  style={{ background: v.colour }}
                  aria-pressed={i === month}
                  aria-label={HEAT.MONTHS[i] + ': ' + v.label + '. Average high ' + highs[i] + ' degrees.'}
                  title={HEAT.MONTHS[i] + ' — ' + v.label}
                  onClick={() => setPick({ month: i })}
                >
                  <span className="pbhc__bmonth">{HEAT.MONTHS[i]}</span>
                  <span className="pbhc__bhigh">{highs[i]}°</span>
                </button>
              ))}
            </div>
            <p className="pbhc__striprow">Average high, °C (1961–1990 normals)</p>

            {/* Colour is never the only signal: this spells out what each shade means. */}
            <ul className="pbhc__legend">
              {HEAT.VERDICTS.map((label, i) => (
                <li key={label}>
                  <span className="pbhc__swatch" style={{ background: HEAT_COLOURS[i] }} aria-hidden="true" />
                  {label}
                </li>
              ))}
            </ul>
          </section>

          <section className="pbhc__other" aria-label="The same month in other cities">
            <h3 className="pbhc__h3">Try another city</h3>
            <div className="pbhc__chips">
              {HEAT.CITIES.filter((c) => c !== city).map((c) => {
                const v = getHeatVerdict(breed, c, month);
                return (
                  <button key={c} type="button" className="pbhc__chip" onClick={() => setPick({ city: c })}>
                    <span className="pbhc__chipdot" style={{ background: v.colour }} aria-hidden="true" />
                    <span className="pbhc__chipcity">{c}</span>
                    <span className="pbhc__chipv">{v.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="pbhc__sharerow">
            <button
              type="button"
              ref={shareBtnRef}
              className="pbhc__share"
              onClick={flow.share}
              aria-busy={flow.busy}
              disabled={flow.busy}
            >
              {flow.busy ? 'Preparing your card…' : 'Share this'}
            </button>
          </div>
          <ShareSheet flow={flow} title="Share this heat check" returnFocusRef={shareBtnRef} />
        </>
      ) : (
        <section className="pbhc__result">
          <p className="pbhc__reason">We do not have heat data for that combination yet.</p>
        </section>
      )}

      <section className="pbhc__how">
        <button
          type="button"
          className="pbhc__howbtn"
          aria-expanded={howOpen}
          aria-controls="pbhc-how"
          onClick={() => setHowOpen((o) => !o)}
        >
          How we calculate this {howOpen ? '−' : '+'}
        </button>
        {howOpen && (
          <div className="pbhc__howbody" id="pbhc-how">
            <p>
              <strong>City heat.</strong> The monthly highs are averages from 1961 to 1990 (a Current Results
              compilation). They are old, so real peaks today are higher. We add one level in the months that
              usually bring heatwaves — April and May in Hyderabad, April to June in Delhi, May and June in
              Chennai — and one level for the humid coastal months in Mumbai and Chennai. Those two
              adjustments are our assumptions, not measured data.
            </p>
            <p>
              <strong>Breed heat tiers.</strong> These come from coat type, face shape and size, matched against
              our breed database and published Indian vet and pet-care guidance. They are a screening score,
              not a clinical measure.
            </p>
            <p>
              <strong>Not veterinary advice.</strong> If a dog is already panting heavily, drooling or looking
              weak, go to a vet immediately.
            </p>
          </div>
        )}
      </section>

      <section className="pbhc__cta">
        <h3 className="pbhc__h3">Not sure which breed suits you?</h3>
        <Link
          className="pbhc__ctabtn"
          to="/"
          onClick={() => track('cta_click', { source: 'heat_check' })}
        >
          Find a breed that suits your city
        </Link>
      </section>
    </div>
  );
}

const CSS = `
.pbhc{--navy:#011E4A;--orange:#F5691A;box-sizing:border-box;max-width:760px;margin:0 auto;padding:24px 16px 72px;background:#FBF8F4;color:var(--navy);font-family:'Satoshi',system-ui,-apple-system,'Segoe UI',sans-serif}
/* The way back. Sticky to the top of the page rather than fixed to the screen, so it
   cannot end up floating over the share sheet. 44px, like every other tap target here. */
.pbhc__close{position:sticky;top:10px;z-index:5;float:right;width:44px;height:44px;margin:-6px -4px 0 0;display:inline-flex;align-items:center;justify-content:center;border:1.5px solid #E6DED6;border-radius:50%;background:#FFFFFF;color:var(--navy);cursor:pointer;box-shadow:0 2px 8px rgba(1,30,74,.08)}
@media (hover:hover){.pbhc__close:hover{background:#F2EDE7}}
.pbhc__close:active{transform:scale(.94)}
.pbhc__close:focus-visible{outline:3px solid var(--orange);outline-offset:2px}
.pbhc *,.pbhc *::before,.pbhc *::after{box-sizing:border-box}
.pbhc :focus-visible{outline:3px solid var(--navy);outline-offset:2px}
.pbhc__kicker{margin:0;font-size:13px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--orange)}
.pbhc__h1{margin:6px 0 0;font-family:'Fredoka',sans-serif;font-weight:700;font-size:clamp(30px,8vw,44px);line-height:1.1}
.pbhc__lede{margin:10px 0 0;font-size:16px;line-height:1.55;color:#4A5568}
.pbhc__h3{margin:0 0 10px;font-family:'Fredoka',sans-serif;font-weight:600;font-size:19px}

.pbhc__controls{margin-top:26px;display:flex;flex-direction:column;gap:18px}
.pbhc__label{display:block;margin-bottom:7px;font-size:13px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#6B7686}
.pbhc__note{margin:7px 0 0;font-size:12px;color:#6B7686}

.pbhc__sel{position:relative}
.pbhc__selinput{width:100%;min-height:48px;padding:0 38px 0 14px;border:1.5px solid #E3DCD5;border-radius:12px;background:#fff;color:var(--navy);font:600 16px 'Satoshi',sans-serif}
.pbhc__selarrow{position:absolute;right:14px;top:50%;transform:translateY(-50%);pointer-events:none;color:#6B7686}
.pbhc__sellist{position:absolute;z-index:5;top:calc(100% + 4px);left:0;right:0;max-height:260px;overflow-y:auto;margin:0;padding:6px;list-style:none;background:#fff;border:1.5px solid #E3DCD5;border-radius:12px;box-shadow:0 12px 30px rgba(1,30,74,.14)}
.pbhc__selopt{display:block;width:100%;min-height:44px;padding:0 12px;border:0;border-radius:9px;background:none;color:var(--navy);font:600 15px 'Satoshi',sans-serif;text-align:left;cursor:pointer}
.pbhc__selopt.is-hi{background:#FFF1E6}
.pbhc__selopt.is-sel{color:var(--orange)}
.pbhc__selempty{padding:10px 12px;font-size:14px;color:#6B7686}

.pbhc__cities{display:flex;flex-wrap:wrap;gap:8px}
.pbhc__city{min-height:48px;padding:0 18px;border:1.5px solid var(--navy);border-radius:999px;background:#fff;color:var(--navy);font:700 15px 'Satoshi',sans-serif;cursor:pointer}
.pbhc__city.is-on{background:var(--navy);color:#fff}
.pbhc__months{display:grid;grid-template-columns:repeat(6,1fr);gap:6px}
.pbhc__month{min-height:44px;padding:0 4px;border:1.5px solid #E3DCD5;border-radius:10px;background:#fff;color:var(--navy);font:700 14px 'Satoshi',sans-serif;cursor:pointer}
.pbhc__month.is-on{border-color:var(--navy);background:var(--navy);color:#fff}

.pbhc__result{margin-top:28px;padding:20px;background:#fff;border:1.5px solid #E9E2DB;border-radius:18px}
.pbhc__q{margin:0;font-family:'Fredoka',sans-serif;font-weight:600;font-size:clamp(19px,5vw,24px);line-height:1.25}
.pbhc__verdict{margin-top:14px;padding:16px 18px;border-radius:14px;color:#fff;display:flex;flex-direction:column;gap:2px}
.pbhc__vlabel{font-family:'Fredoka',sans-serif;font-weight:700;font-size:clamp(24px,6.5vw,32px);line-height:1.1}
.pbhc__vsub{font-size:14px;font-weight:600;opacity:.95}
.pbhc__reason{margin:14px 0 0;font-size:15px;line-height:1.6;color:#4A5568}
.pbhc__advice{margin:12px 0 0;padding-left:20px;font-size:15px;line-height:1.6}
.pbhc__advice li{margin-bottom:6px}
.pbhc__disclaimer{margin:14px 0 0;padding-top:12px;border-top:1px solid #EFE6DC;font-size:13px;line-height:1.5;color:#6B7686}

.pbhc__year{margin-top:26px}
.pbhc__strip{display:grid;grid-template-columns:repeat(6,1fr);gap:5px}
.pbhc__block{min-height:64px;padding:6px 0;border:0;border-radius:7px;color:#fff;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;text-shadow:0 1px 2px rgba(0,0,0,.28)}
.pbhc__block.is-on{outline:3px solid var(--navy);outline-offset:1px}
.pbhc__bmonth{font-size:11px;font-weight:800;letter-spacing:.02em}
.pbhc__bhigh{font-size:10px;font-weight:600;opacity:.95}
.pbhc__striprow{margin:8px 0 0;font-size:12px;color:#6B7686}
.pbhc__legend{margin:12px 0 0;padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:6px 14px;font-size:12px;color:#4A5568}
.pbhc__legend li{display:flex;align-items:center;gap:6px}
.pbhc__swatch{width:12px;height:12px;border-radius:3px;display:inline-block}

.pbhc__other{margin-top:26px}
.pbhc__chips{display:flex;flex-wrap:wrap;gap:8px}
.pbhc__chip{min-height:48px;padding:0 14px;border:1.5px solid #E3DCD5;border-radius:999px;background:#fff;color:var(--navy);font:600 14px 'Satoshi',sans-serif;cursor:pointer;display:inline-flex;align-items:center;gap:8px}
.pbhc__chipdot{width:10px;height:10px;border-radius:50%;flex:none}
.pbhc__chipcity{font-weight:700}
.pbhc__chipv{color:#6B7686}

.pbhc__sharerow{margin-top:24px}
.pbhc__share{width:100%;min-height:52px;padding:0 24px;border:0;border-radius:999px;background:var(--orange);color:#fff;font:700 16px 'Satoshi',sans-serif;cursor:pointer}
.pbhc__share[disabled]{opacity:.7;cursor:default}

.pbhc__how{margin-top:28px}
.pbhc__howbtn{min-height:44px;padding:0;border:0;background:none;color:#B34A0E;font:700 14px 'Satoshi',sans-serif;text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.pbhc__howbody{margin-top:8px;padding:16px;background:#fff;border:1.5px solid #E9E2DB;border-radius:14px}
.pbhc__howbody p{margin:0 0 12px;font-size:14px;line-height:1.6;color:#4A5568}
.pbhc__howbody p:last-child{margin-bottom:0}

.pbhc__cta{margin-top:32px;padding:20px;background:#FFF1E6;border-radius:18px;text-align:center}
.pbhc__ctabtn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 24px;border-radius:999px;background:var(--navy);color:#fff;font:700 15px 'Satoshi',sans-serif;text-decoration:none}

@media (min-width:760px){
  .pbhc{padding:40px 24px 90px}
  .pbhc__months{grid-template-columns:repeat(12,1fr)}
  .pbhc__strip{grid-template-columns:repeat(12,1fr);gap:3px}
  .pbhc__block{min-height:76px}
}
@media (prefers-reduced-motion:reduce){.pbhc *{animation:none!important;transition:none!important}}
`;
