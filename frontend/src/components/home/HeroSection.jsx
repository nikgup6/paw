import React, { useRef, useEffect, useState } from 'react';
import { WHATSAPP_NUMBER } from '../../utils/whatsapp';

/* PAW BUDDY landing hero — mobile-first.
   Structure: orange header bar → hero (background video + dark overlay over a
   black fallback) → black marquee ticker. Bricolage Grotesque is used ONLY for
   the headline; everything else is Satoshi. Entrance is CSS (staggered
   fade+slide); the CTA shine, ticker marquee and video loop handle their own
   motion — all disabled/paused under prefers-reduced-motion. */
const HeroSection = ({
  onSelectFriendPath,
  onDogOwner,      // "My dashboard" — existing owners land in /app
  onMenu,          // hamburger → About
  user,
  onLogin,
  onProfile,
  onAdmin,
  onLogout,
}) => {
  const videoRef = useRef(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  /* Background video playback. The video stays fixed inside the hero (no
     parallax — moving it would uncover black edges). Under
     prefers-reduced-motion it's paused on its first frame instead of looping.
     Some mobile browsers (e.g. iOS Low Power Mode) refuse autoplay; that
     rejection is swallowed so the hero simply stays on its still frame / the
     black background, never an error. */
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      v.pause();
      return;
    }
    const p = v.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  }, []);

  // Close the account menu on Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const openWhatsApp = () =>
    window.open(
      `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Hi PAW BUDDY! I'd like to know more.")}`,
      '_blank',
      'noopener,noreferrer'
    );

  const run = (fn) => () => { setMenuOpen(false); fn && fn(); };

  const Paw = () => (
    <svg className="pbland__tick-paw" viewBox="0 0 24 24" width="11" height="11" aria-hidden="true">
      <g fill="currentColor">
        <ellipse cx="6.5" cy="8.5" rx="2.4" ry="3.1" />
        <ellipse cx="11" cy="5.6" rx="2.5" ry="3.3" />
        <ellipse cx="16.2" cy="6.4" rx="2.4" ry="3.1" />
        <ellipse cx="20" cy="10.6" rx="2.1" ry="2.7" />
        <path d="M12.4 12.2c3.1 0 5.9 2.3 5.9 5.1 0 2.2-1.9 3.4-4 3.4-1.2 0-1.6-.4-2.6-.4s-1.4.4-2.6.4c-2.1 0-4-1.2-4-3.4 0-2.8 2.8-5.1 5.9-5.1Z" />
      </g>
    </svg>
  );

  // One repeating unit of the marquee, duplicated for a seamless loop. Enough
  // phrases here that a single group is wider than the screen — so the track is
  // always full of text and never scrolls through an empty gap.
  const TICKER_PHRASES = [
    'Right breed, right start',
    'Built for Indian pet parents',
    'Vet-verified breeders',
    'Match in under 2 minutes',
    'Care tips made simple',
    'Find the dog that fits your life',
  ];
  const TickerGroup = ({ hidden }) => (
    <div className="pbland__ticker-group" aria-hidden={hidden || undefined}>
      {TICKER_PHRASES.map((phrase, i) => (
        <span className="pbland__tick" key={i}><Paw /> {phrase}</span>
      ))}
    </div>
  );

  return (
    <section className="pbland">
      {/* ── 1. HEADER (cream bar: round icon buttons, paw logo, light doodles) ── */}
      <header className="pbland__header">
        {/* Decorative doodles on their own clipped layer, so they never block
            taps and never clip the account dropdown. */}
        <div className="pbland__hdecor" aria-hidden="true">
          <span className="pbland__hblob pbland__hblob--peach" />
          <span className="pbland__hblob pbland__hblob--blue" />
          <svg className="pbland__hpaw" viewBox="0 0 30 30">
            <ellipse cx="6" cy="10" rx="3.2" ry="4.1" />
            <ellipse cx="11.5" cy="4.6" rx="3.3" ry="4.3" />
            <ellipse cx="18.5" cy="4.6" rx="3.3" ry="4.3" />
            <ellipse cx="24" cy="10" rx="3.2" ry="4.1" />
            <path d="M15 13.5c-4.6 0-8.5 4.4-8.5 8.3 0 2.6 2 3.9 4.4 3.9 1.7 0 2.5-.8 4.1-.8s2.4.8 4.1.8c2.4 0 4.4-1.3 4.4-3.9 0-3.9-3.9-8.3-8.5-8.3Z" />
          </svg>
          <svg className="pbland__hloop" viewBox="0 0 60 30">
            <path d="M2 24c8-1 12-4 16-9 4-5 3-11-1-11s-5 6-1 11c4 5 12 9 22 8" />
          </svg>
          <svg className="pbland__hdash" viewBox="0 0 40 30">
            <path d="M6 4l2 9M18 4l-5 9M34 10l-10 4" />
          </svg>
        </div>

        <button type="button" className="pbland__icon-btn" aria-label="Menu" onClick={onMenu}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h17" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </button>

        <span className="pbland__brand">
          <svg className="pbland__brand-paw" viewBox="0 0 30 30" aria-hidden="true">
            <ellipse cx="6" cy="10" rx="3.2" ry="4.1" />
            <ellipse cx="11.5" cy="4.6" rx="3.3" ry="4.3" />
            <ellipse cx="18.5" cy="4.6" rx="3.3" ry="4.3" />
            <ellipse cx="24" cy="10" rx="3.2" ry="4.1" />
            <path d="M15 13.5c-4.6 0-8.5 4.4-8.5 8.3 0 2.6 2 3.9 4.4 3.9 1.7 0 2.5-.8 4.1-.8s2.4.8 4.1.8c2.4 0 4.4-1.3 4.4-3.9 0-3.9-3.9-8.3-8.5-8.3Z" />
          </svg>
          <span className="pbland__word">PAW BUDDY</span>
        </span>

        <div className="pbland__actions">
          <button type="button" className="pbland__icon-btn" aria-label="Chat on WhatsApp" onClick={openWhatsApp}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
          </button>

          {/* Account menu: login / dashboard / profile / logout, context-aware. */}
          <div className="pbland__account">
            <button
              type="button"
              className="pbland__icon-btn"
              aria-label="Your account"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
                <path d="M4.5 20c0-3.3 3.4-6 7.5-6s7.5 2.7 7.5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>

            {menuOpen && (
              <>
                <div className="pbland__menu-backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" />
                <div className="pbland__menu" role="menu">
                  <button type="button" role="menuitem" className="pbland__menu-item" onClick={run(onMenu)}>About</button>
                  <button type="button" role="menuitem" className="pbland__menu-item" onClick={run(onLogin)}>Login</button>
                  <button type="button" role="menuitem" className="pbland__menu-item" onClick={run(openWhatsApp)}>Contact us</button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── 2. HERO (full-bleed video over a black fallback, content bottom-anchored) ── */}
      <div className="pbland__hero">
        {/* Layer 1 — background video. File lives at frontend/public/videos/hero-dog.mp4
            (served as /videos/hero-dog.mp4). Muted + playsInline so mobile
            browsers allow autoplay; decorative, so hidden from screen readers and
            never focusable or clickable. If it fails to load it's removed and the
            hero's black background shows instead. To add a poster later, drop an
            image at public/videos/hero-dog-poster.jpg and add
            poster="/videos/hero-dog-poster.jpg" here. */}
        {!videoFailed && (
          <video
            ref={videoRef}
            className="pbland__media"
            src="/videos/hero-dog.mp4"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            disablePictureInPicture
            disableRemotePlayback
            aria-hidden="true"
            tabIndex={-1}
            onError={() => setVideoFailed(true)}
          />
        )}

        {/* Layer 2 — cinematic overlay: darkest bottom-left where the headline and
            CTA sit, easing off toward the top-right so the footage still reads. */}
        <div className="pbland__scrim" aria-hidden="true" />

        <div className="pbland__content">
          <h1 className="pbland__headline">
            Find the dog<br />that fits your life.
          </h1>

          <div className="pbland__cta-wrap">
            <button type="button" className="pbland__cta" onClick={onSelectFriendPath}>
              <span>Find your match, now</span>
              <svg className="pbland__cta-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <p className="pbland__sub">
            Begin your match in <strong>under 2 minutes</strong>.
          </p>
        </div>
      </div>

      {/* ── 3. TICKER BAR (continuous marquee) ── */}
      <div className="pbland__ticker">
        <div className="pbland__ticker-track">
          <TickerGroup />
          <TickerGroup hidden />
        </div>
      </div>

      <style>{`
        .pbland {
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
          background: #000000;
          font-family: 'Satoshi', 'Inter', sans-serif;
        }

        /* ── Header ── */
        .pbland__header {
          flex: 0 0 auto;
          height: clamp(64px, 14vw, 76px);
          background: #FBF8F4;
          border-bottom: 1px solid #EFE8E0;
          box-shadow: 0 2px 10px rgba(61, 31, 0, 0.04);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 clamp(12px, 3.5vw, 32px);
          position: relative;
          z-index: 10;
        }

        /* Logo lockup, truly centred (the right side has two buttons, the left one). */
        .pbland__brand {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          display: inline-flex;
          align-items: center;
          gap: clamp(6px, 1.6vw, 10px);
          white-space: nowrap;
          pointer-events: none;
          z-index: 1;
        }
        .pbland__brand-paw { width: clamp(20px, 5.4vw, 30px); height: auto; fill: #F5691A; }
        .pbland__word {
          font-family: 'Satoshi', 'Inter', sans-serif;
          font-weight: 700;
          font-size: clamp(16px, 4.3vw, 22px);
          letter-spacing: 0.01em;
          color: #011E4A;
        }

        .pbland__actions { display: flex; align-items: center; gap: clamp(6px, 2vw, 14px); position: relative; z-index: 2; }
        .pbland__icon-btn {
          position: relative;
          z-index: 2;
          width: clamp(40px, 10.6vw, 44px);   /* ≥40px tap target on phones, 44px on larger screens */
          height: clamp(40px, 10.6vw, 44px);
          flex-shrink: 0;
          border-radius: 50%;
          background: #EFEBE7;
          border: none;
          padding: 0;
          cursor: pointer;
          color: #011E4A;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          box-shadow: inset 0 0 0 1px rgba(61, 31, 0, 0.03);
          transition: background-color 150ms ease, transform 90ms ease-out;
          -webkit-tap-highlight-color: transparent;
        }
        @media (hover: hover) { .pbland__icon-btn:hover { background: #E7E1DB; } }
        .pbland__icon-btn:active { transform: scale(0.94); }
        .pbland__icon-btn[aria-expanded="true"] { background: #E3DCD5; }
        .pbland__icon-btn:focus-visible {
          outline: 2px solid #F5691A;
          outline-offset: 2px;
        }

        /* Header doodles — clipped to the bar, never interactive. */
        .pbland__hdecor { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 0; }
        .pbland__hblob { position: absolute; display: block; }
        .pbland__hblob--peach {
          left: clamp(36px, 10vw, 72px); top: 0; bottom: -30%;
          width: clamp(58px, 14vw, 96px);
          background: #FBE6D8;
          border-radius: 60% 40% 0 0 / 50% 45% 0 0;
          opacity: 0.8;
        }
        .pbland__hblob--blue {
          right: -24px; bottom: -40%;
          width: clamp(70px, 16vw, 120px); height: 80%;
          background: #E3ECF7;
          border-radius: 60% 40% 0 0 / 60% 55% 0 0;
          opacity: 0.9;
        }
        .pbland__hpaw {
          position: absolute; left: clamp(70px, 18vw, 132px); top: 18%;
          width: clamp(14px, 3.4vw, 20px); fill: #F5691A; opacity: 0.85;
          transform: rotate(-12deg);
        }
        .pbland__hloop {
          position: absolute; left: clamp(82px, 21vw, 162px); bottom: 12%;
          width: clamp(34px, 8vw, 52px);
          fill: none; stroke: #F5691A; stroke-width: 2; stroke-linecap: round; opacity: 0.85;
        }
        .pbland__hdash {
          position: absolute; right: 4px; top: 4px;
          width: clamp(24px, 5vw, 34px);
          fill: none; stroke: #F5691A; stroke-width: 2.6; stroke-linecap: round;
        }
        /* On narrow phones the doodles would crowd the logo — keep just the blobs. */
        @media (max-width: 400px) {
          .pbland__hpaw, .pbland__hloop { display: none; }
        }
        /* Very small phones (≤340px): shrink the logo so it never meets the buttons. */
        @media (max-width: 340px) {
          .pbland__word { font-size: 14px; }
          .pbland__brand-paw { width: 17px; }
          .pbland__brand { gap: 5px; }
        }

        /* ── Account menu ── */
        .pbland__account { position: relative; display: inline-flex; }
        .pbland__menu-backdrop {
          position: fixed;
          inset: 0;
          z-index: 40;
          background: transparent;
        }
        .pbland__menu {
          position: absolute;
          top: calc(100% + 12px);
          right: 0;
          z-index: 50;
          min-width: 200px;
          background: #FFFFFF;
          border: 1px solid #EAEAEA;
          border-radius: 14px;
          box-shadow: 0 16px 40px rgba(1, 30, 74, 0.18);
          padding: 6px;
          font-family: 'Satoshi', 'Inter', sans-serif;
          animation: pbland-menu-in 140ms ease-out;
        }
        @keyframes pbland-menu-in {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .pbland__menu-head {
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 8px 12px 10px;
          border-bottom: 1px solid #F0F0F0;
          margin-bottom: 4px;
        }
        .pbland__menu-head strong { color: #011E4A; font-size: 14px; font-weight: 700; }
        .pbland__menu-head span { color: #7A8699; font-size: 12px; word-break: break-all; }
        .pbland__menu-item {
          display: block;
          width: 100%;
          text-align: left;
          background: none;
          border: none;
          padding: 10px 12px;
          border-radius: 9px;
          font-family: 'Satoshi', 'Inter', sans-serif;
          font-size: 14px;
          font-weight: 500;
          color: #011E4A;
          cursor: pointer;
        }
        .pbland__menu-item:hover { background: #F4F6FA; }
        .pbland__menu-item:focus-visible { outline: 2px solid #011E4A; outline-offset: -2px; }
        .pbland__menu-item--danger { color: #D0342C; }
        .pbland__menu-item--danger:hover { background: #FDECEA; }
        .pbland__menu-sep { height: 1px; background: #F0F0F0; margin: 4px 0; }

        /* ── Hero ── */
        .pbland__hero {
          flex: 1 1 auto;
          position: relative;
          background: #000000;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;   /* content bottom-anchored in lower third */
          padding: 24px;
          overflow: hidden;
        }
        .pbland__media {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;            /* fills the hero at any aspect, no distortion */
          object-position: center;
          z-index: 0;
          pointer-events: none;         /* never intercepts taps on the CTA/nav */
          user-select: none;
          display: block;
        }
        /* Two stacked gradients over the whole hero: a vertical one that deepens
           toward the bottom (where the headline/CTA sit) and a horizontal one that
           darkens the left edge — so text stays readable while the top-right of
           the footage stays visible. */
        .pbland__scrim {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.55) 38%, rgba(0,0,0,0.25) 70%, rgba(0,0,0,0.35) 100%),
            linear-gradient(to right, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 55%, rgba(0,0,0,0) 100%);
          z-index: 1;
          pointer-events: none;
        }
        .pbland__content {
          position: relative;
          z-index: 2;
          text-align: left;
        }

        /* Entrance: each child fades + slides up, staggered 100ms apart. */
        @keyframes pbland-enter {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .pbland__content > * {
          opacity: 0;
          animation: pbland-enter 400ms ease-out forwards;
        }
        .pbland__content > *:nth-child(1) { animation-delay: 0ms; }
        .pbland__content > *:nth-child(2) { animation-delay: 100ms; }
        .pbland__content > *:nth-child(3) { animation-delay: 200ms; }

        .pbland__headline {
          font-family: 'Bricolage Grotesque', 'Sora', sans-serif;
          font-weight: 800;
          color: #FFFFFF;
          font-size: clamp(30px, 8.5vw, 34px);
          line-height: 1.15;
          letter-spacing: -0.02em;
          margin: 0 0 16px;
        }
        .pbland__cta-wrap { margin: 0; }
        .pbland__cta {
          position: relative;
          overflow: hidden;               /* clip the shine sweep to the pill */
          isolation: isolate;
          width: 100%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: #F5691A;            /* orange */
          color: #000000;                /* text stays black */
          font-family: 'Satoshi', 'Inter', sans-serif;
          font-weight: 700;
          font-size: 16px;
          border: none;
          border-radius: 999px;
          padding: 14px 20px;
          cursor: pointer;
          transition: transform 180ms ease-out, box-shadow 180ms ease-out;
          will-change: transform;
          box-shadow: 0 6px 18px rgba(245, 105, 26, 0.35);
        }
        /* Text + arrow sit above the shine so they stay crisp black. */
        .pbland__cta > * { position: relative; z-index: 1; }
        /* Animated diagonal "shine" that sweeps across, then pauses, on a loop. */
        .pbland__cta::before {
          content: '';
          position: absolute;
          top: -20%;
          left: -75%;
          width: 45%;
          height: 140%;
          background: linear-gradient(100deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0) 100%);
          transform: skewX(-20deg);
          z-index: 0;
          pointer-events: none;
          animation: pbland-shine 3.2s ease-in-out infinite;
        }
        @keyframes pbland-shine {
          0%   { left: -75%; }
          55%  { left: 130%; }
          100% { left: 130%; }   /* hold off-screen before the next sweep */
        }
        @media (hover: hover) {
          .pbland__cta:hover { box-shadow: 0 8px 22px rgba(245, 105, 26, 0.45); }
          .pbland__cta:hover { transform: scale(1.02); }
          .pbland__cta:hover .pbland__cta-arrow { transform: translateX(4px); }
        }
        .pbland__cta:active { transform: scale(0.97); transition: transform 90ms ease-out; }
        .pbland__cta:focus-visible { outline: 2px solid #FFFFFF; outline-offset: 2px; }
        .pbland__cta-arrow { transition: transform 180ms ease-out; flex-shrink: 0; }

        .pbland__sub {
          font-family: 'Satoshi', 'Inter', sans-serif;
          font-weight: 400;
          font-size: 12px;
          color: #9FA9BF;
          margin: 12px 0 0;
        }
        .pbland__sub strong { color: #FFFFFF; font-weight: 700; }

        /* ── Ticker (continuous marquee) ── */
        .pbland__ticker {
          flex: 0 0 auto;
          background: #000000;
          padding: 10px 0;
          overflow: hidden;
        }
        .pbland__ticker-track {
          display: flex;
          width: max-content;
          animation: pbland-marquee 20s linear infinite;
        }
        @keyframes pbland-marquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .pbland__ticker-group { display: flex; align-items: center; flex-shrink: 0; }
        .pbland__tick {
          font-family: 'Satoshi', 'Inter', sans-serif;
          font-weight: 400;
          font-size: 10px;
          color: #FFFFFF;
          letter-spacing: 0.3px;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 0 28px;           /* even spacing between items, incl. the seam */
          white-space: nowrap;
        }
        .pbland__tick-paw { flex-shrink: 0; }
        @media (hover: hover) {
          .pbland__ticker:hover .pbland__ticker-track { animation-play-state: paused; }
        }

        /* Reduced motion: no entrance, no CTA/marquee/menu motion; final state shown. */
        @media (prefers-reduced-motion: reduce) {
          .pbland__content > * { opacity: 1; animation: none; transform: none; }
          .pbland__cta, .pbland__cta-arrow { transition: none; }
          .pbland__cta::before { animation: none; display: none; }
          .pbland__ticker-track { animation: none; }
          .pbland__menu { animation: none; }
        }
      `}</style>
    </section>
  );
};

export default HeroSection;
