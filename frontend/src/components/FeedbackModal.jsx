import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Portal from '../app/components/Portal';
import PawRating from './PawRating';
import { getOwnerId } from '../utils/dogs';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

/* The long-form feedback survey — five rated questions plus an optional note.

   Opened from "More" in the app shell, where it is the always-available way to
   say something regardless of what the person was just doing. That is what
   separates it from QuickFeedback, which is a one-tap toast tied to a specific
   moment and stays entirely independent of this.

   Ratings use PawRating, the same widget (and paw-pop animation) the owner
   survey uses — five instances, one per question, rather than a second rating
   control that would have to be kept visually in step with the first.

   All five are required. A mixed set of answered and unanswered ratings is
   near-impossible to read later — you cannot tell a skipped question from a
   bad score once it is a row in a table — so submit stays disabled until every
   one is answered. The free-text box is the opposite: genuinely optional, and
   submit works with or without it.

   Identity: `owner_id`, not a login. This app has no auth session (see
   ExperienceFeedback in models/interaction.py); the owner id is the per-device
   id every dog profile and health record is already filed under, so feedback
   lands attached to the same person those records belong to. */

const QUESTIONS = [
  {
    key: 'reliability',
    text: 'Did everything work as expected? (uploads, scans, saving your dog’s info)',
  },
  {
    key: 'ease_of_use',
    text: 'How easy was it to find and use what you needed?',
  },
  {
    key: 'match_accuracy',
    text: 'How accurate did your breed match feel for your lifestyle?',
  },
  {
    key: 'unbiased',
    text: 'Did the advice feel unbiased and genuinely helpful, not pushy?',
  },
  {
    key: 'recommend',
    text: 'How likely are you to recommend PAW BUDDY to another first-time dog owner?',
  },
];

const EMPTY = Object.fromEntries(QUESTIONS.map((q) => [q.key, 0]));

