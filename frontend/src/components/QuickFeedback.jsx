import { useEffect, useState } from 'react';
import axios from 'axios';
import Portal from '../app/components/Portal';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/* One-tap contextual feedback, as a screen-anchored toast.

   Asked at the moment the thing happened, about that specific thing, and
   answerable in a single tap — the whole interaction is meant to cost about a
   second. Three paws rather than five because this arrives unrequested and has
   to be readable at a glance; five points of nuance is what the detailed modal
   is for. Paws rather than 👍/👎 because the product's rating language is
   already paws (PawRating).

   A toast, NOT a modal: no scrim, no focus trap, nothing behind it is
   disabled, and ignoring it entirely is a valid response. It sits above the
   mobile tab bar so it can never cover navigation.

   Two things this file has to get right that are easy to miss:

   1. It renders through <Portal>. `.pb-page` carries a transform from its
      entry animation, and a transformed ancestor becomes the containing block
      for `position: fixed` — a toast rendered in place would be positioned
      against the page, not the viewport, and land off-screen.

   2. Only ONE toast is ever on screen. Several instances can mount at once
      (DocumentVault renders one per scanned document), and as fixed elements
      they would stack in the same spot. A module-level claim lets the first
      instance own the slot and keeps the rest silent. */

const PAWS = [
  { value: 1, label: 'Not useful' },
  { value: 2, label: 'Okay' },
  { value: 3, label: 'Useful' },
];

const STORE_KEY = 'pb_quick_feedback_given';

/* The single-toast lock. Module scope so it is shared across every instance
   in the tree, and a plain variable rather than state because it must be
   claimed synchronously during mount, before any re-render. */
let slotTaken = false;

const keyFor = (context, contextId) => (contextId ? `${context}:${contextId}` : context);

const readGiven = () => {
  try {
    return JSON.parse(window.localStorage.getItem(STORE_KEY) || '[]');
  } catch {
    return [];
  }
};

/** Has this user already answered for this exact thing? */
export const hasGivenFeedback = (context, contextId) => {
  try {
    return readGiven().includes(keyFor(context, contextId));
  } catch {
    return false;   // storage unavailable: better to ask than to hide silently
  }
};

const markGiven = (context, contextId) => {
  try {
    const given = readGiven();
    const key = keyFor(context, contextId);
    if (!given.includes(key)) {
      window.localStorage.setItem(STORE_KEY, JSON.stringify([...given, key]));
    }
  } catch {
    /* private mode — they may be asked again next visit, which is survivable */
  }
};

/* Same paw as PawRating, at toast scale. */
const Paw = ({ filled }) => (
  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
    <g
      fill={filled ? 'var(--orange)' : 'none'}
      stroke={filled ? 'var(--orange)' : '#C9BCB0'}
      strokeWidth="1.4"
    >
      <ellipse cx="6.5" cy="8.5" rx="2.4" ry="3.1" />
      <ellipse cx="11" cy="5.6" rx="2.5" ry="3.3" />
      <ellipse cx="16.2" cy="6.4" rx="2.4" ry="3.1" />
      <ellipse cx="20" cy="10.6" rx="2.1" ry="2.7" />
      <path d="M12.4 12.2c3.1 0 5.9 2.3 5.9 5.1 0 2.2-1.9 3.4-4 3.4-1.2 0-1.6-.4-2.6-.4s-1.4.4-2.6.4c-2.1 0-4-1.2-4-3.4 0-2.8 2.8-5.1 5.9-5.1Z" />
    </g>
  </svg>
);

