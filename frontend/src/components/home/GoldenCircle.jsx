import React, { useState, useRef, useEffect, useId } from 'react';

/* PAW BUDDY "Why / How / What" — cream section below the hero.

   Layout
   - Mobile: tabs → headline + supporting copy → illustrated stage.
   - Desktop (≥860px): stage on the left, tabs + copy on the right.

   The stage is a fixed-aspect box (width : height = 100 : 94) so every piece —
   the lying golden retriever, the three outcome bubbles, their arrows and the
   doodles — keeps its exact position at any width. Text inside the bubbles is
   sized in container units (cqw), so it scales with the stage too.

   Motion (all once, when the section scrolls into view): the dog rises in, the
   bubbles pop in one after another and then float gently, the arrows draw
   themselves, the doodles pop last. Everything is static under
   prefers-reduced-motion. */

const NAVY = '#011E4A';
const ORANGE = '#F5691A';

const TABS = [
  {
    key: 'why',
    label: 'Why',
    head: "Thousands of Indian families bring home the wrong dog — and don't find out until it's too late.",
    body: 'We started Paw Buddy so no first-time dog parent has to go through that. The right breed, the right guidance, and the right support — for a happier life together.',
  },
  {
    key: 'how',
    label: 'How',
    head: 'We match you to a dog that fits your real life — not just the one that looks cute.',
    body: 'Our lifestyle-matching engine asks the right questions — home, schedule, activity, budget — then connects you to a vet-verified breeder for your exact match.',
  },
  {
    key: 'what',
    label: 'What',
    head: "India's first lifestyle-matching platform for first-time dog owners.",
    body: 'A short quiz, your best-fit breeds, and a verified breeder — all in one place, so you bring home the right dog with confidence.',
  },
];

const tabFor = (key) => TABS.find((t) => t.key === key) || TABS[0];

/* ── Bubble icons (navy line + one orange accent) ── */
const HouseIcon = () => (
  <svg viewBox="0 0 32 32" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M8 14v12h16V14" stroke={NAVY} strokeWidth="2.2" />
    <path d="M13.5 26v-6.2h5V26" stroke={NAVY} strokeWidth="2.2" />
    <path d="M21.5 9V5.8H24v5.4" stroke={NAVY} strokeWidth="2.2" />
    <path d="M4.5 15.5L16 5.8l11.5 9.7" stroke={ORANGE} strokeWidth="2.6" />
  </svg>
);

const DogIcon = () => (
  <svg viewBox="0 0 32 32" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 12.5c0-4 2.7-6.8 6-6.8s6 2.8 6 6.8v5.3c0 3.7-2.7 6.4-6 6.4s-6-2.7-6-6.4z" stroke={NAVY} strokeWidth="2" />
    <path d="M10.3 10.4C7 8.4 3.6 10.4 4.1 16c.3 3.2 1.9 5.4 4.4 6" stroke={NAVY} strokeWidth="2" />
    <path d="M21.7 10.4c3.3-2 6.7 0 6.2 5.6-.3 3.2-1.9 5.4-4.4 6" stroke={NAVY} strokeWidth="2" />
    <circle cx="13.6" cy="14.3" r="1" fill={NAVY} />
    <circle cx="18.4" cy="14.3" r="1" fill={NAVY} />
    <path d="M14.6 17.6h2.8L16 19.2z" fill={NAVY} />
    <path d="M14.6 20.6c0 1.9.6 3 1.4 3s1.4-1.1 1.4-3z" fill={ORANGE} />
  </svg>
);

const PeopleIcon = () => (
  <svg viewBox="0 0 32 32" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="14" cy="10" r="3.3" stroke={NAVY} strokeWidth="2" />
    <circle cx="23" cy="10" r="3.3" stroke={NAVY} strokeWidth="2" />
    <path d="M9 25c0-4.4 2.2-7 5-7s5 2.6 5 7M18 25c0-4.4 2.2-7 5-7s5 2.6 5 7" stroke={NAVY} strokeWidth="2" />
    <circle cx="6.5" cy="14" r="2.5" fill={ORANGE} />
    <path d="M3.2 25c0-3.4 1.4-5.6 3.3-5.6" stroke={ORANGE} strokeWidth="2" />
  </svg>
);

