import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import Portal from '../../app/components/Portal';
import { sessionId, track } from '../../utils/analytics';
import {
  AFTER_OVERLAY_MS, PULSE_VERSION, SCREENERS, SHOW_AFTER_MS, THANKS_MS, THIRD_STEP, USEFUL,
} from '../../config/pulse';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/* "Was this useful?" plus up to two screener questions, one small card at a
   time, after someone has seen a recommendation. The questions and codes are in
   config/pulse.js; the server's whitelist in backend/app/models/pulse.py.

   Borrowed from QuickFeedback.jsx (which is left exactly as it is):
   - It renders through <Portal>. `.pb-page` has a transform from its entry
     animation, and a transformed ancestor becomes the containing block for
     `position: fixed`, so a card rendered in place could land off-screen.
   - Only one toast at a time. This card has its own module-level lock, and it
     also waits while a QuickFeedback toast (.qfb) is showing.
   - A toast, NOT a modal: no scrim, no focus trap, nothing behind it disabled,
     and ignoring it is a valid answer.

   It waits while anything else is in front: the match reveal, a breed profile,
   the share sheet, the paywall (the parent says so with `blocked`, and the card
   also checks the page for an open dialog). When that closes it counts
   AFTER_OVERLAY_MS more before appearing. If the person leaves first, nothing
   is shown and nothing is recorded.

   Asked at most once per person per kind: remembered in this browser, checked
   with the server (GET /api/feedback/pulse/status, which also knows a
   signed-in account), and once per page load if storage is blocked.

   Props
     kind              'paid' | 'dismissed' | 'none'  - decides the third question
     price             rupees, from the paywall status (for the price question)
     active            the moment applies (the parent decides when)
     blocked           something in front that the page cannot see as a dialog
     needsInteraction  wait for a scroll or tap first (default true)
     delayMs           time on screen before it appears */

const STORE_KEY = 'pb_results_pulse';
const askedThisLoad = new Set();      // storage blocked: still only once per page load
let slotTaken = false;                // one pulse card on screen, ever

/* "paid" and "fake_door" are one person who unlocked: asked once between them. */
const bucket = (kind) => (kind === 'fake_door' ? 'paid' : kind);
const askedKey = (kind) => `v${PULSE_VERSION}:${bucket(kind)}`;
const readAsked = () => {
  try { return JSON.parse(window.localStorage.getItem(STORE_KEY) || '[]'); } catch { return []; }
};
const wasAsked = (kind) => askedThisLoad.has(askedKey(kind)) || readAsked().includes(askedKey(kind));
const markAsked = (kind) => {
  askedThisLoad.add(askedKey(kind));
  try {
    const list = readAsked();
    if (!list.includes(askedKey(kind))) window.localStorage.setItem(STORE_KEY, JSON.stringify([...list, askedKey(kind)]));
  } catch { /* private mode: the in-memory set covers this page load */ }
};

/* Anything modal-like on screen, other than this card: dialogs, the sign-in
   overlay, or another toast. Hidden elements (no box) do not count. */
const OVERLAYS = '[aria-modal="true"], [role="dialog"], [role="alertdialog"], .auth-overlay.open, .qfb.is-in, .nuc.is-in';
const overlayOpen = (self) => [...document.querySelectorAll(OVERLAYS)]
  .some((el) => !(self && self.contains(el)) && el.getClientRects().length > 0);

/* Same rule as the server: no links in the comment. */
const HAS_LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|in|net|org|io|co|me|ly|app|xyz|link)\b)/i;

const post = (path, body) => {
  // Fire and forget: a failed save is not the person's problem.
  axios.post(`${API_URL}/api/feedback/${path}`, { session_id: sessionId, version: PULSE_VERSION, ...body }).catch(() => {});
};