const QuickFeedback = ({
  context,
  contextId = null,
  question = 'Was this useful?',
  user = null,
}) => {
  const [alreadyGiven] = useState(() => hasGivenFeedback(context, contextId));
  const [owns, setOwns] = useState(false);      // did this instance win the slot
  const [shown, setShown] = useState(false);    // drives the slide-up
  const [rating, setRating] = useState(0);
  const [phase, setPhase] = useState('ask');    // ask | comment | thanks | done
  const [comment, setComment] = useState('');

  /* Claim the one toast slot, and release it on unmount so a later prompt in
     the same session can still appear. */
  useEffect(() => {
    if (alreadyGiven || slotTaken) return undefined;
    slotTaken = true;
    setOwns(true);
    // A beat before sliding in, so it reads as a response to what just
    // happened rather than part of the page load.
    const t = window.setTimeout(() => setShown(true), 350);
    return () => {
      window.clearTimeout(t);
      slotTaken = false;
    };
  }, [alreadyGiven]);

  if (alreadyGiven || !owns || phase === 'done') return null;

  const post = (value, text) => {
    // Fire-and-forget on purpose. Feedback failing is not the user's problem
    // and must not interrupt what they were doing.
    axios.post(`${API_URL}/api/feedback`, {
      user_id: user?.id || null,
      user_name: user?.name || 'Anonymous',
      rating: value,
      comment: text || null,
      context,
      context_id: contextId,
      rating_type: 'quick',
    }).catch(() => {});
    markGiven(context, contextId);
  };

  const close = () => { setShown(false); window.setTimeout(() => setPhase('done'), 200); };

  const finish = () => {
    setPhase('thanks');
    window.setTimeout(close, 1400);   // long enough to read, short enough not to linger
  };

  const pick = (value) => {
    setRating(value);
    // A 1-paw rating posts ONCE, after the follow-up resolves — posting here
    // and again on send would file the same rating twice and double-count
    // every negative in any average.
    if (value === 1) { setPhase('comment'); return; }
    post(value);
    finish();
  };

  const sendComment = () => {
    post(rating, comment.trim() || null);
    finish();
  };

  return (
    <Portal>
      <div
        className={`qfb ${shown ? 'is-in' : ''}`}
        role="status"
        aria-live="polite"
      >
        {phase === 'ask' && (
          <>
            <span className="qfb__q">{question}</span>
            <span className="qfb__paws">
              {PAWS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  className="qfb__paw"
                  aria-label={p.label}
                  title={p.label}
                  onClick={() => pick(p.value)}
                >
                  <Paw filled={rating >= p.value} />
                </button>
              ))}
            </span>
            <button type="button" className="qfb__x" onClick={close} aria-label="Dismiss">×</button>
          </>
        )}

        {phase === 'comment' && (
          <>
            <span className="qfb__q">What went wrong? (optional)</span>
            <input
              className="qfb__input"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Optional"
              maxLength={300}
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') sendComment(); }}
            />
            <button type="button" className="qfb__send" onClick={sendComment}>Send</button>
            {/* Skip files the rating with no comment — same single post as
                Send, so skipping still records what they said. */}
            <button type="button" className="qfb__x" onClick={sendComment}>Skip</button>
          </>
        )}

        {phase === 'thanks' && <span className="qfb__thanks">Thanks! 🐾</span>}

        <style>{`
          .qfb {
            position: fixed;
            left: 50%;
            /* Clears the mobile tab bar (64px) plus the safe area, so it can
               never sit on top of navigation. */
            bottom: calc(64px + env(safe-area-inset-bottom, 0px) + 12px);
            z-index: 2500;              /* under modals (3000), over content */
            width: min(420px, calc(100vw - 28px));
            display: flex; align-items: center; gap: 9px;
            padding: 11px 12px;
            background: var(--white, #fff);
            border: 1px solid var(--border, #EFE6DC);
            border-radius: var(--radius, 20px);
            box-shadow: var(--shadow-lg, 0 24px 64px rgba(61,31,0,.18));
            font-family: var(--font-sans, inherit);
            /* Starts off-screen-ish and un-interactive; .is-in brings it in. */
            transform: translate(-50%, 16px);
            opacity: 0;
            pointer-events: none;
            transition: transform var(--pb-slow, .32s) var(--pb-ease, cubic-bezier(.22,.61,.36,1)),
                        opacity var(--pb-slow, .32s) var(--pb-ease, ease);
          }
          .qfb.is-in { transform: translate(-50%, 0); opacity: 1; pointer-events: auto; }

          /* No tab bar above this width, so it can sit lower and to the side. */
          @media (min-width: 1024px) {
            .qfb { left: auto; right: 22px; bottom: 22px; transform: translate(0, 16px); }
            .qfb.is-in { transform: translate(0, 0); }
          }

          .qfb__q {
            flex: 1 1 auto; min-width: 0;
            font-size: 13px; font-weight: var(--weight-semibold, 600);
            color: var(--brown, #3D1F00); line-height: 1.35;
          }
          .qfb__paws { display: flex; gap: 2px; flex-shrink: 0; }
          .qfb__paw {
            width: 40px; height: 40px;
            display: flex; align-items: center; justify-content: center;
            border: none; background: none; padding: 0; cursor: pointer;
            border-radius: 10px;
            -webkit-tap-highlight-color: transparent;
            transition: transform var(--pb-fast, .18s) var(--pb-ease, ease),
                        background-color var(--pb-fast, .18s) var(--pb-ease, ease);
          }
          .qfb__paw:active { transform: scale(.88); }
          .qfb__paw:focus-visible { outline: 2px solid var(--orange); outline-offset: 2px; }
          @media (hover: hover) {
            .qfb__paw:hover { background: var(--orange-pale, #FFF0E8); transform: translateY(-2px); }
          }

          .qfb__input {
            flex: 1 1 120px; min-width: 0;
            padding: 9px 11px; font-family: inherit; font-size: 13px;
            border: 1px solid var(--border-strong, #E3D9CE);
            border-radius: 10px; background: var(--white, #fff); color: var(--brown);
            outline: none;
            transition: border-color var(--pb-fast, .18s) var(--pb-ease, ease),
                        box-shadow var(--pb-fast, .18s) var(--pb-ease, ease);
          }
          .qfb__input:focus { border-color: var(--orange); box-shadow: var(--focus-ring, 0 0 0 3px rgba(227,93,24,.18)); }

          .qfb__send {
            flex-shrink: 0; padding: 9px 15px; min-height: 38px;
            border: none; border-radius: 50px; cursor: pointer;
            background: var(--orange); color: #fff;
            font-family: inherit; font-size: 13px; font-weight: var(--weight-bold, 700);
            transition: filter var(--pb-fast, .18s) var(--pb-ease, ease);
          }
          @media (hover: hover) { .qfb__send:hover { filter: brightness(1.06); } }
          .qfb__send:focus-visible { outline: 2px solid var(--orange); outline-offset: 2px; }

          .qfb__x {
            flex-shrink: 0; border: none; background: none; cursor: pointer;
            color: var(--text-soft); font-family: inherit; font-size: 13px;
            font-weight: var(--weight-semibold, 600);
            padding: 9px; border-radius: 8px; line-height: 1;
          }
          @media (hover: hover) { .qfb__x:hover { color: var(--brown); } }
          .qfb__x:focus-visible { outline: 2px solid var(--orange); outline-offset: 2px; }

          .qfb__thanks {
            flex: 1 1 auto; text-align: center;
            font-size: 13.5px; font-weight: var(--weight-bold, 700);
            color: var(--orange-strong, #C44E12);
          }

          /* Honour the OS setting: it still appears and still works, it just
             doesn't travel. */
          @media (prefers-reduced-motion: reduce) {
            .qfb { transition: opacity .01ms; transform: translate(-50%, 0); }
            .qfb.is-in { transform: translate(-50%, 0); }
            @media (min-width: 1024px) {
              .qfb, .qfb.is-in { transform: none; }
            }
            .qfb__paw:hover { transform: none; }
          }
        `}</style>
      </div>
    </Portal>
  );
};

export default QuickFeedback;
