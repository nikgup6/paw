import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import Portal from '../../app/components/Portal';
import { sessionId, track } from '../../utils/analytics';
import { PULSE_VERSION, SCREENERS, THANKS_MS } from '../../config/pulse';
import { markAskedNotUnlocked } from './notUnlocked';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/* "What stopped you from unlocking?" - one small, skippable card, asked where
   the decision happened: right after someone closes the paywall without paying
   (moment "dismissed"), or once on their next visit if they left the site with
   the paywall still open (moment "next_visit").

   One tap saves the answer through POST /api/feedback/screener with
   key = not_paid_reason (same codes as before, config/pulse.js). No reward, no
   pressure: ignoring it, Skip and the close button are all fine answers.

   Asked once per person: remembered in this browser, and checked with the
   server (GET /api/feedback/pulse/status), which also knows a signed-in account.
   Never shown to someone who tapped Pay - pages/Home.jsx decides that. */

const Q = SCREENERS.not_paid_reason;

export default function NotUnlockedCard({ moment, onDone }) {
  const [shown, setShown] = useState(false);
  const [picked, setPicked] = useState(null);
  const [thanks, setThanks] = useState(false);
  const fired = useRef(false);

  useEffect(() => {
    if (!fired.current) {
      fired.current = true;
      markAskedNotUnlocked();
      track('not_unlocked_asked', { moment });
    }
    const t = window.setTimeout(() => setShown(true), 30);
    return () => window.clearTimeout(t);
  }, [moment]);

  const leave = (answered) => {
    if (!answered) track('pulse_dismissed', { step: 'not_paid_reason' });
    setShown(false);
    window.setTimeout(() => onDone?.(), 220);
  };

  useEffect(() => {
    if (thanks) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') leave(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const pick = (code) => {
    setPicked(code);
    axios.post(`${API_URL}/api/feedback/screener`, {
      session_id: sessionId, version: PULSE_VERSION, key: 'not_paid_reason', answer: code,
    }).catch(() => { /* a failed save is not their problem */ });
    track('screener_answered', { key: 'not_paid_reason', answer: code });
    window.setTimeout(() => setThanks(true), 220);
    window.setTimeout(() => leave(true), 220 + THANKS_MS);
  };

  return (
    <Portal>
      <section className={`nuc${shown ? ' is-in' : ''}`} aria-label="Quick question">
        {thanks ? (
          <p className="nuc__thanks" role="status">Thank you.</p>
        ) : (
          <>
            <p className="nuc__q" id="nuc-q" aria-live="polite">What stopped you from unlocking?</p>
            <div className="nuc__opts" role="group" aria-labelledby="nuc-q">
              {Q.options.map(([code, label]) => (
                <button key={code} type="button" className="nuc__opt" aria-pressed={picked === code} onClick={() => pick(code)}>
                  {label}
                </button>
              ))}
            </div>
            <div className="nuc__foot">
              <button type="button" className="nuc__skip" onClick={() => leave(false)}>Skip</button>
            </div>
            <button type="button" className="nuc__x" onClick={() => leave(false)} aria-label="Close">
              <span aria-hidden="true">{'×'}</span>
            </button>
          </>
        )}
        <style>{`
          .nuc {
            position: fixed; z-index: 1450; left: 12px; right: 12px; margin: 0 auto; max-width: 380px; box-sizing: border-box;
            bottom: calc(16px + env(safe-area-inset-bottom, 0px));
            padding: 14px 14px 8px; background: #fff; color: #011E4A;
            border: 1.5px solid #FFD9BD; border-radius: 20px; box-shadow: 0 18px 48px rgba(1,30,74,.16);
            font-family: var(--pb-font-body, 'Figtree', system-ui, sans-serif);
            transform: translateY(14px); opacity: 0; pointer-events: none;
            transition: transform .3s cubic-bezier(.22,.61,.36,1), opacity .3s ease;
          }
          .nuc.is-in { transform: translateY(0); opacity: 1; pointer-events: auto; }
          @media (min-width: 768px) { .nuc { left: auto; right: 24px; width: 380px; bottom: calc(24px + env(safe-area-inset-bottom, 0px)); } }
          .nuc__q { margin: 2px 40px 10px 0; font-family: var(--pb-font-display, 'Gabarito', system-ui, sans-serif); font-size: 16px; font-weight: 700; line-height: 1.3; }
          .nuc__opts { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
          .nuc__opt {
            min-height: 44px; padding: 6px 8px; border: 1.5px solid #FFD9BD; border-radius: 12px; background: #FFF6EC;
            color: #011E4A; font: inherit; font-size: 13.5px; font-weight: 600; line-height: 1.25; cursor: pointer;
          }
          .nuc__opt[aria-pressed="true"] { background: #011E4A; border-color: #011E4A; color: #fff; }
          @media (hover: hover) { .nuc__opt:hover { border-color: #F5691A; } }
          .nuc__foot { display: flex; justify-content: flex-end; }
          .nuc__skip { min-height: 44px; min-width: 44px; border: 0; background: none; cursor: pointer; font: inherit; font-size: 13px; font-weight: 600; color: #5B6B85; text-decoration: underline; text-underline-offset: 3px; }
          .nuc__x { position: absolute; top: 4px; right: 4px; width: 44px; height: 44px; border: 0; background: none; border-radius: 50%; cursor: pointer; font-size: 22px; color: #011E4A; }
          .nuc__opt:focus-visible, .nuc__skip:focus-visible, .nuc__x:focus-visible { outline: 3px solid #011E4A; outline-offset: 2px; }
          .nuc__thanks { margin: 6px 0 10px; text-align: center; font-weight: 700; font-size: 15px; }
          @media (prefers-reduced-motion: reduce) { .nuc, .nuc.is-in { transform: none; transition: none; } }
        `}</style>
      </section>
    </Portal>
  );
}
