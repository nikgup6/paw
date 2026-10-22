import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import CitySelect from '../CitySelect';
import { SECTIONS, POPULAR_CITIES, BROWSE_LINK_TEXT, FIND_MATCH_LABEL, DOG_REACTIONS } from '../../constants/quizSections';
import { Glyph, OptionIcon } from './quizIcons';
import RunningDog from './RunningDog';
import DogArt from './DogArt';
import { rememberReadiness, saveProgress, trackBeacon, trackOnce } from '../../utils/analytics';
import { computeReadiness } from '../../utils/breedUtils';
import { primeAudio } from '../../utils/sounds';
import { QUIZ_MUSIC_FILE, QUIZ_MUSIC_LIVE, QUIZ_MUSIC_VOLUME } from '../../constants/quizAudio';

/* The 3-part, 12-screen quiz.

   It is a controlled component: it never owns the answers. It reads `answers`
   and calls `onAnswer(questionId, value)` (Home's existing handleQuizAnswer),
   so the data the matching engine receives is exactly what it always was.
   Grouping and wording live in constants/quizSections.js; questions, options
   and `multi` come from questions.json by id.

   Rendered through a portal as a fixed full-screen layer so it is not squeezed
   into the "Choose Your Journey" card. */

const SCREENS = SECTIONS.flatMap((section, sectionIndex) =>
  section.screens.map((screen, indexInSection) => ({ ...screen, section, sectionIndex, indexInSection })),
);
const TOTAL = SCREENS.length;
const AUTO_ADVANCE_MS = 500; // how long the picked answer stays on screen before the quiz moves on by itself
// The running dog's heart/paw pop: arriving (going forward) at screen 5 (end of part 1),
// screen 9 (end of part 2) and screen 12 (end of the bar). 0-based screen indexes.
const CELEBRATE_AT = [4, 8, 11];
const DOG_SLIDE_MS = 500;

const firstSentence = (text = '') => {
  const m = text.match(/^(.+?[.!?])(\s|$)/);
  return (m ? m[1] : text).trim();
};

const Headline = ({ text, hl }) => {
  if (!hl) return text;
  const m = text.match(new RegExp(`\\b${hl}\\b`, 'i'));
  if (!m) return text;
  return (
    <>
      {text.slice(0, m.index)}
      <span className="pbq__hl">{m[0]}</span>
      {text.slice(m.index + m[0].length)}
    </>
  );
};

const Wordmark = () => (
  <span className="pbq__brand" aria-label="Paw Buddy">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#F5691A" aria-hidden="true">
      <ellipse cx="12" cy="16.2" rx="4.6" ry="3.8" />
      <ellipse cx="5.6" cy="11" rx="1.9" ry="2.4" />
      <ellipse cx="9.4" cy="6.4" rx="1.9" ry="2.5" />
      <ellipse cx="14.6" cy="6.4" rx="1.9" ry="2.5" />
      <ellipse cx="18.4" cy="11" rx="1.9" ry="2.4" />
    </svg>
    <span className="pbq__brand-text">
      <span style={{ color: '#011E4A' }}>PAW </span>
      <span style={{ color: '#F5691A' }}>BUDDY</span>
    </span>
  </span>
);

const OptionCard = ({ q, opt, label, selected, onPick, cols, showDescOnlyWhenSelected }) => (
  <button
    type="button"
    className={`pbq__card${selected ? ' is-selected' : ''}`}
    aria-pressed={selected}
    onClick={() => onPick(q.id, opt.val)}
  >
    <span className="pbq__icon"><OptionIcon questionId={q.id} val={opt.val} /></span>
    <span className="pbq__card-text">
      <span className="pbq__label">{label}</span>
      {opt.desc && (!showDescOnlyWhenSelected || selected) && <span className="pbq__desc">{opt.desc}</span>}
    </span>
    {selected && (
      <span className="pbq__badge" aria-hidden="true"><Glyph name="check" size={14} strokeWidth={3} /></span>
    )}
  </button>
);

/* Paywall props, all optional - without them the quiz behaves exactly as before:
     gateAt   index of the last free screen. Moving forward from it calls onGate
              (with this run's id) instead of showing the next screen.
     startAt  the screen to open on - used to resume after unlocking, with the
              answers so far kept by Home.
     runId    the run id to keep when resuming, so once-only tracking
              (quiz_started, question_viewed...) is not sent a second time. */
