import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* Premium "About PawBuddy" full-screen modal — fade + slide + scale in,
   blurred/darkened backdrop, staggered feature cards, glassmorphism.
   Brand palette: cream / orange / brown, Jakarta Sans headings + Work Sans body. */

/* Card icons — brown line strokes with one orange accent each, replacing the
   old emoji so they match the brand and look identical on every device.
   Decorative only (each card's heading carries the meaning). */
const INK = 'var(--brown, #3D1F00)';
const ACCENT = 'var(--orange, #E35D18)';
const Icon = ({ children }) => (
  <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true"
    strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

const QuizIcon = () => (
  <Icon>
    <path d="M20 13V6.5A2.5 2.5 0 0 0 17.5 4h-10A2.5 2.5 0 0 0 5 6.5v19A2.5 2.5 0 0 0 7.5 28H14" stroke={INK} />
    <path d="M9 10h7M9 14.5h7M9 19h3.5" stroke={INK} />
    <path d="M17.5 28l.8-3.6 7.6-7.6a1.7 1.7 0 0 1 2.4 2.4l-7.6 7.6-3.2 1.2Z" stroke={ACCENT} />
  </Icon>
);

const ShieldIcon = () => (
  <Icon>
    <path d="M16 3.5l10 3.8v7.4c0 6.4-4.2 11.2-10 13.8-5.8-2.6-10-7.4-10-13.8V7.3l10-3.8Z" stroke={INK} />
    <path d="M11.5 16l3.2 3.2 6-6.4" stroke={ACCENT} strokeWidth="2.2" />
  </Icon>
);

const RecordsIcon = () => (
  <Icon>
    <rect x="6" y="5" width="20" height="23" rx="3" stroke={INK} />
    <path d="M12 5V3.5h8V5" stroke={INK} />
    <path d="M16 10v6M13 13h6" stroke={ACCENT} strokeWidth="2.2" />
    <path d="M11 20.5h10M11 24h10" stroke={INK} />
  </Icon>
);

const AssistantIcon = () => (
  <Icon>
    <rect x="5" y="10" width="22" height="15" rx="6" stroke={INK} />
    <path d="M10 10V6.5M22 10V6.5" stroke={INK} />
    <circle cx="10" cy="5.5" r="1.4" fill={ACCENT} stroke="none" />
    <circle cx="22" cy="5.5" r="1.4" fill={ACCENT} stroke="none" />
    <path d="M11 16.5c.6-1 2-1 2.6 0M18.4 16.5c.6-1 2-1 2.6 0" stroke={ACCENT} />
    <path d="M14 21h4" stroke={INK} />
    <path d="M3 15.5v4M29 15.5v4" stroke={INK} />
  </Icon>
);

const RemindersIcon = () => (
  <Icon>
    <path d="M15 26H7a2.5 2.5 0 0 1-2.5-2.5V9A2.5 2.5 0 0 1 7 6.5h16A2.5 2.5 0 0 1 25.5 9v5" stroke={INK} />
    <path d="M4.5 12h21M10 4v5M20 4v5" stroke={INK} />
    <path d="M9 16.5h.01M13 16.5h.01M9 20.5h.01M13 20.5h.01" stroke={INK} strokeWidth="2.6" />
    <circle cx="22.5" cy="22.5" r="5.5" stroke={ACCENT} />
    <path d="M22.5 19.8v2.9h2.2" stroke={ACCENT} />
  </Icon>
);

const VetIcon = () => (
  <Icon>
    <path d="M4 14.5L16 4.5l12 10" stroke={INK} />
    <path d="M7 12.5V27h18V12.5" stroke={INK} />
    <path d="M13.5 27v-6.5h5V27" stroke={INK} />
    <path d="M16 9.5v5M13.5 12h5" stroke={ACCENT} strokeWidth="2.2" />
  </Icon>
);

const CORE = [
  {
    icon: <QuizIcon />,
    title: 'Lifestyle-Based Breed Recommendations',
    body: 'Answer a short quiz and get personalised breed matches based on your home, climate, family, budget, activity level, and experience.',
  },
  {
    icon: <ShieldIcon />,
    title: 'Verified Breeders',
    body: 'Connect only with trusted, verified breeders. We prioritise ethical breeding and healthier puppies.',
  },
];

const SOON = [
  { icon: <RecordsIcon />, title: 'Digital Health Records', body: 'Store vaccinations, prescriptions, medical history, and health reports in one place.' },
  { icon: <AssistantIcon />, title: 'AI Pet Assistant', body: 'Instant answers for nutrition, training, health guidance, and everyday dog care.' },
  { icon: <RemindersIcon />, title: 'Smart Vaccination & Care Reminders', body: 'Never miss vaccinations, grooming, deworming, or vet appointments.' },
  { icon: <VetIcon />, title: 'Vet & Pet Services', body: 'Book trusted vets, trainers, groomers, boarding, and pet-care pros directly through PawBuddy.' },
];

const cardHover = { y: -6, boxShadow: '0 20px 44px rgba(208, 92, 25, 0.20)' };

const AboutModal = ({ isOpen, onClose, onTakeQuiz }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="about-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="About PawBuddy"
        >
          <motion.div
            className="about-panel"
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.98 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="about-close" aria-label="Close" onClick={onClose}>×</button>

            {/* Hero */}
            <motion.div
              className="about-hero"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, duration: 0.5 }}
            >
              <motion.div
                className="about-hero__paw"
                animate={{ y: [0, -10, 0], rotate: [0, 4, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              >
                🐾
              </motion.div>
              <h2>Meet PawBuddy</h2>
              <p>
                PawBuddy helps you find the right dog breed based on your lifestyle — not just
                popularity. We also connect you with verified, ethical breeders so you can bring
                home your perfect companion with confidence.
              </p>
            </motion.div>

            {/* Core features */}
            <div className="about-grid about-grid--core">
              {CORE.map((f, i) => (
                <motion.div
                  key={f.title}
                  className="about-card"
                  initial={{ opacity: 0, y: 26 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.22 + i * 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  whileHover={cardHover}
                >
                  <div className="about-card__icon">{f.icon}</div>
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                </motion.div>
              ))}
            </div>

            {/* Coming soon */}
            <motion.h3
              className="about-soon-title"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.4 }}
            >
              Coming Soon
            </motion.h3>
            <div className="about-grid about-grid--soon">
              {SOON.map((f, i) => (
                <motion.div
                  key={f.title}
                  className="about-card about-card--soon"
                  initial={{ opacity: 0, y: 26 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.46 + i * 0.09, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  whileHover={cardHover}
                >
                  <div className="about-card__icon">{f.icon}</div>
                  <h4>{f.title}</h4>
                  <p>{f.body}</p>
                </motion.div>
              ))}
            </div>

            {/* CTA */}
            <motion.div
              className="about-cta"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.5 }}
            >
              <h3>Find Your Perfect Dog Today</h3>
              <button className="about-cta__btn" onClick={onTakeQuiz}>Take the Quiz</button>
            </motion.div>
          </motion.div>

          <style>{`
            .about-overlay {
              position: fixed; inset: 0;
              background: rgba(45, 30, 18, 0.55);
              backdrop-filter: blur(8px);
              z-index: 3000;
              display: flex; align-items: flex-start; justify-content: center;
              padding: clamp(16px, 4vw, 48px);
              overflow-y: auto;
            }
            .about-panel {
              position: relative;
              width: 100%; max-width: 960px;
              background: linear-gradient(180deg, #FFFDF9 0%, #F5EEE6 100%);
              border-radius: 26px;
              padding: clamp(28px, 5vw, 56px);
              box-shadow: 0 40px 100px rgba(45, 30, 18, 0.4);
              font-family: var(--font-body-family);
              margin: auto;
            }
            .about-close {
              position: absolute; top: 18px; right: 20px;
              z-index: 5;   /* the animated hero below is its own layer and would otherwise cover (and swallow taps on) this button */
              width: 40px; height: 40px; border-radius: 50%;
              border: none; background: rgba(0,0,0,0.05); color: var(--brown, #5a4636);
              font-size: 24px; cursor: pointer; line-height: 1;
              display: flex; align-items: center; justify-content: center;
              transition: background 0.2s;
            }
            .about-close:hover { background: rgba(0,0,0,0.1); }
            .about-hero { text-align: center; margin-bottom: clamp(28px, 5vw, 44px); }
            .about-hero__paw { font-size: 46px; margin-bottom: 8px; }
            .about-hero h2 {
              font-family: var(--font-display);
              font-size: clamp(30px, 6vw, 46px);
              font-weight: var(--weight-bold); color: var(--orange, #E66A1A);
              margin: 0 0 12px;
            }
            .about-hero p {
              max-width: 640px; margin: 0 auto;
              color: var(--text-soft, #6e5646); font-size: clamp(14px, 2.2vw, 16px);
              line-height: 1.65;
            }
            .about-grid { display: grid; gap: 18px; }
            .about-grid--core { grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); margin-bottom: clamp(28px, 5vw, 44px); }
            .about-grid--soon { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
            .about-card {
              background: rgba(255, 255, 255, 0.7);
              backdrop-filter: blur(6px);
              border: 1px solid rgba(230, 106, 26, 0.14);
              border-radius: 20px;
              padding: 24px;
              box-shadow: 0 8px 24px rgba(61, 41, 28, 0.06);
              cursor: default;
            }
            .about-card__icon {
              font-size: 30px; width: 54px; height: 54px; border-radius: 14px;
              background: rgba(230, 106, 26, 0.1);
              display: flex; align-items: center; justify-content: center;
              margin-bottom: 14px;
            }
            .about-card h3 { font-family: var(--font-display); font-weight: var(--weight-semibold); color: var(--brown, #5a4636); font-size: 19px; margin: 0 0 8px; }
            .about-card h4 { font-family: var(--font-display); font-weight: var(--weight-semibold); color: var(--brown, #5a4636); font-size: 16px; margin: 0 0 6px; }
            .about-card p { color: var(--text-soft, #6e5646); font-size: 13.5px; line-height: 1.55; margin: 0; }
            .about-card--soon { background: rgba(255,255,255,0.55); }
            .about-soon-title {
              text-align: center; font-family: var(--font-display); font-weight: var(--weight-semibold);
              color: var(--brown, #5a4636); font-size: 24px; margin: 8px 0 18px;
            }
            .about-cta {
              text-align: center; margin-top: clamp(30px, 5vw, 46px);
              padding-top: clamp(24px, 4vw, 36px);
              border-top: 1px solid rgba(230, 106, 26, 0.15);
            }
            .about-cta h3 { font-family: var(--font-display); font-weight: var(--weight-semibold); color: var(--brown, #5a4636); font-size: clamp(22px, 4vw, 30px); margin: 0 0 18px; }
            .about-cta__btn {
              position: relative; overflow: hidden;
              padding: 15px 40px; border: none; border-radius: 50px;
              background: linear-gradient(135deg, #E66A1A 0%, #C45511 100%);
              color: #fff; font-family: var(--font-display); font-weight: var(--weight-bold); font-size: 16px;
              cursor: pointer; box-shadow: 0 10px 28px rgba(208, 92, 25, 0.35);
              transition: transform 0.25s ease, box-shadow 0.25s ease;
            }
            .about-cta__btn:hover { transform: translateY(-2px) scale(1.03); box-shadow: 0 16px 38px rgba(208, 92, 25, 0.45); }
            .about-cta__btn:active { transform: translateY(0) scale(0.98); }
            @media (prefers-reduced-motion: reduce) {
              .about-hero__paw { animation: none; }
              .about-cta__btn { transition: none; }
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AboutModal;
