import React from 'react';
import { motion } from 'framer-motion';
import AnimatedPaw from './AnimatedPaw';
import HeroParticles from './HeroParticles';

const HeroSection = ({ onSelectFriendPath, onDogOwner }) => {
  return (
    <section className="hero-section">
      <HeroParticles />
      <div className="hero-socials">
        <div className="hero-social-btn">FB</div>
        <div className="hero-social-btn">IG</div>
      </div>

      {/*
        hero-composition is the single sizing root.
        Paw width drives all typography via container query units (cqw).
      */}
      <div className="hero-composition">
        <div className="paw-stage">
          <AnimatedPaw />

          {/* Text region locked to the paw pad (matches paw-base: 9% left, 85% wide) */}
          <div className="paw-overlay">
            <motion.div
              className="paw-overlay__inner"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.5 }}
            >
              <h1 className="hero-title">
                Find the dog that<br />
                Fits your life.
              </h1>
              <p className="hero-subtitle">
                A companion tailored to your lifestyle
              </p>
            </motion.div>
          </div>
        </div>

        <div className="hero-actions">
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            whileHover={{ scale: 1.03, boxShadow: '0 14px 32px rgba(208, 92, 25, 0.42)' }}
            whileTap={{ scale: 0.97 }}
            onClick={onSelectFriendPath}
            className="hero-btn hero-btn-primary"
            style={{
              transition: 'transform 300ms cubic-bezier(0.25, 0.8, 0.25, 1), box-shadow 300ms cubic-bezier(0.25, 0.8, 0.25, 1)'
            }}
          >
            Looking for a furry friend
            <span className="hero-btn__icon">→</span>
          </motion.button>

          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.9 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={onDogOwner}
            className="hero-btn hero-btn-secondary"
            style={{
              transition: 'transform 300ms cubic-bezier(0.25, 0.8, 0.25, 1), box-shadow 300ms cubic-bezier(0.25, 0.8, 0.25, 1)'
            }}
          >
            Already a dog owner?
          </motion.button>
        </div>
      </div>

      <style>{`
        .hero-section {
          position: relative;
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          background: #F1EBE4;
          padding: clamp(80px, 12vh, 100px) clamp(12px, 3vw, 24px) clamp(40px, 6vh, 60px);
        }

        .hero-socials {
          position: absolute;
          bottom: clamp(20px, 4vh, 40px);
          right: clamp(16px, 3vw, 40px);
          display: flex;
          gap: 10px;
        }

        .hero-social-btn {
          width: clamp(32px, 4vw, 40px);
          height: clamp(32px, 4vw, 40px);
          border-radius: 50%;
          background: #E5D5CA;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #D05C19;
          font-size: clamp(10px, 1.2vw, 12px);
          font-weight: 700;
          cursor: pointer;
        }

        /* ── Single responsive composition root ── */
        .hero-composition {
          container-type: inline-size;
          container-name: hero;
          width: min(540px, 90vw);
          margin: 0 auto;
          position: relative;
          z-index: 1; /* keep paw, text & buttons above the particle canvas */
        }

        .paw-stage {
          position: relative;
          width: 100%;
          aspect-ratio: 10 / 7;
        }

        .paw-stage .animated-paw-wrapper {
          position: absolute;
          inset: 0;
          width: 100%;
          max-width: none;
          height: 100%;
          margin: 0;
        }

        .paw-stage .paw-floating-container {
          width: 100%;
          height: 100%;
        }

        .paw-stage .paw-relative-box {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          padding-bottom: 0;
        }

        /*
          Overlay = paw pad zone (paw-base sits at left 9%, width 85%, bottom 0).
          top: 44% clears the toe pads; bottom: 1% anchors to pad base.
        */
        .paw-overlay {
          position: absolute;
          left: 9%;
          width: 85%;
          top: 44%;
          bottom: 1%;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: center;
          box-sizing: border-box;
          padding: 2% 6%;
          pointer-events: none;
        }

        .paw-overlay__inner {
          width: 100%;
          text-align: center;
        }

        /*
          Typography scales directly with paw width (cqw).
          Fallback uses min(vw, px-cap) so large viewports don't blow up text.
        */
        .hero-title {
          font-family: 'Fredoka', sans-serif;
          font-weight: 800;
          color: #D05C19;
          line-height: 1.08;
          margin: 0;
          text-shadow: 0 2px 10px rgba(255, 255, 255, 0.5);
          font-size: clamp(1rem, min(5.5vw, 42px), 2.8rem);
        }

        .hero-subtitle {
          font-family: 'Poppins', sans-serif;
          font-weight: 600;
          color: #6e5646;
          line-height: 1.3;
          margin: clamp(4px, 1.2cqw, 12px) 0 0;
          font-size: clamp(0.65rem, min(2vw, 16px), 1.1rem);
        }

        @supports (font-size: 1cqw) {
          .hero-title {
            font-size: clamp(1rem, 6.5cqw, 2.8rem);
          }
          .hero-subtitle {
            font-size: clamp(0.65rem, 2.5cqw, 1.1rem);
            margin-top: clamp(4px, 1.2cqw, 12px);
          }
        }

        /* ── Buttons below paw, scaled to same composition width ── */
        .hero-actions {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: center;
          gap: clamp(8px, 2.4cqw, 16px);
          margin-top: clamp(16px, 4.4cqw, 30px);
          width: 100%;
        }

        .hero-btn {
          padding: clamp(8px, 2cqw, 12px) clamp(16px, 4cqw, 24px);
          background: linear-gradient(135deg, #E66A1A 0%, #C45511 100%);
          color: white;
          border: none;
          border-radius: 50px;
          font-family: 'Poppins', sans-serif;
          font-size: clamp(0.7rem, min(2vw, 15px), 0.95rem);
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 8px 20px rgba(208, 92, 25, 0.3);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: clamp(6px, 1.8cqw, 12px);
        }

        @supports (font-size: 1cqw) {
          .hero-btn {
            font-size: clamp(0.7rem, 2.3cqw, 0.95rem);
          }
        }

        .hero-btn__icon {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 50%;
          width: clamp(18px, 3.5cqw, 24px);
          height: clamp(18px, 3.5cqw, 24px);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: clamp(11px, 2cqw, 14px);
          flex-shrink: 0;
        }

        .hero-btn-primary {
          padding: clamp(11px, 2.6cqw, 15px) clamp(24px, 6cqw, 38px);
          font-size: clamp(0.8rem, min(2.3vw, 17px), 1.05rem);
        }

        .hero-btn-secondary {
          background: white;
          color: #D05C19;
          border: 2px solid #D05C19;
          box-shadow: 0 8px 20px rgba(208, 92, 25, 0.12);
        }

        @supports (font-size: 1cqw) {
          .hero-btn-primary {
            font-size: clamp(0.8rem, 2.8cqw, 1.05rem);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .hero-btn {
            transition: none !important;
          }
        }

        @media (max-width: 768px) {
          .hero-section {
            padding-top: clamp(88px, 14vh, 100px);
            min-height: 90vh;
            min-height: 90dvh;
          }

          .hero-socials {
            display: none;
          }

          .hero-composition {
            width: min(680px, 96vw);
          }
        }
      `}</style>
    </section>
  );
};

export default HeroSection;
