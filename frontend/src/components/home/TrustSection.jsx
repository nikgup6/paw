import React, { useEffect, useRef, useState } from 'react';

/* "Pitfalls in Choosing the Wrong Breed" — cream section with three
   illustrated cards.

   Layout
   - Mobile: cards stacked; each card = illustration on the left, icon + title +
     copy on the right.
   - Desktop (≥860px): three cards side by side; each card = icon + title +
     copy on top, illustration below.

   Each illustration is a fixed-aspect box: a soft blob, the dog photo (a
   transparent cut-out in /public/pitfalls/) and hand-drawn props. If a dog
   photo is missing it simply isn't shown — the blob and props still render.

   Motion: heading + cards rise in once when scrolled into view; then small
   idle loops (ball bounce, sun turn, heat shimmer, clock tick). All off under
   prefers-reduced-motion. */

const NAVY = '#011E4A';
const ORANGE = '#F5691A';

/* ── Card icons (orange line on a peach circle) ── */
const BoltIcon = () => (
  <svg viewBox="0 0 32 32" fill="none" stroke={ORANGE} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18.5 3.5L7.5 18h8l-2 10.5L24.5 14h-8l2-10.5Z" />
  </svg>
);
const SunIcon = () => (
  <svg viewBox="0 0 32 32" fill="none" stroke={ORANGE} strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
    <circle cx="16" cy="16" r="5.5" />
    <path d="M16 3.5v3.5M16 25v3.5M3.5 16H7M25 16h3.5M7.2 7.2l2.4 2.4M22.4 22.4l2.4 2.4M7.2 24.8l2.4-2.4M22.4 9.6l2.4-2.4" />
  </svg>
);
const AlarmIcon = () => (
  <svg viewBox="0 0 32 32" fill="none" stroke={ORANGE} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="16" cy="17.5" r="9" />
    <path d="M16 12.5v5.5h4" />
    <path d="M5 8.5a4.5 4.5 0 0 1 5.5-3M27 8.5a4.5 4.5 0 0 0-5.5-3M9.5 25.5 7.5 28M22.5 25.5l2 2.5" />
  </svg>
);

/* ── Illustration props ── */
const MotionArcs = ({ className }) => (
  <svg className={className} viewBox="0 0 40 40" fill="none" stroke={NAVY} strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
    <path d="M30 6C18 7 9 15 7 27" />
    <path d="M36 16c-8 1-14 6-16 14" />
  </svg>
);
const Dashes = ({ className }) => (
  <svg className={className} viewBox="0 0 30 30" fill="none" stroke={ORANGE} strokeWidth="3" strokeLinecap="round" aria-hidden="true">
    <path d="M10 3 7 13M24 12l-9 6" />
  </svg>
);
const Ball = ({ className }) => (
  <svg className={className} viewBox="0 0 40 40" aria-hidden="true">
    <circle cx="20" cy="20" r="17" fill={ORANGE} />
    <path d="M8 9c9 5 15 14 16 28" fill="none" stroke={NAVY} strokeWidth="4" />
    <path d="M12.5 6.5c8 6 13 14 15.5 28" fill="none" stroke="#FFFFFF" strokeWidth="3" />
    <circle cx="20" cy="20" r="17" fill="none" stroke="#D9550F" strokeWidth="1.5" />
  </svg>
);
const Sun = ({ className }) => (
  <svg className={className} viewBox="0 0 60 60" aria-hidden="true">
    <g className="pf__sun-rays" fill="none" stroke={ORANGE} strokeWidth="3" strokeLinecap="round">
      <path d="M30 4v7M30 49v7M4 30h7M49 30h7M11.6 11.6l5 5M43.4 43.4l5 5M11.6 48.4l5-5M43.4 16.6l5-5" />
    </g>
    <circle cx="30" cy="30" r="12" fill="#FDB43C" stroke={ORANGE} strokeWidth="2" />
  </svg>
);
const Heat = ({ className }) => (
  <svg className={className} viewBox="0 0 30 40" fill="none" stroke={ORANGE} strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
    <path d="M8 36c-5-5 5-9 0-15s5-10 0-17" />
    <path d="M20 36c-5-5 5-9 0-15s5-10 0-17" />
  </svg>
);
const Clock = ({ className }) => (
  <svg className={className} viewBox="0 0 60 60" aria-hidden="true">
    <circle cx="30" cy="30" r="26" fill="#FFFFFF" stroke={NAVY} strokeWidth="3.5" />
    <path d="M30 8v5M30 47v5M8 30h5M47 30h5" stroke={ORANGE} strokeWidth="3" strokeLinecap="round" />
    <path d="M30 30h11" stroke={NAVY} strokeWidth="3.5" strokeLinecap="round" />
    <path className="pf__clock-hand" d="M30 30V14" stroke={NAVY} strokeWidth="3.5" strokeLinecap="round" />
    <circle cx="30" cy="30" r="2.6" fill={ORANGE} />
  </svg>
);

