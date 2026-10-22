import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { WHATSAPP_NUMBER } from '../../utils/whatsapp';
import { track } from '../../utils/analytics';
import { primeAudio, playBark, barkVoiceForSize } from '../../utils/sounds';
import questionsData from '../../constants/questions.json';
import { useBreedList } from '../../context/BreedsContext';
import BarkButton from '../results/BarkButton';

/* PAW BUDDY landing hero — mobile-first, warm and dog-first.
   Structure: cream header bar → hero (cream→peach gradient, a rotating "meet a
   pup" stage with trait chips, one main CTA, a static trust row). On phones a
   sticky "Find my dog" bar appears once the main button has scrolled away.
   Fonts: Bricolage Grotesque for the headline only, Fredoka for the breed name
   in the speech bubble, Satoshi for everything else.
   All motion is CSS; it is switched off under prefers-reduced-motion.

   WHERE TO EDIT (everything is at the top of this file or in the <style> block):
   - the headline ........ HEADLINE_LEAD / HEADLINE_HIGHLIGHT below
   - the pups ............ the PUPS list below
   - the chips on the photo HERO_BREED_CHIPS below
   - the subheading ...... HERO_SUBHEAD below (old line kept in a comment)
   - the trust row ....... TRUST_ITEMS below
   - colours ............. the hex values in the <style> block at the bottom */

// ── Headline (change the words here) ───────────────────────────────────────
// Three parts, because the two lines are set in two different typefaces. The sentence
// is unchanged: "Find the dog that fits your life."
const HEADLINE_SERIF = 'Find the dog';        // line 1, Instrument Serif italic
const HEADLINE_BOLD = 'that fits';            // line 2 opening, Bricolage Grotesque 800
const HEADLINE_HIGHLIGHT = 'your life.';      // line 2 close, shown in orange

// ── The pups shown in the stage and the picker row ─────────────────────────
// Photos live in public/assets/. Keep the one-liners general and honest.
const PUPS = [
  { key: 'indie',   name: 'Indie Dog',  breedName: 'Indie Dog',          img: '/assets/indian_pariaha.jpg',     line: 'Hardy, clever and built for Indian weather.' },
  { key: 'lab',     name: 'Labrador',   breedName: 'Labrador Retriever', img: '/assets/labrador_retriever.jpg', line: 'Friendly and eager to please. Needs daily exercise.' },
  { key: 'pug',     name: 'Pug',        breedName: 'Pug',                img: '/assets/Pug.jpg',                line: 'Total clown, loves company. Struggles in heat.' },
  { key: 'beagle',  name: 'Beagle',     breedName: 'Beagle',             img: '/assets/beagle.jpg',             line: 'Nose-led and cheerful. Yes, they are vocal.' },
  { key: 'shihtzu', name: 'Shih Tzu',   breedName: 'Shih Tzu',           img: '/assets/shihtzu.jpg',            line: 'Small and affectionate. Needs regular grooming.' },
  { key: 'pom',     name: 'Pomeranian', breedName: 'Pomeranian',         img: '/assets/Pomeranian.jpg',         line: 'Tiny, bold and a bit of a barker.' },
];

const ROTATE_MS = 3500;        // how often the pup changes until someone taps one
const PHOTO_FADE_MS = 420;     // how long one pup photo takes to dissolve into the next
const PARALLAX_MAX = 24;       // px the stage drifts against the scroll (0 disables it)
const WOOF_GAP_MS = 300;       // shortest gap between two thumbnail woofs

// ── Chips on the photo (illustrative traits for each breed, NOT personalised) ──
// Shown on the breed's photo and swapped when a different pup is selected. No "% match" here:
// that would imply a personalised score before the quiz. Text comes from facts already in
// constants/breeds.json (flat size, kids, coat, climate, energy). Keep each chip under ~22
// characters. `icon` is one of: home, kids, coat, climate, energy, paw. Keys = the pup `name` above.
export const HERO_BREED_CHIPS = {
  'Indie Dog':  [{ icon: 'coat', text: 'Low-maintenance coat' }, { icon: 'home', text: 'Fits a 2BHK' }, { icon: 'climate', text: 'Handles Indian heat' }],
  'Labrador':   [{ icon: 'kids', text: 'Good with kids' }, { icon: 'energy', text: 'Needs daily exercise' }, { icon: 'paw', text: 'First-timer friendly' }],
  'Pug':        [{ icon: 'home', text: 'Fits a 1BHK' }, { icon: 'kids', text: 'Good with kids' }, { icon: 'climate', text: 'Needs cool indoors' }],
  'Beagle':     [{ icon: 'home', text: 'Fits a 2BHK' }, { icon: 'kids', text: 'Good with kids' }, { icon: 'energy', text: 'Needs daily walks' }],
  'Shih Tzu':   [{ icon: 'home', text: 'Fits a 1BHK' }, { icon: 'coat', text: 'Low shedding' }, { icon: 'coat', text: 'Needs daily brushing' }],
  'Pomeranian': [{ icon: 'home', text: 'Fits a 1BHK' }, { icon: 'coat', text: 'Needs daily brushing' }, { icon: 'climate', text: 'Prefers cooler weather' }],
};

// ── Subheading ─────────────────────────────────────────────────────────────
// Old line, kept so it can be reverted:
//   "Tell us about your home, your time and your budget. We match you with breeds that actually suit an Indian household."
const HERO_SUBHEAD = 'Answer a few questions. Get your top 5 breeds, plus vet-verified breeders.';

// Phones get ONE short line instead of the long one plus the "13 quick questions · Free"
// line underneath — the number is already in this sentence. Desktop still shows both.
// `{n}` is replaced with the real number of questions in the quiz data.
const HERO_SUBHEAD_PHONE = 'Answer {n} quick questions. Get your top 5 breeds.';

// ── Trust row (static; no numbers unless they come from live data) ─────────
const TRUST_ITEMS = [
  { icon: 'shield', text: 'Vet-verified breeders' },
  { icon: 'home', text: 'Built for Indian homes' },
  { icon: 'free', text: 'Free to use' },
];

// The real number of questions in the quiz data, not a hard-coded one.
const QUESTION_COUNT = questionsData.length;

