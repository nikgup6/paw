import React, { useEffect, useRef, useState } from 'react';

/* "Join thousands of puppy lovers" — cream section with a white card, three
   stats that count up the first time the section scrolls into view, a golden
   retriever peeking out from below (phone) / beside (desktop) the card, and a
   few hand-drawn doodles. All doodles are decorative (aria-hidden). */

const ORANGE = '#F5691A';

const STATS = [
  { value: 23, suffix: '', label: 'Breeds analysed', tone: 'orange', Icon: () => <DogFaceIcon /> },
  { value: 500, suffix: '+', label: 'Recommendations', tone: 'blue', Icon: () => <DocIcon /> },
  { value: 100, suffix: '%', label: 'Indian Specific', tone: 'green', Icon: () => <IndiaIcon /> },
];

/* ── Stat icons ── */
const DogFaceIcon = () => (
  <svg width="30" height="30" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 12.5c0-4 2.7-6.8 6-6.8s6 2.8 6 6.8v5.3c0 3.7-2.7 6.4-6 6.4s-6-2.7-6-6.4z" />
    <path d="M10.3 10.4C7 8.4 3.6 10.4 4.1 16c.3 3.2 1.9 5.4 4.4 6" />
    <path d="M21.7 10.4c3.3-2 6.7 0 6.2 5.6-.3 3.2-1.9 5.4-4.4 6" />
    <circle cx="13.6" cy="14.6" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="18.4" cy="14.6" r="0.9" fill="currentColor" stroke="none" />
    <path d="M14.7 18.4h2.6L16 19.9z" fill="currentColor" />
    <path d="M16 19.9v1.2M14 21.6c1.1.8 2.9.8 4 0" />
  </svg>
);

const DocIcon = () => (
  <svg width="30" height="30" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="8.5" y="5.5" width="15" height="21" rx="2.6" />
    <path d="M12.3 11.5h7.4M12.3 15.8h7.4M12.3 20.1h5" />
  </svg>
);

/* Simplified outline of India — reads as the country at icon size. */
const IndiaIcon = () => (
  <svg width="30" height="30" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M15 3.5l3.5 1-.5 2.5 2.5 2-.5 2 3 1.3 3.5-.3 2-1 .5 2.5-2.5 1-1 1.5-1.5-.5-1.5 2-2 2.5-2 2.5-1.5 3.5-1.2 3-1.2-2.5-1.3-4-1.1-3-.7-1.7-2-.6-2-1 1-1.4-2-.8 1.3-1.5 2.2-.7 1-2.3 2-1.3-.4-2.2z" />
  </svg>
);

/* ── Count-up: 0 → target with ease-out, once, when `start` flips true. ── */
function useCountUp(target, start, duration, delay) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!start) return;
    let raf = 0;
    let t0 = 0;
    const timer = window.setTimeout(() => {
      const tick = (now) => {
        if (!t0) t0 = now;
        const p = Math.min(1, (now - t0) / duration);
        const eased = 1 - Math.pow(1 - p, 3);          // easeOutCubic
        setN(Math.round(eased * target));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => { clearTimeout(timer); cancelAnimationFrame(raf); };
  }, [start, target, duration, delay]);
  return n;
}

const Stat = ({ stat, start, index, instant }) => {
  const counted = useCountUp(stat.value, start && !instant, 1300 + index * 150, index * 120);
  const shown = instant ? stat.value : counted;
  const Icon = stat.Icon;
  return (
    <div className="cs__stat">
      <span className={`cs__icon cs__icon--${stat.tone}`}><Icon /></span>
      {/* Screen readers get the final figure; the animated digits are visual only. */}
      <span className="cs__sr">{stat.value}{stat.suffix} {stat.label}</span>
      <span className="cs__num" aria-hidden="true">{shown}{stat.suffix}</span>
      <span className="cs__label" aria-hidden="true">{stat.label}</span>
    </div>
  );
};