const BUBBLES = [
  { key: 'parents', lines: ['Better', 'Dog Parents'], Icon: HouseIcon, tone: 'blue' },
  { key: 'dogs', lines: ['Happier', 'Dogs'], Icon: DogIcon, tone: 'peach' },
  { key: 'communities', lines: ['Healthier', 'Communities'], Icon: PeopleIcon, tone: 'green' },
];

const GoldenCircle = () => {
  const [active, setActive] = useState('why');           // default active tab
  const [shown, setShown] = useState('why');              // copy currently displayed
  const [fading, setFading] = useState(false);
  const [inView, setInView] = useState(false);

  const uid = useId().replace(/:/g, '');
  const arrowId = `gc-arrow-${uid}`;
  const panelId = `gc-panel-${uid}`;

  const sectionRef = useRef(null);
  const fadeTimer = useRef(0);
  const reduceRef = useRef(
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  // Entrance: fire once when the section scrolls into view.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    if (reduceRef.current || typeof IntersectionObserver === 'undefined') { setInView(true); return; }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) { setInView(true); io.disconnect(); }
      },
      { threshold: 0.2 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => () => clearTimeout(fadeTimer.current), []);

  const selectTab = (key) => {
    if (key === active) return;
    setActive(key);

    if (reduceRef.current) { setShown(key); return; }

    // Crossfade: fade the current copy out, swap only once it's invisible,
    // then fade the new copy in.
    clearTimeout(fadeTimer.current);
    setFading(true);
    fadeTimer.current = window.setTimeout(() => {
      setShown(key);
      setFading(false);
    }, 200);
  };

  const current = tabFor(shown);

  return (
    <section ref={sectionRef} className={`gc ${inView ? 'is-in' : ''}`}>
      <div className="gc__inner">
        {/* ── Tabs + copy ── */}
        <div className="gc__content">
          <div className="gc__tabs" role="tablist" aria-label="Why, how and what">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active === t.key}
                aria-controls={panelId}
                className={`gc__tab ${active === t.key ? 'is-active' : ''}`}
                onClick={() => selectTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* All three copies are stacked invisibly in the same grid cell, so the
              panel is always exactly as tall as the longest one — no layout jump
              when switching tabs. The live copy sits on top and crossfades. */}
          <div className="gc__panel" id={panelId} role="tabpanel">
            {TABS.map((t) => (
              <div key={t.key} className="gc__copy gc__copy--sizer" aria-hidden="true">
                <h2 className="gc__head">{t.head}</h2>
                <p className="gc__body">{t.body}</p>
              </div>
            ))}
            <div className={`gc__copy gc__copy--live ${fading ? 'is-fading' : ''}`} aria-live="polite">
              <h2 className="gc__head">{current.head}</h2>
              <p className="gc__body">{current.body}</p>
            </div>
          </div>
        </div>

        {/* ── Illustrated stage ── */}
        <div
          className="gc__stage"
          role="img"
          aria-label="Paw Buddy leads to better dog parents, happier dogs and healthier communities."
        >
          {/* soft background blobs */}
          <span className="gc__bg gc__bg--left" aria-hidden="true" />
          <span className="gc__bg gc__bg--right" aria-hidden="true" />

          <img
            className="gc__dog"
            src="/why-dog.webp"
            alt=""
            width="900"
            height="604"
            loading="lazy"
            decoding="async"
            draggable="false"
          />

          {/* Outcome bubbles: outer element pops in, inner element floats. */}
          {BUBBLES.map(({ key, lines, Icon, tone }) => (
            <div key={key} className={`gc__bubble gc__bubble--${key}`} aria-hidden="true">
              <div className={`gc__bubble-body gc__bubble-body--${tone}`}>
                <span className="gc__bubble-icon"><Icon /></span>
                <span className="gc__bubble-text">
                  {lines[0]}<br />{lines[1]}
                </span>
              </div>
            </div>
          ))}

          {/* Arrows + doodles, drawn in the stage's own 1000 × 940 space
              (same aspect as the stage, so curves never distort). */}
          <svg className="gc__lines" viewBox="0 0 1000 940" aria-hidden="true">
            <defs>
              <marker
                id={arrowId}
                viewBox="0 0 10 10"
                refX="7"
                refY="5"
                markerUnits="userSpaceOnUse"
                markerWidth="20"
                markerHeight="20"
                orient="auto-start-reverse"
              >
                <path d="M1.5 1.5 L7.5 5 L1.5 8.5" fill="none" stroke={NAVY} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </marker>
            </defs>

            {/* Each arrow's line draws itself; its heads fade in with it. */}
            <g className="gc__arrow gc__arrow--1">
              <path className="gc__arrow-line" pathLength="1" d="M522 254 C 546 272, 508 288, 514 308" />
              <path className="gc__arrow-heads" d="M522 254 C 546 272, 508 288, 514 308" markerStart={`url(#${arrowId})`} markerEnd={`url(#${arrowId})`} />
            </g>
            <g className="gc__arrow gc__arrow--2">
              <path className="gc__arrow-line" pathLength="1" d="M200 392 C 196 424, 228 424, 234 416 C 242 404, 222 400, 224 416 C 226 430, 244 438, 266 440" />
              <path className="gc__arrow-heads" d="M200 392 C 196 424, 228 424, 234 416 C 242 404, 222 400, 224 416 C 226 430, 244 438, 266 440" markerStart={`url(#${arrowId})`} markerEnd={`url(#${arrowId})`} />
            </g>
            <g className="gc__arrow gc__arrow--3">
              <path className="gc__arrow-line" pathLength="1" d="M846 396 C 850 424, 824 442, 790 448" />
              <path className="gc__arrow-heads" d="M846 396 C 850 424, 824 442, 790 448" markerStart={`url(#${arrowId})`} markerEnd={`url(#${arrowId})`} />
            </g>

            <g className="gc__dashes">
              <path d="M660 10 L644 52 M704 32 L672 56" />
              <path d="M372 224 L356 266 M404 262 L380 282" />
              <path d="M884 384 L900 420 M950 376 L938 416" />
            </g>

            <path
              className="gc__squiggle"
              pathLength="1"
              d="M1010 610 C 970 650, 1000 760, 940 792 C 892 818, 862 766, 832 826 C 812 866, 790 906, 760 950"
            />
          </svg>

          <svg className="gc__heart" viewBox="0 0 32 32" aria-hidden="true">
            <path d="M16 27s-10-6.2-10-13.2A5.6 5.6 0 0 1 16 10a5.6 5.6 0 0 1 10 3.8C26 20.8 16 27 16 27z" />
          </svg>
          <svg className="gc__paw" viewBox="0 0 30 30" aria-hidden="true">
            <g transform="rotate(-10 15 15)">
            <ellipse cx="6" cy="10" rx="3.2" ry="4.1" />
            <ellipse cx="11.5" cy="4.6" rx="3.3" ry="4.3" />
            <ellipse cx="18.5" cy="4.6" rx="3.3" ry="4.3" />
            <ellipse cx="24" cy="10" rx="3.2" ry="4.1" />
            <path d="M15 13.5c-4.6 0-8.5 4.4-8.5 8.3 0 2.6 2 3.9 4.4 3.9 1.7 0 2.5-.8 4.1-.8s2.4.8 4.1.8c2.4 0 4.4-1.3 4.4-3.9 0-3.9-3.9-8.3-8.5-8.3Z" />
            </g>
          </svg>
        </div>
      </div>

      <style>{`
        .gc {
          position: relative;
          background: var(--cream);   /* same cream as the stats section below */
          padding: clamp(28px, 6vw, 64px) 20px 0;   /* no bottom padding: the dog rests on the section edge */
          font-family: 'Satoshi', 'Inter', sans-serif;
          overflow: hidden;
        }
        .gc__inner {
          max-width: 1180px;
          margin: 0 auto;
          display: grid;
          grid-template-areas: "content" "stage";
          gap: clamp(18px, 4vw, 32px);
        }

        /* ── Content (tabs + copy) ── */
        .gc__content { grid-area: content; width: 100%; max-width: 520px; justify-self: center; }

        .gc__tabs { display: flex; gap: 12px; margin-bottom: clamp(22px, 5vw, 32px); }
        .gc__tab {
          flex: 1;
          min-height: 48px;
          padding: 0 8px;
          border-radius: 999px;
          background: transparent;
          border: 1.5px solid ${NAVY};
          color: ${NAVY};
          font-family: 'Satoshi', 'Inter', sans-serif;
          font-weight: 500;
          font-size: clamp(16px, 4.2vw, 17px);
          cursor: pointer;
          transition: background-color 150ms ease, color 150ms ease, transform 90ms ease-out;
          -webkit-tap-highlight-color: transparent;
        }
        .gc__tab.is-active { background: ${NAVY}; color: #FFFFFF; }
        .gc__tab:active { transform: scale(0.97); }
        .gc__tab:focus-visible { outline: 2px solid ${ORANGE}; outline-offset: 2px; }

        .gc__panel { display: grid; text-align: left; }
        .gc__copy { grid-area: 1 / 1; }
        .gc__copy--sizer { visibility: hidden; }
        .gc__copy--live { transition: opacity 200ms ease; opacity: 1; }
        .gc__copy--live.is-fading { opacity: 0; }
        .gc__head {
          margin: 0 0 14px;
          font-family: 'Satoshi', 'Inter', sans-serif;
          font-weight: 700;
          font-size: clamp(24px, 6.6vw, 30px);
          line-height: 1.2;
          letter-spacing: -0.015em;
          color: ${NAVY};
        }
        .gc__body {
          margin: 0;
          font-family: 'Satoshi', 'Inter', sans-serif;
          font-weight: 400;
          font-size: clamp(16px, 4.3vw, 18px);
          line-height: 1.55;
          color: #6B7486;
        }

        /* ── Stage ── */
        .gc__stage {
          grid-area: stage;
          position: relative;
          container-type: inline-size;
          width: calc(100% + 40px);        /* phones: bleed edge to edge */
          margin: 0 -20px;
          aspect-ratio: 100 / 94;
          justify-self: center;
        }
        .gc__bg { position: absolute; display: block; pointer-events: none; }
        .gc__bg--left {
          left: -8%; top: 2%; width: 44%; height: 70%;
          background: #FCEBDD;
          border-radius: 46% 54% 58% 42% / 50% 42% 58% 50%;
          opacity: 0.85;
        }
        .gc__bg--right {
          right: -10%; bottom: -6%; width: 36%; height: 48%;
          background: #FCEBDD;
          border-radius: 58% 42% 0 0 / 60% 55% 0 0;
          opacity: 0.8;
        }
        .gc__dog {
          position: absolute;
          left: -3%;
          top: 32%;
          width: 95%;
          height: auto;
          z-index: 1;
          user-select: none;
          pointer-events: none;
        }

        /* Bubbles — positions/sizes are % of the stage. */
        .gc__bubble { position: absolute; z-index: 2; }
        .gc__bubble--parents     { left: 34.5%; top: 0.5%;  width: 31%; }
        .gc__bubble--dogs        { left: 4.5%;  top: 14%;   width: 26%; }
        .gc__bubble--communities { left: 66%;   top: 13.5%; width: 29.5%; }
        .gc__bubble-body {
          aspect-ratio: 1.3 / 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1.2cqw;
          text-align: center;
          padding: 2cqw;
        }
        .gc__bubble-body--blue  { background: #E4F0FB; border-radius: 55% 45% 50% 50% / 55% 50% 50% 45%; }
        .gc__bubble-body--peach { background: #FBE8DB; border-radius: 48% 52% 45% 55% / 52% 48% 55% 45%; aspect-ratio: 1.05 / 1; }
        .gc__bubble-body--green { background: #E5EEDD; border-radius: 52% 48% 55% 45% / 50% 55% 45% 50%; aspect-ratio: 1.15 / 1; }
        .gc__bubble-icon { width: 9cqw; max-width: 60px; display: block; }
        .gc__bubble-icon svg { display: block; width: 100%; height: auto; }
        .gc__bubble-text {
          font-family: 'Caveat', 'Segoe Print', cursive;
          font-weight: 600;
          font-size: 4.9cqw;
          line-height: 1.02;
          color: ${NAVY};
          transform: rotate(-4deg);
        }

        /* Arrows + doodles overlay */
        .gc__lines {
          position: absolute; inset: 0; width: 100%; height: 100%;
          overflow: visible; z-index: 3; pointer-events: none;
        }
        .gc__arrow-line, .gc__arrow-heads { fill: none; stroke: ${NAVY}; stroke-width: 3; stroke-linecap: round; }
        .gc__arrow-heads { stroke: transparent; }   /* only its markers show */
        .gc__dashes path { fill: none; stroke: ${ORANGE}; stroke-width: 5; stroke-linecap: round; }
        .gc__squiggle { fill: none; stroke: ${ORANGE}; stroke-width: 3.5; stroke-linecap: round; }
        .gc__heart {
          position: absolute; left: 6.5%; top: 43%; width: 6%; z-index: 3;
          fill: none; stroke: ${ORANGE}; stroke-width: 2.2; stroke-linejoin: round;
          transform: rotate(-12deg);
        }
        .gc__paw {
          position: absolute; left: 85%; top: 71%; width: 7.5%; z-index: 3;
          fill: ${ORANGE};
        }

        /* ── Desktop: stage left, copy right ── */
        @media (min-width: 860px) {
          .gc { padding: 56px 40px 0; }
          .gc__inner {
            grid-template-columns: 1.15fr 1fr;
            grid-template-areas: "stage content";
            align-items: center;
            column-gap: clamp(32px, 5vw, 72px);
          }
          .gc__stage { width: 100%; max-width: 640px; margin: 0; align-self: end; }
          .gc__content { max-width: 500px; justify-self: start; padding-bottom: 56px; }
          .gc__head { font-size: clamp(28px, 2.6vw, 36px); }
          .gc__body { font-size: 17px; }
        }

        /* ── Entrance ── */
        @keyframes gc-rise   { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
        @keyframes gc-dog-in { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: none; } }
        @keyframes gc-pop    { 0% { opacity: 0; transform: scale(0.55); } 70% { opacity: 1; transform: scale(1.05); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes gc-draw   { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
        @keyframes gc-fade   { from { opacity: 0; } to { opacity: 1; } }
        @keyframes gc-float  { from { transform: translateY(0); } to { transform: translateY(-6px); } }

        .gc__tabs, .gc__panel, .gc__dog, .gc__bubble, .gc__arrow-heads,
        .gc__dashes, .gc__heart, .gc__paw { opacity: 0; }
        .gc__arrow-line, .gc__squiggle { stroke-dasharray: 1; stroke-dashoffset: 1; }

        .gc.is-in .gc__tabs  { animation: gc-rise 400ms ease-out forwards; }
        .gc.is-in .gc__panel { animation: gc-rise 400ms ease-out 100ms forwards; }
        .gc.is-in .gc__dog   { animation: gc-dog-in 650ms cubic-bezier(0.2, 0.8, 0.2, 1) 150ms forwards; }

        .gc.is-in .gc__bubble { animation: gc-pop 520ms cubic-bezier(0.34, 1.4, 0.64, 1) forwards; transform-origin: 50% 80%; }
        .gc.is-in .gc__bubble--parents     { animation-delay: 350ms; }
        .gc.is-in .gc__bubble--dogs        { animation-delay: 500ms; }
        .gc.is-in .gc__bubble--communities { animation-delay: 650ms; }

        .gc.is-in .gc__arrow-line  { animation: gc-draw 520ms ease-out forwards; }
        .gc.is-in .gc__arrow-heads { animation: gc-fade 200ms ease-out forwards; }
        .gc.is-in .gc__arrow--1 > * { animation-delay: 800ms; }
        .gc.is-in .gc__arrow--2 > * { animation-delay: 950ms; }
        .gc.is-in .gc__arrow--3 > * { animation-delay: 1100ms; }

        .gc.is-in .gc__dashes, .gc.is-in .gc__heart { animation: gc-fade 400ms ease-out 1100ms forwards; }
        .gc.is-in .gc__squiggle { animation: gc-draw 900ms ease-out 1150ms forwards; }
        .gc.is-in .gc__paw { animation: gc-pop 480ms cubic-bezier(0.34, 1.4, 0.64, 1) 1350ms forwards; }

        /* Idle: bubbles bob gently, each on its own rhythm. */
        .gc.is-in .gc__bubble-body { animation: gc-float 3.6s ease-in-out 1.4s infinite alternate; }
        .gc.is-in .gc__bubble--dogs .gc__bubble-body        { animation-duration: 4.2s; animation-delay: 1.6s; }
        .gc.is-in .gc__bubble--communities .gc__bubble-body { animation-duration: 3.9s; animation-delay: 1.9s; }

        @media (prefers-reduced-motion: reduce) {
          .gc__tabs, .gc__panel, .gc__dog, .gc__bubble, .gc__arrow-heads,
          .gc__dashes, .gc__heart, .gc__paw {
            opacity: 1 !important; animation: none !important;
          }
          .gc__arrow-line, .gc__squiggle { stroke-dasharray: none !important; stroke-dashoffset: 0 !important; animation: none !important; }
          .gc__bubble-body { animation: none !important; }
          .gc__copy--live, .gc__tab { transition: none; }
        }
      `}</style>
    </section>
  );
};

export default GoldenCircle;
