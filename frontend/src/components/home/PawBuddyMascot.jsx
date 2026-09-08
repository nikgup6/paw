import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* Friendly fixed-corner mascot. Periodically shows an elegant speech bubble
   with a vet-verified message. Lightweight (CSS/Framer only), touch-friendly,
   and dismissible. Swap MASCOT_IMG_URL for your own transparent Golden
   Retriever PNG (a cropped, forward-facing puppy looks best). */
/* Drop the background-removed mascot at frontend/public/assets/mascot.png and
   it is picked up automatically — no code change needed. Until that file
   exists we fall back to the old photo, then to an emoji, so the mascot never
   renders broken. */
const MASCOT_IMG_URL = '/assets/mascot.png';
const MASCOT_FALLBACK_URL = '/assets/golder_retriever.jpeg';

// Three friendly tips. They quietly rotate every 10s, but the bubble only
// ever appears when the user taps the mascot (no auto pop-up — that was
// distracting).
const MESSAGES = [
  'These picks are based on your lifestyle. Already have a breed in mind? Choose “I already love a specific breed” in the quiz, or explore all our breeds.',
  "I hope you're having a lovely day! Just so you know — my lifestyle recommendations are verified by top veterinary experts.",
  'Take your time — finding your perfect pup is a joyful journey. Whatever you choose, a very lucky dog is waiting for you. 🐾',
];

const PawBuddyMascot = () => {
  const [open, setOpen] = useState(false);
  const [msgIndex, setMsgIndex] = useState(0);
  // Fully hidden for the rest of the session once the user closes the mascot.
  const [hidden, setHidden] = useState(() =>
    typeof sessionStorage !== 'undefined' && sessionStorage.getItem('pb_mascot_hidden') === '1');

  // Rotate the current tip every 10s. Pause while the bubble is open so the
  // text the user is reading doesn't change under them.
  useEffect(() => {
    if (hidden || open) return;
    const id = setInterval(() => setMsgIndex((i) => (i + 1) % MESSAGES.length), 10000);
    return () => clearInterval(id);
  }, [hidden, open]);

  const hideForever = () => {
    setHidden(true);
    setOpen(false);
    try { sessionStorage.setItem('pb_mascot_hidden', '1'); } catch { /* ignore */ }
  };

  if (hidden) return null;

  return (
    <div className="pb-mascot" aria-live="polite">
      <AnimatePresence>
        {open && (
          <motion.div
            key="bubble"
            className="pb-mascot__bubble"
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            role="status"
          >
            <button
              className="pb-mascot__close"
              aria-label="Dismiss message"
              onClick={(e) => { e.stopPropagation(); setOpen(false); }}
            >
              ×
            </button>
            {msgIndex === 1 && (
              <div className="pb-mascot__verified">
                <img src="/verified.png" alt="" onError={(e) => { e.target.style.display = 'none'; }} />
                <span>Vet-Verified</span>
              </div>
            )}
            <p>{MESSAGES[msgIndex]}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pb-mascot__dogwrap">
        <button
          className="pb-mascot__hide"
          aria-label="Hide mascot"
          title="Hide"
          onClick={(e) => { e.stopPropagation(); hideForever(); }}
        >
          ×
        </button>
        <motion.button
          type="button"
          className="pb-mascot__dog"
          aria-label="Paw Buddy mascot — show a tip"
          onClick={() => setOpen((v) => !v)}
          animate={{ y: [0, -7, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
        >
          <img
            src={MASCOT_IMG_URL}
            alt="Paw Buddy"
            onError={(e) => {
              const img = e.currentTarget;
              if (img.dataset.fellBack !== '1') {   // mascot.png not added yet
                img.dataset.fellBack = '1';
                img.src = MASCOT_FALLBACK_URL;
                return;
              }
              img.replaceWith(Object.assign(document.createElement('span'), { textContent: '🐕', style: 'font-size:38px' }));
            }}
          />
          <span className="pb-mascot__badge" aria-hidden="true">🐾</span>
        </motion.button>
      </div>

      <style>{`
        .pb-mascot {
          position: fixed;
          right: 20px;
          bottom: 20px;
          z-index: 1200;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 10px;
          pointer-events: none;
        }
        .pb-mascot__dogwrap {
          pointer-events: auto;
          position: relative;
        }
        .pb-mascot__hide {
          position: absolute;
          top: -6px;
          right: -6px;
          z-index: 2;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          border: 1px solid rgba(0,0,0,0.08);
          background: #fff;
          color: #8a7a6c;
          font-size: 15px;
          line-height: 1;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 3px 8px rgba(0,0,0,0.16);
          opacity: 0;
          transition: opacity 0.2s ease;
        }
        .pb-mascot__dogwrap:hover .pb-mascot__hide,
        .pb-mascot__hide:focus-visible { opacity: 1; }
        .pb-mascot__dog {
          pointer-events: auto;
          width: 74px;
          height: 74px;
          border-radius: 50%;
          border: 3px solid #fff;
          background: #fff;
          padding: 0;
          overflow: visible;
          cursor: pointer;
          box-shadow: 0 10px 26px rgba(61, 41, 28, 0.28);
          position: relative;
          display: block;
        }
        .pb-mascot__dog img {
          width: 100%;
          height: 100%;
          /* contain, not cover: a background-removed PNG must sit inside the
             circle whole rather than being cropped at the edges. */
          object-fit: contain;
          border-radius: 50%;
          display: block;
        }
        .pb-mascot__badge {
          position: absolute;
          bottom: -4px;
          left: -4px;
          background: var(--orange, #E66A1A);
          color: #fff;
          width: 26px;
          height: 26px;
          border-radius: 50%;
          font-size: 13px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid #fff;
          box-shadow: 0 3px 8px rgba(0,0,0,0.18);
        }
        .pb-mascot__bubble {
          pointer-events: auto;
          position: relative;
          max-width: 250px;
          background: #fff;
          color: var(--brown, #5a4636);
          border-radius: 18px 18px 6px 18px;
          padding: 14px 16px 14px;
          box-shadow: 0 16px 40px rgba(61, 41, 28, 0.22);
          border: 1px solid rgba(230, 106, 26, 0.15);
          font-family: var(--font-body-family);
        }
        .pb-mascot__bubble p {
          margin: 0;
          font-size: 13px;
          line-height: 1.5;
        }
        .pb-mascot__verified {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          margin-bottom: 7px;
          font-size: 11px;
          font-weight: 700;
          color: var(--orange, #E66A1A);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .pb-mascot__verified img { width: 15px; height: 15px; object-fit: contain; }
        .pb-mascot__close {
          position: absolute;
          top: 6px;
          right: 8px;
          background: none;
          border: none;
          font-size: 17px;
          line-height: 1;
          color: #b7a99c;
          cursor: pointer;
          padding: 2px 4px;
        }
        @media (max-width: 768px) {
          .pb-mascot { right: 12px; bottom: 12px; }
          .pb-mascot__dog { width: 54px; height: 54px; }
          .pb-mascot__bubble { max-width: 190px; }
          /* No hover on touch — keep the hide control always tappable */
          .pb-mascot__hide { opacity: 1; width: 24px; height: 24px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .pb-mascot__dog { animation: none; }
        }
      `}</style>
    </div>
  );
};

export default PawBuddyMascot;