const FeedbackModal = ({ isOpen, onClose, user }) => {
  const [scores, setScores] = useState(EMPTY);
  const [comment, setComment] = useState('');
  const [phase, setPhase] = useState('form');   // form | sending | thanks
  const [error, setError] = useState('');

  /* A fresh sheet each time it opens, so a previous submission's answers can
     never be shown — or resubmitted — on the next visit. */
  useEffect(() => {
    if (!isOpen) return;
    setScores(EMPTY);
    setComment('');
    setPhase('form');
    setError('');
  }, [isOpen]);

  /* Thank-you is shown briefly and then closes itself: long enough to register
     that the feedback landed, short enough not to become another thing to
     dismiss. Cleared on unmount so closing early cannot fire it late. */
  useEffect(() => {
    if (phase !== 'thanks') return undefined;
    const t = window.setTimeout(() => onClose?.(), 1800);
    return () => window.clearTimeout(t);
  }, [phase, onClose]);

  if (!isOpen) return null;

  const answered = QUESTIONS.filter((q) => scores[q.key] > 0).length;
  const complete = answered === QUESTIONS.length;

  const submit = async () => {
    if (!complete || phase === 'sending') return;
    setPhase('sending');
    setError('');
    try {
      await axios.post(`${API_URL}/api/feedback/experience`, {
        owner_id: getOwnerId(),
        // Only ever present for an admin — there is no ordinary login. Sent so
        // the record is richer when it happens to exist, never relied upon.
        user_id: user?.id || null,
        user_name: user?.name || null,
        ...scores,
        comment: comment.trim() || null,
      });
      setPhase('thanks');
    } catch {
      // Kept on the form with everything still filled in, rather than thrown
      // away — retyping five ratings because the network blipped is the fastest
      // way to never get feedback twice.
      setError('Couldn’t send that. Check your connection and try again.');
      setPhase('form');
    }
  };

  return (
    <Portal>
      <div className="fbm" role="dialog" aria-modal="true" aria-label="Share your feedback" onClick={onClose}>
        <div className="fbm__box" onClick={(e) => e.stopPropagation()}>
          <div className="fbm__bar">
            <span>Share your feedback</span>
            <button type="button" onClick={onClose} aria-label="Close">×</button>
          </div>

          {phase === 'thanks' ? (
            <div className="fbm__thanks">
              <div className="fbm__thanks-icon" aria-hidden="true">🐾</div>
              <strong>Thank you!</strong>
              <p>Your feedback helps us make Paw Buddy better for everyone.</p>
            </div>
          ) : (
            <div className="fbm__body">
              <p className="fbm__intro">
                Five quick questions about how Paw Buddy is working for you.
              </p>

              {QUESTIONS.map((q, i) => (
                <div key={q.key} className="fbm__q">
                  <p className="fbm__q-text">
                    <span className="fbm__q-n" aria-hidden="true">{i + 1}</span>
                    {q.text}
                  </p>
                  <PawRating
                    label={q.text}
                    value={scores[q.key]}
                    onChange={(v) => setScores((prev) => ({ ...prev, [q.key]: v }))}
                  />
                </div>
              ))}

              <div className="fbm__q">
                <label className="fbm__q-text" htmlFor="fbm-comment">
                  Anything else you’d like to tell us? <em>Optional</em>
                </label>
                <textarea
                  id="fbm-comment"
                  className="fbm__text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Anything the questions above didn’t cover…"
                  maxLength={2000}
                  rows={3}
                />
              </div>

              {error && <p className="fbm__error" role="alert">{error}</p>}

              <div className="fbm__actions">
                {/* Says what is still missing rather than just greying out —
                    a disabled button with no reason is the commonest way a
                    form silently dead-ends. */}
                <span className="fbm__progress" aria-live="polite">
                  {complete
                    ? 'All five answered'
                    : `${answered} of ${QUESTIONS.length} rated`}
                </span>
                <button
                  type="button"
                  className="fbm__send"
                  onClick={submit}
                  disabled={!complete || phase === 'sending'}
                >
                  {phase === 'sending' ? 'Sending…' : 'Submit feedback'}
                </button>
              </div>
            </div>
          )}

          <style>{`
            .fbm {
              position: fixed; inset: 0; z-index: 3200;
              background: rgba(35,22,14,.72);
              display: flex; align-items: center; justify-content: center;
              padding: 20px;
              font-family: var(--font-body-family);
            }
            .fbm__box {
              background: var(--white, #fff); border-radius: 16px;
              width: 100%; max-width: 520px; max-height: 90dvh; overflow-y: auto;
              box-shadow: var(--shadow-lg, 0 30px 70px rgba(0,0,0,.35));
            }
            .fbm__bar {
              display: flex; align-items: center; justify-content: space-between; gap: 12px;
              padding: 13px 17px; border-bottom: 1px solid var(--border, #EFE6DC);
              background: var(--cream, #FBF5EF);
              position: sticky; top: 0; z-index: 1;
            }
            .fbm__bar span {
              font-family: var(--font-display); color: var(--brown);
              font-weight: var(--weight-semibold); font-size: 15.5px;
            }
            .fbm__bar button {
              border: none; background: none; color: var(--text-soft);
              font-size: 24px; line-height: 1; cursor: pointer; padding: 0 4px;
            }
            .fbm__bar button:hover { color: var(--brown); }

            .fbm__body { padding: 16px 17px 18px; }
            .fbm__intro {
              margin: 0 0 18px; color: var(--text-soft);
              font-size: 13px; line-height: 1.55;
            }

            .fbm__q { margin-bottom: 18px; }
            .fbm__q-text {
              display: block; margin: 0 0 6px;
              color: var(--brown); font-size: 13.5px; line-height: 1.5;
              font-weight: var(--weight-medium);
            }
            .fbm__q-text em {
              font-style: normal; color: var(--text-soft);
              font-weight: var(--weight-regular); font-size: 12.5px;
            }
            .fbm__q-n {
              display: inline-flex; align-items: center; justify-content: center;
              width: 19px; height: 19px; margin-right: 7px; vertical-align: 1px;
              border-radius: 50%; background: var(--orange-pale, #FDF1E8);
              color: var(--orange-strong, #C44E12);
              font-size: 11px; font-weight: var(--weight-bold);
            }

            .fbm__text {
              width: 100%; box-sizing: border-box;
              padding: 11px 13px; border-radius: 12px;
              border: 1px solid var(--border-strong, #E3D9CE); background: #fff;
              font-family: inherit; font-size: 14px; color: var(--brown);
              outline: none; resize: vertical;
            }
            .fbm__text:focus {
              border-color: var(--orange);
              box-shadow: var(--focus-ring, 0 0 0 3px rgba(227,93,24,.18));
            }

            .fbm__error {
              margin: 0 0 12px; padding: 9px 12px; border-radius: 10px;
              background: #FFF5F5; border: 1px solid #F2C9C9; color: #B23B3B;
              font-size: 12.5px;
            }

            .fbm__actions {
              display: flex; align-items: center; justify-content: space-between;
              gap: 12px; flex-wrap: wrap;
              padding-top: 4px;
            }
            .fbm__progress { color: var(--text-soft); font-size: 12.5px; }
            .fbm__send {
              padding: 11px 22px; border-radius: 50px; border: none;
              background: var(--orange); color: #fff; cursor: pointer;
              font-family: var(--font-display); font-weight: var(--weight-bold);
              font-size: 14.5px;
              transition: filter .18s ease, opacity .18s ease;
            }
            .fbm__send:disabled { opacity: .45; cursor: not-allowed; }
            @media (hover: hover) {
              .fbm__send:not(:disabled):hover { filter: brightness(1.06); }
            }
            .fbm__send:focus-visible { outline: 2px solid var(--orange); outline-offset: 2px; }

            .fbm__thanks {
              padding: 34px 24px 38px; text-align: center;
              animation: fbmIn .32s cubic-bezier(.16,1,.3,1) both;
            }
            .fbm__thanks-icon { font-size: 42px; margin-bottom: 10px; }
            .fbm__thanks strong {
              display: block; font-family: var(--font-display);
              color: var(--orange-strong, #C44E12);
              font-weight: var(--weight-semibold); font-size: 19px; margin-bottom: 6px;
            }
            .fbm__thanks p {
              margin: 0; color: var(--text-soft); font-size: 13.5px; line-height: 1.55;
            }
            @keyframes fbmIn {
              from { opacity: 0; transform: translateY(6px); }
              to   { opacity: 1; transform: none; }
            }
            @media (prefers-reduced-motion: reduce) {
              .fbm__thanks { animation: none; }
            }

            @media (max-width: 480px) {
              .fbm { padding: 12px; }
              .fbm__actions { flex-direction: column-reverse; align-items: stretch; }
              .fbm__send { width: 100%; }
              .fbm__progress { text-align: center; }
            }
          `}</style>
        </div>
      </div>
    </Portal>
  );
};

export default FeedbackModal;