const CARDS = [
  {
    key: 'energy',
    title: 'Energy Mismatch',
    desc: 'Active dogs in small apartments lead to frustration.',
    Icon: BoltIcon,
    img: '/pitfalls/energy.webp',
    blob: 'blue',
    props: (
      <>
        <MotionArcs className="pf__prop pf__arcs pf__arcs--top" />
        <MotionArcs className="pf__prop pf__arcs pf__arcs--low" />
        <Dashes className="pf__prop pf__dash pf__dash--energy" />
        <Ball className="pf__prop pf__ball" />
      </>
    ),
  },
  {
    key: 'climate',
    title: 'Climate Conflict',
    desc: 'Cold-weather breeds suffer in Indian summers.',
    Icon: SunIcon,
    img: '/pitfalls/climate.webp',
    blob: 'peach',
    props: (
      <>
        <Sun className="pf__prop pf__sun" />
        <Heat className="pf__prop pf__heat pf__heat--a" />
        <Heat className="pf__prop pf__heat pf__heat--b" />
      </>
    ),
  },
  {
    key: 'time',
    title: 'Time Constraints',
    desc: 'High-maintenance breeds need more time and attention.',
    Icon: AlarmIcon,
    img: '/pitfalls/time.webp',
    blob: 'blue',
    props: (
      <>
        <Clock className="pf__prop pf__clock" />
        <Dashes className="pf__prop pf__dash pf__dash--time" />
      </>
    ),
  },
];

/* Dog photo that quietly disappears if the file isn't there yet. */
const DogPhoto = ({ src, cardKey }) => {
  const [ok, setOk] = useState(true);
  if (!ok) return null;
  return (
    <img
      className={`pf__dog pf__dog--${cardKey}`}
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      draggable="false"
      onError={() => setOk(false)}
    />
  );
};

