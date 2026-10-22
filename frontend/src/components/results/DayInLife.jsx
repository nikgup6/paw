import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { buildDay } from '../../utils/dayInLife';
import { track } from '../../utils/analytics';

/* "A day with your dog" — one honest day with a 3-month-old puppy of this breed,
   played as a short story of cards.

   Everything shown here comes out of utils/dayInLife.js (buildDay), which is a pure
   function: breed row + the visitor's quiz answers in, scenes + summary out. This file
   is only the player. It invents no advice of its own, which is the whole point: if a
   number or a sentence looks wrong, it is changed in dayInLife.js and every surface
   that shows it changes with it.

   The honest parts are not softened. A scene that carries a `warn` gets an amber chip
   with words on it ("Too long for a puppy"), so the warning survives colour-blindness,
   greyscale printing and forced-colors mode. The summary lists every flag.

   HOW TO EDIT
   - How long each scene holds: SCENE_MS.
   - Scene colours: PALETTE, keyed by the scene's `icon`.
   - The amber chip wording: WARN_TEXT.
   - The icons: ICONS, plain inline SVG, brand colours only.
   Wording and numbers in the cards themselves are NOT here — they are in
   utils/dayInLife.js. */

const SCENE_MS = 4500;          // how long one scene holds before the next one

/* Which instance currently owns the focus. React's StrictMode mounts every component
   twice in development (setup, cleanup, setup), and without this the throwaway first
   mount's cleanup hands focus back to the opening button a frame after the real mount
   has given it to the close button — so the dialog opened with focus outside itself.
   The cleanup only restores focus if it is still the newest instance. */
let focusOwner = 0;
const NAVY = '#011E4A';
const ORANGE = '#F5691A';
const CREAM = '#FBF8F4';

const DISCLAIMER = 'A general guide for a typical 3-month-old puppy, not veterinary advice. Ask your vet about your own dog.';

const WARN_TEXT = {
  limit: 'At the limit for a puppy',
  'too-long': 'Too long for a puppy',
  supervise: 'Needs supervision',
};

/* One background per scene type, so the story visibly moves through the day: warm at
   wake-up, pale at midday, deep navy once the moon is out. `ink` is the text colour on
   it — every pair here clears WCAG AA for normal text. */
const PALETTE = {
  sun: { bg: '#FFE9C9', ink: NAVY, ring: '#F5B041' },
  bowl: { bg: '#FFD9BD', ink: NAVY, ring: ORANGE },
  walk: { bg: '#E3ECF7', ink: NAVY, ring: '#4F7FBF' },
  home: { bg: '#FFEFE0', ink: NAVY, ring: ORANGE },
  family: { bg: '#FFE0E0', ink: NAVY, ring: '#C0566A' },
  train: { bg: '#E0EFE4', ink: NAVY, ring: '#3E7D56' },
  moon: { bg: NAVY, ink: CREAM, ring: '#FFD9BD' },
};
const paletteFor = (icon) => PALETTE[icon] || PALETTE.home;

/* ── Scene icons. Decorative: every one is aria-hidden, and the scene always says in
      words what it is about, so nothing depends on reading the drawing. ── */