const CommunitySection = () => {
  const sectionRef = useRef(null);
  const [inView, setInView] = useState(false);
  const reduce =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Start the count-up (and card entrance) the first time the stats are
  // meaningfully on screen. No IntersectionObserver → just show the numbers.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    if (reduce || typeof IntersectionObserver === 'undefined') { setInView(true); return; }
    const io = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) { setInView(true); io.disconnect(); } },
      { threshold: 0.35 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduce]);

  return (
    <section ref={sectionRef} className={`cs ${inView ? 'is-in' : ''}`}>
      {/* ── Background doodles ── */}
      <div className="cs__blob cs__blob--peach" aria-hidden="true" />
      <div className="cs__blob cs__blob--green" aria-hidden="true" />
      <svg className="cs__doodle cs__doodle--dash-top" viewBox="0 0 40 40" aria-hidden="true">
        <path d="M6 10l9 13M26 5l-1 15" />
      </svg>
      <svg className="cs__doodle cs__doodle--curl" viewBox="0 0 40 60" aria-hidden="true">
        <path d="M8 56C3 42 14 30 20 36s-6 12-9 2C9 30 18 16 32 6" />
      </svg>

      <div className="cs__inner">
        {/* ── Card ── */}
        <div className="cs__cardwrap">
          <div className="cs__card">
            <svg className="cs__heart" viewBox="0 0 32 32" aria-hidden="true">
              <path d="M16 27s-10-6.2-10-13.2A5.6 5.6 0 0 1 16 10a5.6 5.6 0 0 1 10 3.8C26 20.8 16 27 16 27z" />
            </svg>
            <h2 className="cs__title">
              Join thousands of puppy lovers creating{' '}
              <span className="cs__title-accent">happier homes.</span>
            </h2>
            <p className="cs__copy">
              Whether you're ready to adopt or just want to support our mission, there's a place for you in the Paw Buddy family.
            </p>
            <div className="cs__stats">
              {STATS.map((s, i) => (
                <Stat key={s.label} stat={s} index={i} start={inView} instant={reduce} />
              ))}
            </div>
          </div>
        </div>

        {/* ── Dog ── */}
        <div className="cs__dogwrap" aria-hidden="true">
          <div className="cs__blob cs__blob--dog" />
          <svg className="cs__doodle cs__doodle--dash-dog" viewBox="0 0 40 40">
            <path d="M16 4l-5 11M34 18l-11 8" />
          </svg>
          <svg className="cs__doodle cs__doodle--loop" viewBox="0 0 50 60">
            <path d="M4 52c16 3 27-9 21-17s-17 2-9 8c9 7 24-9 26-37" />
          </svg>
          <svg className="cs__paw" viewBox="0 0 30 30" fill={ORANGE}>
            <ellipse cx="6" cy="10" rx="3.2" ry="4.1" />
            <ellipse cx="11.5" cy="4.6" rx="3.3" ry="4.3" />
            <ellipse cx="18.5" cy="4.6" rx="3.3" ry="4.3" />
            <ellipse cx="24" cy="10" rx="3.2" ry="4.1" />
            <path d="M15 13.5c-4.6 0-8.5 4.4-8.5 8.3 0 2.6 2 3.9 4.4 3.9 1.7 0 2.5-.8 4.1-.8s2.4.8 4.1.8c2.4 0 4.4-1.3 4.4-3.9 0-3.9-3.9-8.3-8.5-8.3Z" />
          </svg>
          <img
            className="cs__dog"
            src="/community-dog.webp"
            alt=""
            width="720"
            height="875"
            loading="lazy"
            decoding="async"
            draggable="false"
          />
        </div>
      </div>

      <style>{`
        .cs {
          position: relative;
          overflow: hidden;
          background: var(--cream);
          padding: clamp(56px, 10vw, 88px) 16px 0;   /* no bottom padding: the dog sits on the section edge */
        }
        .cs__inner {
          position: relative;
          z-index: 1;
          max-width: 1120px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        /* ── Card ── */
        .cs__cardwrap { position: relative; z-index: 2; width: 100%; max-width: 460px; }
        .cs__card {
          position: relative;
          background: #FFFDFA;
          border-radius: 28px;
          padding: clamp(44px, 11vw, 56px) clamp(14px, 4.5vw, 40px) clamp(30px, 8vw, 44px);
          text-align: center;
          box-shadow: 0 24px 60px rgba(61, 31, 0, 0.08), 0 2px 8px rgba(61, 31, 0, 0.04);
        }
        .cs__title {
          margin: 0 0 16px;
          font-family: 'Fredoka', sans-serif;
          font-weight: 700;
          font-size: clamp(26px, 7.2vw, 42px);
          line-height: 1.12;
          letter-spacing: -0.01em;
          color: #2C1A0E;
        }
        .cs__title-accent { display: block; color: ${ORANGE}; }
        .cs__copy {
          margin: 0 auto 32px;
          max-width: 34ch;
          font-family: var(--font-body-family);
          font-size: clamp(16px, 4.4vw, 18px);
          line-height: 1.55;
          color: #6E6259;
        }
        .cs__stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 2px; }
        .cs__stat { display: flex; flex-direction: column; align-items: center; min-width: 0; }
        .cs__icon {
          width: clamp(54px, 15vw, 64px);
          height: clamp(54px, 15vw, 64px);
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 12px;
        }
        .cs__icon--orange { background: #FDE8DB; color: ${ORANGE}; }
        .cs__icon--blue   { background: #E3EEFA; color: #2F7FD1; }
        .cs__icon--green  { background: #E6ECDF; color: #5E7A45; }
        .cs__num {
          font-family: 'Fredoka', sans-serif;
          font-weight: 700;
          font-size: clamp(28px, 8vw, 40px);
          line-height: 1;
          color: ${ORANGE};
          font-variant-numeric: tabular-nums;
          margin-bottom: 8px;
        }
        .cs__label {
          font-family: var(--font-body-family);
          font-size: clamp(11px, 3.05vw, 15px);
          line-height: 1.3;
          color: #4A3B30;
          text-align: center;
          white-space: nowrap;
        }
        .cs__sr {
          position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
          overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
        }

        /* ── Dog (peeks out below the card on phones) ── */
        .cs__dogwrap {
          position: relative;
          z-index: 1;
          width: min(80%, 330px);
          margin-top: -14px;          /* head tucks just under the card edge */
        }
        .cs__dog { position: relative; z-index: 1; display: block; width: 100%; height: auto; }

        /* ── Doodles & blobs ── */
        .cs__blob { position: absolute; pointer-events: none; }
        .cs__blob--peach {
          top: -60px; left: -90px; width: 260px; height: 300px;
          background: #FBE4D5; opacity: 0.75;
          border-radius: 42% 58% 60% 40% / 45% 45% 55% 55%;
        }
        .cs__blob--green {
          top: 44%; right: -70px; width: 140px; height: 250px;
          background: #D9E1CB; opacity: 0.85;
          border-radius: 60% 40% 45% 55% / 50% 50% 50% 50%;
        }
        /* A big ellipse whose lower half is clipped by the section edge, so it
           reads as a soft rounded hill behind the dog. */
        .cs__blob--dog {
          left: -24%; right: -24%; top: 28%; bottom: -60%;
          background: #FCE3CE;
          border-radius: 50%;
          z-index: 0;
        }
        .cs__doodle { position: absolute; fill: none; stroke-linecap: round; stroke-linejoin: round; pointer-events: none; }
        .cs__doodle--dash-top { top: 18px; left: 22%; width: 44px; stroke: ${ORANGE}; stroke-width: 3; }
        .cs__doodle--curl { top: 47%; right: 2px; width: 38px; stroke: #55653D; stroke-width: 2.4; z-index: 1; }
        .cs__heart {
          position: absolute; top: 14px; right: 14px; width: clamp(32px, 9vw, 44px);
          fill: none; stroke: #F08A5D; stroke-width: 2.2; stroke-linejoin: round;
          transform: rotate(10deg);
        }
        .cs__doodle--dash-dog { top: 0; right: -4%; width: 44px; stroke: ${ORANGE}; stroke-width: 3; z-index: 2; }
        .cs__doodle--loop { bottom: 12%; right: -14%; width: 64px; stroke: ${ORANGE}; stroke-width: 2.4; z-index: 2; }
        .cs__paw { position: absolute; top: 8%; left: -8%; width: 40px; transform: rotate(-14deg); z-index: 2; }

        /* ── Desktop: card left, dog right ── */
        @media (min-width: 900px) {
          .cs { padding: 72px 40px 0; }
          .cs__inner {
            display: grid;
            grid-template-columns: 1.15fr 0.85fr;
            align-items: end;
            column-gap: 48px;
          }
          .cs__cardwrap { max-width: 600px; justify-self: end; margin-bottom: 72px; }
          .cs__card { padding: 56px 48px 44px; }
          .cs__dogwrap { width: 100%; max-width: 420px; margin-top: 0; justify-self: start; }
          .cs__blob--dog { left: -16%; right: -16%; top: 20%; bottom: -55%; }
          .cs__doodle--loop { right: -12%; }
          .cs__paw { left: -10%; }
          .cs__doodle--dash-top { left: 8%; }
          .cs__blob--green { top: 18%; right: -60px; }
          .cs__doodle--curl { top: 24%; right: 20px; }
        }

        /* ── Entrance: card rises in, dog follows ── */
        .cs__cardwrap, .cs__dogwrap { opacity: 0; transform: translateY(24px); transition: opacity 500ms ease-out, transform 500ms ease-out; }
        .cs__dogwrap { transition-delay: 150ms; }
        .cs.is-in .cs__cardwrap, .cs.is-in .cs__dogwrap { opacity: 1; transform: none; }

        @media (prefers-reduced-motion: reduce) {
          .cs__cardwrap, .cs__dogwrap { opacity: 1; transform: none; transition: none; }
        }
      `}</style>
    </section>
  );
};

export default CommunitySection;