export default function QuizFlow({ questions, answers, onAnswer, onSubmit, onCancel, onBrowseBreeds, submitting = false, processingMessage = '', gateAt = null, onGate, startAt = 0, runId: resumeRunId }) {
  const [idx, setIdx] = useState(startAt);
  const [maxIdx, setMaxIdx] = useState(startAt);
  const [dir, setDir] = useState('fwd');
  const [whyOpen, setWhyOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [popKey, setPopKey] = useState(0);
  const [celebrate, setCelebrate] = useState(false);

  // --- funnel tracking (see utils/analytics.js). One run id per time the quiz is opened,
  // so every once-only event is "once per quiz run", even with StrictMode's double effects.
  const [runId] = useState(() => resumeRunId ?? Date.now());
  const latest = useRef({});
  const submitted = useRef(false);
  const exitSent = useRef(false);
  const startedRef = useRef(false);
  const firstAnswers = useRef(true);

  const timer = useRef(null);
  const reactTimer = useRef(null);
  const headerRef = useRef(null);
  const [reaction, setReaction] = useState(null); // { id: screen id, mood }: the dog's mood right after an answer (see DOG_REACTIONS)
  const [hdrH, setHdrH] = useState(130);            // header height, so the "working" layer starts just below it
  const toastTimer = useRef(null);
  const celebrateTimers = useRef([]);
  const headRef = useRef(null);
  const mainRef = useRef(null);
  const firstRender = useRef(true);
  const rootRef = useRef(null);
  const floorsRef = useRef(null);
  const audioRef = useRef(null);
  const [floorInView, setFloorInView] = useState(false);
  const [advancing, setAdvancing] = useState(0); // set while an auto-next is counting down (drives the thin bar above the footer)
  const [musicOn, setMusicOn] = useState(() => { try { return window.localStorage.getItem('pb_quiz_music') === '1'; } catch { return false; } });
  const reduceMotion = useRef(false);

  const screen = SCREENS[idx];
  const isLast = idx === TOTAL - 1;
  latest.current = { answers, idx };
  const byId = useMemo(() => Object.fromEntries(questions.map((q) => [q.id, q])), [questions]);
  const screenQs = screen.ids.map((id) => byId[id]).filter(Boolean);
  const answeredOf = (id) => (answers[id] || []).length > 0;
  const answered = screenQs.length > 0 && screenQs.every((q) => answeredOf(q.id));
  const multi = screenQs.length === 1 && screenQs[0].multi !== false && screenQs[0].type !== 'city' && !screen.single;

  useEffect(() => {
    reduceMotion.current = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }, []);

  /* ---------------- funnel tracking ---------------- */
  // quiz_started: when the quiz first appears.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    if (startAt > 0) return;   // resumed after unlocking: this run has already started
    trackOnce('quiz_started', `run${runId}`, {});
    saveProgress({ status: 'in_progress', current_question: 0 });
  }, [runId, startAt]);

  // question_viewed: each screen the first time it is shown. A screen holding two
  // questions (home + flooring) reports q_id 'home+flooring'.
  useEffect(() => {
    trackOnce('question_viewed', `${runId}:${screen.id}`, { q_index: idx, q_id: screen.ids.join('+') });
  }, [idx]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save the FULL answer sheet on every answer, so a tab closed at screen 4 still leaves
  // screens 1-4 on file. (Skips the empty sheet the quiz starts with.)
  useEffect(() => {
    if (firstAnswers.current) { firstAnswers.current = false; return; }
    if (!Object.keys(answers).length) return;
    saveProgress({ answers, current_question: idx, city: (answers.city || [])[0] || undefined });
  }, [answers]); // eslint-disable-line react-hooks/exhaustive-deps

  // timeline_selected: same meaning as the old /quiz page, using the engine's readiness helper.
  const timelineValue = (answers.timeline || [])[0];
  useEffect(() => {
    if (!timelineValue) return;
    const level = computeReadiness({ timeline: [timelineValue] });
    const option = byId.timeline?.options?.find((o) => o.val === timelineValue);
    const purchase_timeline = option?.label || timelineValue;
    rememberReadiness(level.code);
    trackOnce('timeline_selected', `${runId}:${timelineValue}`, { readiness_code: level.code, purchase_timeline });
    saveProgress({ readiness_code: level.code, purchase_timeline });
  }, [timelineValue]); // eslint-disable-line react-hooks/exhaustive-deps

  // quiz_exit: tab hidden or closed while the quiz is open and not yet submitted. Sent with
  // fetch keepalive so it survives the tab closing. Once per run.
  useEffect(() => {
    const fire = () => {
      if (submitted.current || exitSent.current) return;
      exitSent.current = true;
      const { idx: i } = latest.current;
      trackBeacon('quiz_exit', { q_index: i, q_id: SCREENS[i].ids.join('+') });
    };
    const onVisibility = () => { if (document.visibilityState === 'hidden') fire(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', fire);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', fire);
    };
  }, []);

  /** question_answered for screen `i`, once per run, only if all its questions are answered. */
  const fireAnswered = (i) => {
    const s = SCREENS[i];
    const a = latest.current.answers || {};
    if (!s.ids.every((id) => (a[id] || []).length > 0)) return;
    trackOnce('question_answered', `${runId}:${s.id}`, {
      q_index: i,
      q_id: s.ids.join('+'),
      answer: s.ids.map((id) => a[id].join(',')).join('+'),
    });
  };

  /* Keep the quiz no taller than the VISIBLE screen, so the Back / Next bar at the bottom can never be
     pushed below the fold. This has bitten twice now, so it is deliberately paranoid:

       - it takes the SMALLEST of every height the browser reports. One of them being wrong (a stale
         visualViewport while the URL bar animates, a browser that counts the area behind its own bars
         in innerHeight) is then harmless instead of fatal.
       - it re-measures on orientation change and window resize, not only on visualViewport events,
         because not every browser fires those.
       - it re-measures a few times just after opening, while the browser chrome is still settling.

     If you ever simplify this back to `height = visualViewport.height`, the buttons disappear again on
     some phone. */
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    const apply = () => {
      const vv = window.visualViewport;
      const candidates = [
        vv ? vv.height : Infinity,
        window.innerHeight || Infinity,
        document.documentElement?.clientHeight || Infinity,
      ].filter((n) => Number.isFinite(n) && n > 0);
      if (!candidates.length) return;
      el.style.height = `${Math.round(Math.min(...candidates))}px`;
      el.style.top = `${Math.round(vv ? vv.offsetTop : 0)}px`;
    };
    apply();
    const ticks = [60, 250, 600, 1200].map((ms) => setTimeout(apply, ms));
    const vv = window.visualViewport;
    vv?.addEventListener('resize', apply);
    vv?.addEventListener('scroll', apply);
    window.addEventListener('resize', apply);
    window.addEventListener('orientationchange', apply);
    return () => {
      ticks.forEach(clearTimeout);
      vv?.removeEventListener('resize', apply);
      vv?.removeEventListener('scroll', apply);
      window.removeEventListener('resize', apply);
      window.removeEventListener('orientationchange', apply);
    };
  }, []);

  // Optional background music (hidden until QUIZ_MUSIC_LIVE is switched on in constants/quizAudio.js).
  // It never autoplays: it starts from a tap on the speaker, or from the first tap after a reload
  // if the person had left it on. It stops when the quiz closes or the tab is hidden.
  useEffect(() => {
    if (!QUIZ_MUSIC_LIVE) return undefined;
    const audio = audioRef.current || (audioRef.current = Object.assign(new Audio(QUIZ_MUSIC_FILE), { loop: true, volume: QUIZ_MUSIC_VOLUME }));
    const start = () => { audio.play().catch(() => {}); };
    if (!musicOn) { audio.pause(); return undefined; }
    start();
    window.addEventListener('pointerdown', start, { once: true });
    const onVis = () => { if (document.hidden) audio.pause(); else start(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { window.removeEventListener('pointerdown', start); document.removeEventListener('visibilitychange', onVis); };
  }, [musicOn]);
  useEffect(() => () => { try { audioRef.current?.pause(); } catch { /* ignore */ } }, []);
  const toggleMusic = () => {
    setMusicOn((on) => { const next = !on; try { window.localStorage.setItem('pb_quiz_music', next ? '1' : '0'); } catch { /* blocked */ } return next; });
  };

  // "Scroll down" help on the home + floor screen: is the floor question on screen yet?
  useEffect(() => {
    const el = floorsRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setFloorInView(true); return undefined; }
    const io = new IntersectionObserver(([entry]) => setFloorInView(entry.isIntersecting), { root: mainRef.current, threshold: 0.6 });
    io.observe(el);
    return () => io.disconnect();
  }, [idx]);

  // Lock the page behind the full-screen layer.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const el = headerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setHdrH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => () => { clearTimeout(timer.current); clearTimeout(toastTimer.current); clearTimeout(reactTimer.current); celebrateTimers.current.forEach(clearTimeout); }, []);

  // A reaction belongs to the screen it was made on (so it ends by itself on the next one). From screen DOG_REACTIONS.pantFromScreen on the dog pants. One dog_react per screen.
  useEffect(() => {
    clearTimeout(reactTimer.current);
    if (idx + 1 >= DOG_REACTIONS.pantFromScreen) {
      trackOnce('dog_react', `${runId}:dr:${screen.id}`, { q_id: screen.ids.join('+'), mood: DOG_REACTIONS.panMood });
    }
  }, [idx]); // eslint-disable-line react-hooks/exhaustive-deps


  // New screen: reset the "why we ask" panel, scroll to top, move focus to the headline.
  useEffect(() => {
    setWhyOpen(false);
    mainRef.current?.scrollTo?.({ top: 0 });
    if (firstRender.current) { firstRender.current = false; return; }
    headRef.current?.focus({ preventScroll: true });
  }, [idx]);

  const homeValue = (answers.home || [])[0];
  /* The living-space screen used to glide itself down to the floor question a moment after a home was
     picked. It moved the page under the reader's thumb while they were still looking at what they had
     just chosen, so it is gone — the floor question is right below the cards and the scroll hint still
     points at it. (floorsRef is kept: the hint uses it to tell whether the question is in view.) */

  const go = (to, direction) => {
    clearTimeout(timer.current);
    setAdvancing(0);
    const next = Math.max(0, Math.min(TOTAL - 1, to));
    if (direction === 'fwd') {
      fireAnswered(idx);
      // Part 1 ends moving screen 4 -> 5, part 2 moving screen 8 -> 9.
      if (idx === 3 && next === 4) trackOnce('section_completed', `${runId}:1`, { section: 1 });
      if (idx === 7 && next === 8) trackOnce('section_completed', `${runId}:2`, { section: 2 });
      // The paywall gate. Every forward move (Next, auto-advance) comes through
      // here, so this one check is the whole gate. The tracking above still runs.
      if (gateAt != null && idx === gateAt && next > gateAt) {
        onGate?.(runId);
        return;
      }
    }
    if (SCREENS[next].sectionIndex !== SCREENS[idx].sectionIndex) {
      setPopKey((k) => k + 1);
      const msg = direction === 'fwd' ? SCREENS[next].section.toast : null;
      clearTimeout(toastTimer.current);
      setToast(msg);
      if (msg) toastTimer.current = setTimeout(() => setToast(null), 2400);
    }
    celebrateTimers.current.forEach(clearTimeout);
    setCelebrate(false);
    if (direction === 'fwd' && CELEBRATE_AT.includes(next)) {
      celebrateTimers.current = [
        setTimeout(() => setCelebrate(true), reduceMotion.current ? 0 : DOG_SLIDE_MS),
        setTimeout(() => setCelebrate(false), DOG_SLIDE_MS + 900),
      ];
    }
    setMaxIdx((m) => Math.max(m, next));
    setDir(direction);
    setIdx(next);
  };

  const scheduleAdvance = () => {
    clearTimeout(timer.current);
    const from = idx;
    if (!reduceMotion.current) setAdvancing(Date.now());
    timer.current = setTimeout(() => go(from + 1, 'fwd'), reduceMotion.current ? 0 : AUTO_ADVANCE_MS);
  };

  const editing = idx < maxIdx; // arrived via Back: never auto-advance

  /** Looks the answer up in DOG_REACTIONS and gives the dog a mood for a moment. No match = it keeps running. */
  const reactToAnswer = (qid, val) => {
    const rule = DOG_REACTIONS.rules.find((r) => r.question === qid && r.values.includes(val));
    if (!rule) return;
    clearTimeout(reactTimer.current);
    setReaction({ id: screen.id, mood: rule.mood });
    trackOnce('dog_react', `${runId}:dr:${screen.id}`, { q_id: qid, mood: rule.mood });
    reactTimer.current = setTimeout(() => setReaction(null), rule.ms);
  };

  const pick = (qid, val) => {
    try { navigator.vibrate?.(8); } catch { /* not supported */ }
    const q = byId[qid];
    const current = answers[qid] || [];
    if (!current.includes(val)) reactToAnswer(qid, val);
    if (q.multi !== false && !screen.single) { onAnswer(qid, val); return; }
    // Single choice: Home's handler toggles, so never re-send an already-selected value.
    // A screen forced to single choice (screen.single) while its question allows several
    // clears any earlier pick first, so the saved answer is still an array with ONE value.
    if (q.multi !== false) current.filter((v) => v !== val).forEach((v) => onAnswer(qid, v));
    if (!current.includes(val)) onAnswer(qid, val);
    if (editing || isLast) return;
    const othersDone = screen.ids.filter((id) => id !== qid).every(answeredOf);
    if (othersDone) scheduleAdvance();
  };

  const pickCity = (val) => {
    if (!val) return;
    try { navigator.vibrate?.(8); } catch { /* not supported */ }
    if (!(answers.city || []).includes(val)) onAnswer('city', val);
    if (!editing) scheduleAdvance();
  };

  const labelFor = (qid, opt) => screen.labels?.[qid]?.[opt.val] || opt.label;
  const visibleOpts = (q) => q.options.filter((o) => !screen.hiddenOptions?.[q.id]?.includes(o.val));
  const colsFor = (q) => Math.min(q.cols || 2, 2);

  const primary = screenQs[0];
  const subText = screen.ids.map((id) => byId[id]?.sub).filter(Boolean);
  const helper = screen.helper || firstSentence(primary?.sub);
  const extraSub = screen.alwaysShowSub ? null : subText;
  const merged = screen.ids.length > 1;
  const sectionNo = screen.sectionIndex + 1;
  const headingId = `pbq-h-${screen.id}`;

  const nextLabel = multi ? 'Continue' : 'Next';
  // The dog's mood: sitting once the quiz is submitted; otherwise the reaction to the last answer; otherwise
  // panting from the late screens; otherwise running.
  const dogMood = submitting
    ? DOG_REACTIONS.submitMood
    : ((reaction && reaction.id === screen.id ? reaction.mood : null) || (idx + 1 >= DOG_REACTIONS.pantFromScreen ? DOG_REACTIONS.panMood : DOG_REACTIONS.baseMood));

  return createPortal(
    <div className="pbq" ref={rootRef} role="dialog" aria-label="Find your dog match quiz">
      <style>{CSS}</style>
      <span className="pbq__deco pbq__deco--a" aria-hidden="true" />
      <span className="pbq__deco pbq__deco--b" aria-hidden="true" />

      <header className="pbq__header" ref={headerRef}>
        <div className="pbq__top">
          <Wordmark />
          <div className="pbq__tools">
            {QUIZ_MUSIC_LIVE && (
              <button type="button" className="pbq__x" aria-pressed={musicOn} aria-label={musicOn ? 'Turn music off' : 'Turn music on'} onClick={toggleMusic}>
                <Glyph name={musicOn ? 'speaker' : 'speakerOff'} size={18} strokeWidth={2} />
              </button>
            )}
            <button type="button" className="pbq__x" aria-label="Exit quiz" onClick={onCancel}>
              <Glyph name="closeX" size={18} strokeWidth={2.2} />
            </button>
          </div>
        </div>
        <div
          className="pbq__lane"
          role="progressbar"
          aria-label="Quiz progress"
          aria-valuemin={1}
          aria-valuemax={TOTAL}
          aria-valuenow={idx + 1}
          aria-valuetext={`Step ${idx + 1} of ${TOTAL}`}
        >
          <RunningDog step={idx + 1} total={TOTAL} direction={dir === 'back' ? 'back' : 'forward'} celebrate={celebrate} mood={dogMood} />
        </div>
        <ol className="pbq__segs" aria-label={`Part ${sectionNo} of ${SECTIONS.length}`}>
          {SECTIONS.map((s, i) => {
            const state = i < screen.sectionIndex ? 'done' : i === screen.sectionIndex ? 'current' : 'todo';
            return (
              <li key={s.id} className={`pbq__seg is-${state}`} aria-current={state === 'current' ? 'step' : undefined}>
                <span className="pbq__seg-label">{s.label}</span>
                <span className="pbq__seg-bar" />
                <span className="pbq__dots" aria-hidden="true">
                  {s.screens.map((sc, di) => (
                    <i key={sc.id} className={state === 'current' && di === screen.indexInSection ? 'on' : state === 'done' ? 'done' : ''} />
                  ))}
                </span>
              </li>
            );
          })}
        </ol>
      </header>
      <div className={`pbq__toast${toast ? ' is-on' : ''}`} role="status" aria-live="polite">{toast}</div>

      {submitting && (
        <div className="pbq__processing" style={{ top: hdrH }} role="status" aria-live="polite">
          {/* The same sitting dog is drawn in the match reveal at this same spot, so the hand-over does not jump. */}
          <div className="pbq__pdog"><DogArt mood="sit" width={120} /></div>
          <p className="pbq__ptext">{processingMessage || 'Sniffing out your match...'}</p>
        </div>
      )}

      <main className="pbq__main" ref={mainRef}>
        <section key={idx} className={`pbq__screen pbq__screen--${dir}`} aria-labelledby={headingId}>
          <div className="pbq__head">
            <div className="pbq__chiprow">
              <span key={popKey} className={`pbq__chip${popKey ? ' is-pop' : ''}`}>
                <Glyph name={screen.section.icon} size={16} />
                <span>{screen.chip}</span>
              </span>
              <span className="pbq__part">Part {sectionNo} of {SECTIONS.length}</span>
            </div>

            <h2 id={headingId} className="pbq__title" ref={headRef} tabIndex={-1}>
              <Headline text={screen.headline} hl={screen.hl} />
            </h2>
          </div>

          <p className="pbq__helper">
            {helper}
            {multi && <span className="pbq__multi"> Pick all that apply.</span>}
          </p>
          {screen.alwaysShowSub && <p className="pbq__sub">{primary.sub}</p>}
          {extraSub && extraSub.length > 0 && (
            <div className="pbq__why">
              <button type="button" className="pbq__why-btn" aria-expanded={whyOpen} onClick={() => setWhyOpen((o) => !o)}>
                Why we ask <span aria-hidden="true">{whyOpen ? '−' : '+'}</span>
              </button>
              {whyOpen && extraSub.map((t) => <p key={t} className="pbq__sub">{t}</p>)}
            </div>
          )}

          {screen.id === 'city' && (
            <>
              <div className="pbq__group pbq__cities" role="group" aria-labelledby={headingId}>
                {POPULAR_CITIES.map((c) => {
                  const on = (answers.city || []).includes(c.value);
                  return (
                    <button key={c.label} type="button" className={`pbq__pill${on ? ' is-selected' : ''}`} aria-pressed={on} onClick={() => pickCity(c.value)}>
                      {on && <Glyph name="check" size={14} strokeWidth={3} />}
                      {c.label}
                    </button>
                  );
                })}
              </div>
              <p className="pbq__small">Somewhere else? Search for your city:</p>
              <div className="pbq__citysel">
                <CitySelect
                  value={(answers.city || [])[0] || ''}
                  placeholder={primary?.placeholder}
                  onChange={pickCity}
                />
              </div>
              <button type="button" className="pbq__link" onClick={onBrowseBreeds}>{BROWSE_LINK_TEXT}</button>
            </>
          )}

          {screen.id !== 'city' && !merged && primary && (
            <div className="pbq__group pbq__grid" role="group" aria-labelledby={headingId} data-cols={colsFor(primary)}>
              {visibleOpts(primary).map((o) => (
                <OptionCard
                  key={o.val}
                  q={primary}
                  opt={o}
                  label={labelFor(primary.id, o)}
                  selected={(answers[primary.id] || []).includes(o.val)}
                  onPick={pick}
                />
              ))}
            </div>
          )}

          {merged && (
            <>
              <div className="pbq__group pbq__grid" role="group" aria-labelledby={headingId} data-cols="2">
                {visibleOpts(byId.home).map((o) => (
                  <OptionCard
                    key={o.val}
                    q={byId.home}
                    opt={o}
                    label={labelFor('home', o)}
                    selected={(answers.home || []).includes(o.val)}
                    onPick={pick}
                    showDescOnlyWhenSelected
                  />
                ))}
              </div>
              {homeValue && !(answers.flooring || []).length && !floorInView && (
                <p className="pbq__scrollhint" role="status">
                  <span className="pbq__scrollarrow" aria-hidden="true">↓</span> Scroll down for the floor question
                </p>
              )}
              <p className="pbq__subhead" id="pbq-floor-label" ref={floorsRef}>{screen.flooringLabel}</p>
              <div className="pbq__group pbq__floors" role="group" aria-labelledby="pbq-floor-label">
                {byId.flooring.options.map((o) => {
                  const on = (answers.flooring || []).includes(o.val);
                  return (
                    <button key={o.val} type="button" className={`pbq__pill${on ? ' is-selected' : ''}`} aria-pressed={on} onClick={() => pick('flooring', o.val)}>
                      {on && <Glyph name="check" size={14} strokeWidth={3} />}
                      {labelFor('flooring', o)}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {screen.breedLink && (
            <button type="button" className="pbq__link" onClick={() => onAnswer(screen.breedLink.questionId, screen.breedLink.val)}>
              {screen.breedLink.text}
            </button>
          )}

          <div className="pbq__mascot" aria-hidden="true">
            <img src="/dog6.png" alt="" width="84" height="84" />
            <p className="pbq__bubble" key={screen.id}>{screen.mascot}</p>
          </div>
        </section>
      </main>

      <footer className="pbq__footer">
        {advancing > 0 && (
          <div className="pbq__countdown" key={advancing} aria-hidden="true">
            <i style={{ animationDuration: `${AUTO_ADVANCE_MS}ms` }} />
          </div>
        )}
        <div className="pbq__footer-in">
          {idx > 0 && (
            <button type="button" className="pbq__btn pbq__btn--back" onClick={() => go(idx - 1, 'back')}>Back</button>
          )}
          {isLast && answered ? (
            <button type="button" className="pbq__btn pbq__btn--go" onClick={() => { primeAudio(); fireAnswered(idx); submitted.current = true; onSubmit(); }}>{FIND_MATCH_LABEL}</button>
          ) : (
            <button type="button" className="pbq__btn pbq__btn--next" disabled={!answered || isLast} onClick={() => go(idx + 1, 'fwd')}>
              {nextLabel}
            </button>
          )}
        </div>
      </footer>
    </div>,
    document.body,
  );
}

const CSS = `
.pbq{position:fixed;top:0;left:0;right:0;height:100vh;height:100dvh;z-index:2000;display:flex;flex-direction:column;background:#FBF8F4;color:#011E4A;font-family:'Satoshi',system-ui,-apple-system,'Segoe UI',sans-serif;font-size:14px;overflow:hidden}
.pbq *,.pbq *::before,.pbq *::after{box-sizing:border-box}
.pbq button{font-family:inherit}
.pbq :focus-visible{outline:3px solid #011E4A;outline-offset:2px}
.pbq__title:focus{outline:none}

.pbq__deco{position:absolute;border-radius:50%;pointer-events:none;z-index:0}
.pbq__deco--a{width:260px;height:260px;background:#FFD9BD;opacity:.55;top:-90px;right:-80px}
.pbq__deco--b{width:220px;height:220px;background:#E3ECF7;opacity:.8;bottom:-80px;left:-70px}

/* The top inset keeps the PAW BUDDY name, the close button and the running dog clear of a phone's
   status bar / notch. The footer already did this at the bottom; the top had been forgotten. */
.pbq__header{position:relative;z-index:2;width:100%;max-width:560px;margin:0 auto;padding:calc(12px + env(safe-area-inset-top)) 16px 6px}
.pbq__top{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.pbq__brand{display:inline-flex;align-items:center;gap:6px}
.pbq__brand-text{font-family:'Fredoka',sans-serif;font-weight:700;font-size:20px;letter-spacing:.3px;line-height:1}
.pbq__tools{display:flex;gap:8px;align-items:center}
.pbq__processing{position:absolute;left:0;right:0;bottom:0;z-index:6;background:#FBF8F4;display:flex;flex-direction:column;align-items:center}
.pbq__pdog{position:fixed;left:50%;top:36%;transform:translate(-50%,-50%)}
.pbq__ptext{position:fixed;left:0;right:0;top:calc(36% + 86px);margin:0;text-align:center;font-family:'Fredoka',sans-serif;font-weight:600;font-size:20px;color:#011E4A}
.pbq__x{width:36px;height:36px;border-radius:50%;border:1px solid #EAE4DE;background:#fff;color:#011E4A;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}
.pbq__lane{margin-bottom:2px}
.pbq__segs{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.pbq__seg{display:flex;flex-direction:column;gap:5px;min-width:0}
.pbq__seg-label{font-size:12px;font-weight:700;color:#8A93A3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pbq__seg-bar{height:6px;border-radius:6px;background:#F3DCC8}
.pbq__seg.is-done .pbq__seg-bar{background:#F5691A}
.pbq__seg.is-current .pbq__seg-bar{background:#F5691A;box-shadow:0 0 0 2px #FFD9BD}
.pbq__seg.is-current .pbq__seg-label{color:#011E4A}
.pbq__seg.is-done .pbq__seg-label{color:#B34A0E}
.pbq__dots{display:flex;gap:5px;height:8px;visibility:hidden}
.pbq__seg.is-current .pbq__dots{visibility:visible}
.pbq__dots i{width:8px;height:8px;border-radius:50%;background:#F3DCC8;display:block;transition:background .2s,transform .2s}
.pbq__dots i.on{background:#F5691A;transform:scale(1.2)}
.pbq__dots i.done{background:#F5691A}
.pbq__toast{position:absolute;left:50%;bottom:96px;transform:translate(-50%,6px);background:#011E4A;color:#fff;font-weight:700;font-size:13px;padding:8px 16px;border-radius:999px;opacity:0;pointer-events:none;transition:opacity .25s,transform .25s;white-space:nowrap;z-index:5}
.pbq__toast.is-on{opacity:1;transform:translate(-50%,0)}

.pbq__main{position:relative;z-index:1;flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch}
.pbq__screen{width:100%;max-width:560px;margin:0 auto;padding:14px 16px 28px;animation:pbq-in-fwd .3s ease backwards}
.pbq__screen--back{animation-name:pbq-in-back}
@keyframes pbq-in-fwd{from{opacity:0;transform:translateX(26px)}to{opacity:1;transform:none}}
@keyframes pbq-in-back{from{opacity:0;transform:translateX(-26px)}to{opacity:1;transform:none}}

.pbq__chiprow{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px}
.pbq__head{display:flex;flex-direction:column}
.pbq__scrollhint{position:sticky;bottom:10px;z-index:2;display:flex;align-items:center;gap:8px;width:max-content;max-width:100%;margin:12px auto 0;padding:9px 14px;border-radius:999px;background:#011E4A;color:#fff;font-size:13px;font-weight:700;box-shadow:0 6px 16px rgba(1,30,74,.3)}
.pbq__scrollarrow{display:inline-block;color:#FFD9BD;font-size:16px;line-height:1;animation:pbq-bounce 1s ease-in-out infinite}
@keyframes pbq-bounce{0%,100%{transform:translateY(-2px)}50%{transform:translateY(3px)}}
@media (min-width:600px){.pbq__head{flex-direction:row-reverse;justify-content:space-between;align-items:flex-start;gap:18px}.pbq__head .pbq__chiprow{flex:none;flex-direction:column;align-items:flex-end;gap:6px;margin:4px 0 0}.pbq__head .pbq__title{flex:1;min-width:0}}
.pbq__chip{display:inline-flex;align-items:center;gap:6px;background:#fff;border:1px solid #F3DCC8;border-radius:999px;padding:6px 12px 6px 9px;font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#B34A0E}
.pbq__chip svg{color:#F5691A}
.pbq__chip.is-pop{animation:pbq-pop .6s cubic-bezier(.3,1.5,.5,1) both}
@keyframes pbq-pop{0%{transform:scale(.7);opacity:.2}60%{transform:scale(1.12);opacity:1}100%{transform:scale(1)}}
.pbq__part{font-size:12px;font-weight:600;color:#6B7280}

.pbq__title{font-family:'Fredoka',sans-serif;font-weight:700;font-size:26px;line-height:1.2;margin:0 0 8px;color:#011E4A}
.pbq__hl{color:#F5691A}
.pbq__helper{margin:0 0 6px;font-size:14px;line-height:1.5;color:#4A5568}
.pbq__multi{font-weight:700;color:#011E4A}
.pbq__sub{margin:8px 0 0;font-size:14px;line-height:1.5;color:#4A5568;background:#fff;border:1px solid #EAE4DE;border-radius:12px;padding:10px 12px}
.pbq__why{margin:2px 0 0}
.pbq__why-btn{background:none;border:0;padding:6px 0;font-size:13px;font-weight:700;color:#B34A0E;cursor:pointer;text-decoration:underline;text-underline-offset:3px;min-height:32px}

/* Touch devices need a 44px target; a mouse does not, so the desktop sizes above stay as they are. */
@media (pointer:coarse){.pbq__x{width:44px;height:44px}.pbq__why-btn{min-height:44px}.pbq__link{min-height:44px}}

.pbq__grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:14px}
.pbq__grid[data-cols="1"]{grid-template-columns:1fr}
.pbq__card{position:relative;overflow:hidden;display:flex;flex-direction:column;align-items:flex-start;gap:8px;text-align:left;width:100%;min-height:56px;padding:14px 12px;background:#fff;border:2px solid #EAE4DE;border-radius:16px;color:#011E4A;cursor:pointer;transition:transform .16s cubic-bezier(.3,1.4,.5,1),border-color .1s,background .1s;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
.pbq__card:active{transform:scale(.95);background:#FFF6EE;border-color:#F5B58A}
.pbq__card.is-selected{border-color:#F5691A;background:#FFF1E6;transform:scale(1.02);box-shadow:0 4px 14px rgba(245,105,26,.18);animation:pbq-select .4s cubic-bezier(.3,1.4,.5,1)}
.pbq__card.is-selected::before,.pbq__pill.is-selected::before{content:'';position:absolute;inset:0;border-radius:inherit;background:radial-gradient(circle at 50% 50%,rgba(245,105,26,.32),rgba(245,105,26,0) 70%);opacity:0;pointer-events:none;animation:pbq-flash .55s ease-out}
@keyframes pbq-select{0%{transform:scale(.93)}55%{transform:scale(1.05)}100%{transform:scale(1.02)}}
@keyframes pbq-flash{0%{opacity:1;transform:scale(.4)}100%{opacity:0;transform:scale(1.6)}}
.pbq__countdown{position:absolute;left:16px;right:16px;top:0;height:3px;border-radius:3px;background:#F3DCC8;overflow:hidden;max-width:528px;margin:0 auto}
.pbq__countdown i{display:block;height:100%;width:100%;background:#F5691A;transform-origin:0 50%;animation:pbq-count linear both}
@keyframes pbq-count{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.pbq__icon{flex:none;width:38px;height:38px;border-radius:50%;background:#FFD9BD;color:#F5691A;display:inline-flex;align-items:center;justify-content:center}
.pbq__card-text{display:flex;flex-direction:column;gap:3px;min-width:0}
.pbq__label{font-size:15px;font-weight:600;line-height:1.3;color:#011E4A;overflow-wrap:anywhere}
.pbq__desc{font-size:12px;line-height:1.4;color:#5B6472;overflow-wrap:anywhere}
.pbq__badge{position:absolute;top:8px;right:8px;width:22px;height:22px;border-radius:50%;background:#F5691A;color:#fff;display:inline-flex;align-items:center;justify-content:center;animation:pbq-check .3s cubic-bezier(.3,1.6,.5,1) both}
@keyframes pbq-check{from{transform:scale(0)}to{transform:scale(1)}}

.pbq__cities,.pbq__floors{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.pbq__floors{margin-top:6px}
.pbq__pill{position:relative;overflow:hidden;touch-action:manipulation;display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:8px 16px;border-radius:999px;background:#fff;border:2px solid #EAE4DE;color:#011E4A;font-size:14px;font-weight:600;cursor:pointer;transition:transform .15s,border-color .15s,background .15s;-webkit-tap-highlight-color:transparent}
.pbq__pill:active{transform:scale(.94);background:#FFF6EE}
.pbq__pill.is-selected{border-color:#F5691A;background:#FFF1E6;color:#B34A0E;font-weight:700;animation:pbq-select .4s cubic-bezier(.3,1.4,.5,1)}
.pbq__pill svg{color:#F5691A}
.pbq__small{margin:16px 0 6px;font-size:13px;font-weight:600;color:#4A5568}
.pbq__subhead{margin:20px 0 0;font-size:14px;font-weight:700;color:#011E4A}
.pbq__citysel{position:relative;z-index:3}
.pbq__link{display:block;margin:18px 0 0;padding:8px 0;background:none;border:0;font-size:14px;font-weight:700;color:#B34A0E;text-decoration:underline;text-underline-offset:3px;cursor:pointer;text-align:left}

.pbq__mascot{display:flex;align-items:flex-end;gap:8px;margin-top:22px}
.pbq__mascot img{flex:none;width:84px;height:84px;object-fit:contain;object-position:bottom}
.pbq__bubble{position:relative;margin:0 0 14px;max-width:260px;padding:8px 12px;background:#E3ECF7;color:#011E4A;border-radius:14px 14px 14px 4px;font-family:'Caveat',cursive;font-size:19px;line-height:1.2;animation:pbq-in-fwd .3s ease backwards}

/* The footer itself is SOLID, and the whole fade lives in the strip above it. When it was a gradient the top
   third of the Back/Next row was still see-through, so a card scrolling past showed its words across the
   buttons. Now the text has faded out before it ever reaches them. */
.pbq__footer{position:relative;z-index:3;flex:none;padding:0 16px calc(12px + env(safe-area-inset-bottom));background:#FBF8F4}
.pbq__footer::before{content:'';position:absolute;left:0;right:0;top:-36px;height:36px;background:linear-gradient(to bottom,rgba(251,248,244,0),#FBF8F4);pointer-events:none}
.pbq__footer-in{max-width:528px;margin:0 auto;display:flex;gap:10px;align-items:center;padding-top:10px}
.pbq__btn{min-height:50px;border-radius:999px;font-size:16px;font-weight:700;cursor:pointer;padding:0 28px;transition:transform .15s,opacity .15s,background .15s}
.pbq__btn:active:not(:disabled){transform:scale(.97)}
.pbq__btn--back{background:#fff;color:#011E4A;border:2px solid #011E4A}
.pbq__btn--next,.pbq__btn--go{margin-left:auto;background:#F5691A;color:#011E4A;border:0;box-shadow:0 6px 16px rgba(245,105,26,.28)}
.pbq__btn--next:disabled{background:#EDE7E0;color:#9AA1AD;box-shadow:none;cursor:not-allowed}
.pbq__btn--go{flex:1;font-size:18px;min-height:56px}

@media (max-width:379px){.pbq__grid{grid-template-columns:1fr}.pbq__card{flex-direction:row;align-items:center;gap:12px;padding:10px 12px}.pbq__card .pbq__badge{top:50%;margin-top:-11px}.pbq__card-text{padding-right:26px}}
@media (hover:hover){.pbq__card:hover:not(.is-selected),.pbq__pill:hover:not(.is-selected){border-color:#F5691A}.pbq__x:hover{border-color:#F5691A}}
@media (max-height:639px){.pbq__mascot{display:none}}
@media (min-width:1200px){
  .pbq__mascot{position:fixed;left:28px;bottom:28px;margin:0;z-index:4}
  .pbq__mascot img{width:96px;height:96px}
  .pbq__bubble{max-width:190px}
  .pbq__footer{background:none}
  .pbq__footer::before{display:none}
}
@media (min-width:640px){.pbq__title{font-size:30px}.pbq__screen{padding-top:22px}}
@media (prefers-reduced-motion:reduce){
  .pbq__screen,.pbq__chip.is-pop,.pbq__badge,.pbq__bubble,.pbq__scrollarrow{animation:none}
  .pbq__card,.pbq__pill,.pbq__btn,.pbq__toast,.pbq__dots i{transition:none}
  .pbq__card.is-selected{transform:none;animation:none}
  .pbq__pill.is-selected{animation:none}
  .pbq__card.is-selected::before,.pbq__pill.is-selected::before{animation:none;opacity:0}
  .pbq__countdown{display:none}
  .pbq__card:active,.pbq__pill:active,.pbq__btn:active{transform:none}
}
`;