const ResultsPulse = ({ kind = 'none', price, active, blocked = false, needsInteraction = true, delayMs = SHOW_AFTER_MS }) => {
  const steps = ['useful', 'breed_known', ...(THIRD_STEP[kind] ? [THIRD_STEP[kind]] : [])];
  const [eligible, setEligible] = useState(false);
  // Already asked in this browser (or this page load): never starts at all.
  const [phase, setPhase] = useState(() => (wasAsked(kind) ? 'done' : 'wait'));   // wait | ask | thanks | done
  const [shown, setShown] = useState(false);       // drives the slide-up
  const [paused, setPaused] = useState(false);     // something opened in front of it
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState({});        // step key -> code
  const [comment, setComment] = useState('');
  const [commentError, setCommentError] = useState('');
  const cardRef = useRef(null);
  const questionRef = useRef(null);
  const interacted = useRef(!needsInteraction);
  const answeredAny = useRef(false);
  const ownsSlot = useRef(false);
  const blockedRef = useRef(blocked);   // read by the clock without restarting it

  useEffect(() => { blockedRef.current = blocked; }, [blocked]);

  /* 1. May we ask at all? This browser was checked when the card was created;
     now the server, which also knows a signed-in account. */
  useEffect(() => {
    if (!active || eligible || phase !== 'wait') return undefined;
    let cancelled = false;
    axios.get(`${API_URL}/api/feedback/pulse/status`, { params: { session_id: sessionId, version: PULSE_VERSION } })
      .then(({ data }) => {
        if (cancelled) return;
        const last = THIRD_STEP[kind] || 'useful';
        const shown = (data?.shown_kinds || []).map(bucket);
        if (shown.includes(bucket(kind)) || (data?.steps_done || []).includes(last)) setPhase('done');
        else setEligible(true);
      })
      .catch(() => { if (!cancelled) setEligible(true); });   // server unreachable: this browser's memory decides
    return () => { cancelled = true; };
  }, [active, kind, eligible, phase]);

  /* A scroll, tap or key press: the person is actually looking at the page. */
  useEffect(() => {
    if (interacted.current) return undefined;
    const mark = () => { interacted.current = true; };
    const opts = { passive: true, capture: true };
    ['scroll', 'pointerdown', 'keydown', 'touchstart'].forEach((e) => window.addEventListener(e, mark, opts));
    return () => ['scroll', 'pointerdown', 'keydown', 'touchstart'].forEach((e) => window.removeEventListener(e, mark, opts));
  }, []);

  /* 2. The clock. Counts only while nothing is in front of the page. */
  useEffect(() => {
    if (!active || !eligible || phase !== 'wait') return undefined;
    let onScreen = 0;
    let sinceClear = 0;
    let wasBlocked = false;
    const TICK = 250;
    const id = window.setInterval(() => {
      if (blockedRef.current || overlayOpen(null) || slotTaken) {
        wasBlocked = true;
        sinceClear = 0;
        return;
      }
      onScreen += TICK;
      sinceClear += TICK;
      const ready = onScreen >= delayMs && interacted.current && (!wasBlocked || sinceClear >= AFTER_OVERLAY_MS);
      if (!ready) return;
      window.clearInterval(id);
      slotTaken = true;
      ownsSlot.current = true;
      markAsked(kind);
      track('pulse_shown', { kind, version: PULSE_VERSION });
      setPhase('ask');
      window.setTimeout(() => setShown(true), 30);
    }, TICK);
    return () => window.clearInterval(id);
  }, [active, eligible, phase, delayMs, kind]);

  /* Release the one-card lock when this goes away. */
  useEffect(() => () => { if (ownsSlot.current) slotTaken = false; }, []);

  /* 3. While showing: step aside if something opens in front; Esc closes it. */
  useEffect(() => {
    if (phase !== 'ask') return undefined;
    const id = window.setInterval(() => setPaused(blocked || overlayOpen(cardRef.current)), 250);
    return () => window.clearInterval(id);
  }, [phase, blocked]);

  const finish = (thank) => {
    if (thank) {
      setPhase('thanks');
      window.setTimeout(() => { setShown(false); window.setTimeout(() => setPhase('done'), 220); }, THANKS_MS);
    } else {
      setShown(false);
      window.setTimeout(() => setPhase('done'), 220);
    }
  };

  const goNext = () => {
    if (step + 1 < steps.length) {
      setStep(step + 1);
      // The button that had focus is gone; put focus on the new question.
      window.setTimeout(() => questionRef.current?.focus({ preventScroll: true }), 0);
    } else {
      finish(answeredAny.current);
    }
  };

  const dismiss = () => {
    track('pulse_dismissed', { step: steps[step] });
    finish(false);
  };

  const skip = () => {
    track('pulse_dismissed', { step: steps[step] });
    goNext();
  };

  useEffect(() => {
    if (phase !== 'ask' || paused) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') dismiss(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  if (!active || phase === 'wait' || phase === 'done') return null;

  const key = steps[step];
  const pickUseful = (code) => {
    setPicked((p) => ({ ...p, useful: code }));
    answeredAny.current = true;
    post('pulse', { useful: code });         // saved now, so closing later keeps it
    track('pulse_answered', { useful: code });
  };
  const sendComment = () => {
    const text = comment.trim();
    if (text && HAS_LINK.test(text)) { setCommentError('Please leave out links.'); return; }
    if (text) post('pulse', { useful: picked.useful, comment: text });
    goNext();
  };
  const pickScreener = (code) => {
    setPicked((p) => ({ ...p, [key]: code }));
    answeredAny.current = true;
    post('screener', { key, answer: code });
    track('screener_answered', { key, answer: code });
    window.setTimeout(goNext, 220);           // long enough to see the choice land
  };

  const q = key === 'useful' ? USEFUL : SCREENERS[key];
  const wording = key === 'price_fair' && kind === 'fake_door' ? q.questionFakeDoor : q.question;
  const question = wording.replace('{price}', price ? `₹${price}` : 'the price');
  const cols = { useful: 3, breed_known: 1, price_fair: 2, not_paid_reason: 2 }[key] || 1;
  const qid = `rpulse-q-${key}`;

  return (
    <Portal>
      <section
        ref={cardRef}
        className={`rpulse${shown ? ' is-in' : ''}${paused ? ' is-paused' : ''}`}
        aria-label="Quick question"
        aria-hidden={paused || undefined}
      >
        {phase === 'thanks' ? (
          <p className="rpulse__thanks" role="status">Thank you.</p>
        ) : (
          <>
            <div className="rpulse__top">
              <span className="rpulse__count">
                <span className="rpulse__dots" aria-hidden="true">
                  {steps.map((s, i) => <span key={s} className={i === step ? 'is-on' : ''} />)}
                </span>
                {step + 1} of {steps.length}
              </span>
            </div>

            <p className="rpulse__q" id={qid} ref={questionRef} tabIndex={-1} aria-live="polite">{question}</p>

            <div className={`rpulse__opts rpulse__opts--${cols}`} role="group" aria-labelledby={qid}>
              {q.options.map(([code, label]) => (
                <button
                  key={code}
                  type="button"
                  className="rpulse__opt"
                  aria-pressed={picked[key] === code}
                  onClick={() => (key === 'useful' ? pickUseful(code) : pickScreener(code))}
                >
                  {label}
                </button>
              ))}
            </div>

            {key === 'useful' && picked.useful && (
              <div className="rpulse__comment">
                <label htmlFor="rpulse-comment">{USEFUL.commentLabel} <span>(optional)</span></label>
                <div className="rpulse__comment-row">
                  <input
                    id="rpulse-comment"
                    type="text"
                    value={comment}
                    maxLength={USEFUL.commentMax}
                    autoComplete="off"
                    onChange={(e) => { setComment(e.target.value); setCommentError(''); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') sendComment(); }}
                    aria-invalid={!!commentError}
                    aria-describedby={commentError ? 'rpulse-comment-error' : undefined}
                  />
                  <button type="button" className="rpulse__send" onClick={sendComment}>Send</button>
                </div>
                {commentError && <p className="rpulse__error" id="rpulse-comment-error">{commentError}</p>}
              </div>
            )}

            {key === 'useful' && <p className="rpulse__note">{USEFUL.note}</p>}

            <div className="rpulse__foot">
              <button type="button" className="rpulse__skip" onClick={skip}>Skip</button>
            </div>
            <button type="button" className="rpulse__x" onClick={dismiss} aria-label="Close">
              <span aria-hidden="true">{'×'}</span>
            </button>
          </>
        )}

        <style>{`
          .rpulse {
            position: fixed; z-index: 1450;             /* above the paw menu button, under every modal */
            left: 12px; right: 12px; margin: 0 auto; max-width: 380px; box-sizing: border-box;
            /* Sits above the results paw button (InfoFan, 16px + 56px) and the safe area. */
            bottom: calc(84px + env(safe-area-inset-bottom, 0px));
            padding: 14px 14px 10px;
            background: #fff; color: #011E4A;
            border: 1.5px solid #FFD9BD; border-radius: 20px;
            box-shadow: 0 18px 48px rgba(1,30,74,.16);
            font-family: var(--pb-font-body, 'Figtree', system-ui, sans-serif);
            transform: translateY(14px); opacity: 0; pointer-events: none;
            transition: transform .3s cubic-bezier(.22,.61,.36,1), opacity .3s ease;
            max-height: calc(100dvh - 110px); overflow-y: auto;
          }
          .rpulse.is-in { transform: translateY(0); opacity: 1; pointer-events: auto; }
          .rpulse.is-paused { visibility: hidden; }
          @media (min-width: 768px) {
            .rpulse { left: auto; right: 24px; width: 380px; bottom: calc(92px + env(safe-area-inset-bottom, 0px)); }
          }

          .rpulse__top { display: flex; align-items: center; min-height: 20px; padding-right: 40px; }
          .rpulse__count { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; color: #C84B0A; }
          .rpulse__dots { display: inline-flex; gap: 5px; }
          .rpulse__dots span { width: 7px; height: 7px; border-radius: 50%; background: #FFD9BD; }
          .rpulse__dots span.is-on { background: #C84B0A; }

          .rpulse__q {
            margin: 6px 40px 10px 0; outline: none;
            font-family: var(--pb-font-display, 'Gabarito', system-ui, sans-serif);
            font-size: 16px; font-weight: 700; line-height: 1.3; color: #011E4A;
          }
          .rpulse__q:focus-visible { outline: 3px solid #011E4A; outline-offset: 3px; border-radius: 4px; }

          .rpulse__opts { display: grid; gap: 8px; }
          .rpulse__opts--1 { grid-template-columns: 1fr; }
          .rpulse__opts--2 { grid-template-columns: 1fr 1fr; }
          .rpulse__opts--3 { grid-template-columns: repeat(3, 1fr); }
          .rpulse__opt {
            min-height: 44px; padding: 8px 10px; box-sizing: border-box;
            border: 1.5px solid #FFD9BD; border-radius: 12px; background: #FFF6EC; color: #011E4A;
            font: inherit; font-size: 14px; font-weight: 600; line-height: 1.25; cursor: pointer;
            transition: background-color .15s, border-color .15s, color .15s;
          }
          .rpulse__opt[aria-pressed="true"] { background: #011E4A; border-color: #011E4A; color: #fff; }
          @media (hover: hover) { .rpulse__opt:hover { border-color: #F5691A; } }

          .rpulse__comment { margin-top: 10px; }
          .rpulse__comment label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; }
          .rpulse__comment label span { font-weight: 400; color: #5B6B85; }
          .rpulse__comment-row { display: flex; gap: 8px; }
          .rpulse__comment input {
            flex: 1; min-width: 0; min-height: 44px; padding: 0 12px; box-sizing: border-box;
            border: 1.5px solid #E5DCD2; border-radius: 12px; color: #011E4A; background: #fff;
            font: inherit; font-size: 16px;            /* 16px: iOS does not zoom on focus */
          }
          .rpulse__comment input:focus { border-color: #011E4A; outline: none; }
          .rpulse__comment input[aria-invalid="true"] { border-color: #B3261E; }
          .rpulse__send {
            min-height: 44px; padding: 0 16px; border: 0; border-radius: 999px;
            background: #011E4A; color: #fff; font: inherit; font-size: 14px; font-weight: 700; cursor: pointer;
          }
          .rpulse__error { margin: 6px 0 0; font-size: 12.5px; color: #B3261E; }

          .rpulse__note { margin: 10px 0 0; font-size: 12px; color: #5B6B85; }
          .rpulse__foot { display: flex; justify-content: flex-end; margin-top: 4px; }
          .rpulse__skip {
            min-height: 44px; min-width: 44px; padding: 0 8px; border: 0; background: none; cursor: pointer;
            font: inherit; font-size: 13px; font-weight: 600; color: #5B6B85;
            text-decoration: underline; text-underline-offset: 3px;
          }
          .rpulse__x {
            position: absolute; top: 4px; right: 4px; width: 44px; height: 44px;
            border: 0; background: none; border-radius: 50%; cursor: pointer;
            font-size: 22px; line-height: 1; color: #011E4A;
          }
          .rpulse__opt:focus-visible, .rpulse__send:focus-visible, .rpulse__skip:focus-visible,
          .rpulse__x:focus-visible, .rpulse__comment input:focus-visible {
            outline: 3px solid #011E4A; outline-offset: 2px;
          }
          .rpulse__thanks { margin: 6px 0; text-align: center; font-weight: 700; font-size: 15px; color: #011E4A; }

          @media (max-width: 340px) {
            .rpulse { padding: 12px 10px 8px; }
            .rpulse__opt { font-size: 13px; padding: 6px 6px; }
          }
          @media (prefers-reduced-motion: reduce) {
            .rpulse, .rpulse.is-in { transform: none; transition: none; }
            .rpulse__opt { transition: none; }
          }
        `}</style>
      </section>
    </Portal>
  );
};

export default ResultsPulse;