/* These two small components live OUTSIDE HeroSection on purpose. HeroSection
   re-renders every time the pup rotates; a component defined inside it would be
   re-created each time and the ticker would restart from the beginning. */
const PawIcon = ({ size = 11, className }) => (
  <svg className={className} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
    <g fill="currentColor">
      <ellipse cx="6.5" cy="8.5" rx="2.4" ry="3.1" />
      <ellipse cx="11" cy="5.6" rx="2.5" ry="3.3" />
      <ellipse cx="16.2" cy="6.4" rx="2.4" ry="3.1" />
      <ellipse cx="20" cy="10.6" rx="2.1" ry="2.7" />
      <path d="M12.4 12.2c3.1 0 5.9 2.3 5.9 5.1 0 2.2-1.9 3.4-4 3.4-1.2 0-1.6-.4-2.6-.4s-1.4.4-2.6.4c-2.1 0-4-1.2-4-3.4 0-2.8 2.8-5.1 5.9-5.1Z" />
    </g>
  </svg>
);

const CHIP_ICONS = {
  home: <><path d="M3.5 11L12 4l8.5 7" /><path d="M5.5 10v9.5h13V10" /></>,
  kids: <><circle cx="9" cy="8" r="3" /><path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" /><circle cx="17.5" cy="9.5" r="2.2" /><path d="M16 14.2c2.8 0 4.7 1.6 4.7 4" /></>,
  coat: <><path d="M5 15c0-4.2 3-7.5 7-7.5s7 3.3 7 7.5" /><path d="M8 12l1 1.4M12 10.5v1.8M16 12l-1 1.4" /><path d="M4 18.5h16" /></>,
  climate: <><circle cx="12" cy="12" r="3.8" /><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.5 1.5M16.5 16.5L18 18M18 6l-1.5 1.5M7.5 16.5L6 18" /></>,
  energy: <path d="M13 3L5.5 13.5H11L10 21l7.5-10.5H12z" />,
  paw: <><ellipse cx="12" cy="16" rx="4.2" ry="3.4" /><circle cx="6" cy="11" r="1.6" /><circle cx="9.6" cy="6.8" r="1.6" /><circle cx="14.4" cy="6.8" r="1.6" /><circle cx="18" cy="11" r="1.6" /></>,
  shield: <><path d="M12 3l7.5 3v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V6z" /><path d="M9 12l2.2 2.2L15.5 10" /></>,
  free: <><path d="M4 12.5V6a2 2 0 0 1 2-2h6.5l7.5 7.5a2 2 0 0 1 0 2.8l-5.4 5.4a2 2 0 0 1-2.8 0z" /><circle cx="8.5" cy="8.5" r="1.3" /></>,
};
const Glyph = ({ name, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {CHIP_ICONS[name] || CHIP_ICONS.paw}
  </svg>
);

const HeroSection = ({
  onSelectFriendPath,
  onDogOwner,      // "Already a dog owner?" — existing owners land in /app
  onMenu,          // hamburger → About
  user,
  onLogin,
  onProfile,
  onAdmin,
  onLogout,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [active, setActive] = useState(0);            // index of the pup on show
  const [userPicked, setUserPicked] = useState(false); // true once someone taps a pup
  const reduceMotion = useReducedMotion();
  const ctaRef = useRef(null);                          // the main "Find my dog" button
  const [stickyOn, setStickyOn] = useState(false);      // phones: show the bottom bar once the main button scrolled away

  /* Auto-rotate: move to the next pup every ROTATE_MS, until the person taps
     one (then it stops for good). The interval is always cleaned up, and it
     doesn't run at all when the visitor asked for reduced motion. */
  useEffect(() => {
    if (userPicked) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const id = setInterval(() => setActive((i) => (i + 1) % PUPS.length), ROTATE_MS);
    return () => clearInterval(id);
  }, [userPicked]);

  // Warm the browser cache so swapping pups never flashes an empty frame.
  useEffect(() => {
    PUPS.forEach((p) => { const img = new Image(); img.src = p.img; });
  }, []);

  /* Cross-fade between pups. The outgoing photo stays on the page for FADE_MS while the
     incoming one fades up over it, so the swap is soft instead of a hard cut. Without
     this the old photo is removed in the same frame the new one mounts and you see the
     peach halo flash through. */
  const [fading, setFading] = useState(null);     // the pup index on its way out, or null
  const prevActive = useRef(active);
  useEffect(() => {
    if (prevActive.current === active) return undefined;
    const outgoing = prevActive.current;
    prevActive.current = active;
    if (reduceMotion) return undefined;           // no cross-fade when motion is switched off
    setFading(outgoing);
    const t = setTimeout(() => setFading(null), PHOTO_FADE_MS);
    return () => clearTimeout(t);
  }, [active, reduceMotion]);

  /* Pause the looping decorations while the tab is in the background. They are only
     decoration, and an animation nobody can see is battery spent for nothing. */
  const [tabHidden, setTabHidden] = useState(false);
  useEffect(() => {
    const on = () => setTabHidden(document.visibilityState === 'hidden');
    on();
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);

  /* Light parallax on the stage: the halo and the chips drift against the scroll, at most
     PARALLAX_MAX px. Switched off entirely for reduced motion and for phones that tell us
     they have few cores, because this is the one effect here that runs on every frame. */
  const stageRef = useRef(null);
  useEffect(() => {
    if (reduceMotion) return undefined;
    try {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
      if ((navigator.hardwareConcurrency || 8) <= 4) return undefined;
    } catch { /* no hints available: carry on */ }
    const el = stageRef.current;
    if (!el) return undefined;
    let frame = 0;
    const apply = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      // -1 (stage below the fold) .. +1 (above it); 0 when it is centred
      const progress = Math.max(-1, Math.min(1, (r.top + r.height / 2 - window.innerHeight / 2) / (window.innerHeight || 1)));
      el.style.setProperty('--pbland-par', `${(progress * PARALLAX_MAX).toFixed(1)}px`);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(apply); };
    apply();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
      el.style.removeProperty('--pbland-par');
    };
  }, [reduceMotion]);

  /* Sticky phone CTA: show the bar only after the main button has scrolled OUT OF VIEW upwards
     (not while it is still below the fold), and hide it again when the button is back. */
  useEffect(() => {
    const el = ctaRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([entry]) => {
      setStickyOn(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    }, { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /* While the hero is on screen on a phone, leave room at the bottom of the page for the bar so
     it never covers the footer's last line. Removed again when the hero goes away. */
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const apply = () => { document.body.style.paddingBottom = mq.matches ? 'calc(72px + env(safe-area-inset-bottom))' : ''; };
    apply();
    mq.addEventListener('change', apply);
    return () => { mq.removeEventListener('change', apply); document.body.style.paddingBottom = ''; };
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

  /* Tapping a pup shows it, stops the auto-rotate, and barks.

     One short woof, pitched by the breed's size, so a Pomeranian is higher than a
     Labrador. Deliberately the BUILT-IN bark and not playBreedBark: the real per-breed
     recordings are the reward for unlocking a breed in the game (that is what the
     "Unlock in the game" button on the card is about), and handing them out for a tap on
     a thumbnail would give that away. `playBark` already does nothing while muted, and
     primeAudio runs here because a tap is exactly what unlocks audio in a browser. */
  const lastWoof = useRef(null);
  const lastWoofAt = useRef(0);
  const pickPup = (index, at = 0) => {
    setActive(index);
    setUserPicked(true);
    track('hero_breed_tap', { breed: PUPS[index].breedName });
    try {
      primeAudio();
      /* The picture always changes; the WOOF is rate limited. Without this, ten fast taps
         started nine overlapping woofs - silenced one by one, but all of them built. Same
         300ms rule the "Hear it" button already uses.
         `at` is the click event's own timeStamp rather than Date.now(), so nothing impure
         is read inside the component body. */
      if (at - lastWoofAt.current < WOOF_GAP_MS) return;
      lastWoofAt.current = at;
      lastWoof.current?.();                       // and a slower second tap replaces the first
      const size = (breedList.find((b) => b.name === PUPS[index].breedName) || {}).size;
      lastWoof.current = playBark(1, barkVoiceForSize(size).pitch);
    } catch { /* audio blocked: the picture still changes */ }
  };

  const pup = PUPS[active];
  const breedList = useBreedList();
  const pupBreed = { name: pup.breedName, size: (breedList.find((b) => b.name === pup.breedName) || {}).size };
  const chips = HERO_BREED_CHIPS[pup.name] || [];

  // Both the main button and the sticky bar start the same journey, and tell analytics which one was tapped.
  const startQuiz = (source) => () => {
    track('cta_click', { source });
    if (onSelectFriendPath) onSelectFriendPath(source);   // Home reports it as find_dog_clicked too
  };

  return (
    <section className={`pbland${tabHidden ? ' is-bg' : ''}`}>
      {/* ── 1. HEADER (cream bar: round icon buttons, paw logo, light doodles) ── */}
      <header className="pbland__header">
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
                  <button type="button" role="menuitem" className="pbland__menu-item pbland__menu-item--owner" onClick={run(onDogOwner)}>Already a dog owner? →</button>
                  <Link to="/play" role="menuitem" className="pbland__menu-item" onClick={run()}>Play</Link>
                  <button type="button" role="menuitem" className="pbland__menu-item" onClick={run(onLogin)}>Login</button>
                  <button type="button" role="menuitem" className="pbland__menu-item" onClick={run(openWhatsApp)}>Contact us</button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── 2. HERO (cream → peach; the only decoration is one soft circle behind the photo) ── */}
      <div className="pbland__hero">

        <div className="pbland__content">
          {/* 1. pill badge */}
          <div className="pbland__pill">
            <PawIcon size={13} className="pbland__pill-paw" />
            Free breed match
          </div>

          {/* 2. headline — change the words at the top of this file.
              Two lines in two typefaces: a serif italic opener, then the bold line that
              carries the orange phrase. */}
          <h1 className="pbland__headline">
            <span className="pbland__h-serif">{HEADLINE_SERIF}</span>
            <span className="pbland__h-bold">
              {HEADLINE_BOLD} <span className="pbland__hl">{HEADLINE_HIGHLIGHT}</span>
            </span>
          </h1>

          {/* 3. subheading. Desktop keeps the full line; phones get the short one instead
              (and lose the "13 quick questions · Free" line, whose number is in it). Both are
              rendered and one is hidden in CSS, so there is no width check and no layout shift. */}
          <p className="pbland__lede">{HERO_SUBHEAD}</p>
          <p className="pbland__lede-sm">{HERO_SUBHEAD_PHONE.replace('{n}', QUESTION_COUNT)}</p>

          {/* 4. stage: photo (with trait chips on its edge) + the navy breed card attached to it.
              key= makes the photo and card remount, so the entrance animation replays each time the pup changes. */}
          <div className="pbland__stage" ref={stageRef}>
            <div className="pbland__photo-wrap">
              <span className="pbland__halo" aria-hidden="true" />
              {/* The pup on its way out, underneath, fading. Removed after PHOTO_FADE_MS. */}
              {fading !== null && fading !== active && (
                <img
                  key={`out-${PUPS[fading].key}`}
                  className="pbland__photo pbland__photo--out"
                  src={PUPS[fading].img}
                  alt=""
                  aria-hidden="true"
                  width="320"
                  height="320"
                />
              )}
              <img
                key={pup.key}
                className="pbland__photo"
                src={pup.img}
                alt={pup.name.toLowerCase().endsWith('dog') ? pup.name : `${pup.name} dog`}
                width="320"
                height="320"
              />
              {/* Illustrative trait chips, staggered in on every breed change. Space is reserved
                  (they are absolutely positioned), so nothing shifts.
                  Each one animates OPACITY ONLY, deliberately: the chips now carry a continuous
                  CSS drift on `transform`, and a CSS animation outranks an inline style, so an
                  animated `y` here would be overridden the moment it started. Stagger is kept. */}
              <ul className="pbland__chips" key={`${pup.key}-chips`} aria-label={`About the ${pup.name}`}>
                {chips.map((c, i) => (
                  <motion.li
                    key={c.text}
                    className={`pbland__chip pbland__chip--${i}`}
                    initial={reduceMotion ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={reduceMotion ? { duration: 0 } : { delay: 0.2 + i * 0.08, duration: 0.3, ease: 'easeOut' }}
                  >
                    <span className="pbland__chip-icon"><Glyph name={c.icon} size={15} /></span>
                    {c.text}
                  </motion.li>
                ))}
              </ul>
            </div>
            <div key={`${pup.key}-b`} className="pbland__bubble" aria-live="polite">
              <span className="pbland__bubble-name">{pup.name}</span>
              <span className="pbland__bubble-line">{pup.line}</span>
              {/* "Hear it": plays this breed's bark after a tap. Breeds the game has not unlocked show "Unlock in the game". */}
              <span className="pbland__bark"><BarkButton breed={pupBreed} source="carousel" tone="dark" /></span>
            </div>
          </div>

          {/* 5. pup picker + its hint (the hint lives right next to the thumbnails) */}
          <div className="pbland__pups-wrap">
            <div className="pbland__pups" role="group" aria-label="Meet a breed">
              {PUPS.map((p, i) => (
                <button
                  key={p.key}
                  type="button"
                  className={`pbland__pup${i === active ? ' is-active' : ''}`}
                  aria-pressed={i === active}
                  aria-label={p.name}
                  onClick={(e) => pickPup(i, e.timeStamp)}
                >
                  <img src={p.img} alt="" loading="lazy" width="56" height="56" />
                </button>
              ))}
            </div>
            <p className="pbland__hint">Tap a pup to say hi first.</p>
          </div>

          {/* 6. one main button + a quiet text link for people who already have a dog */}
          <div className="pbland__cta-wrap">
            {/* the slot exists only so the pulse ring can be exactly the button's size */}
            <span className="pbland__cta-slot">
              <span className="pbland__cta-ring" aria-hidden="true" />
              <button type="button" ref={ctaRef} className="pbland__cta" onClick={startQuiz('hero')}>
                <span>Find my dog</span>
                <svg className="pbland__cta-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </span>
            <button type="button" className="pbland__owner" onClick={onDogOwner}>
              Already a dog owner? <span className="pbland__owner-arrow" aria-hidden="true">→</span>
            </button>
          </div>

          {/* 7. microcopy: the question count comes from the quiz data */}
          <p className="pbland__sub">{QUESTION_COUNT} quick questions · Free</p>

          {/* 8. static trust row (replaces the scrolling strip) */}
          <ul className="pbland__trust" aria-label="Why PAW BUDDY">
            {TRUST_ITEMS.map((t) => (
              <li key={t.text}><span className="pbland__trust-icon"><Glyph name={t.icon} size={18} /></span>{t.text}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Phones only: bottom bar, shown after the main button has scrolled out of view. It is
          portalled to <body> so no parent can clip or move it. */}
      {createPortal(
        <div className={`pbland__sticky${stickyOn ? ' is-on' : ''}`} aria-hidden={!stickyOn}>
          <button type="button" className="pbland__sticky-btn" tabIndex={stickyOn ? 0 : -1} onClick={startQuiz('sticky_bar')}>
            <span>Find my dog</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>,
        document.body,
      )}

      <style>{`
        .pbland {
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
          background: #FBF8F4;
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
          width: 44px;    /* full 44px tap target everywhere — phones included */
          height: 44px;
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

        /* Very small phones (≤340px): shrink the logo so it never meets the buttons. */
        @media (max-width: 340px) {
          .pbland__word { font-size: 14px; }
          .pbland__brand-paw { width: 17px; }
          .pbland__brand { gap: 5px; }
        }
        /* At 320px the short subheading fits on one line with about a pixel to spare, which
           reads as text jammed against both edges. A touch smaller buys it a margin. */
        @media (max-width: 360px) {
          .pbland__lede-sm { font-size: 12.5px; }
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
          min-width: 244px;
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
          text-decoration: none;
          box-sizing: border-box;
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
          overflow: hidden;
          background: linear-gradient(180deg, #FBF8F4 0%, #FFF1E6 100%);
          padding: 26px 16px 30px;
        }
        /* one centred column (phones) */
        .pbland__content {
          position: relative;
          z-index: 1;
          max-width: 460px;
          margin: 0 auto;
          text-align: center;
        }

        /* Entrance: each block fades in and slides up 20px, 80ms apart, once on load.
           Children 3 and 4 are the long and the short subheading — only ever one of them is
           visible, so they share a delay and the rhythm still reads as one step. */
        @keyframes pbland-enter {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .pbland__content > * { opacity: 0; animation: pbland-enter 420ms ease-out forwards; }
        .pbland__content > *:nth-child(1) { animation-delay: 0ms; }
        .pbland__content > *:nth-child(2) { animation-delay: 80ms; }
        .pbland__content > *:nth-child(3) { animation-delay: 160ms; }
        .pbland__content > *:nth-child(4) { animation-delay: 160ms; }
        .pbland__content > *:nth-child(5) { animation-delay: 240ms; }
        .pbland__content > *:nth-child(6) { animation-delay: 320ms; }
        .pbland__content > *:nth-child(7) { animation-delay: 400ms; }
        .pbland__content > *:nth-child(8) { animation-delay: 480ms; }
        .pbland__content > *:nth-child(9) { animation-delay: 560ms; }

        .pbland__pill {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          background: #FFFFFF;
          border: 1px solid #F3DCC8;
          border-radius: 999px;
          padding: 6px 14px;
          font-size: 12px;
          font-weight: 700;
          color: #011E4A;
          margin-bottom: 14px;
        }
        .pbland__pill-paw { color: #F5691A; }

        /* Two lines, two typefaces. The h1 is the measuring box; each line sets its own
           face and size. --pbland-h1 is the bold line's size and the serif line is scaled
           from it, so both move together when the screen changes. */
        .pbland__headline {
          position: relative;                 /* the desktop badge hangs off this */
          --pbland-h1: clamp(26px, 8.4vw, 38px);
          display: block;
          line-height: 1.04;
          letter-spacing: -0.02em;
          color: #011E4A;
          margin: 0 0 12px;
          font-size: var(--pbland-h1);
        }
        /* line 1: the serif italic opener, noticeably larger than the line under it */
        .pbland__h-serif {
          display: block;
          font-family: 'Instrument Serif', 'Georgia', serif;
          font-style: italic;
          font-weight: 400;
          font-size: calc(var(--pbland-h1) * 1.47);
          line-height: 1;
          letter-spacing: -0.012em;
        }
        /* line 2: the bold line that carries the orange phrase */
        .pbland__h-bold {
          display: block;
          font-family: 'Bricolage Grotesque', 'Sora', sans-serif;
          font-weight: 800;
          font-size: var(--pbland-h1);
          line-height: 1.08;
          margin-top: 0.06em;
        }
        /* The orange phrase. The peach highlighter swipe that used to sit under it was
           removed on 2026-10-20 - the serif line above carries the emphasis now, and the
           underline was competing with it. inline-block so it never splits across two lines. */
        .pbland__hl {
          display: inline-block;
          color: #F5691A;
        }

        /* The short phone line. Desktop hides it and shows .pbland__lede instead; the swap
           is in the two media queries further down, so neither ever shows twice. */
        .pbland__lede-sm {
          font-size: 15px;
          font-weight: 400;
          line-height: 1.45;
          color: #4A5568;
          max-width: 430px;
          margin: 0 auto 16px;
        }

        /* subheading: regular weight, #4A5568, 16.5px on phones (18-20px on desktop), 1.5 line height */
        .pbland__lede {
          font-size: 16.5px;
          font-weight: 400;
          line-height: 1.5;
          color: #4A5568;
          max-width: 520px;
          margin: 0 auto 18px;
        }

        /* stage: blob-framed photo + navy speech bubble */
        .pbland__stage { display: flex; flex-direction: column; align-items: center; }
        @keyframes pbland-pop {
          from { opacity: 0; transform: scale(0.88); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes pbland-float {
          from { transform: translateY(0) rotate(0deg); }
          to   { transform: translateY(-6px) rotate(-1.2deg); }
        }
        /* the photo sits in a wrapper so the one soft circle and the chips can be positioned around it */
        /* The halo is a circle 132% of the photo's width, so it reaches ~16% of that width ABOVE the photo.
           In the single-column (phone/tablet) layout that put its edge straight through the last line of the
           subheading — it read like a line struck through the text. The top margin keeps it clear.
           Desktop is a two-column grid where the halo sits beside the text, and it keeps its own 8px. */
        /* --pbland-photo drives the photo AND its top margin. The halo circle is 132% of the photo's
           width, so it reaches 16% of that width above it; the margin below is 17% of the same number,
           which keeps the halo clear of the subheading at every size without a magic constant. */
        .pbland__photo-wrap {
          position: relative;
          --pbland-photo: min(62vw, 260px);
          width: var(--pbland-photo);
          margin: calc(var(--pbland-photo) * 0.17) 0 20px;
        }
        /* --pbland-par is written by the parallax effect in JS (0 when it is switched off),
           so the only thing that ever changes here is a transform. */
        .pbland__halo {
          position: absolute; left: 50%; top: 50%;
          width: 132%; aspect-ratio: 1 / 1;
          transform: translate(-50%, calc(-50% + var(--pbland-par, 0px) * 1));
          border-radius: 50%; background: rgba(255, 227, 207, 0.6);   /* #FFE3CF at ~60% */
          pointer-events: none; z-index: 0;
          will-change: transform;
        }
        /* The incoming pup dissolves in from 1.04 scale; the outgoing one sits underneath
           at z-index 0 and fades out, so there is never a frame with no photo at all. */
        @keyframes pbland-photo-in {
          from { opacity: 0; transform: scale(1.04); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes pbland-photo-out {
          from { opacity: 1; }
          to   { opacity: 0; }
        }
        .pbland__photo {
          position: relative; z-index: 1;
          display: block;
          width: 100%;
          aspect-ratio: 1 / 1;
          height: auto;
          object-fit: cover;
          border: 5px solid #FFFFFF;
          border-radius: 46% 54% 52% 48% / 52% 46% 54% 48%;
          box-shadow: 0 0 0 8px #FFD9BD, 0 14px 34px rgba(245, 105, 26, 0.28);
          margin: 0;
          animation:
            pbland-photo-in ${PHOTO_FADE_MS}ms ease-out both,
            pbland-float 5s ease-in-out ${PHOTO_FADE_MS}ms infinite alternate;
        }
        .pbland__photo--out {
          position: absolute; inset: 0; z-index: 0;
          width: 100%; height: 100%;
          animation: pbland-photo-out ${PHOTO_FADE_MS}ms ease-out both;
        }

        /* trait chips: white pills on the photo's edge, low on the photo so they stay off the dog's face */
        .pbland__chips { list-style: none; margin: 0; padding: 0; position: absolute; inset: 0; z-index: 2; pointer-events: none; }
        .pbland__chip {
          position: absolute;
          display: inline-flex; align-items: center; gap: 6px;
          padding: 6px 12px 6px 8px;
          background: #FFFFFF; color: #011E4A;
          border-radius: 999px;
          box-shadow: 0 6px 16px rgba(1, 30, 74, 0.16);
          font-size: 13px; font-weight: 600; line-height: 1.2; white-space: nowrap;
        }
        .pbland__chip-icon { display: inline-flex; color: #F5691A; flex: none; }
        .pbland__chip--0 { left: -36px; bottom: 9%; }
        .pbland__chip--1 { right: -36px; bottom: 30%; }
        .pbland__chip--2 { left: -44px; bottom: 33%; }
        /* Each chip breathes up and down on its own clock, and all three ride the parallax
           in the opposite direction to the halo so the stage reads as having depth. */
        @keyframes pbland-chip-drift {
          from { transform: translateY(calc(var(--pbland-par, 0px) * -0.6 - 4px)); }
          to   { transform: translateY(calc(var(--pbland-par, 0px) * -0.6 + 4px)); }
        }
        .pbland__chip { will-change: transform; animation: pbland-chip-drift 3.6s ease-in-out infinite alternate; }
        .pbland__chip--0 { animation-duration: 3.6s; animation-delay: 0s; }
        .pbland__chip--1 { animation-duration: 4.4s; animation-delay: .5s; }
        .pbland__chip--2 { animation-duration: 4.0s; animation-delay: .9s; }
        @media (max-width: 899px) { .pbland__chip--2 { display: none; } }   /* phones: two chips at most */

        @keyframes pbland-bubble-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .pbland__bubble {
          position: relative;
          box-sizing: border-box;
          width: 100%;
          max-width: 300px;
          min-height: 58px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 2px;
          background: #011E4A;
          color: #FFFFFF;
          border-radius: 16px;
          padding: 10px 16px;
          font-size: 13px;
          line-height: 1.4;
          animation: pbland-bubble-in 300ms ease-out both;
        }
        /* little rotated square = the tail, pointing up at the photo */
        .pbland__bubble::before {
          content: '';
          position: absolute;
          top: -6px;
          left: 50%;
          width: 12px;
          height: 12px;
          margin-left: -6px;
          background: #011E4A;
          transform: rotate(45deg);
          border-radius: 2px;
        }
        .pbland__bark { display: flex; justify-content: center; margin-top: 6px; min-height: 36px; }
        .pbland__bubble-name {
          font-family: 'Fredoka', 'Satoshi', sans-serif;
          font-size: 15px;
          font-weight: 600;
          color: #FFB27A;
        }

        /* pup picker: 52px thumbnails on phones, 56px on desktop, at least 8px apart */
        .pbland__pups-wrap { margin: 18px 0 20px; }
        .pbland__pups {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 8px;
        }
        .pbland__pup {
          width: 52px;
          height: 52px;
          padding: 0;
          border: 3px solid #FFFFFF;
          border-radius: 50%;
          background: #FFD9BD;
          overflow: hidden;
          cursor: pointer;
          box-shadow: 0 4px 10px rgba(1, 30, 74, 0.14);
          transition: transform 160ms ease-out, box-shadow 160ms ease-out;
          -webkit-tap-highlight-color: transparent;
        }
        .pbland__pup img { display: block; width: 100%; height: 100%; object-fit: cover; }
        .pbland__pup.is-active {
          /* scale and the bounce both live on 'transform', so the bounce keyframes have to
             carry the 1.18 themselves or the thumbnail would snap back to 1 while playing */
          transform: scale(1.18);
          box-shadow: 0 0 0 3px #F5691A, 0 6px 16px rgba(245, 105, 26, 0.45);
          animation: pbland-pup-bounce 460ms cubic-bezier(0.2, 1.5, 0.4, 1) both;
        }
        @keyframes pbland-pup-bounce {
          0%   { transform: scale(0.96); }
          45%  { transform: scale(1.26); }
          100% { transform: scale(1.18); }
        }
        @media (hover: hover) {
          .pbland__pup:not(.is-active):hover { transform: scale(1.08); }
        }
        .pbland__pup:active { transform: scale(0.94); }
        .pbland__pup:focus-visible { outline: 3px solid #011E4A; outline-offset: 3px; }
        .pbland__hint { margin: 10px 0 0; font-size: 12px; color: #6B7686; }

        /* main button: orange pill, navy text, a diagonal shine that sweeps across */
        .pbland__cta-wrap { margin: 0; }
        .pbland__cta {
          position: relative;
          overflow: hidden;               /* clips the shine to the pill */
          isolation: isolate;
          width: 100%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 16px 20px;
          background: #F5691A;
          color: #011E4A;
          font-family: 'Satoshi', 'Inter', sans-serif;
          font-weight: 700;
          font-size: 17px;
          border: none;
          border-radius: 999px;
          cursor: pointer;
          box-shadow: 0 10px 26px rgba(245, 105, 26, 0.38);
          transition: transform 180ms ease-out, box-shadow 180ms ease-out;
          will-change: transform;
        }
        .pbland__cta > * { position: relative; z-index: 1; }   /* text + arrow stay above the shine */
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
        /* A slow ring breathing out of the button. It is a separate element because the
           button itself clips its own overflow for the shine sweep, and 'transform' +
           'opacity' are the only things that move. Paused while the tab is hidden. */
        .pbland__cta-wrap { position: relative; }
        .pbland__cta-slot { position: relative; display: block; }
        .pbland__cta-ring {
          position: absolute; inset: 0;
          border-radius: 999px;
          border: 2px solid rgba(245, 105, 26, 0.55);
          pointer-events: none;
          z-index: 0;
          will-change: transform, opacity;
          animation: pbland-pulse 2.4s cubic-bezier(.2,.6,.3,1) infinite;
        }
        @keyframes pbland-pulse {
          0%   { opacity: .55; transform: scale(1); }
          70%  { opacity: 0;   transform: scale(1.14); }
          100% { opacity: 0;   transform: scale(1.14); }
        }
        .pbland.is-bg .pbland__cta-ring,
        .pbland.is-bg .pbland__cta::before,
        .pbland.is-bg .pbland__photo,
        .pbland.is-bg .pbland__chip { animation-play-state: paused; }

        @media (hover: hover) {
          /* lift 2px, as asked — the slight scale is kept so the shadow grows with it */
          .pbland__cta:hover { transform: translateY(-2px) scale(1.02); box-shadow: 0 16px 36px rgba(245, 105, 26, 0.5); }
          .pbland__cta:hover .pbland__cta-arrow { transform: translateX(4px); }
        }
        .pbland__cta:active { transform: scale(0.97); transition: transform 90ms ease-out; }
        .pbland__cta:focus-visible { outline: 3px solid #011E4A; outline-offset: 3px; }
        .pbland__cta-arrow { transition: transform 180ms ease-out; flex-shrink: 0; }

        /* secondary path for people who already have a dog: a quiet text link, not a second button */
        .pbland__owner {
          display: inline-flex; align-items: center; justify-content: center; gap: 4px;
          width: 100%;
          min-height: 44px;
          margin-top: 6px;
          padding: 8px 12px;
          background: none;
          border: none;
          color: #011E4A;
          font-family: 'Satoshi', 'Inter', sans-serif;
          font-weight: 500;
          font-size: 14px;
          cursor: pointer;
          text-decoration: none;
        }
        .pbland__owner-arrow { transition: transform 160ms ease-out; }
        @media (hover: hover) {
          .pbland__owner:hover { text-decoration: underline; text-underline-offset: 3px; }
          .pbland__owner:hover .pbland__owner-arrow { transform: translateX(3px); }
        }
        .pbland__owner:focus-visible { outline: 3px solid #011E4A; outline-offset: 2px; border-radius: 8px; }
        .pbland__menu-item--owner { color: #F57A1B; font-weight: 700; }

        .pbland__sub {
          font-size: 13px;
          color: #6B7686;
          margin: 8px 0 0;
        }

        /* static trust row: three items, wraps on phones, never scrolls sideways */
        .pbland__trust {
          list-style: none; margin: 16px 0 0; padding: 0;
          display: flex; flex-wrap: wrap; justify-content: center; gap: 8px 18px;
        }
        .pbland__trust li { display: inline-flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 600; color: #011E4A; }
        .pbland__trust-icon { display: inline-flex; color: #F5691A; flex: none; }

        /* sticky phone bar: hidden by default, slides up once the main button has scrolled away */
        .pbland__sticky {
          position: fixed; left: 0; right: 0; bottom: 0; z-index: 900;
          padding: 8px 16px calc(8px + env(safe-area-inset-bottom));
          background: rgba(251, 248, 244, 0.97);
          border-top: 1px solid #EFE8E0;
          box-shadow: 0 -6px 20px rgba(1, 30, 74, 0.08);
          transform: translateY(110%);
          visibility: hidden;
          transition: transform 220ms ease-out, visibility 0s linear 220ms;
        }
        .pbland__sticky.is-on { transform: translateY(0); visibility: visible; transition: transform 220ms ease-out; }
        .pbland__sticky-btn {
          width: 100%; height: 56px;
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          background: #F5691A; color: #011E4A;
          font-family: 'Satoshi', 'Inter', sans-serif; font-weight: 700; font-size: 17px;
          border: none; border-radius: 999px; cursor: pointer;
          box-shadow: 0 8px 20px rgba(245, 105, 26, 0.32);
        }
        .pbland__sticky-btn:active { transform: scale(0.98); }
        .pbland__sticky-btn:focus-visible { outline: 3px solid #011E4A; outline-offset: 3px; }
        @media (min-width: 768px) { .pbland__sticky { display: none; } }

        /* ── Phones and tablets: the whole hero has to land above the fold, on a 567px-tall phone as
              well as an 844px one. Every vertical size below is capped in vh, so the column shrinks
              with the screen instead of running off the bottom. Desktop (≥900px) is a two-column
              layout and is deliberately left out of all of this. ── */
        @media (max-width: 899px) {
          /* The hero is exactly one screenful. Everything is a flex column, and the photo stage is the
             one part allowed to give up space (flex: 1 with min-height: 0), so the button, the
             "Already a dog owner?" link and the trust row are always on screen — the picture shrinks
             instead of pushing them under the fold. */
          .pbland { height: 100dvh; }
          .pbland__hero { display: flex; flex: 1 1 auto; min-height: 0; padding: clamp(8px, 1.6vh, 26px) 16px clamp(10px, 1.6vh, 30px); }
          .pbland__content { display: flex; flex-direction: column; width: 100%; min-height: 0; }
          .pbland__stage { flex: 1 1 auto; min-height: 0; justify-content: center; }
          /* The trait chips hang off the edges of a 240-320px photo. Now that the photo is sized to
             whatever the screen has left (often ~120px), they would sit on top of each other and on the
             pup. They stay on desktop, where the photo is still full size. */
          .pbland__chips { display: none; }
          /* a gentler halo on phones: 132% needs 16% of the photo's width as clearance above it,
             which is space a short screen does not have */
          .pbland__halo { width: 114%; }
          .pbland__photo-wrap {
            flex: 1 1 auto;                   /* takes whatever the stage has left over */
            width: auto;
            height: min(62vw, 260px);
            aspect-ratio: 1 / 1;
            max-height: 100%;
            min-height: 72px;                 /* ...but never shrinks to a dot */
            margin: clamp(5px, 1vh, 14px) auto clamp(6px, 1.2vh, 16px);
          }
          /* the navy breed card holds a 44px bark button, so it must keep its natural height —
             the photo above it is the only thing that gives way */
          .pbland__bubble { flex: none; }
          /* The pill is an inline-flex in a stretching flex column, so on a phone it was
             stretching to the full width of the screen — a "pill" the width of the page.
             Centring it makes it the chip it was drawn as, and frees the top-right corner
             the new badge sits in. */
          .pbland__pill { align-self: center; margin-bottom: clamp(5px, 1.1vh, 14px); padding: clamp(4px, 0.8vh, 6px) 14px; }
          /* The headline is sized against BOTH the width and the height here, because the
             whole hero has to land on one screen on a short phone as well as a tall one. */
          .pbland__headline { --pbland-h1: clamp(24px, min(9.6vw, 4.6vh), 38px); margin-bottom: clamp(5px, 1.1vh, 12px); }
          /* Phones: one short line. The long one and the "13 quick questions · Free" line
             both step aside — the number lives in the short line now. */
          .pbland__lede { display: none; }
          .pbland__sub { display: none; }
          .pbland__lede-sm { font-size: clamp(13px, min(4vw, 2vh), 15.5px); margin-bottom: clamp(5px, 1.3vh, 16px); }
          /* Trust row as three small chips rather than bare text. */
          .pbland__trust li {
            padding: clamp(3px, 0.7vh, 6px) 10px;
            background: #FFFFFF;
            border: 1px solid #F3DCC8;
            border-radius: 999px;
            font-size: 12px;
            gap: 5px;
          }
          .pbland__bubble { min-height: 0; padding: clamp(8px, 1.4vh, 14px) 16px; }
          .pbland__bubble-line { font-size: clamp(12px, 1.7vh, 14px); }
          .pbland__bark { margin-top: clamp(2px, 0.6vh, 6px); min-height: 0; }
          .pbland__pups-wrap { margin: clamp(7px, 1.5vh, 18px) 0 clamp(7px, 1.5vh, 20px); }
          .pbland__pup { width: clamp(38px, min(12vw, 6.2vh), 52px); height: clamp(38px, min(12vw, 6.2vh), 52px); }
          .pbland__hint { margin-top: clamp(4px, 0.9vh, 10px); }
          .pbland__owner { margin-top: clamp(2px, 0.5vh, 6px); }
          .pbland__sub { margin-top: clamp(3px, 0.7vh, 8px); }
          .pbland__trust { margin-top: clamp(7px, 1.4vh, 16px); gap: clamp(4px, 0.8vh, 8px) 18px; }
        }

        /* ── Short phones (an iPhone SE with the browser bars showing is only ~567px tall). The photo
              has a floor, so the last of the space comes from the small print: the "Free breed match"
              badge steps aside and the trust row goes to one tight line. Everything the person needs
              — headline, pup, breed card, thumbnails, button, owner link, questions line and trust
              row — is still on the screen. ── */
        @media (max-width: 899px) and (max-height: 680px) {
          .pbland__hero { padding-top: 8px; padding-bottom: 8px; }
          .pbland__pill { display: none; }
          .pbland__headline { --pbland-h1: clamp(21px, 7.2vw, 27px); margin-bottom: 3px; }
          .pbland__lede-sm { font-size: 13px; line-height: 1.35; margin-bottom: 3px; }
          .pbland__pups-wrap { margin: 5px 0 5px; }
          /* The circle shrinks but the TAP target must not: the ::after keeps a full 44x44 area, and the
             8px gap means neighbouring targets sit edge to edge instead of overlapping. */
          .pbland__pups { gap: 12px; }
          /* overflow:hidden is what makes the circle, but it also clipped the ::after away — so the
             photo takes the rounding itself and the button is free to carry a bigger hit area. */
          .pbland__pup { position: relative; width: 36px; height: 36px; border-width: 2px; overflow: visible; }
          .pbland__pup img { border-radius: 50%; }
          .pbland__pup::after { content: ''; position: absolute; inset: -6px; border-radius: 50%; }
          .pbland__hint { font-size: 12px; margin-top: 2px; }
          .pbland__trust { margin-top: 6px; gap: 4px 8px; font-size: 12px; }
          .pbland__trust li { font-size: 11.5px; gap: 4px; padding: 3px 8px; }
          .pbland__owner { margin-top: 0; }
          /* The trait chips are positioned for a full-size photo; on a small one they land on top of
             each other and on the photo itself, so they step aside here. The breed card keeps its name
             and its line — only the bark button inside it goes, which is the one thing on this screen
             that is also available later. */
          .pbland__bark { display: none; }
          .pbland__bubble-line { font-size: 12.5px; line-height: 1.35; }
        }

        /* ── Desktop: text on the left, the pup stage on the right ── */
        @media (min-width: 900px) {
          .pbland__hero { padding: 56px 40px 52px; display: flex; flex-direction: column; justify-content: center; }
          .pbland__content {
            width: 100%;
            max-width: 1200px;
            display: grid;
            grid-template-columns: minmax(0, 560px) 420px;
            /* rows 1-6 are the left text; row 6 (trust row) soaks up the spare height of the tall right column */
            grid-template-rows: auto auto auto auto auto 1fr auto;
            column-gap: 72px;
            justify-content: space-between;
            align-content: center;
            text-align: left;
          }
          .pbland__pill     { grid-column: 1; grid-row: 1; justify-self: start; margin-bottom: 22px; }
          /* more air above the headline, and the two lines get their full size here */
          .pbland__headline { grid-column: 1; grid-row: 2; --pbland-h1: clamp(46px, 4.6vw, 64px); margin-bottom: 20px; }
          .pbland__lede     { grid-column: 1; grid-row: 3; font-size: 19px; margin: 0 0 24px; }
          .pbland__lede-sm  { display: none; }         /* desktop keeps the full text */
          .pbland__cta-wrap { grid-column: 1; grid-row: 4; max-width: 380px; }
          .pbland__owner    { justify-content: flex-start; padding-left: 4px; }
          .pbland__sub      { grid-column: 1; grid-row: 5; }
          .pbland__trust    { grid-column: 1; grid-row: 6; align-self: start; justify-content: flex-start; margin-top: 22px; }
          .pbland__stage    { grid-column: 2; grid-row: 1 / 7; align-self: start; }
          /* thumbnails centred under the card, not left-aligned with the text column */
          .pbland__pups-wrap{ grid-column: 2; grid-row: 7; align-self: start; margin: 10px 0 0; }
          .pbland__pups     { justify-content: center; }
          .pbland__hint     { text-align: center; }
          /* a slightly larger circle, and the chips sit further out on its edge */
          .pbland__photo-wrap { width: 360px; margin: 8px auto 24px; }
          .pbland__bubble   { margin: 0 auto; transition: transform 180ms ease-out, box-shadow 180ms ease-out; }
          .pbland__pup      { width: 56px; height: 56px; }
          .pbland__chip     { font-size: 14px; }
          .pbland__chip--0  { left: -74px; }
          .pbland__chip--1  { right: -74px; }
          .pbland__chip--2  { left: -82px; }
        }

        /* Pointer devices only: hover lifts. Never on touch, where :hover sticks after a tap. */
        @media (min-width: 900px) and (hover: hover) {
          .pbland__bubble:hover { transform: translateY(-4px); box-shadow: 0 14px 30px rgba(1, 30, 74, 0.22); }
        }

        /* ── Reduced motion: show final states, nothing moves ── */
        @media (prefers-reduced-motion: reduce) {
          .pbland__content > * { opacity: 1; animation: none; transform: none; }
          .pbland__photo, .pbland__photo--out, .pbland__bubble { animation: none; }
          .pbland__cta::before { animation: none; display: none; }
          .pbland__cta, .pbland__cta-arrow, .pbland__pup, .pbland__owner, .pbland__owner-arrow, .pbland__sticky, .pbland__bubble { transition: none; }
          .pbland__menu { animation: none; }
          /* everything added in the hero upgrade: the pulse ring, the chip drift, the
             thumbnail bounce and the parallax all stop here too */
          .pbland__cta-ring { animation: none; display: none; }
          .pbland__chip { animation: none; transform: none; }
          .pbland__pup.is-active { animation: none; }
          .pbland__halo { transform: translate(-50%, -50%); }
        }
      `}</style>
    </section>
  );
};

export default HeroSection;