const ICONS = {
  sun: (c) => (
    <>
      <circle cx="12" cy="12" r="4.4" fill={c} />
      <path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4L17 7M7 17l-1.6 1.6" stroke={c} strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  bowl: (c) => (
    <>
      <path d="M3.6 11h16.8a8.4 8.4 0 0 1-8.4 7.6A8.4 8.4 0 0 1 3.6 11z" fill="none" stroke={c} strokeWidth="2" strokeLinejoin="round" />
      <path d="M8.2 7.6c.9-1.4 2.2-2.2 3.8-2.2s2.9.8 3.8 2.2" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  walk: (c) => (
    <>
      <ellipse cx="12" cy="15.5" rx="4.4" ry="3.6" fill="none" stroke={c} strokeWidth="2" />
      <circle cx="6.4" cy="9.6" r="1.9" fill="none" stroke={c} strokeWidth="2" />
      <circle cx="10.2" cy="6" r="1.9" fill="none" stroke={c} strokeWidth="2" />
      <circle cx="15.4" cy="6" r="1.9" fill="none" stroke={c} strokeWidth="2" />
      <circle cx="18.4" cy="9.6" r="1.9" fill="none" stroke={c} strokeWidth="2" />
    </>
  ),
  home: (c) => (
    <>
      <path d="M3.6 11.4L12 4.2l8.4 7.2" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.8 11v8.4h12.4V11" fill="none" stroke={c} strokeWidth="2" strokeLinejoin="round" />
      <path d="M10 19.4v-4.6h4v4.6" fill="none" stroke={c} strokeWidth="2" strokeLinejoin="round" />
    </>
  ),
  family: (c) => (
    <>
      <circle cx="8.4" cy="7.4" r="2.8" fill="none" stroke={c} strokeWidth="2" />
      <circle cx="16.4" cy="9" r="2.1" fill="none" stroke={c} strokeWidth="2" />
      <path d="M3.4 19.4c0-3 2.2-5.2 5-5.2s5 2.2 5 5.2" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" />
      <path d="M14.2 19.4c0-2.3 1.2-3.8 2.9-3.8s2.9 1.5 2.9 3.8" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  train: (c) => (
    <>
      <path d="M12 20.4l-1.6-3.4-3.6.6 1.6-3.4L5.2 11l3.6-.8L8.4 6.4 12 8l3.6-1.6-.4 3.8 3.6.8-3.2 3.2 1.6 3.4-3.6-.6z" fill="none" stroke={c} strokeWidth="2" strokeLinejoin="round" />
    </>
  ),
  moon: (c) => (
    <>
      <path d="M19 14.6A7.6 7.6 0 0 1 9.4 5a7.8 7.8 0 1 0 9.6 9.6z" fill="none" stroke={c} strokeWidth="2" strokeLinejoin="round" />
    </>
  ),
};

const SceneIcon = ({ name, colour }) => (
  <svg className="pbd__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    {(ICONS[name] || ICONS.home)(colour)}
  </svg>
);

const PawIcon = () => (
  <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" focusable="false">
    {ICONS.walk('currentColor')}
  </svg>
);

/* The scene picture: a circular crop of the breed's own photo on the scene's colour,
   moving the way the scene feels. No image files are added — it is the same photo the
   card already shows. Decorative, so alt="". */
const ScenePicture = ({ src, mood, icon, still }) => {
  const p = paletteFor(icon);
  return (
    <div className={`pbd__pic pbd__pic--${still ? 'still' : mood}`} style={{ background: p.bg }}>
      <div className="pbd__dog" style={{ borderColor: p.ring }}>
        {src ? <img src={src} alt="" aria-hidden="true" draggable="false" /> : null}
      </div>
      <span className="pbd__badge" style={{ background: p.ink === CREAM ? 'rgba(255,255,255,.14)' : '#FFFFFF' }}>
        <SceneIcon name={icon} colour={p.ink} />
      </span>
      {mood === 'tired' && !still && <span className="pbd__zzz" style={{ color: p.ink }} aria-hidden="true">z z z</span>}
    </div>
  );
};

const WarnChip = ({ warn }) => (
  <p className="pbd__chip">
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" focusable="false">
      <path d="M12 3.5L21 19H3z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M12 10v4M12 16.8v.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
    {WARN_TEXT[warn] || warn}
  </p>
);

/* One scene card. `still` kills the motion (reduced motion, or the static list). */
const SceneCard = ({ scene, photo, still }) => {
  const p = paletteFor(scene.icon);
  return (
    <article className="pbd__scene">
      <ScenePicture src={photo} mood={scene.mood} icon={scene.icon} still={still} />
      <div className="pbd__body">
        <p className="pbd__time">{scene.time}</p>
        <h3 className="pbd__stitle">{scene.title}</h3>
        <p className="pbd__text">{scene.body}</p>
        {scene.warn && <WarnChip warn={scene.warn} />}
      </div>
      <span className="pbd__hairline" style={{ background: p.ring }} aria-hidden="true" />
    </article>
  );
};

/* The last card: what the day actually costs in hours and rupees, and every warning. */
const SummaryCard = ({ summary, breedName, onBack, onFindBreeders }) => {
  const hours = summary.ownerHoursPerDay;
  const alone = summary.aloneHours;
  return (
    <article className="pbd__scene pbd__scene--sum">
      <div className="pbd__body">
        <h3 className="pbd__stitle">The day in numbers</h3>

        <div className="pbd__stats">
          <div className="pbd__stat">
            <b>{Number.isFinite(hours) ? hours : '—'}</b>
            <span>{Number.isFinite(hours) ? `About ${hours} hours of your time on a typical puppy day` : 'Hours of your time: not available'}</span>
          </div>
          <div className="pbd__stat">
            <b>{alone === null || alone === undefined ? '?' : alone}</b>
            <span>{alone === null || alone === undefined ? 'Alone: not provided' : `Alone: ${alone} ${alone === 1 ? 'hour' : 'hours'}`}</span>
          </div>
        </div>

        {summary.adultTimeNeeded && (
          <p className="pbd__text">As an adult, {summary.adultTimeNeeded} of attention every day.</p>
        )}
        {summary.budgetNote && <p className="pbd__text">{summary.budgetNote}</p>}

        {summary.flags && summary.flags.length > 0 ? (
          <div className="pbd__flags">
            <h4>Worth knowing before you decide</h4>
            <ul>
              {summary.flags.map((f, i) => <li key={i}>{f}</li>)}
            </ul>
          </div>
        ) : (
          <p className="pbd__good">Looks like a good fit for your day.</p>
        )}

        <p className="pbd__disclaimer">{DISCLAIMER}</p>

        <div className="pbd__sumbtns">
          <button type="button" className="pbd__cta pbd__cta--ghost" onClick={onBack}>Back to my matches</button>
          {onFindBreeders && (
            <button type="button" className="pbd__cta" onClick={onFindBreeders}>Find breeders for {breedName}</button>
          )}
        </div>
      </div>
    </article>
  );
};

export default function DayInLife({ breed, answers, city, onClose, onFindBreeders }) {
  /* Reduced motion decides the whole shape of this modal — a player, or a plain list —
     so it is read once on open and then followed if the user changes it mid-story. */
  const [still, setStill] = useState(() => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
  });
  useEffect(() => {
    let mq;
    try { mq = window.matchMedia('(prefers-reduced-motion: reduce)'); } catch { return undefined; }
    const on = (e) => setStill(e.matches);
    mq.addEventListener ? mq.addEventListener('change', on) : mq.addListener(on);
    return () => { mq.removeEventListener ? mq.removeEventListener('change', on) : mq.removeListener(on); };
  }, []);

  const { scenes, summary } = useMemo(() => buildDay(breed, answers || {}), [breed, answers]);
  const total = scenes.length;              // index === total means "the summary card"
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(!still);

  const panelRef = useRef(null);
  const closeRef = useRef(null);
  const liveRef = useRef(null);
  const ownRef = useRef(0);

  /* The element to hand focus back to. Captured during the FIRST render, not in the
     effect: by the time an effect runs, the dialog has already moved focus to its own
     close button, so an effect would "remember" the close button and focus would fall
     to the top of the page on close. Lazy initial state runs once per instance. */
  const [opener] = useState(() => {
    try { return document.activeElement; } catch { return null; }
  });

  const breedName = breed?.name || 'this breed';
  const photo = breed?.img ? `/${breed.img}` : null;
  const cityLabel = (city || '').trim();

  /* ── Tracking. Breed name only: no answers, no city, ever. ── */
  const seen = useRef(new Set());
  const completed = useRef(false);
  const atRef = useRef('wake');             // the scene we are on, for day_closed
  // Once per open, by design: the deps list is empty on purpose.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { track('day_opened', { breed: breedName }); }, []);

  const markScene = useCallback((id) => {
    if (!id || seen.current.has(id)) return;
    seen.current.add(id);
    track('day_scene_viewed', { breed: breedName, scene: id });
  }, [breedName]);

  const markComplete = useCallback(() => {
    if (completed.current) return;
    completed.current = true;
    track('day_completed', { breed: breedName });
  }, [breedName]);

  /* One close path for everything (Escape, backdrop, the X, "Back to my matches"), so
     day_closed can never be missed and focus always lands back on the opening button. */
  const close = useCallback(() => {
    track('day_closed', { breed: breedName, at: atRef.current });
    onClose?.();
  }, [breedName, onClose]);

  /* In the player, the scene on screen is the one that has been seen. */
  useEffect(() => {
    if (still) return;
    if (index >= total) { atRef.current = 'summary'; markComplete(); return; }
    const s = scenes[index];
    atRef.current = s?.id || 'summary';
    markScene(s?.id);
  }, [index, total, scenes, still, markScene, markComplete]);

  /* In the static list, a scene counts as viewed when it actually scrolls into view. */
  useEffect(() => {
    if (!still || typeof IntersectionObserver === 'undefined') return undefined;
    const root = panelRef.current;
    if (!root) return undefined;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const id = e.target.getAttribute('data-scene');
        if (id === 'summary') { atRef.current = 'summary'; markComplete(); return; }
        atRef.current = id;
        markScene(id);
      });
    }, { root, threshold: 0.5 });
    root.querySelectorAll('[data-scene]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [still, markScene, markComplete]);

  const go = useCallback((n, manual = true) => {
    if (manual) setPlaying(false);          // any manual step stops the auto-play
    setIndex((i) => Math.min(total, Math.max(0, typeof n === 'function' ? n(i) : n)));
  }, [total]);

  const next = useCallback((manual = true) => go((i) => i + 1, manual), [go]);
  const prev = useCallback(() => go((i) => i - 1, true), [go]);

  // auto-play: holds each scene, then stops of its own accord on the summary
  useEffect(() => {
    if (still || !playing || index >= total) return undefined;
    const t = setTimeout(() => next(false), SCENE_MS);
    return () => clearTimeout(t);
  }, [still, playing, index, total, next]);
  /* "Play the day again" from the summary: back to the first scene AND playing, which a
     plain go(0) would not do, because every manual step deliberately pauses the story. */
  const replay = useCallback(() => { setIndex(0); setPlaying(true); }, []);

  /* Reaching the summary disables Next and "Skip to summary". If the user got here BY
     pressing one of them, that button is now disabled and has silently dropped focus, so
     hand it to the summary's own first button instead of leaving it nowhere. */
  useEffect(() => {
    if (still || index < total) return;
    const p = panelRef.current;
    if (!p) return;
    const a = document.activeElement;
    if (a && p.contains(a) && !a.disabled) return;          // the user is still somewhere sensible
    if (a && a !== document.body && !p.contains(a)) return; // they moved focus out themselves: leave it
    p.querySelector('.pbd__cta')?.focus({ preventScroll: true });
  }, [index, total, still]);

  /* Scroll lock and focus, set up ONCE and undone once.

     This deliberately has an empty dependency list and talks to the key handler below
     through refs. It used to depend on the callbacks, and `onClose` is a fresh arrow
     function on every render of the results page, so the effect tore down and set up
     again on every render: focus was handed back to the opener mid-story and the close
     button never kept it. Do not add dependencies here. */
  useEffect(() => {
    ownRef.current = ++focusOwner;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = prevOverflow;
      /* The ownership test has to happen INSIDE the frame callback, not here: StrictMode
         runs this cleanup BEFORE the real mount's setup, so at this moment we still look
         like the newest instance. One frame later the real mount has claimed it. */
      const mine = ownRef.current;
      requestAnimationFrame(() => {
        if (mine !== focusOwner) return;                  // a newer instance owns focus now
        try { opener?.focus?.({ preventScroll: true }); } catch { /* gone from the page */ }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Escape, the focus trap and the keyboard story controls. This one may re-bind freely:
     adding and removing a listener costs nothing and changes no state.
     Space is left alone while a button or link has focus, so the keyboard user can
     still press the control they are actually on.

     Registered in the CAPTURE phase, and the keys this dialog owns stop there. While a
     modal dialog is open the keyboard belongs to it, and the results page underneath has
     its own live window-level Escape handler (MatchReveal keeps listening after the
     reveal has closed) which otherwise also fired and parked the focus back on the #1
     card, instead of on the button that opened this. Window capture runs before any
     window bubble listener, so stopping propagation there settles it without reaching
     into that component. */
  useEffect(() => {
    const mine = (e) => { e.preventDefault(); e.stopPropagation(); };
    const onKey = (e) => {
      if (e.key === 'Escape') { mine(e); close(); return; }
      if (e.key === 'Tab') {
        const p = panelRef.current;
        if (!p) return;
        const f = [...p.querySelectorAll('button:not([disabled]), a[href]')].filter((el) => el.offsetParent !== null);
        if (!f.length) return;
        const first = f[0]; const last = f[f.length - 1];
        /* Focus can end up on <body> without the user doing anything wrong: pressing
           "Skip to summary" disables that very button, and a disabled control drops its
           focus. From <body> neither the first nor the last test matched, so Tab walked
           straight out of the dialog and into the page behind it. Pull it back in. */
        if (!p.contains(document.activeElement)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); return; }
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        return;
      }
      if (still) return;                     // the static list is just a page: let arrows scroll it
      const onControl = document.activeElement?.closest?.('button, a[href]');
      if (e.key === 'ArrowRight') { mine(e); next(); }
      else if (e.key === 'ArrowLeft') { mine(e); prev(); }
      else if ((e.key === ' ' || e.key === 'Spacebar') && !onControl) { mine(e); next(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [still, next, prev, close]);

  const onSummary = index >= total;
  const current = onSummary ? null : scenes[index];
  const liveText = onSummary
    ? `Summary. A day with a ${breedName} puppy, in numbers.`
    : `${current?.time}. ${current?.title}. ${current?.body}${current?.warn ? ` ${WARN_TEXT[current.warn] || ''}` : ''}`;

  return createPortal(
    <div className="pbd__wrap" onClick={close}>
      <style>{CSS}</style>
      <div
        className={`pbd__panel${still ? ' is-still' : ''}`}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`A day with ${breedName}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="pbd__head">
          <div className="pbd__headtext">
            <h2 className="pbd__title">A day with {breedName}</h2>
            <p className="pbd__sub">3-month-old puppy{cityLabel ? ` · ${cityLabel}` : ''}</p>
          </div>
          <button type="button" className="pbd__x" ref={closeRef} onClick={close} aria-label="Close">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        {/* What is on screen, for a screen reader. Visually hidden: the cards below say the same. */}
        <p className="pbd__sr" aria-live="polite" ref={liveRef}>{liveText}</p>

        {still ? (
          /* Reduced motion: no auto-play and no movement — the whole day as a list. */
          <div className="pbd__list">
            {scenes.map((s) => (
              <div key={s.id} data-scene={s.id}>
                <SceneCard scene={s} photo={photo} still />
              </div>
            ))}
            <div data-scene="summary">
              <SummaryCard summary={summary} breedName={breedName} onBack={close} onFindBreeders={onFindBreeders ? () => onFindBreeders(breed) : null} />
            </div>
          </div>
        ) : (
          <>
            <div className="pbd__stage" onClick={() => (onSummary ? null : next())}>
              {onSummary
                ? <SummaryCard summary={summary} breedName={breedName} onBack={close} onFindBreeders={onFindBreeders ? () => onFindBreeders(breed) : null} />
                : <SceneCard key={current.id} scene={current} photo={photo} />}
            </div>

            <nav className="pbd__dots" aria-label="Scenes">
              {scenes.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  className={`pbd__dot${i === index ? ' is-on' : ''}${onSummary || i < index ? ' is-done' : ''}`}
                  aria-label={`Scene ${i + 1} of ${total}: ${s.time}, ${s.title}`}
                  aria-current={i === index ? 'true' : undefined}
                  onClick={() => go(i)}
                />
              ))}
            </nav>

            <footer className="pbd__foot">
              <button type="button" className="pbd__ctrl" onClick={prev} disabled={index === 0} aria-label="Previous scene">
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              <button
                type="button"
                className="pbd__ctrl pbd__ctrl--play"
                onClick={() => (onSummary ? replay() : setPlaying((p) => !p))}
                aria-label={onSummary ? 'Play the day again' : playing ? 'Pause' : 'Play'}
              >
                {onSummary ? (
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M20 12a8 8 0 1 1-2.4-5.7M20 4v4h-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                ) : playing ? (
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M9 5v14M15 5v14" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M8 5l11 7-11 7z" fill="currentColor" /></svg>
                )}
              </button>
              <button type="button" className="pbd__ctrl" onClick={() => next()} disabled={onSummary} aria-label="Next scene">
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              <button type="button" className="pbd__skip" onClick={() => go(total)} disabled={onSummary}>
                <PawIcon />
                Skip to summary
              </button>
            </footer>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

const CSS = `
.pbd__wrap{position:fixed;inset:0;z-index:1700;background:rgba(1,30,74,.5);display:flex;align-items:stretch;justify-content:center;font-family:'Satoshi',system-ui,sans-serif;-webkit-tap-highlight-color:transparent}
.pbd__panel{box-sizing:border-box;position:relative;display:flex;flex-direction:column;width:100%;background:${CREAM};color:${NAVY};overflow:hidden;padding-bottom:env(safe-area-inset-bottom)}
.pbd__panel.is-still{overflow-y:auto}
@media (min-width:768px){
  .pbd__wrap{align-items:center;padding:24px}
  .pbd__panel{width:min(720px,100%);max-height:min(92dvh,860px);border-radius:24px;box-shadow:0 24px 60px rgba(1,30,74,.3)}
}

/* header */
.pbd__head{flex:none;display:flex;align-items:flex-start;gap:12px;padding:calc(14px + env(safe-area-inset-top)) 16px 10px;border-bottom:1px solid #EFE6DA;background:${CREAM}}
.pbd__headtext{min-width:0;flex:1 1 auto}
.pbd__title{margin:0;font-family:'Fredoka',sans-serif;font-weight:700;font-size:clamp(19px,5vw,25px);line-height:1.18;overflow-wrap:anywhere}
.pbd__sub{margin:3px 0 0;font-size:13px;color:#5A6B82}
.pbd__x{flex:none;width:44px;height:44px;margin:-4px -6px 0 0;display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:50%;background:transparent;color:${NAVY};cursor:pointer}
.pbd__x:hover{background:#F0E7DB}

/* the one-scene stage */
.pbd__stage{flex:1 1 auto;min-height:0;overflow-y:auto;display:flex;flex-direction:column;padding:14px 16px 4px;cursor:pointer}
/* auto margins rather than justify-content:center — a card taller than the stage then
   still scrolls from its own top instead of having its head cut off */
.pbd__stage>.pbd__scene{margin-block:auto}
/* on a tall phone the picture takes the slack, so the card fills the screen */
@media (min-height:680px){.pbd__stage .pbd__pic{height:clamp(170px,25vh,250px)}}
.pbd__list{padding:14px 16px calc(20px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:16px}

.pbd__scene{position:relative;overflow:hidden;background:#FFFFFF;border:1px solid #EFE6DA;border-radius:20px;box-shadow:0 6px 20px rgba(1,30,74,.07);animation:pbd-in .34s cubic-bezier(.16,1,.3,1) both}
.pbd__hairline{position:absolute;left:0;right:0;bottom:0;height:3px}
@keyframes pbd-in{from{opacity:0;transform:translateY(14px) scale(.985)}to{opacity:1;transform:none}}

/* the picture */
.pbd__pic{position:relative;height:clamp(140px,28vw,200px);display:flex;align-items:center;justify-content:center}
.pbd__dog{width:clamp(96px,22vw,132px);aspect-ratio:1/1;border-radius:50%;overflow:hidden;border:4px solid #FFF;box-shadow:0 8px 22px rgba(1,30,74,.18);background:#E7EEF7}
.pbd__dog img{width:100%;height:100%;object-fit:cover;display:block;user-select:none}
.pbd__badge{position:absolute;right:14px;bottom:14px;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(1,30,74,.16)}
.pbd__icon{width:22px;height:22px}
.pbd__zzz{position:absolute;left:50%;top:14px;margin-left:34px;font:800 15px 'Satoshi',sans-serif;letter-spacing:.14em;opacity:.75;animation:pbd-zzz 2.6s ease-in-out infinite}
@keyframes pbd-zzz{0%{opacity:0;transform:translateY(8px)}35%{opacity:.8}100%{opacity:0;transform:translateY(-14px)}}

/* mood: the dog moves the way the scene feels */
.pbd__pic--happy .pbd__dog{animation:pbd-bounce 1.5s ease-in-out infinite}
.pbd__pic--calm .pbd__dog{animation:pbd-breathe 4.2s ease-in-out infinite}
.pbd__pic--tired .pbd__dog{animation:pbd-droop 3.4s ease-in-out infinite}
.pbd__pic--worried .pbd__dog{animation:pbd-shake 2.4s ease-in-out infinite}
@keyframes pbd-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
@keyframes pbd-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.045)}}
@keyframes pbd-droop{0%,100%{transform:rotate(-7deg) translateY(2px)}50%{transform:rotate(-11deg) translateY(7px)}}
@keyframes pbd-shake{0%,72%,100%{transform:translateX(0)}78%{transform:translateX(-4px)}84%{transform:translateX(4px)}90%{transform:translateX(-2px)}}

/* the words */
.pbd__body{padding:16px 18px 20px}
.pbd__time{margin:0;font-family:'Fredoka',sans-serif;font-weight:700;font-size:clamp(22px,6vw,30px);line-height:1.1;color:${ORANGE}}
.pbd__stitle{margin:6px 0 0;font-family:'Fredoka',sans-serif;font-weight:700;font-size:clamp(17px,4.4vw,21px);line-height:1.25;color:${NAVY}}
.pbd__text{margin:9px 0 0;font-size:15px;line-height:1.6;color:#2A3C55}
.pbd__chip{margin:12px 0 0;display:inline-flex;align-items:center;gap:7px;padding:8px 13px;border-radius:999px;background:#FFF4E5;border:1.5px solid #E0A93B;color:#8A5A12;font-weight:700;font-size:13px;line-height:1.3}

/* The summary. Everything here is a little tighter than a scene card: with the stats,
   the adult line, the cost line, two or three warnings, the disclaimer and two buttons,
   the card was taller than the stage and its buttons were cut in half at the fold. */
.pbd__scene--sum{background:#FFFFFF}
.pbd__scene--sum .pbd__body{padding:14px 18px 16px}
.pbd__scene--sum .pbd__stitle{font-size:clamp(16px,4vw,19px)}
.pbd__stats{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 2px}
.pbd__stat{flex:1 1 180px;display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:14px;background:#F3F7FC;border:1px solid #E1EAF5}
/* side by side, two of these do not fit on a narrow phone without the sentence
   breaking after every other word, so there they go one per row */
@media (max-width:460px){.pbd__stat{flex:1 1 100%}}
.pbd__stat b{font-family:'Fredoka',sans-serif;font-size:24px;line-height:1;color:${ORANGE}}
.pbd__stat span{font-size:13px;line-height:1.45;color:#2A3C55}
.pbd__flags{margin:12px 0 0;padding:11px 13px;border-radius:14px;background:#FFF4E5;border:1.5px solid #E0A93B;color:#7A4F10}
.pbd__flags h4{margin:0 0 6px;font-family:'Fredoka',sans-serif;font-size:14.5px}
.pbd__flags ul{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px}
.pbd__flags li{font-size:13.5px;line-height:1.5}
.pbd__good{margin:14px 0 0;padding:13px 15px;border-radius:16px;background:#E8F5EC;border:1.5px solid #76B98C;color:#1F5B35;font-weight:700;font-size:14.5px}
.pbd__disclaimer{margin:11px 0 0;font-size:12.5px;line-height:1.5;color:#5A6B82}
.pbd__sumbtns{display:flex;flex-wrap:wrap;gap:10px;margin:14px 0 0}
.pbd__cta{flex:1 1 170px;min-height:46px;padding:0 18px;border:0;border-radius:999px;background:${ORANGE};color:#FFFFFF;font:700 15px 'Satoshi',sans-serif;cursor:pointer}
.pbd__cta--ghost{background:#FFFFFF;color:${NAVY};border:1.5px solid ${NAVY}}

/* dots */
.pbd__dots{position:relative;flex:none;display:flex;flex-wrap:wrap;gap:6px;justify-content:center;padding:10px 16px 2px;background:${CREAM}}
/* a card taller than the stage fades out into this strip instead of being cut off dead */
.pbd__dots::before{content:'';position:absolute;left:0;right:0;bottom:100%;height:22px;background:linear-gradient(to top,${CREAM},rgba(251,248,244,0));pointer-events:none}
.pbd__dot{position:relative;width:26px;height:26px;padding:0;border:0;background:transparent;cursor:pointer}
.pbd__dot::before{content:'';position:absolute;left:50%;top:50%;width:9px;height:9px;margin:-4.5px 0 0 -4.5px;border-radius:50%;background:#D7CEC2;transition:background .2s,transform .2s}
.pbd__dot.is-done::before{background:#F5B98D}
.pbd__dot.is-on::before{background:${ORANGE};transform:scale(1.45)}

/* controls.
   The site stylesheet styles the bare <footer> element (brown background, pale text,
   40px padding) for the page footer. This is a <footer> inside a dialog, so every one of
   those has to be said again here or the control bar renders as a dark brown band. */
.pbd__foot{flex:none;display:flex;align-items:center;gap:8px;padding:6px 16px calc(14px + env(safe-area-inset-bottom));justify-content:center;background:${CREAM};color:${NAVY};text-align:left}
.pbd__ctrl{width:48px;height:48px;display:inline-flex;align-items:center;justify-content:center;border:1.5px solid ${NAVY};border-radius:50%;background:#FFFFFF;color:${NAVY};cursor:pointer}
.pbd__ctrl--play{background:${NAVY};color:#FFFFFF}
.pbd__ctrl:disabled{opacity:.35;cursor:default}
.pbd__skip{margin-left:4px;min-height:48px;padding:0 16px;display:inline-flex;align-items:center;gap:7px;border:1.5px solid ${NAVY};border-radius:999px;background:#FFFFFF;color:${NAVY};font:700 14px 'Satoshi',sans-serif;cursor:pointer}
.pbd__skip:disabled{opacity:.35;cursor:default}
@media (max-width:420px){.pbd__skip{padding:0 12px;font-size:13px}.pbd__ctrl{width:44px;height:44px}}

.pbd__x:focus-visible,.pbd__ctrl:focus-visible,.pbd__skip:focus-visible,.pbd__dot:focus-visible,.pbd__cta:focus-visible{outline:3px solid ${ORANGE};outline-offset:2px}
.pbd__panel.is-still .pbd__x:focus-visible{outline-color:${NAVY}}

.pbd__sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}

@media (prefers-reduced-motion:reduce){
  .pbd__scene{animation:none}
  .pbd__pic--happy .pbd__dog,.pbd__pic--calm .pbd__dog,.pbd__pic--tired .pbd__dog,.pbd__pic--worried .pbd__dog{animation:none}
  .pbd__zzz{animation:none;opacity:.75}
  .pbd__dot::before{transition:none}
}
.pbd__pic--still .pbd__dog{animation:none}
`;
