import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* Premium "About PawBuddy" full-screen modal — fade + slide + scale in,
   blurred/darkened backdrop, staggered feature cards, glassmorphism.
   Brand palette: cream / orange / brown, Fredoka + Poppins. */

const CORE = [
  {
    icon: '🐶',
    title: 'Lifestyle-Based Breed Recommendations',
    body: 'Answer a short quiz and get personalised breed matches based on your home, climate, family, budget, activity level, and experience.',
  },
  {
    icon: '✅',
    title: 'Verified Breeders',
    body: 'Connect only with trusted, verified breeders. We prioritise ethical breeding and healthier puppies.',
  },
];

const SOON = [
  { icon: '📋', title: 'Digital Health Records', body: 'Store vaccinations, prescriptions, medical history, and health reports in one place.' },
  { icon: '🤖', title: 'AI Pet Assistant', body: 'Instant answers for nutrition, training, health guidance, and everyday dog care.' },
  { icon: '📅', title: 'Smart Vaccination & Care Reminders', body: 'Never miss vaccinations, grooming, deworming, or vet appointments.' },
  { icon: '🏥', title: 'Vet & Pet Services', body: 'Book trusted vets, trainers, groomers, boarding, and pet-care pros directly through PawBuddy.' },
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
              font-family: 'Poppins', sans-serif;
              margin: auto;
            }
            .about-close {
              position: absolute; top: 18px; right: 20px;
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
              font-family: 'Fredoka', sans-serif;
              font-size: clamp(30px, 6vw, 46px);
              font-weight: 800; color: var(--orange, #E66A1A);
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
            .about-card h3 { font-family: 'Fredoka', sans-serif; color: var(--brown, #5a4636); font-size: 19px; margin: 0 0 8px; }
            .about-card h4 { font-family: 'Fredoka', sans-serif; color: var(--brown, #5a4636); font-size: 16px; margin: 0 0 6px; }
            .about-card p { color: var(--text-soft, #6e5646); font-size: 13.5px; line-height: 1.55; margin: 0; }
            .about-card--soon { background: rgba(255,255,255,0.55); }
            .about-soon-title {
              text-align: center; font-family: 'Fredoka', sans-serif;
              color: var(--brown, #5a4636); font-size: 24px; margin: 8px 0 18px;
            }
            .about-cta {
              text-align: center; margin-top: clamp(30px, 5vw, 46px);
              padding-top: clamp(24px, 4vw, 36px);
              border-top: 1px solid rgba(230, 106, 26, 0.15);
            }
            .about-cta h3 { font-family: 'Fredoka', sans-serif; color: var(--brown, #5a4636); font-size: clamp(22px, 4vw, 30px); margin: 0 0 18px; }
            .about-cta__btn {
              position: relative; overflow: hidden;
              padding: 15px 40px; border: none; border-radius: 50px;
              background: linear-gradient(135deg, #E66A1A 0%, #C45511 100%);
              color: #fff; font-family: 'Poppins', sans-serif; font-weight: 700; font-size: 16px;
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
