import { Link } from 'react-router-dom';
import React, { useState, useMemo, useEffect, useRef, lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import MatchCard from './results/MatchCard';
import FeedbackModal from './FeedbackModal';
import { createPortal } from 'react-dom';
import MatchReveal, { ZOOMIES_FADE_MS, ZOOMIES_MS } from './results/MatchReveal';
import ZoomiesLayer from './results/Zoomies';
import { ToySlots } from './fun/SqueakyToy';
import { useToyGate } from './fun/ToyContext';
import { CardStackIcon } from './swipe/swipeIcons';
import StickerPack from './results/StickerPack';
import InfoFan from './results/InfoFan';
import { packForBreed, STICKERS_LIVE } from '../constants/stickers';
import { hasHeatData } from '../utils/heat';
import { cardColourFor } from '../utils/photoColour';
import ShareMatches from './results/ShareMatches';
import AvatarCardButton from './results/avatarCard/AvatarCardButton';
import BarkButton from './results/BarkButton';
// The remix sheet only matters once someone taps "Remix the bark", so it is code-split.
const BarkMixer = lazy(() => import('./results/BarkMixer'));
// Same reason: the puppy-day story only matters once someone taps "See a day with ...".
const DayInLife = lazy(() => import('./results/DayInLife'));
import DogArt from './quiz/DogArt';
import { primeAudio, playBreedBark } from '../utils/sounds';
import { track } from '../utils/analytics';
import WarningsButton from './results/WarningsButton';
import { getNewTagSeen, setNewTagSeen } from '../utils/swipeState';
import { useBreedList } from '../context/BreedsContext';
import { noExcellentMatch, selectTopMatches } from '../utils/breedUtils';

/* Very faint paw/bone/dog/heart/star/ball tile, used only behind the #2-#5 area.
   Change the look here: `opacity` is the strength (.055 = about 5.5%), and the
   shapes are plain SVG paths. Navy on the page's own white, so text contrast is
   effectively unchanged. Removed under reduced-transparency / forced-colors. */
const RESULTS_PATTERN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180"><g fill="none" stroke="#011E4A" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" opacity=".055"><g transform="translate(22 22) rotate(-12)"><ellipse cx="14" cy="22" rx="8" ry="6.5"/><circle cx="4" cy="12" r="3"/><circle cx="11" cy="5" r="3"/><circle cx="19" cy="5" r="3"/><circle cx="26" cy="12" r="3"/></g><g transform="translate(100 22) rotate(25)"><path d="M6 6a4 4 0 1 0-1 7 4 4 0 1 0 7 1h12a4 4 0 1 0 7-1 4 4 0 1 0-1-7 4 4 0 1 0-6 .5H12A4 4 0 0 0 6 6z"/></g><g transform="translate(120 88)"><circle cx="18" cy="20" r="14"/><path d="M6 12C0 10-2 22 4 28M30 12c6-2 8 10 2 16"/><circle cx="13" cy="18" r="1.6"/><circle cx="23" cy="18" r="1.6"/><path d="M16 25h4l-2 2.5z"/></g><g transform="translate(24 96)"><path d="M12 24S0 17 0 9a6 6 0 0 1 12-2 6 6 0 0 1 12 2c0 8-12 15-12 15z"/></g><g transform="translate(78 124)"><path d="M14 0l4.2 9 9.8 1-7.4 6.6 2.2 9.6L14 21l-8.8 5.2 2.2-9.6L0 10l9.8-1z"/></g><g transform="translate(144 148)"><circle cx="10" cy="10" r="10"/><path d="M1 8c5 2 13 2 18 0"/></g></g></svg>`;
const RESULTS_PATTERN = `url("data:image/svg+xml,${encodeURIComponent(RESULTS_PATTERN_SVG)}")`;

/* Top-5 recommendation results — hero-card + grid, plus the full results
   toolkit (retake, breed lookup, share) ported from the standalone page.
   #1 breed gets a large orange hero card; #2–#5 stagger in below. */
/* ── Hand-drawn doodles — decorative only (aria-hidden), brand palette only ── */
const D_NAVY = '#011E4A';
const D_ORANGE = '#F57A1B';

const Crown = () => (
  <svg className="rbx-crown" viewBox="0 0 64 44" aria-hidden="true">
    <path d="M8 38 L4 11 L20 24 L32 6 L44 24 L60 11 L56 38 Z" fill="#FFFFFF" stroke={D_NAVY} strokeWidth="3" strokeLinejoin="round" />
    <path d="M10 38.5 H54" stroke={D_NAVY} strokeWidth="3" strokeLinecap="round" />
    <circle cx="4" cy="10" r="3.4" fill={D_ORANGE} stroke={D_NAVY} strokeWidth="2" />
    <circle cx="32" cy="5.5" r="3.4" fill={D_ORANGE} stroke={D_NAVY} strokeWidth="2" />
    <circle cx="60" cy="10" r="3.4" fill={D_ORANGE} stroke={D_NAVY} strokeWidth="2" />
  </svg>
);

const Heart = ({ className, stroke = D_NAVY }) => (
  <svg className={`rbx-doodle ${className || ''}`} viewBox="0 0 32 32" aria-hidden="true">
    <path d="M16 27s-10-6.2-10-13.2A5.6 5.6 0 0 1 16 10a5.6 5.6 0 0 1 10 3.8C26 20.8 16 27 16 27z" fill="none" stroke={stroke} strokeWidth="2.2" strokeLinejoin="round" />
  </svg>
);

const Sparks = ({ className, stroke = D_ORANGE }) => (
  <svg className={`rbx-doodle ${className || ''}`} viewBox="0 0 40 34" aria-hidden="true">
    <path d="M7 4 L13 16 M22 2 L22 15 M36 8 L26 17" fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
  </svg>
);

/* Hand-drawn arrow: the line draws itself, then the head fades in. */
const ARROWS = {
  down: { line: 'M12 6 C 8 26, 24 40, 38 50', head: 'M33.9 40.9 L38 50 L28 49' },
  left: { line: 'M48 6 C 52 26, 36 40, 14 50', head: 'M24 51 L14 50 L19.8 41.9' },
};
const Arrow = ({ dir = 'down', className }) => (
  <svg className={`rbx-arrow ${className || ''}`} viewBox="0 0 60 60" aria-hidden="true">
    <path className="rbx-arrow-line" pathLength="1" d={ARROWS[dir].line} fill="none" stroke={D_NAVY} strokeWidth="2.4" strokeLinecap="round" />
    <path className="rbx-arrow-head" d={ARROWS[dir].head} fill="none" stroke={D_NAVY} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* Status pill colours, read from the START of the engine's own label. Never a new threshold,
   and never a cheerier colour than the word the engine chose. */
const labelPill = (label = '') => {
  if (label.startsWith('Excellent')) return { background: '#1E8E5A', color: '#FFFFFF' };
  if (label.startsWith('Good')) return { background: '#FFE3CF', color: '#8A3300' };
  return { background: '#ECEFF3', color: '#3C4F6B' };
};

/* The #1 card is navy in the Soft-modern design. Before that it took its colour from the
   winning breed's own photo (utils/photoColour.js, built 2026-10-19). That code is untouched;
   set this to true to go back to the per-breed colour. */
const TOP_CARD_USES_BREED_COLOUR = false;

const RecommendationResults = ({ breeds, answers, user, onBack, onBuy, onFullProfile, onRetake, onExploreMore, onCompareBreeds, onPlayGames, revealRun = 0, revealSeen = 0, onRevealDone = () => {} }) => {
  const breedsData = useBreedList();
  /* The top five, worked out up here rather than after the early return below, because the card-colour
     effect needs to know which breed won. Same rule as the quiz Results page: a "Not recommended" breed
     is never listed as a match. Guarded, since `breeds` can arrive empty. */
  const { matches, hiddenCount } = (breeds && breeds.length)
    ? selectTopMatches(breeds, 5)
    : { matches: [], hiddenCount: 0 };
  const top = matches[0];
  const rest = matches.slice(1);

  const [searchQuery, setSearchQuery] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const shareCardRef = useRef(null);
  const [fabTucked, setFabTucked] = useState(false);

  /* The #1 card's progress bar fills once, the first time the card is on screen. One
     observer, disconnected the moment it fires, so scrolling away and back never replays it. */
  const heroRef = useRef(null);
  const [heroSeen, setHeroSeen] = useState(false);
  /* Read once at first render, not in an effect: the CSS switches the rest of this section off
     under reduced motion, but the #1 card's entrance is framer-motion and has to be told. */
  const [reducedMotion] = useState(() => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
  });
  const pctWidth = `${Number(top?.matchPercentage) || 0}%`;
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return undefined;
    let reduced = false;
    try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* assume motion is fine */ }
    if (reduced || typeof IntersectionObserver === 'undefined') { setHeroSeen(true); return undefined; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); setHeroSeen(true); } }, { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);


  /* ...and it gets out of the way at the end of the page. The "Share your results" card carries its own Retake Quiz
     button, so from there down the floating one is only covering the card and the footer links underneath it. */
  useEffect(() => {
    const card = shareCardRef.current;
    if (!card || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([e]) => setFabTucked(e.isIntersecting), { threshold: 0 });
    io.observe(card);
    return () => io.disconnect();
  }, []);

  const [mixerOpen, setMixerOpen] = useState(false);   // the "Remix the bark" sheet

  /* "See a day with ..." — holds the breed whose puppy-day story is open, or null.
     The quiz's own city answer is passed through for the header line only; the story
     itself reads the answers object directly and nothing is stored or sent. */
  const [dayBreed, setDayBreed] = useState(null);
  const quizCity = (Array.isArray(answers?.city) ? answers.city[0] : answers?.city) || '';
  useToyGate(!(revealRun && revealRun !== revealSeen));   // no squeaky toys anywhere on the page while the reveal layer is open
  // Tapping the sitting dog next to the #1 match replays the small 3-dog "zoomies" (not the drumroll or the card).
  // At most once every 4 seconds, never for a weak (calm) result, never with reduced motion.
  const [zoomReplay, setZoomReplay] = useState(0);        // 0 = not showing; otherwise it identifies this replay
  const zoomAt = useRef(0);
  const zoomTimer = useRef(null);
  useEffect(() => () => clearTimeout(zoomTimer.current), []);
  const replayZoomies = () => {
    const now = Date.now();
    if (now - zoomAt.current < 4000) return;
    if (noExcellentMatch(matches)) return;
    try { if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch { /* assume motion is fine */ }
    zoomAt.current = now;
    setZoomReplay(now);
    track('zoomies_played', { dogs: 3, label: top?.label, replay: true });
    clearTimeout(zoomTimer.current);
    zoomTimer.current = setTimeout(() => setZoomReplay(0), ZOOMIES_MS + ZOOMIES_FADE_MS);
  };
  /* The #1 card takes its colour from the winning breed's own photo (see utils/photoColour.js), so a
     white Spitz and a golden Labrador do not get the same card. The colour is always dark enough for
     the white text on it; if it cannot be worked out we simply keep the brand orange from the CSS. */
  const topSrc = top?.img ? `/${top.img}` : null;
  const [measured, setMeasured] = useState({ src: null, hex: null });
  useEffect(() => {
    if (!topSrc) return undefined;
    let live = true;
    cardColourFor(topSrc).then((hex) => { if (live) setMeasured({ src: topSrc, hex }); });
    return () => { live = false; };
  }, [topSrc]);
  // Keyed on the photo it was measured from, so a retake never paints the old breed's colour.
  const cardColour = measured.src === topSrc ? measured.hex : null;

  /* The little sitting dog on a card: bark in that breed's voice, then let the zoomies run.
     The #1 match and all four runners-up share this, so they behave identically. */
  const celebrate = (breed) => {
    primeAudio();
    if (playBreedBark({ breed: breed.name, size: breed.size })) track('bark_played', { breed: breed.name, source: 'result' });
    replayZoomies();
  };

  const mixerBtnRef = useRef(null);
  const [shareSheetOpen, setShareSheetOpen] = useState(false); // the fallback share sheet (see results/ShareMatches.jsx)
  const [exploreSeen, setExploreSeen] = useState(getNewTagSeen); // orange "New" tag until the button is used once

  if (!top) return null;

  // Was recomputing its own label from matchPercentage at 85/75/60 cutoffs,
  // with a 4th "Exceptional" tier the engine doesn't have — completely
  // independent of the engine's own `label`, which caps at "Fair" when a
  // severe issue (a bad gate, or the SPACE flag) is present. That's how a
  // 0/15-home-fit breed with a SPACE warning still read "Excellent" here:
  // this function never looked at the flag, only the raw percentage.
  // breed.label is already the right answer — computed once, in one place.

  const suggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return breedsData.filter(b => b.name.toLowerCase().includes(q)).slice(0, 6);
  }, [searchQuery]);

  const openSearched = (breed) => { setSearchQuery(''); onFullProfile(breed); };

  /* The reveal layer is a full-screen portal: while it is up, nothing on the page behind it
     can be seen, so the entrance animations wait rather than playing into a covered page. */
  const revealOpen = Boolean(revealRun && revealRun !== revealSeen);

  const pillBtn = (bg, color, border) => ({
    padding: '12px 24px', background: bg, color, border: border || 'none',
    borderRadius: '50px', cursor: 'pointer', fontWeight: 'var(--weight-semibold)',
    fontFamily: 'var(--font-display)', fontSize: '14px'
  });

  return (
    <div className="results-wrap rbx pbsm" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 16px' }}>
      {revealOpen ? <MatchReveal top={top} matches={matches} onDone={onRevealDone} /> : null}
      {zoomReplay > 0 && createPortal(<ZoomiesLayer key={zoomReplay} level="replay" ms={ZOOMIES_MS} fadeMs={ZOOMIES_FADE_MS} fixed />, document.body)}
      {/* Top row. Same four controls and the same handlers as before, restyled as pills:
          Back on the left, then Tinder for dogs, Retake, Share my matches and See us together.
          On a phone it is one row that scrolls sideways rather than wrapping. */}
      <div className="pbsm__toprow">
        <button onClick={onBack} className="rbx-back pbsm__pill pbsm__pill--white">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          Back
        </button>
        <div className="pbsm__topright">
        {onExploreMore && (
          <button
            type="button"
            className="rbx-explore pbsm__pill pbsm__pill--white"
            aria-label="Tinder for dogs"
            title="Tinder for dogs"
            onClick={() => { setNewTagSeen(); setExploreSeen(true); onExploreMore(); }}
          >
            <CardStackIcon size={20} />
            <span className="rbx-explore-label">Tinder for dogs</span>
            {!exploreSeen && <span className="rbx-explore-new">New</span>}
          </button>
        )}
        {onRetake && (
          <button type="button" className="rbx-retake-hdr pbsm__pill pbsm__pill--white" aria-label="Retake quiz" title="Retake quiz" onClick={onRetake}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M20 12a8 8 0 1 1-2.6-5.9" /><path d="M20 4v4.5h-4.5" /></svg>
          </button>
        )}

        <ShareMatches matches={matches} sheetOpen={shareSheetOpen} onSheetOpenChange={setShareSheetOpen} />
        <AvatarCardButton matches={matches} />
        </div>
      </div>
      <div className="results-header pbsm__titlewrap">
        {/* Squeaky toys beside the heading: only once the reveal layer has closed (never during it). Decoration only. */}
        {!revealOpen && <ToySlots group="results" page="results" />}
        <div className={`pbsm__titleblock${revealOpen ? '' : ' is-in'}`}>
          <h2 className="pbsm__title">
            <span className="rbx-title">
              Your <span className="pbsm__title-hl">pawfect</span><br />matches
              <Heart className="rbx-title-heart" stroke={D_ORANGE} />
              <Sparks className="rbx-title-sparks" />
            </span>
          </h2>
          <p className="pbsm__lede">
            Ranked for your home, your time and your budget. Read the notes before you fall in love.
          </p>
        </div>

        {/* The warnings chip sits at the right of the title block on a desktop and under it on
           a phone. Same items, same messages, same panel when tapped. */}
      {/* Was computed correctly by the engine this whole time (noExcellentMatch,
          showsScheduleDisclaimer, showsPgDisclaimer, showsHomeUnsureDisclaimer)
          and tested in a standalone harness, but never actually wired into this
          component — so none of it ever reached a real user. The allergies
          question's own text promises "we'll flag this clearly"; nothing in
          this file read the answer at all. All five now render here, once,
          before the hero card, since each is about the whole result set or the
          whole answer set — not about any one breed. */}
      {(() => {
        const noExcellent = noExcellentMatch(matches);
        const allergyAns = Array.isArray(answers?.allergies) ? answers.allergies[0] : answers?.allergies;
        const showAllergy = allergyAns === 'mild' || allergyAns === 'diagnosed';
        const showSchedule = top.showsScheduleDisclaimer;
        const showPg = top.showsPgDisclaimer;
        const showUnsure = top.showsHomeUnsureDisclaimer;
        const boxStyle = { borderRadius: '14px', padding: '14px 18px', fontSize: '13.5px', lineHeight: 1.55 };
        const plain = { ...boxStyle, background: '#f8f9fa', border: '1px dashed #d8d2ca', color: 'var(--text-soft)' };
        // All of the notes that used to stack above the first card now live behind ONE
        // "Warnings" button (results/WarningsButton.jsx). Same messages, same wording.
        const items = [];
        if (noExcellent) items.push({ id: 'none', tone: 'warn', node: (
          <div style={{ ...boxStyle, background: '#fff4e5', border: '1px solid #ffd699', color: 'var(--brown)' }}>
            <strong style={{ display: 'block', marginBottom: '4px' }}>{noExcellent.headline}</strong>
            <span style={{ color: 'var(--text-soft)' }}>{noExcellent.reasons.join(' · ')}</span>
          </div>) });
        if (showPg) items.push({ id: 'pg', tone: 'warn', node: (
          <div style={plain}>
            <strong style={{ color: 'var(--brown)' }}>PG / shared accommodation: </strong>
            most PG setups restrict or limit pets, and space here is scored tighter than a self-contained flat.
            Check your landlord's actual pet policy before anything else — this is a fit estimate, not a guarantee
            you're allowed a dog at all.
          </div>) });
        if (showUnsure) items.push({ id: 'unsure', tone: 'warn', node: (
          <div style={plain}>
            <strong style={{ color: 'var(--brown)' }}>Home type not yet known: </strong>
            these results use a typical 2BHK as a neutral placeholder. Come back and answer this once you know —
            home type changes which breeds actually fit, in both directions.
          </div>) });
        if (showAllergy) items.push({ id: 'allergy', tone: 'warn', node: (
          <div style={plain}>
            No dog breed is truly allergen-free, including ones marketed as "hypoallergenic" — two peer-reviewed
            studies found no meaningful difference in allergen protein between breeds. Spend real time with a
            specific dog before committing.
          </div>) });
        if (showSchedule) items.push({ id: 'schedule', tone: 'warn', node: (
          <div style={plain}>
            General welfare note: RSPCA, PDSA, Dogs Trust and Blue Cross all recommend no more than 4 hours alone
            for any dog, regardless of breed — this applies to every result below, not just the ones flagged.
          </div>) });
        // Breeder availability note: shown above results always (not a warning, so it does not blink).
        items.push({ id: 'availability', tone: 'note', node: (
          <div style={{ background: '#F5F9FC', border: '1.5px solid #CCE9F8', borderRadius: '12px', padding: '12px 16px', fontSize: '13px', fontFamily: 'var(--font-body-family)', color: 'var(--brown)', lineHeight: 1.55 }}>
            🛒 <strong>About availability:</strong> if your first-choice breeder doesn't have this breed in stock right now, don't worry — other verified breeders on PAW BUDDY may have your match ready. Always check a second listing before giving up on your top pick.
          </div>) });
        return <WarningsButton items={items} />;
      })()}
      </div>

      <div className="rbx-hero-wrap">
        {/* The marching dashed outline, 10px outside the card. Outside #rec-top-match on purpose:
            the share image captures that element, and this must not appear in it. */}
        <svg className="pbsm__ring" aria-hidden="true" focusable="false" data-html2canvas-ignore="true"><rect /></svg>
        {/* "Your best match!" speech bubble + arrow (decorative) */}
        <div className="rbx-callout rbx-callout--best" aria-hidden="true">
          <span className="rbx-bubble">Your best match!</span>
          <Arrow dir="down" className="rbx-arrow--best" />
        </div>

      {/* #1 hero card */}
      <motion.div
        className="top-match"
        id="rec-top-match"
        onClick={() => onFullProfile(top)}
        ref={heroRef}
        /* Navy by default (see TOP_CARD_USES_BREED_COLOUR). The per-breed colour is one flag away. */
        style={TOP_CARD_USES_BREED_COLOUR && cardColour ? { cursor: 'pointer', background: cardColour } : { cursor: 'pointer' }}
        initial={reducedMotion ? false : { opacity: 0, y: 34, scale: 0.96 }}
        animate={!reducedMotion && revealOpen ? { opacity: 0, y: 34, scale: 0.96 } : { opacity: 1, y: 0, scale: 1 }}
        transition={reducedMotion ? { duration: 0 } : { duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* The photo. First image on the page, so it is NOT lazy-loaded. */}
        <div className="top-match-media">
          <div className="rbx-photo">
          <Crown />
          <img
            src={`/${top.img}`}
            alt={top.name}
            className="top-match-img"
            width="660"
            height="660"
            /* ref as well as onLoad: a cached image can finish before React attaches the
               handler, and then onLoad never fires and the photo stays at opacity 0. */
            ref={(el) => { if (el && el.complete) el.classList.add('is-loaded'); }}
            onLoad={(e) => e.currentTarget.classList.add('is-loaded')}
            onClick={(e) => { e.stopPropagation(); onFullProfile(top); }}
            style={{ cursor: 'pointer' }}
            onError={(e) => { e.target.src = 'https://via.placeholder.com/180?text=Dog'; }}
          />
          </div>
        </div>

        <div className="top-match-info">
          {/* Was a hardcoded "#1 RECOMMENDED" regardless of the engine's own
              label — confirmed a breed labelled "Not recommended" still
              carried this exact badge. Now reflects what the engine actually
              concluded; #1 in the ranking isn't the same claim as "we
              recommend this." */}
          {/* Two pills, as the design board has them. The FIRST one still carries the
              engine's own verdict rather than a flat "No. 1 pick": a breed the engine would
              not recommend must not be dressed up just because it came first. */}
          <div className="pbsm__pills">
            <span className="top-badge pbsm__no1">
              {top.label?.startsWith('Not recommended') ? 'Best available — not recommended'
                : top.label?.startsWith('Fair') ? 'No. 1 — check warnings'
                : 'No. 1 pick'}
            </span>
            {top.label && <span className="pbsm__labelpill" style={labelPill(top.label)}>{top.label}</span>}
          </div>
          <div className="pbsm__namerow">
            <div className="pbsm__nameid">
            <h3 style={{ marginTop: 0, marginBottom: 0, minWidth: 0 }}>{top.name}</h3>
            {/* A small sitting dog next to the name. Decorative art; the button around it plays the bark.
                Left out of the shared image (data-html2canvas-ignore). */}
            <button
              type="button"
              className="rbx-dogbtn"
              data-html2canvas-ignore="true"
              aria-label="Play bark"
              onClick={(e) => {
                e.stopPropagation(); // the card behind it opens the breed profile on tap; this should only bark
                celebrate(top);
              }}
            >
              <DogArt mood="sit" width={56} />
            </button>
            </div>
            <span className="pbsm__heropct">
              <b>{top.matchPercentage}</b><i>%</i>
            </span>
          </div>
          <p className="reason">{top.purpose}</p>

          {/* Fills from 0 to the match percentage once, the first time the card is seen. */}
          <div className="pbsm__bar" aria-hidden="true">
            <span className="pbsm__barfill" style={{ width: heroSeen ? pctWidth : '0%' }} />
          </div>
          {/* The long "You wanted a family companion, and the ... fits" paragraph used to sit
              here and on every runner-up. Removed on 2026-10-20: it was the tallest thing on
              each card and said little the tags and warnings do not. The reasoning is still in
              the Full Profile. */}

          {top.warnings?.length > 0 && (
            <div className="pbsm__warns">
              {top.warnings.map((w, i) => (
                <p className="pbsm__warn" key={i}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l10 18H2z" /><path d="M12 10v5M12 18v.5" /></svg>
                  <span>{w}</span>
                </p>
              ))}
            </div>
          )}

          <div className="match-tags" style={{ marginTop: '15px' }}>
            {top.tags?.map((tag) => (
              <span key={tag} className="match-tag">{tag}</span>
            ))}
          </div>

          {/* One small line through to the heat check for this exact breed. Hidden when the breed is not in
              the heat data, so it can never link to a page that would have to guess. Not part of the
              shared image. */}
          {hasHeatData(top.name) && (
            <p className="rbx-heatline" data-html2canvas-ignore="true" style={{ marginTop: '12px' }}>
              <Link
                to={'/heat-check?breed=' + encodeURIComponent(top.name)}
                onClick={(e) => e.stopPropagation()}
              >
                Check this breed in your city &rarr;
              </Link>
            </p>
          )}

          {/* Stickers for this exact breed, if we drew a pack for it. The pack itself sits at the bottom of
              the page; this is just the signpost. Hidden entirely until STICKERS_LIVE is on. */}
          {STICKERS_LIVE && packForBreed(top.name) && (
            <p className="rbx-heatline" data-html2canvas-ignore="true" style={{ marginTop: '6px' }}>
              <a
                href="#rbx-stickers"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  document.getElementById('rbx-stickers')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              >
                Get {top.name} stickers &rarr;
              </a>
            </p>
          )}

          {/* Bark: "Hear it" (the matched #1 breed is never locked) and the remix sheet. Not part of the shared image. */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }} data-html2canvas-ignore="true">
            <BarkButton breed={top} source="result" alwaysUnlocked tone="dark" />
            <button type="button" ref={mixerBtnRef} className="pbbk pbbk--dark" onClick={(e) => { e.stopPropagation(); setMixerOpen(true); }}>Remix the bark</button>
          </div>

          {/* The honest version of "what am I actually signing up for": one day with a
              3-month-old puppy of this breed, built from this visitor's own answers. */}
          <div className="pbsm__dayrow" data-html2canvas-ignore="true">
            <button type="button" className="rbx-daybtn pbsm__daylink" onClick={(e) => { e.stopPropagation(); setDayBreed(top); }}>
              A day with {top.name} &rarr;
            </button>
          </div>

          <div className="pbsm__heroactions">
            <button
              className="pbsm__hbtn pbsm__hbtn--profile"
              onClick={(e) => { e.stopPropagation(); onFullProfile(top); }}
            >
              Full profile
            </button>
            <button
              className="pbsm__hbtn pbsm__hbtn--buy"
              onClick={(e) => { e.stopPropagation(); onBuy(top); }}
            >
              Buy
            </button>
            {/* Adoption path — shown for adoption-typical breeds (Pariah, Mudhol, Rajapalayam
                and any breed the network has no breeder listings for). Routing to a real
                rescue/shelter page is a TODO on the data side; the button is there so the
                UX exists before the partner list is ready. */}
            <button
              disabled
              className="pbsm__hbtn pbsm__hbtn--adopt"
              title="Adoption partners coming soon — check back before launch"
            >
              Adoption – Coming Soon
            </button>
          </div>
        </div>
        <Heart className="rbx-hero-heart" />
        <Sparks className="rbx-hero-sparks" stroke={D_NAVY} />
      </motion.div>
      </div>

      {/* #2–#5 grid, staggered. The faint pattern lives on this wrapper only: not behind
          the #1 card (#rec-top-match, which the share image captures), banners or paragraphs. */}
      <style>{`

        .rbx-pattern{background-image:var(--rbx-pattern);background-repeat:repeat;padding:14px 0;border-radius:20px}
        @media (prefers-reduced-transparency: reduce){.rbx-pattern{background-image:none}}
        @media (forced-colors: active){.rbx-pattern{background-image:none}}
        .rbx-explore{position:relative;min-width:40px;min-height:40px;padding:0 12px;display:inline-flex;align-items:center;gap:8px;background:#FFFFFF;color:#011E4A;border:1.5px solid #011E4A;border-radius:50px;cursor:pointer;font:600 13px var(--font-display, 'Satoshi', sans-serif)}
        .rbx-explore:focus-visible{outline:3px solid #011E4A;outline-offset:2px}
        /* hit area 44px tall while the button stays level with its 40px neighbours (same trick as .pbsh__btn) */
        .rbx-explore::after,.rbx-retake-hdr::after{content:'';position:absolute;inset:-2px 0}
        .rbx-explore-label{display:none}
        /* On phones the Retake control is also in this top row, so it can never be hidden by the browser's bottom bar. */
        .rbx-retake-hdr{position:relative;box-sizing:border-box;min-width:44px;height:40px;padding:0 10px;display:inline-flex;align-items:center;justify-content:center;background:#FFFFFF;border:1.5px solid #011E4A;border-radius:50px;cursor:pointer}
        .rbx-retake-hdr:focus-visible{outline:3px solid #011E4A;outline-offset:2px}
        @media (min-width:768px){.rbx-retake-hdr{display:none}}
        .rbx-explore-new{position:absolute;z-index:1;top:-8px;right:-6px;padding:1px 7px;border-radius:999px;background:#F5691A;color:#FFFFFF;font:800 10px 'Satoshi', sans-serif;letter-spacing:.04em}
        @media (min-width:480px){.rbx-explore-label{display:inline}}
        @media (pointer:coarse){.rbx-explore-new{font-size:11px}}
      `}</style>
      {/* Both the heading and the patterned panel are gated on there actually being runner-ups.
          A set of answers where everything else scored "Not recommended" leaves `rest` empty -
          weak-result run: Indian Spitz at 39% and nothing behind it - and a "More good fits"
          heading over an empty box reads as a loading failure. */}
      {rest.length > 0 && <h3 className="pbsm__more">More good fits</h3>}

      {rest.length > 0 && (
      <div className="rbx-pattern" style={{ '--rbx-pattern': RESULTS_PATTERN }}>
      {/* The entrance stagger is the card's own (see MatchCard): one IntersectionObserver
          each, fired once. framer-motion's whileInView was doing the same job, but it also
          owned `transform`, which the hover lift and the press scale now need. */}
      <div className="breeds-grid pbsm__grid">
        {rest.map((breed, index) => (
          <MatchCard
            key={breed.id || breed.name}
            breed={breed}
            rank={index + 2}
            showHeatLink
            barkSource="result"
            onBuy={(b) => onBuy(b)}
            onFullProfile={(b) => onFullProfile(b)}
            onImageClick={(b) => onFullProfile(b)}
            onCelebrate={celebrate}
            onDayInLife={(b) => setDayBreed(b)}
          />
        ))}
      </div>
      </div>
      )}

      {/* Fewer than 5 breeds fit: say so plainly instead of leaving an empty grid, and point to the
          rest. Only breeds the engine does not label "Not recommended" are ever listed as matches. */}
      {matches.length < 5 && (
        <div style={{ margin: '22px auto 0', maxWidth: '620px', padding: '16px 20px', borderRadius: '16px', background: '#FFF1E6', border: '1px solid #F3DCC8', textAlign: 'center' }}>
          <strong style={{ display: 'block', color: 'var(--brown)', fontSize: '15px', marginBottom: '4px' }}>
            Only {matches.length} {matches.length === 1 ? 'breed fits' : 'breeds fit'} your answers well enough to recommend
          </strong>
          <span style={{ fontSize: '13.5px', color: 'var(--text-soft)', lineHeight: 1.5 }}>
            {hiddenCount > 0
              ? `The next closest ${hiddenCount === 1 ? 'breed scored' : 'breeds scored'} "Not recommended" for you, so we haven't listed ${hiddenCount === 1 ? 'it' : 'them'} as matches. `
              : ''}
            You can still look through the rest, each marked with how well it fits you.
          </span>
          {onExploreMore && (
            <div style={{ marginTop: '12px' }}>
              <button type="button" onClick={onExploreMore} style={pillBtn('var(--orange)', 'white')}>Browse the other breeds</button>
            </div>
          )}
        </div>
      )}
      {matches.length >= 5 && hiddenCount > 0 && (
        <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-soft)', margin: '18px auto 0', maxWidth: '560px', lineHeight: 1.5 }}>
          {hiddenCount} other breed{hiddenCount === 1 ? '' : 's'} scored "Not recommended" for your answers, so we haven't listed {hiddenCount === 1 ? 'it' : 'them'} as matches.
        </p>
      )}

      {/* Have a breed in mind? — search */}
      <div className="pbsm__box" style={{ position: 'relative', marginTop: '44px', padding: '30px' }}>
        <div className="rbx-callout rbx-callout--check" aria-hidden="true">
          <span className="rbx-hand">Let's check!</span>
          <Arrow dir="left" className="rbx-arrow--small" />
        </div>
        <h3 className="pbsm__h3">Have a breed in mind?</h3>
        <p style={{ color: 'var(--text-soft)', fontSize: '14px', marginBottom: '20px' }}>Type any breed name and we'll tell you the pros &amp; cons based on YOUR specific lifestyle answers</p>
        <div style={{ display: 'flex', gap: '10px', position: 'relative', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 220px', position: 'relative' }}>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="husky"
              className="pbsm__input"
              style={{ width: '100%', padding: '15px 20px', fontSize: '16px' }}
            />
            {suggestions.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, width: '100%', background: 'white', border: '1.5px solid #CCE9F8', borderRadius: '12px', maxHeight: '220px', overflowY: 'auto', zIndex: 10, marginTop: '6px', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}>
                {suggestions.map(b => (
                  <div
                    key={b.name}
                    onClick={() => openSearched(b)}
                    style={{ padding: '12px', cursor: 'pointer', borderBottom: '1px solid #CCE9F8', display: 'flex', alignItems: 'center', gap: '10px' }}
                    onMouseOver={e => e.currentTarget.style.background = '#F5F9FC'}
                    onMouseOut={e => e.currentTarget.style.background = 'white'}
                  >
                    <img src={`/${b.img}`} alt={b.name} style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} />
                    <span style={{ fontFamily: 'var(--font-body-family)', color: 'var(--brown)', fontWeight: 'var(--weight-regular)' }}>{b.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => {
              const b = breedsData.find(x => x.name.toLowerCase().includes(searchQuery.trim().toLowerCase()));
              if (b) openSearched(b); else alert('Breed not found. Try the suggestions dropdown.');
            }}
            className="pbsm__checkbtn"
            style={{ flex: '1 1 150px' }}
          >
            Check This Breed
          </button>
        </div>
      </div>

      {/* Share your results */}
      <div ref={shareCardRef} className="pbsm__box" style={{ position: 'relative', marginTop: '28px', textAlign: 'center', padding: '40px' }}>
        <div className="rbx-callout rbx-callout--share" aria-hidden="true">
          <span className="rbx-hand">Share the paw love! <Heart className="rbx-inline-heart" stroke={D_ORANGE} /></span>
          <Arrow dir="left" className="rbx-arrow--small" />
        </div>
        <h3 className="pbsm__h3">Share your results</h3>
        <p style={{ color: 'var(--text-soft)', fontSize: '14px', marginBottom: '20px' }}>Let your friends know what breed suits you!</p>
        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {/* The old Share Results / Share on WhatsApp / Download as Image buttons now live in ONE
              flow: the "Share my matches" button in the header. This opens its sheet (WhatsApp,
              Copy link, Download image), which is the same set of options. */}
          <button className="rbx-pill" onClick={() => setShareSheetOpen(true)} style={pillBtn('var(--orange)', '#011E4A')}>More ways to share</button>
          <button className="rbx-pill" onClick={() => setShowFeedback(true)} style={pillBtn('#FFFFFF', '#011E4A', '1.5px solid #011E4A')}>Share Feedback</button>
          <button className="rbx-pill" onClick={onRetake} style={pillBtn('#FFFFFF', '#011E4A', '1.5px solid #011E4A')}>Retake Quiz</button>
        </div>
      </div>

      {/* The sticker pack for the top match. Last thing on the page: it must never get between the person
          and their results, and the images only load when this scrolls into view. */}
      {(() => {
        const pack = packForBreed(top.name);
        return pack ? (
          <div id="rbx-stickers">
            <StickerPack pack={pack} heading={`${top.name} sticker pack`} />
          </div>
        ) : null;
      })()}

      {/* The round paw in the corner. It fans out the three places people go next, and tucks away once the
          end-of-page card (which carries the same Retake Quiz button) scrolls into view, so it never sits
          on the footer links. */}
      <InfoFan
        tucked={fabTucked}
        items={[
          { key: 'retake', label: 'Retake quiz', onClick: () => onRetake && onRetake() },
          { key: 'compare', label: 'Compare breeds', onClick: () => onCompareBreeds && onCompareBreeds() },
          { key: 'tinder', label: 'Tinder', onClick: () => onExploreMore && onExploreMore() },
          { key: 'games', label: 'Games', onClick: () => onPlayGames && onPlayGames() },
        ].filter((it) => (it.key !== 'compare' || onCompareBreeds) && (it.key !== 'games' || onPlayGames))}
      />

      {dayBreed && (
        <Suspense fallback={null}>
          <DayInLife
            breed={dayBreed}
            answers={answers}
            city={quizCity}
            onClose={() => setDayBreed(null)}
            /* "Find breeders for ..." reuses the card's own Buy path — no second flow. */
            onFindBreeders={(b) => { setDayBreed(null); onBuy(b); }}
          />
        </Suspense>
      )}

      {mixerOpen && (
        <Suspense fallback={null}>
          <BarkMixer open={mixerOpen} onClose={() => setMixerOpen(false)} breed={top} returnFocusRef={mixerBtnRef} />
        </Suspense>
      )}

      <FeedbackModal isOpen={showFeedback} onClose={() => setShowFeedback(false)} user={user} />

      <style>{`
        /* PAW BUDDY brand system — scoped to the quiz results view only */
        .rbx {
          --orange: #F57A1B;
          --orange-pale: #CCE9F8;
          --brown: #011E4A;
          --text-soft: rgba(5, 12, 30, 0.72);
          --text-color: #050C1E;
          --cream: #F5F9FC;
          --shadow: none;
          --shadow-lg: none;
          --font-display: 'Clash Display', 'Sora', sans-serif;
          --font-accent: 'Clash Display', 'Sora', sans-serif;
          --font-body-family: 'Satoshi', 'Inter', sans-serif;
          color: #050C1E;
          font-family: 'Satoshi', 'Inter', sans-serif;
        }
        .rbx h2, .rbx h3, .rbx h4 {
          font-family: 'Clash Display', 'Sora', sans-serif !important;
          font-weight: 700 !important;
          letter-spacing: -0.01em;
        }
        .rbx button, .rbx input, .rbx .match-tag, .rbx .pill, .rbx .top-badge {
          font-family: 'Satoshi', 'Inter', sans-serif !important;
        }
        /* hero card: flat brand orange, crisp navy border */
        /* The background is replaced inline with the breed's own colour once the photo has been read;
           this stays as the fallback and as the colour everything else on the card was designed against. */
        .rbx .top-match { transition: background-color 420ms ease; }
        @media (prefers-reduced-motion: reduce) { .rbx .top-match { transition: none; } }
        .rbx .top-match {
          background: #F57A1B;
          border: 2px solid #011E4A;
          box-shadow: none;
        }
        .rbx .top-badge { background: #011E4A !important; color: #FFFFFF; }   /* label text differs per verdict; colour stays on-brand */
        .rbx .match-tag { background: #FFFFFF; color: #011E4A; font-weight: 700; }
        .rbx .top-match-img { border: 3px solid #FFFFFF; background: #CCE9F8; }
        .rbx .match-score, .rbx .breed-rank { font-family: 'Clash Display', 'Sora', sans-serif !important; }
        /* secondary cards: crisp light-blue border, navy on hover */
        .rbx .breed-card { background: #FFFFFF; border: 2px solid #CCE9F8; box-shadow: none; }
        .rbx .breed-card:hover { border-color: #011E4A; box-shadow: none; }
        .rbx .breed-card-img { background: #CCE9F8; }
        .rbx .breed-rank { background: #011E4A; color: #FFFFFF; }
        .rbx .pill-orange { background: #CCE9F8; color: #011E4A; }
        .rbx .breed-reason-box {
          background: #F5F9FC !important;
          border-left: 3px solid #F57A1B !important;
          color: #050C1E !important;
        }
        .rbx .breed-btn--buy { background: #F57A1B !important; color: #FFFFFF !important; border: 1.5px solid #F57A1B !important; }
        .rbx .breed-btn--profile { background: #FFFFFF !important; color: #011E4A !important; border: 1.5px solid #011E4A !important; }
        /* ── Doodles: layout ── */
        .rbx .top-match { position: relative; }
        .rbx-hero-wrap { position: relative; padding-top: 50px; }
        .rbx-callout { position: absolute; z-index: 3; pointer-events: none; user-select: none; }
        .rbx-callout--best { left: 20px; top: 0; }
        .rbx-bubble {
          position: relative;
          display: inline-block;
          background: #FFFFFF;
          border: 2px solid #011E4A;
          border-radius: 18px;
          padding: 5px 16px 7px;
          font: 600 22px/1 'Caveat', 'Segoe Print', cursive;
          color: #011E4A;
          transform: rotate(-3deg);
          transform-origin: 30% 100%;
        }
        .rbx-bubble::after {
          content: '';
          position: absolute;
          left: 96px; bottom: -9px;
          width: 14px; height: 14px;
          background: #FFFFFF;
          border-right: 2px solid #011E4A;
          border-bottom: 2px solid #011E4A;
          transform: rotate(45deg);
        }
        .rbx-arrow { position: absolute; width: 60px; height: 60px; overflow: visible; }
        .rbx-arrow--best { left: 100px; top: 34px; }
        .rbx-photo { position: relative; width: 180px; flex-shrink: 0; }
        .rbx-crown {
          position: absolute;
          left: 50%; top: -26px;
          width: 58px;
          z-index: 2;
          transform: translateX(-50%) rotate(-7deg);
          pointer-events: none;
        }
        .rbx-doodle { position: absolute; pointer-events: none; overflow: visible; }
        .rbx-title { position: relative; display: inline-block; }
        .rbx-title-heart { left: -40px; top: -8px; width: 28px; rotate: -14deg; }
        .rbx-title-sparks { right: -44px; top: -14px; width: 32px; }
        .rbx-hero-heart { right: 26px; top: 16px; width: 32px; rotate: 12deg; }
        .rbx-hero-sparks { right: 66px; top: 10px; width: 30px; }
        .rbx-hand {
          display: inline-block;
          font: 600 27px/1 'Caveat', 'Segoe Print', cursive;
          color: #011E4A;
          transform: rotate(-5deg);
          white-space: nowrap;
        }
        .rbx-inline-heart { position: static; display: inline-block; width: 20px; height: 20px; vertical-align: -3px; rotate: 10deg; }
        .rbx-callout--check { right: 70px; top: 16px; }
        .rbx-callout--share { right: 56px; top: 16px; }
        .rbx-arrow--small { right: 14px; top: 30px; width: 54px; height: 54px; }
        .rbx-callout--check .rbx-arrow--small,
        .rbx-callout--share .rbx-arrow--small { position: absolute; }

        @media (max-width: 900px) {
          /* narrower boxes: keep the handwriting as a tag on the box edge, no arrow */
          .rbx-callout--check, .rbx-callout--share { top: -17px; right: 20px; }
          .rbx-callout--check .rbx-arrow, .rbx-callout--share .rbx-arrow { display: none; }
        }
        @media (max-width: 640px) {
          .rbx-hero-wrap { padding-top: 56px; }
          .rbx-callout--best { left: 0; right: 0; text-align: center; }
          .rbx-bubble::after { left: calc(50% - 7px); }
          .rbx-arrow--best { left: calc(50% + 26px); top: 36px; }
          .rbx-title-heart { display: none; }   /* would sit on the Back button on phones */
          .rbx-title-sparks { right: 2px; top: -28px; }
          .rbx-hero-heart { right: 18px; top: 14px; width: 28px; }
          .rbx-hero-sparks { right: 54px; top: 8px; width: 26px; }
          .rbx-hand { font-size: 24px; }
        }

        /* ── Doodles: motion (once, on arrival) ── */
        @keyframes rbx-pop { 0% { opacity: 0; scale: 0.6; } 70% { opacity: 1; scale: 1.06; } 100% { opacity: 1; scale: 1; } }
        @keyframes rbx-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes rbx-draw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
        @keyframes rbx-beat { 0%, 100% { scale: 1; } 50% { scale: 1.12; } }
        @keyframes rbx-crown-drop {
          0% { opacity: 0; transform: translateX(-50%) translateY(-20px) rotate(-22deg); }
          70% { opacity: 1; transform: translateX(-50%) translateY(2px) rotate(-4deg); }
          100% { opacity: 1; transform: translateX(-50%) rotate(-7deg); }
        }
        .rbx-crown { animation: rbx-crown-drop 750ms cubic-bezier(0.34, 1.4, 0.64, 1) 450ms both; }
        .rbx-bubble { animation: rbx-pop 520ms cubic-bezier(0.34, 1.4, 0.64, 1) 700ms both; }
        .rbx-arrow-line { stroke-dasharray: 1; stroke-dashoffset: 1; animation: rbx-draw 520ms ease-out 1100ms forwards; }
        .rbx-arrow-head { opacity: 0; animation: rbx-fade 200ms ease-out 1550ms forwards; }
        .rbx-title-heart, .rbx-title-sparks, .rbx-hero-heart, .rbx-hero-sparks { animation: rbx-fade 450ms ease-out 900ms both; }
        .rbx-title-heart, .rbx-hero-heart { animation: rbx-fade 450ms ease-out 900ms both, rbx-beat 3.4s ease-in-out 1.6s infinite; }
        .rbx-hand { animation: rbx-fade 600ms ease-out 400ms both; }
        .rbx-callout--check .rbx-arrow-line, .rbx-callout--share .rbx-arrow-line { animation-delay: 700ms; }
        .rbx-callout--check .rbx-arrow-head, .rbx-callout--share .rbx-arrow-head { animation-delay: 1150ms; }
        @media (prefers-reduced-motion: reduce) {
          .rbx-crown { animation: none; opacity: 1; transform: translateX(-50%) rotate(-7deg); }
          .rbx-bubble, .rbx-hand, .rbx-title-heart, .rbx-title-sparks, .rbx-hero-heart, .rbx-hero-sparks { animation: none; opacity: 1; scale: 1; }
          .rbx-arrow-line { animation: none; stroke-dasharray: none; stroke-dashoffset: 0; }
          .rbx-arrow-head { animation: none; opacity: 1; }
        }
        .rbx-heatline{margin:0}
        /* "See a day with ..." on the #1 card. The card behind it is the breed's own colour,
           so this is the light-on-dark treatment (same family as .pbbk--dark). */
        .rbx-daybtn{box-sizing:border-box;width:100%;min-height:48px;padding:0 18px;display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1.5px solid rgba(255,255,255,.75);border-radius:50px;background:rgba(255,255,255,.16);color:#FFFFFF;font:700 15px var(--font-display,'Satoshi',sans-serif);cursor:pointer;line-height:1.25;text-align:center}
        .rbx-daybtn:hover{background:rgba(255,255,255,.26)}
        .rbx-daybtn:focus-visible{outline:3px solid #FFFFFF;outline-offset:2px}
        .rbx-heatline a{display:inline-flex;align-items:center;min-height:44px;color:#FFD9BD;font:700 14px var(--font-display,'Satoshi',sans-serif);text-decoration:underline;text-underline-offset:3px}
        .rbx-dogbtn{background:none;border:0;padding:2px;margin:0;cursor:pointer;border-radius:12px;display:inline-flex;-webkit-tap-highlight-color:transparent}
        .rbx-dogbtn:focus-visible{outline:3px solid #fff;outline-offset:2px}
        .rbx-dogbtn:active{transform:scale(.94)}
        /* ══════════════════════════════════════════════════════════════════════════════════════
           SOFT MODERN - the Top 5 results section only. Scoped to .pbsm so nothing else moves.

           WHERE TO EDIT
           - fonts ............ --pb-font-display / --pb-font-body / --pb-font-hand just below
           - card colours ..... --pb-navy, --pb-navy-2, --pb-cream, --pb-peach and friends
           - animation timing . --pb-in (entrance), --pb-bar (progress bar), --pb-hover
           - photos ........... .pbmc__img and .top-match-img; the placeholder is .pbmc__noimg,
                                drawn in components/results/MatchCard.jsx
           ══════════════════════════════════════════════════════════════════════════════════════ */
        .pbsm{
          --pb-font-display:'Gabarito',system-ui,sans-serif;
          --pb-font-body:'Figtree',system-ui,sans-serif;
          --pb-font-hand:'Caveat',cursive;

          --pb-orange:#F5691A;
          --pb-orange-dark:#C84B0A;
          --pb-navy:#011E4A;
          --pb-navy-2:#0B3270;
          --pb-cream:#FFF6EC;
          --pb-peach:#FFD9BD;
          --pb-peach-light:#FFE9D6;
          --pb-grey:#3C4F6B;
          --pb-amber:#FFE9B8;
          --pb-amber-ink:#5C3D00;

          --pb-in:400ms;
          --pb-bar:900ms;
          --pb-hover:200ms;

          font-family:var(--pb-font-body);
          color:var(--pb-navy);
        }
        .pbsm *,.pbsm *::before,.pbsm *::after{box-sizing:border-box}
        .pbsm :focus-visible{outline:3px solid var(--pb-orange);outline-offset:2px}

        /* ── top row ─────────────────────────────────────────────────────────────────── */
        .pbsm__toprow{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px}
        .pbsm__topright{display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:flex-end}
        .pbsm .pbsm__pill,.pbsm .rbx-back,.pbsm .rbx-explore,.pbsm .rbx-retake-hdr{
          min-height:44px;padding:0 20px;display:inline-flex;align-items:center;gap:8px;
          background:#FFFFFF;color:var(--pb-navy);border:0;border-radius:999px;cursor:pointer;
          font:700 15px var(--pb-font-body);box-shadow:0 1px 3px rgba(1,30,74,.06);
          transition:transform var(--pb-hover) ease,box-shadow var(--pb-hover) ease;
        }
        /* Left as it was: this chip is a PHONE control. On a desktop the end-of-page
           "Share your results" card carries Retake Quiz, so showing both would be new UI. */
        .pbsm .rbx-retake-hdr{padding:0;width:44px;justify-content:center}
        .pbsm .pbsm__pill--white{background:#FFFFFF;color:var(--pb-navy)}

        /* "Share my matches" and "See us together" draw their own buttons in their own
           components (results/ShareMatches.jsx, results/avatarCard/AvatarCardButton.jsx).
           Those files are shared code, so they are NOT edited - the pills are restyled from
           here instead, where .pbsm scopes it to this section. Share is the one solid
           orange button in the row; See us together is a white pill like the rest. */
        .pbsm .pbsh__btn,.pbsm .pbav__btn{
          height:auto;min-height:44px;padding:0 20px;border:0;border-radius:999px;
          font:800 15px var(--pb-font-body);box-shadow:0 1px 3px rgba(1,30,74,.06);
          transition:transform var(--pb-hover) ease,box-shadow var(--pb-hover) ease;
        }
        .pbsm .pbsh__btn{background:var(--pb-orange);color:var(--pb-navy)}
        .pbsm .pbav__btn{background:#FFFFFF;color:var(--pb-navy)}
        .pbsm .pbsh__btn:focus-visible,.pbsm .pbav__btn:focus-visible{outline:3px solid var(--pb-orange);outline-offset:2px}
        @media (hover:hover){
          .pbsm .pbsm__pill:hover,.pbsm .pbsh__btn:not(:disabled):hover,.pbsm .pbav__btn:hover{transform:translateY(-2px);box-shadow:0 6px 16px rgba(1,30,74,.12)}
        }
        .pbsm .pbsm__pill:active,.pbsm .pbsh__btn:not(:disabled):active,.pbsm .pbav__btn:active{transform:scale(.98)}
        @media (max-width:767px){
          .pbsm__toprow{display:flex;gap:8px;overflow-x:auto;overflow-y:hidden;flex-wrap:nowrap;
            scrollbar-width:none;-webkit-overflow-scrolling:touch;padding:0 16px 2px;margin:0 -16px 18px}
          .pbsm__toprow::-webkit-scrollbar{display:none}
          .pbsm__topright{flex-wrap:nowrap}
          .pbsm .pbsm__pill,.pbsm .rbx-back,.pbsm .rbx-explore,.pbsm .pbsh__btn,.pbsm .pbav__btn{flex:none;white-space:nowrap}
        }

        /* ── title ───────────────────────────────────────────────────────────────────── */
        .pbsm__titlewrap{position:relative;display:flex;align-items:flex-end;justify-content:space-between;gap:40px;text-align:left;margin:40px 0 28px}
        .pbsm__titleblock{min-width:0}
        /* The legacy block above carries '.rbx h2, .rbx h3, .rbx h4 { font-family: 'Clash
           Display' !important }'. It is left in place for the rest of the page, so every
           heading restyled here has to answer it with !important of its own. */
        .pbsm .pbsm__title{margin:0;font-family:var(--pb-font-display) !important;font-weight:800;font-size:72px;line-height:.98;letter-spacing:-.03em;color:var(--pb-navy)}
        .pbsm .pbsm__title-hl{color:var(--pb-orange)}
        .pbsm__lede{margin:18px 0 0;font-size:18px;line-height:1.5;color:var(--pb-grey);max-width:520px}
        .pbsm .pbsm__more{margin:44px 0 18px;font-family:var(--pb-font-display) !important;font-weight:800;font-size:36px;letter-spacing:-.02em;color:var(--pb-navy)}
        /* The title fades up once, when the reveal layer is no longer covering the page. */
        .pbsm__titleblock.is-in{animation:pbsm-titlein var(--pb-in) cubic-bezier(.2,.8,.3,1) both}
        @keyframes pbsm-titlein{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}

        .pbsm .pbwn__row{margin:0;flex:none}
        .pbsm .pbwn__btn{min-height:44px;padding:0 22px;background:var(--pb-amber);border:0;color:var(--pb-amber-ink);font:700 15px var(--pb-font-body);border-radius:999px}
        .pbsm .pbwn__btn.is-warn{animation:pbsm-wiggle .5s ease-in-out 1.2s 2}
        .pbsm .pbwn__count{background:var(--pb-amber-ink);color:var(--pb-amber)}
        @keyframes pbsm-wiggle{0%,100%{transform:rotate(0)}25%{transform:rotate(3deg)}75%{transform:rotate(-3deg)}}

        /* ── the #1 card ─────────────────────────────────────────────────────────────── */
        .pbsm .rbx-hero-wrap{position:relative;margin-top:0}
        /* styles/index.css gives .top-match 'animation: slideUp .5s', and slideUp starts at
           opacity:0. Two things went wrong with that here. On screen a CSS animation outranks an
           inline style, so it was quietly overriding framer-motion's own entrance on this card.
           In the share image it was worse: html2canvas clones the page, the clone restarts the
           animation from frame 0, and the capture caught the card at about 75% opacity - navy
           came out #435877, the amber warning strip and the orange button were washed out with
           it. One entrance, owned by framer-motion, fixes both. */
        .pbsm .top-match{
          animation:none;
          background:var(--pb-navy);color:var(--pb-cream);
          border:2px solid var(--pb-navy-2);border-radius:36px;padding:36px;
          display:flex;gap:40px;align-items:stretch;
          transition:transform var(--pb-hover) ease,box-shadow var(--pb-hover) ease;
        }
        @media (hover:hover){.pbsm .top-match:hover{transform:translateY(-4px)}}
        .pbsm .top-match:active{transform:scale(.98)}
        .pbsm .top-match-media{width:330px;flex:0 0 330px;display:block}
        .pbsm .rbx-photo{position:relative;width:100%;height:100%}
        /* The fade is a TRANSITION driven by the load, never a CSS animation. An animation here
           cost the share image its photo: html2canvas clones the card, the clone restarts
           'from{opacity:0}', and the capture came out with an empty navy column where the dog
           should be. A transition does not re-run in a static clone. */
        .pbsm .top-match-img{width:100%;height:100%;min-height:330px;object-fit:cover;border-radius:26px;border:2px solid var(--pb-navy-2);display:block;opacity:0;transition:opacity 300ms ease}
        .pbsm .top-match-img.is-loaded{opacity:1}
        .pbsm .top-match-info{flex:1;min-width:0;display:flex;flex-direction:column}

        .pbsm__pills{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
        .pbsm .top-badge.pbsm__no1{background:var(--pb-orange) !important;color:var(--pb-navy) !important;font:800 12px var(--pb-font-body);letter-spacing:.1em;text-transform:uppercase;border-radius:999px;padding:7px 14px;margin:0;display:inline-block}
        .pbsm__labelpill{font:800 13px var(--pb-font-body);border-radius:999px;padding:7px 14px;display:inline-block}

        .pbsm__namerow{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-top:16px}
        .pbsm__nameid{display:flex;align-items:center;gap:8px;min-width:0}
        .pbsm .top-match-info h3{margin:0;font-family:var(--pb-font-display) !important;font-weight:800;font-size:60px;line-height:1;letter-spacing:-.03em;color:var(--pb-cream)}
        .pbsm__heropct{display:flex;align-items:baseline;gap:4px;flex:none;font-variant-numeric:tabular-nums}
        .pbsm__heropct b{font-family:var(--pb-font-display);font-weight:800;font-size:84px;line-height:1;color:var(--pb-orange);letter-spacing:-.04em}
        .pbsm__heropct i{font-family:var(--pb-font-display);font-weight:800;font-size:36px;font-style:normal;color:var(--pb-orange)}
        .pbsm .top-match-info .reason{margin:6px 0 0;font-size:17px;color:#C9D6EE;font-family:var(--pb-font-body)}

        .pbsm__bar{height:8px;background:var(--pb-navy-2);border-radius:999px;margin-top:18px;overflow:hidden}
        .pbsm__barfill{display:block;height:100%;background:var(--pb-orange);border-radius:999px;transition:width var(--pb-bar) cubic-bezier(.2,.8,.3,1)}

        .pbsm .match-tags{display:flex;gap:8px;flex-wrap:wrap;margin-top:18px}
        .pbsm .match-tag{background:var(--pb-navy-2);color:var(--pb-cream);border-radius:999px;padding:7px 16px;font:700 14px var(--pb-font-body)}
        .pbsm .rbx-heatline a{color:#FFB88A;font:700 16px var(--pb-font-body);text-decoration:none}
        .pbsm .rbx-heatline a:hover{text-decoration:underline}

        .pbsm__warns{display:flex;flex-direction:column;gap:8px;margin-top:14px}
        .pbsm__warn{display:flex;gap:10px;align-items:flex-start;margin:0;background:var(--pb-amber);color:var(--pb-amber-ink);border-radius:14px;padding:9px 12px;font:500 14px/1.4 var(--pb-font-body)}
        .pbsm__warn svg{flex:none;margin-top:2px}

        .pbsm__dayrow{margin-top:14px}
        .pbsm .pbsm__daylink{background:none;border:0;padding:8px 0;color:var(--pb-cream);font:700 15px var(--pb-font-body);cursor:pointer;width:auto;min-height:44px}
        .pbsm .pbsm__daylink:hover{text-decoration:underline}

        .pbsm__heroactions{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:24px}
        .pbsm .pbsm__hbtn{min-height:48px;padding:0 32px;border:0;border-radius:999px;cursor:pointer;font:800 16px var(--pb-font-body);transition:transform var(--pb-hover) ease}
        @media (hover:hover){.pbsm .pbsm__hbtn:not(:disabled):hover{transform:translateY(-2px)}}
        .pbsm .pbsm__hbtn:not(:disabled):active{transform:scale(.98)}
        .pbsm .pbsm__hbtn--profile{background:var(--pb-orange);color:var(--pb-navy)}
        .pbsm .pbsm__hbtn--buy{background:var(--pb-cream);color:var(--pb-navy)}
        .pbsm .pbsm__hbtn--adopt{background:transparent;color:var(--pb-cream);border:1.5px dashed rgba(255,255,255,.55);font-size:13px;opacity:.85;cursor:not-allowed;padding:0 20px}
        /* "Hear it" and "Remix the bark" read as quiet text links, but a fingertip still needs
           44px, so the height comes from padding rather than from a visible box. */
        .pbsm .pbbk{min-height:44px;padding-top:0;padding-bottom:0;display:inline-flex;align-items:center}
        .pbsm .pbbk--dark{color:#C9D6EE}
        .pbsm .rbx-dogbtn{min-width:44px;min-height:44px;display:inline-flex;align-items:center;justify-content:center}
        .pbsm .rbx-heatline a{display:inline-flex;align-items:center;min-height:44px}

        /* The slow dashed ring sits on the WRAPPER, outside #rec-top-match, so the share capture
           never sees it.

           It is an SVG rather than a dashed CSS border because the dashes have to MOVE and a
           border cannot do that. Rotating the box instead was the first attempt and it is wrong
           twice over: a 1188px-wide rectangle swung round its centre reaches far past the window
           (a horizontal scrollbar appeared and went), and the dashes orbit rather than march. */
        .pbsm__ring{position:absolute;inset:-10px;width:calc(100% + 20px);height:calc(100% + 20px);pointer-events:none;overflow:visible}
        .pbsm__ring rect{x:1px;y:1px;width:calc(100% - 2px);height:calc(100% - 2px);rx:46px;fill:none;stroke:rgba(245,105,26,.4);stroke-width:2;stroke-dasharray:10 10;animation:pbsm-dash 18s linear infinite}
        @keyframes pbsm-dash{to{stroke-dashoffset:-400}}

        /* ── the four other cards ────────────────────────────────────────────────────── */
        .pbsm .breeds-grid.pbsm__grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;margin:0}
        .pbsm .pbmc{
          background:#FFFFFF;border:1.5px solid var(--pb-peach);border-radius:28px;padding:16px;
          display:flex;gap:20px;align-items:stretch;cursor:pointer;
          opacity:0;transform:translateY(16px);
          transition:transform var(--pb-hover) ease,border-color var(--pb-hover) ease,box-shadow var(--pb-hover) ease,opacity var(--pb-in) ease;
        }
        .pbsm .pbmc.is-in{opacity:1;transform:none;transition-delay:var(--pbmc-delay,0ms)}
        @media (hover:hover){
          .pbsm .pbmc:hover{transform:translateY(-6px);border-color:var(--pb-orange);box-shadow:0 14px 30px rgba(1,30,74,.10)}
          .pbsm .pbmc:hover .pbmc__img{transform:scale(1.05)}
        }
        .pbsm .pbmc:active{transform:scale(.98)}

        .pbmc__media{position:relative;width:170px;flex:0 0 170px;min-height:190px;border-radius:20px;border:2px solid var(--pb-peach);overflow:hidden;background:var(--pb-peach-light)}
        .pbmc__img{width:100%;height:100%;object-fit:cover;display:block;opacity:0;transition:opacity 300ms ease,transform var(--pb-hover) ease}
        .pbmc__img.is-loaded{opacity:1}
        .pbmc__noimg{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;color:#9A6B45;font:500 13px var(--pb-font-body)}
        .pbmc__rank{position:absolute;top:10px;left:10px;width:34px;height:34px;border-radius:50%;background:var(--pb-navy);color:var(--pb-cream);display:flex;align-items:center;justify-content:center;font:800 16px var(--pb-font-display)}
        .pbmc__pill{font:800 12px var(--pb-font-body);border-radius:999px;padding:4px 10px;display:inline-block}
        .pbmc__pill--onphoto{display:none}

        .pbmc__body{flex:1;min-width:0;display:flex;flex-direction:column;gap:10px;padding:6px 8px 6px 0}
        .pbmc__top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
        .pbmc__id{min-width:0}
        .pbsm .pbmc__name{margin:0;display:flex;align-items:center;gap:6px;font-family:var(--pb-font-display) !important;font-weight:800;font-size:25px;line-height:1.1;letter-spacing:-.01em;color:var(--pb-navy)}
        .pbmc__sub{margin:4px 0 0;font-size:14px;color:var(--pb-grey)}
        .pbmc__score{text-align:right;flex:none}
        .pbmc__pct{display:block;font-family:var(--pb-font-display);font-weight:800;font-size:34px;line-height:1;color:var(--pb-orange-dark);font-variant-numeric:tabular-nums}
        .pbmc__pill--aside{margin-top:6px}
        .pbmc__warns{display:flex;flex-direction:column;gap:6px}
        .pbmc__warn{display:flex;gap:10px;align-items:flex-start;margin:0;background:var(--pb-amber);color:var(--pb-amber-ink);border-radius:14px;padding:9px 12px;font:500 14px/1.4 var(--pb-font-body)}
        .pbmc__warn svg{flex:none;margin-top:2px}
        .pbmc__heat{margin:0}
        .pbmc__heat a{display:inline-flex;align-items:center;min-height:44px;color:var(--pb-orange-dark);font:700 14px var(--pb-font-body);text-decoration:none}
        .pbmc__heat a:hover{text-decoration:underline}
        .pbmc__bark{display:flex}
        .pbmc__spacer{flex-grow:1}
        .pbmc__actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
        .pbsm .pbmc__btn{min-height:44px;padding:0 22px;border:0;border-radius:999px;cursor:pointer;font:800 15px var(--pb-font-body);transition:transform var(--pb-hover) ease}
        @media (hover:hover){.pbsm .pbmc__btn:hover{transform:translateY(-2px)}}
        .pbsm .pbmc__btn:active{transform:scale(.98)}
        .pbsm .pbmc__btn--profile{background:var(--pb-orange);color:var(--pb-navy)}
        .pbsm .pbmc__btn--buy{background:var(--pb-navy);color:#FFFFFF}
        .pbsm .pbmc__daylink{margin-left:auto;background:none;border:0;padding:10px 0;color:var(--pb-orange-dark);font:700 14px var(--pb-font-body);cursor:pointer;min-height:44px}
        .pbsm .pbmc__daylink:hover{text-decoration:underline}
        .pbsm .rbx-dogbtn--light{flex:none}

        /* ── tablet ──────────────────────────────────────────────────────────────────── */
        @media (max-width:1023px){
          .pbsm .pbsm__title{font-size:56px}
          .pbsm .top-match{gap:28px;padding:28px}
          .pbsm .top-match-media{width:260px;flex:0 0 260px}
          .pbsm .top-match-img{min-height:260px}
          .pbsm .top-match-info h3{font-size:44px}
          .pbsm__heropct b{font-size:64px}
          .pbsm__heropct i{font-size:30px}
          .pbsm .breeds-grid.pbsm__grid{grid-template-columns:repeat(auto-fit,minmax(330px,1fr))}
        }

        /* ── phones ──────────────────────────────────────────────────────────────────── */
        @media (max-width:767px){
          .pbsm__titlewrap{flex-direction:column;align-items:flex-start;gap:16px;margin:24px 0 20px}
          .pbsm .pbsm__title{font-size:48px}
          .pbsm__lede{font-size:16px;margin-top:12px}
          .pbsm .pbsm__more{font-size:30px;margin:32px 0 14px}

          .pbsm .top-match{flex-direction:column;gap:18px;padding:18px;border-radius:30px}
          .pbsm .top-match-media{width:100%;flex:none}
          .pbsm .top-match-img{min-height:220px;height:220px;border-radius:22px}
          .pbsm__namerow{gap:12px}
          .pbsm .top-match-info h3{font-size:40px}
          .pbsm__heropct b{font-size:56px}
          .pbsm__heropct i{font-size:26px}
          .pbsm .top-match-info .reason{font-size:15px}
          .pbsm .pbsm__hbtn{flex:1 1 140px;padding:0 20px;font-size:15px}
          .pbsm .pbsm__hbtn--adopt{flex:1 1 100%}

          .pbsm .breeds-grid.pbsm__grid{grid-template-columns:1fr;gap:16px}
          .pbsm .pbmc{flex-direction:column;gap:12px;padding:12px;border-radius:24px}
          .pbmc__media{width:100%;flex:none;height:170px;min-height:170px;border-radius:18px}
          .pbmc__pill--onphoto{display:inline-block;position:absolute;top:10px;right:10px}
          .pbmc__pill--aside{display:none}
          .pbmc__body{padding:0 4px 4px}
          .pbsm .pbmc__name{font-size:21px}
          .pbmc__pct{font-size:26px}
          .pbsm .pbmc__daylink{margin-left:0;width:100%;text-align:left}
        }
        @media (max-width:479px){
          .pbsm .pbtoys{display:none}
        }
        /* The legacy block moves this sparkle INSIDE the heading box below 640px (right: 2px),
           which was fine over a one-line title. The new title wraps to two lines and .rbx-title
           is inline-block, so the span hugs the text and the sparkle lands on the top of
           "pawfect" - measured at 320: text starts y156, sparkle ends y161. There is only 24px
           of clear space above the title, and the sparkle is 27px tall, so there is nowhere to
           move it. The heart next to it is already hidden here; this joins it. */
        @media (max-width:640px){
          .pbsm .rbx-title-sparks{display:none}
        }

        /* ── the two end-of-page cards ───────────────────────────────────────────────── */
        .pbsm .pbsm__box{background:#FFFFFF;border:2px solid var(--pb-navy);border-radius:20px}
        .pbsm .pbsm__h3{margin:0 0 10px;font-family:var(--pb-font-display) !important;font-weight:800;font-size:28px;letter-spacing:-.01em;color:var(--pb-navy)}
        .pbsm .pbsm__input{box-sizing:border-box;background:#FFFFFF;color:var(--pb-navy);border:2px solid var(--pb-navy);border-radius:20px;font-family:var(--pb-font-body)}
        .pbsm .pbsm__input::placeholder{color:#8294AE}
        .pbsm .pbsm__checkbtn{min-height:48px;padding:0 30px;background:var(--pb-orange);color:var(--pb-navy);border:0;border-radius:999px;cursor:pointer;font:800 16px var(--pb-font-body);transition:transform var(--pb-hover) ease}
        @media (hover:hover){.pbsm .pbsm__checkbtn:hover{transform:translateY(-2px)}}
        .pbsm .pbsm__checkbtn:active{transform:scale(.98)}
        .pbsm .rbx-pill{min-height:44px;font-family:var(--pb-font-body);font-weight:800}
        @media (max-width:767px){.pbsm .pbsm__h3{font-size:24px}}

        /* ── reduced motion: everything shown at once, nothing moves ─────────────────── */
        @media (prefers-reduced-motion:reduce){
          .pbsm .pbmc{opacity:1;transform:none;transition:none}
          .pbsm .pbmc__img,.pbsm .top-match-img{opacity:1;transition:none}
          .pbsm__ring{display:none}
          .pbsm .pbwn__btn.is-warn{animation:none}
          .pbsm__barfill{transition:none}
          .pbsm__titleblock.is-in{animation:none}
          .pbsm .top-match,.pbsm .pbmc__btn,.pbsm .pbsm__hbtn,.pbsm .pbsm__pill,
          .pbsm .pbsh__btn,.pbsm .pbav__btn,.pbsm .pbsm__checkbtn{transition:none}
        }
      `}</style>
    </div>
  );
};

export default RecommendationResults;