const TrustSection = () => {
  const sectionRef = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || typeof IntersectionObserver === 'undefined') { setInView(true); return; }
    const io = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) { setInView(true); io.disconnect(); } },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className={`pf ${inView ? 'is-in' : ''}`}>
      {/* background doodles */}
      <span className="pf__bg pf__bg--peach" aria-hidden="true" />
      <span className="pf__bg pf__bg--blue" aria-hidden="true" />
      <svg className="pf__deco pf__deco--squiggle" viewBox="0 0 300 130" aria-hidden="true">
        <path d="M-10 124c40-10 80-44 130-52s84 6 104 0 26-30 12-44-34 2-26 22 44 34 90 30" />
      </svg>
      <svg className="pf__deco pf__deco--loop" viewBox="0 0 120 80" aria-hidden="true">
        <path d="M2 22c10 4 20 16 20 30 0 12-14 16-16 6-3-12 20-20 40-14s40 14 72 6" />
      </svg>
      <svg className="pf__deco pf__deco--paw" viewBox="0 0 30 30" aria-hidden="true">
        <g transform="rotate(-14 15 15)">
          <ellipse cx="6" cy="10" rx="3.2" ry="4.1" />
          <ellipse cx="11.5" cy="4.6" rx="3.3" ry="4.3" />
          <ellipse cx="18.5" cy="4.6" rx="3.3" ry="4.3" />
          <ellipse cx="24" cy="10" rx="3.2" ry="4.1" />
          <path d="M15 13.5c-4.6 0-8.5 4.4-8.5 8.3 0 2.6 2 3.9 4.4 3.9 1.7 0 2.5-.8 4.1-.8s2.4.8 4.1.8c2.4 0 4.4-1.3 4.4-3.9 0-3.9-3.9-8.3-8.5-8.3Z" />
        </g>
      </svg>

      <div className="pf__inner">
        <header className="pf__head">
          <span className="pf__pill">Common pitfalls</span>
          <h2 className="pf__title">
            <span className="pf__title-dash-wrap">
              Pitfalls in Choosing
              <Dashes className="pf__title-dash" />
            </span>
            <span className="pf__title-accent">the Wrong Breed</span>
          </h2>
          <p className="pf__sub">
            Find your perfect match and avoid the heartbreak of mismatched expectations. A happy pup means a happy home!
          </p>
        </header>

        <div className="pf__grid">
          {CARDS.map(({ key, title, desc, Icon, img, blob, props }, i) => (
            <article key={key} className={`pf__card pf__card--${key}`} style={{ '--i': i }}>
              <div className="pf__text">
                <span className="pf__icon"><Icon /></span>
                <div className="pf__words">
                  <h3 className="pf__card-title">{title}</h3>
                  <p className="pf__card-desc">{desc}</p>
                </div>
              </div>
              <div className="pf__art" aria-hidden="true">
                <span className={`pf__blob pf__blob--${blob}`} />
                <DogPhoto src={img} cardKey={key} />
                {props}
              </div>
            </article>
          ))}
        </div>
      </div>

      <style>{`
        .pf {
          position: relative;
          overflow: hidden;
          background: var(--cream);
          padding: clamp(56px, 10vw, 88px) 16px clamp(56px, 9vw, 88px);
        }
        .pf__inner { position: relative; z-index: 1; max-width: 1180px; margin: 0 auto; }

        /* ── Heading ── */
        .pf__head { text-align: center; margin-bottom: clamp(28px, 6vw, 44px); }
        .pf__pill {
          display: none;              /* desktop only, per the design */
          margin-bottom: 14px;
          padding: 7px 22px;
          border-radius: 999px;
          background: #E4F0FB;
          color: ${NAVY};
          font-family: 'Satoshi', 'Inter', sans-serif;
          font-weight: 500;
          font-size: 14px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
        }
        .pf__title {
          margin: 0 0 14px;
          font-family: 'Fredoka', sans-serif;
          font-weight: 700;
          font-size: clamp(32px, 9vw, 60px);
          line-height: 1.08;
          letter-spacing: -0.01em;
          color: ${NAVY};
        }
        .pf__title-dash-wrap { position: relative; display: inline-block; }
        .pf__title-dash { position: absolute; right: -0.9em; top: -0.35em; width: 0.8em; }
        .pf__title-accent { display: block; color: ${ORANGE}; }
        .pf__sub {
          margin: 0 auto;
          max-width: 34ch;
          font-family: 'Satoshi', 'Inter', sans-serif;
          font-size: clamp(16px, 4.4vw, 19px);
          line-height: 1.55;
          color: #6E6259;
        }

        /* ── Cards (mobile: art left, text right) ── */
        .pf__grid { display: grid; gap: 16px; max-width: 520px; margin: 0 auto; }
        .pf__card {
          display: grid;
          grid-template-columns: 46% 1fr;
          grid-template-areas: "art text";
          align-items: center;
          gap: 10px;
          padding: 16px 16px 16px 10px;
          background: #FFFDFA;
          border-radius: 24px;
          box-shadow: 0 16px 40px rgba(61, 31, 0, 0.06), 0 1px 4px rgba(61, 31, 0, 0.04);
        }
        .pf__text { grid-area: text; }
        .pf__icon {
          width: 52px; height: 52px; border-radius: 50%;
          background: #FDE8DB;
          display: inline-flex; align-items: center; justify-content: center;
          margin-bottom: 10px;
          flex-shrink: 0;
        }
        .pf__icon svg { width: 28px; height: 28px; }
        .pf__card-title {
          margin: 0 0 6px;
          font-family: 'Fredoka', sans-serif;
          font-weight: 700;
          font-size: clamp(19px, 5.4vw, 24px);
          line-height: 1.15;
          color: ${NAVY};
        }
        .pf__card-desc {
          margin: 0;
          font-family: 'Satoshi', 'Inter', sans-serif;
          font-size: clamp(14px, 3.8vw, 16px);
          line-height: 1.5;
          color: #6E6259;
        }

        /* ── Illustration box ── */
        .pf__art { grid-area: art; position: relative; aspect-ratio: 1.3 / 1; }
        .pf__blob { position: absolute; inset: 10% 2% 6% 2%; z-index: 0; }
        .pf__blob--blue  { background: #E4F0FB; border-radius: 52% 48% 45% 55% / 55% 50% 50% 45%; }
        .pf__blob--peach { background: #FCE6D6; border-radius: 48% 52% 55% 45% / 50% 55% 45% 50%; }
        .pf__dog { position: absolute; z-index: 1; height: auto; user-select: none; pointer-events: none; }
        /* The running pup is a tall portrait, so it's sized by height; the two
           lying dogs are wide, so they're sized by width. */
        .pf__dog--energy  { left: 16%; bottom: 0;  height: 102%; width: auto; }
        .pf__dog--climate { left: 5%;  bottom: 3%; width: 86%; }
        .pf__dog--time    { right: 3%; bottom: 3%; width: 76%; }
        .pf__prop { position: absolute; z-index: 2; }
        .pf__arcs--top { left: 4%; top: 6%; width: 16%; }
        .pf__arcs--low { left: 2%; bottom: 20%; width: 13%; transform: rotate(180deg) scaleX(-1); }
        .pf__ball { right: 8%; bottom: 3%; width: 17%; }
        .pf__dash--energy { right: 16%; top: 38%; width: 12%; }
        .pf__sun { right: 4%; top: 0; width: 24%; }
        .pf__heat--a { right: 22%; top: 30%; width: 9%; }
        .pf__heat--b { right: 4%; bottom: 14%; width: 9%; }
        .pf__clock { left: 10%; top: 4%; width: 28%; }
        .pf__dash--time { right: 8%; top: 12%; width: 12%; }

        /* ── Background doodles ── */
        .pf__bg { position: absolute; pointer-events: none; }
        .pf__bg--peach { left: -80px; top: -40px; width: 240px; height: 280px; background: #FCEBDD; border-radius: 45% 55% 60% 40% / 50% 45% 55% 50%; opacity: 0.8; }
        .pf__bg--blue { right: -90px; top: 20px; width: 200px; height: 220px; background: #E4F0FB; border-radius: 55% 45% 50% 50% / 50% 55% 45% 50%; opacity: 0.8; }
        .pf__deco { position: absolute; pointer-events: none; fill: none; stroke: ${ORANGE}; stroke-width: 2.4; stroke-linecap: round; }
        .pf__deco--squiggle { display: none; left: 0; top: 190px; width: 280px; }
        .pf__deco--loop { display: none; right: 0; top: 280px; width: 110px; }
        .pf__deco--paw { display: none; right: 110px; top: 240px; width: 48px; fill: ${ORANGE}; stroke: none; }

        /* ── Desktop: three cards side by side, text on top, art below ── */
        @media (min-width: 860px) {
          .pf { padding: 72px 40px 96px; }
          .pf__pill { display: inline-block; }
          .pf__deco--squiggle, .pf__deco--loop, .pf__deco--paw { display: block; }
          .pf__sub { max-width: 44ch; }
          .pf__grid { grid-template-columns: repeat(3, 1fr); gap: 20px; max-width: none; }
          .pf__card {
            grid-template-columns: 1fr;
            grid-template-areas: "text" "art";
            align-items: start;
            gap: 18px;
            padding: 26px 24px 22px;
          }
          .pf__text { display: flex; align-items: flex-start; gap: 16px; }
          .pf__icon { width: 60px; height: 60px; margin-bottom: 0; }
          .pf__icon svg { width: 32px; height: 32px; }
          .pf__card-title { font-size: clamp(20px, 2vw, 26px); margin-top: 8px; }
          .pf__card-desc { font-size: 15.5px; }
          .pf__art { aspect-ratio: 1.45 / 1; }
        }

        /* ── Motion ── */
        /* translate/scale (not transform) so entrance never overrides hover lifts or the props' own tilt */
        @keyframes pf-rise { from { opacity: 0; translate: 0 22px; } to { opacity: 1; translate: 0 0; } }
        @keyframes pf-pop  { 0% { opacity: 0; scale: 0.6; } 70% { opacity: 1; scale: 1.06; } 100% { opacity: 1; scale: 1; } }
        @keyframes pf-bounce { 0%, 100% { transform: translateY(0); } 45% { transform: translateY(-16%); } 60% { transform: translateY(0); } 75% { transform: translateY(-5%); } }
        @keyframes pf-spin   { to { transform: rotate(360deg); } }
        @keyframes pf-shimmer { 0%, 100% { opacity: 0.35; transform: translateY(2px); } 50% { opacity: 1; transform: translateY(-2px); } }
        @keyframes pf-tick   { to { transform: rotate(360deg); } }

        .pf__head, .pf__card { opacity: 0; }
        .pf.is-in .pf__head { animation: pf-rise 500ms ease-out forwards; }
        .pf.is-in .pf__card { animation: pf-rise 550ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards; animation-delay: calc(180ms + var(--i) * 140ms); }
        .pf__dog { opacity: 0; }
        .pf.is-in .pf__dog { animation: pf-rise 600ms ease-out forwards; animation-delay: calc(420ms + var(--i) * 140ms); }
        .pf__prop { opacity: 0; }
        .pf.is-in .pf__prop { animation: pf-pop 450ms cubic-bezier(0.34, 1.4, 0.64, 1) forwards; animation-delay: calc(650ms + var(--i) * 140ms); }

        /* idle loops (start after the entrance) */
        .pf.is-in .pf__ball { animation: pf-pop 450ms cubic-bezier(0.34, 1.4, 0.64, 1) 650ms forwards, pf-bounce 1.6s ease-in-out 1.3s infinite; }
        .pf.is-in .pf__sun-rays { transform-box: fill-box; transform-origin: center; animation: pf-spin 18s linear infinite; }
        .pf.is-in .pf__heat { animation: pf-pop 450ms ease-out calc(650ms + var(--i) * 140ms) forwards, pf-shimmer 2.2s ease-in-out 1.5s infinite; }
        .pf.is-in .pf__heat--b { animation-delay: calc(650ms + var(--i) * 140ms), 2.3s; }
        .pf.is-in .pf__clock-hand { transform-box: view-box; transform-origin: 30px 30px; animation: pf-tick 12s steps(60) infinite; }

        @media (hover: hover) {
          .pf__card { transition: transform 200ms ease-out, box-shadow 200ms ease-out; }
          .pf__card:hover { transform: translateY(-4px); box-shadow: 0 22px 48px rgba(61, 31, 0, 0.09), 0 2px 6px rgba(61, 31, 0, 0.05); }
        }

        @media (prefers-reduced-motion: reduce) {
          .pf__head, .pf__card, .pf__dog, .pf__prop { opacity: 1 !important; animation: none !important; }
          .pf__sun-rays, .pf__clock-hand { animation: none !important; }
          .pf__card { transition: none; }
        }
      `}</style>
    </section>
  );
};

export default TrustSection;
