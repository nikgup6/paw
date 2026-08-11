import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { generatePersonalizedReason } from '../utils/breedUtils';

/* Editorial one-liner for Explore mode (no quiz answers to personalise on) */
const describeBreed = (b) => {
  const sizeWord = { S: 'small', M: 'medium-sized', L: 'large', X: 'giant' }[(b.size || 'M').trim()[0]] || '';
  const role = (b.purpose || 'Companion').split('/')[0].trim().toLowerCase();
  const energy = (b.energy || 'Medium').split('–')[0].trim().toLowerCase();
  return `A ${sizeWord} ${role} with ${energy} energy — happiest with ${(b.time || 'about an hour').toLowerCase()} of engagement every day.`;
};

const BreedSlider = ({ breeds, answers, isResults, onClose, onBuy, onFullProfile, onCompare }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0); // -1 for prev, 1 for next
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [animateTrigger, setAnimateTrigger] = useState(true);
  const reducedMotion = useReducedMotion();

  const activeBreed = breeds[currentIndex];

  useEffect(() => {
    // Re-trigger staggered animations whenever current breed changes
    setAnimateTrigger(false);
    const timeout = setTimeout(() => setAnimateTrigger(true), 50);
    return () => clearTimeout(timeout);
  }, [currentIndex]);

  // New breed list (explore ↔ results) always starts from the first slide
  useEffect(() => {
    setCurrentIndex(0);
    setDirection(0);
  }, [breeds]);

  // Search autocomplete filter
  useEffect(() => {
    if (!searchQuery) {
      setSuggestions([]);
      return;
    }
    const filtered = breeds
      .filter(b => b.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .slice(0, 5);
    setSuggestions(filtered);
  }, [searchQuery, breeds]);

  const handleNext = () => {
    setDirection(1);
    setCurrentIndex((prevIndex) => (prevIndex + 1) % breeds.length);
  };

  const handlePrev = () => {
    setDirection(-1);
    setCurrentIndex((prevIndex) => (prevIndex - 1 + breeds.length) % breeds.length);
  };

  const handleSearchSelect = (breedName) => {
    const index = breeds.findIndex(b => b.name.toLowerCase() === breedName.toLowerCase());
    if (index !== -1) {
      setDirection(index > currentIndex ? 1 : -1);
      setCurrentIndex(index);
      setSearchQuery('');
      setShowSuggestions(false);
    }
  };

  if (!activeBreed) return null;

  // Stagger variants — spec: left −30px→0, right 30px→0, center 20px rise.
  // Exit mirrors the entrance so old data slides out in sync with the new
  // data sliding in (exits run faster than entrances).
  const ease = [0.16, 1, 0.3, 1];
  const leftSideVariants = {
    hidden: { opacity: 0, x: reducedMotion ? 0 : -30 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease } },
    exit: { opacity: 0, x: reducedMotion ? 0 : -30, transition: { duration: 0.35, ease: 'easeIn' } }
  };

  const rightSideVariants = {
    hidden: { opacity: 0, x: reducedMotion ? 0 : 30 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease } },
    exit: { opacity: 0, x: reducedMotion ? 0 : 30, transition: { duration: 0.35, ease: 'easeIn' } }
  };

  const centerVariants = {
    hidden: { opacity: 0, y: reducedMotion ? 0 : 20, scale: reducedMotion ? 1 : 0.97 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.7, ease, delay: 0.1 } },
    exit: { opacity: 0, y: reducedMotion ? 0 : 12, transition: { duration: 0.35, ease: 'easeIn' } }
  };

  const bgHeaderVariants = {
    hidden: { opacity: 0, scale: reducedMotion ? 1 : 0.9 },
    visible: { opacity: 0.06, scale: 1, transition: { duration: 1, ease: 'easeOut' } },
    exit: { opacity: 0, transition: { duration: 0.3, ease: 'easeIn' } }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '4px 0' }}>

      {/* Side navigation arrows — click to glide to the prev/next breed profile */}
      <button
        onClick={handlePrev}
        aria-label="Previous breed"
        className="slider-side-arrow slider-side-arrow--left"
      >
        ‹
      </button>
      <button
        onClick={handleNext}
        aria-label="Next breed"
        className="slider-side-arrow slider-side-arrow--right"
      >
        ›
      </button>

      {/* Search Header Options */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', zIndex: 10, padding: '0 10px' }}>
        <button 
          onClick={onClose}
          style={{
            background: 'white', color: 'var(--brown)', border: '1px solid #EAE4DE',
            padding: '8px 20px', borderRadius: '50px', cursor: 'pointer',
            fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: '13px',
            boxShadow: 'var(--shadow)', display: 'flex', alignItems: 'center', gap: '8px'
          }}
        >
          ← Back
        </button>

        {/* Autocomplete Instant Search Bar */}
        <div style={{ position: 'relative', width: '100%', maxWidth: '350px' }}>
          <div 
            style={{ 
              display: 'flex', alignItems: 'center', background: 'white', 
              borderRadius: '50px', padding: '4px 15px', border: '1px solid #EAE4DE',
              boxShadow: '0 4px 15px rgba(0,0,0,0.05)'
            }}
          >
            <span style={{ marginRight: '8px' }}>🔍</span>
            <input 
              type="text"
              placeholder="Search breeds instantly..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              style={{
                border: 'none', outline: 'none', padding: '8px 0', width: '100%',
                fontSize: '14px', fontFamily: "'Poppins', sans-serif", color: 'var(--brown)'
              }}
            />
          </div>

          <AnimatePresence>
            {showSuggestions && suggestions.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                style={{
                  position: 'absolute', top: '100%', left: 0, right: 0,
                  background: 'white', border: '1px solid #EAE4DE', borderRadius: '12px',
                  boxShadow: '0 8px 25px rgba(0,0,0,0.1)', zIndex: 110, overflow: 'hidden'
                }}
              >
                {suggestions.map(s => (
                  <div 
                    key={s.id}
                    onClick={() => handleSearchSelect(s.name)}
                    style={{ 
                      padding: '10px 15px', cursor: 'pointer', transition: 'background 0.2s',
                      display: 'flex', alignItems: 'center', gap: '10px'
                    }}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseOver={e => e.currentTarget.style.background = 'var(--cream)'}
                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <img src={`/${s.img}`} alt={s.name} style={{ width: '25px', height: '25px', borderRadius: '50%', objectFit: 'cover' }} />
                    <span style={{ fontWeight: 600, color: 'var(--brown)', fontSize: '13px', fontFamily: "'Poppins', sans-serif" }}>
                      {s.name}
                    </span>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Main Magazine Layout Stage */}
      <div 
        style={{ 
          position: 'relative', flex: 1, display: 'grid', 
          gridTemplateColumns: 'minmax(200px, 1fr) auto minmax(200px, 1fr)', 
          alignItems: 'center', gap: 'clamp(20px, 4vw, 40px)',
          overflow: 'hidden', padding: '0 10px'
        }}
      >
        {/* Giant background text header */}
        <AnimatePresence mode="wait">
          {animateTrigger && (
            <motion.div
              key={`bg-title-${activeBreed.id}`}
              variants={bgHeaderVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              style={{
                position: 'absolute', top: '2%', left: '50%', transform: 'translateX(-50%)',
                fontSize: 'clamp(3rem, 10vw, 8.5rem)', fontWeight: 900,
                color: 'var(--orange)', pointerEvents: 'none', zIndex: 1,
                fontFamily: "'Fredoka', sans-serif", width: '100%', textAlign: 'center',
                letterSpacing: '0.05em', whiteSpace: 'nowrap'
              }}
            >
              {activeBreed.name.toUpperCase()}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Left-Side details */}
        <div style={{ zIndex: 2 }}>
          <AnimatePresence mode="wait">
            {animateTrigger && (
              <motion.div 
                key={`left-${activeBreed.id}`} 
                variants={leftSideVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
              >
                <div style={{ background: 'white', padding: '13px 16px', borderRadius: '16px', boxShadow: 'var(--shadow)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--orange)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '5px' }}>Breed Group</div>
                  <strong style={{ color: 'var(--brown)', fontSize: '15px', fontFamily: "'Poppins', sans-serif" }}>
                    {activeBreed.purpose || 'Companion'}
                  </strong>
                </div>

                <div style={{ background: 'white', padding: '13px 16px', borderRadius: '16px', boxShadow: 'var(--shadow)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--orange)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '5px' }}>Energy Needs</div>
                  <strong style={{ color: 'var(--brown)', fontSize: '15px', fontFamily: "'Poppins', sans-serif" }}>
                    {activeBreed.energy.split('–')[0] || 'Moderate'}
                  </strong>
                </div>

                <div style={{ background: 'white', padding: '13px 16px', borderRadius: '16px', boxShadow: 'var(--shadow)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--orange)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '5px' }}>Climate Compatibility</div>
                  <strong style={{ color: 'var(--brown)', fontSize: '15px', fontFamily: "'Poppins', sans-serif" }}>
                    {activeBreed.climate.split('\n')[0] || 'Medium Climate'}
                  </strong>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Center Arched frame holding active dog's photo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2 }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={`frame-${activeBreed.id}`}
              initial={{ scale: reducedMotion ? 1 : 0.9, opacity: 0, x: reducedMotion ? 0 : direction * 50 }}
              animate={{
                scale: 1,
                opacity: 1,
                x: 0,
                transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] }
              }}
              exit={{ scale: reducedMotion ? 1 : 0.94, opacity: 0, x: reducedMotion ? 0 : direction * -50, transition: { duration: 0.35, ease: 'easeIn' } }}
              style={{
                height: 'clamp(190px, 30vh, 300px)', // cap by viewport height so the action row stays on-screen
                aspectRatio: '0.75',
                overflow: 'hidden',
                borderRadius: '160px 160px 24px 24px', // Premium arched frame morph
                border: '7px solid white',
                boxShadow: 'var(--shadow-lg)',
                background: '#FCFAF7',
                marginBottom: '10px'
              }}
            >
              <img 
                src={`/${activeBreed.img}`} 
                alt={activeBreed.name}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Right-Side details */}
        <div style={{ zIndex: 2 }}>
          <AnimatePresence mode="wait">
            {animateTrigger && (
              <motion.div 
                key={`right-${activeBreed.id}`}
                variants={rightSideVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
              >
                <div style={{ background: 'white', padding: '13px 16px', borderRadius: '16px', boxShadow: 'var(--shadow)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--orange)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '5px' }}>Adult Weight</div>
                  <strong style={{ color: 'var(--brown)', fontSize: '15px', fontFamily: "'Poppins', sans-serif" }}>
                    {activeBreed.size.split('(')[1]?.split(',')[0] || '10-25 kg'}
                  </strong>
                </div>

                <div style={{ background: 'white', padding: '13px 16px', borderRadius: '16px', boxShadow: 'var(--shadow)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--orange)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '5px' }}>Grooming Level</div>
                  <strong style={{ color: 'var(--brown)', fontSize: '15px', fontFamily: "'Poppins', sans-serif" }}>
                    {activeBreed.grooming.split('–')[0] || 'Low'}
                  </strong>
                </div>

                <div style={{ background: 'white', padding: '13px 16px', borderRadius: '16px', boxShadow: 'var(--shadow)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--orange)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '5px' }}>Owner Experience</div>
                  <strong style={{ color: 'var(--brown)', fontSize: '15px', fontFamily: "'Poppins', sans-serif" }}>
                    {activeBreed.experienceLevel || 'First-timer OK'}
                  </strong>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom section showing description and action CTA */}
      <div 
        style={{ 
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          maxWidth: '650px', margin: '6px auto 0', textCenter: 'center',
          zIndex: 2, padding: '0 20px'
        }}
      >
        <AnimatePresence mode="wait">
          {animateTrigger && (
            <motion.div
              key={`bottom-${activeBreed.id}`}
              variants={centerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              style={{ textAlign: 'center' }}
            >
              {isResults && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'var(--orange)', color: 'white', padding: '6px 16px', borderRadius: '50px', fontSize: '12px', fontWeight: 700, fontFamily: "'Poppins', sans-serif", marginBottom: '10px', boxShadow: '0 4px 12px rgba(208, 92, 25, 0.3)' }}>
                  #{currentIndex + 1} Recommended
                  {typeof activeBreed.matchPercentage === 'number' && <span style={{ opacity: 0.9 }}>· {activeBreed.matchPercentage}% Match</span>}
                </div>
              )}

              <h2 style={{ fontFamily: "'Fredoka', sans-serif", color: 'var(--brown)', fontSize: '24px', marginBottom: '6px' }}>
                {activeBreed.name}
              </h2>
              <p style={{ color: 'var(--text-soft)', fontSize: '13.5px', lineHeight: 1.5, marginBottom: isResults && activeBreed.warnings?.length ? '8px' : '14px', fontFamily: "'Poppins', sans-serif" }}>
                {isResults ? generatePersonalizedReason(activeBreed, answers) : describeBreed(activeBreed)}
              </p>

              {isResults && activeBreed.warnings?.length > 0 && (
                <p style={{ color: '#9a6b1f', background: '#fdf3e0', border: '1px solid #f3ddb2', borderRadius: '12px', padding: '7px 14px', fontSize: '12.5px', lineHeight: 1.5, marginBottom: '12px', fontFamily: "'Poppins', sans-serif", display: 'inline-block' }}>
                  ⚠ {activeBreed.warnings[0]}
                </p>
              )}

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={() => onFullProfile && onFullProfile(activeBreed)}
                  style={{
                    padding: '11px 22px', fontSize: '14px', borderRadius: '50px',
                    background: 'white', color: 'var(--brown)', border: '2px solid #EAE4DE',
                    cursor: 'pointer', fontFamily: "'Poppins', sans-serif", fontWeight: 'bold',
                    boxShadow: 'var(--shadow)'
                  }}
                >
                  Full Profile
                </button>
                <button
                  onClick={() => onCompare && onCompare(activeBreed)}
                  style={{
                    padding: '11px 22px', fontSize: '14px', borderRadius: '50px',
                    background: 'white', color: 'var(--orange)', border: '2px solid var(--orange)',
                    cursor: 'pointer', fontFamily: "'Poppins', sans-serif", fontWeight: 'bold',
                    boxShadow: '0 4px 14px rgba(208, 92, 25, 0.12)'
                  }}
                >
                  ⚖ Compare
                </button>
                <button
                  onClick={() => onBuy(activeBreed)}
                  className="hero-btn"
                  style={{
                    padding: '11px 30px', fontSize: '14px', boxShadow: '0 6px 20px rgba(208, 92, 25, 0.25)',
                    fontFamily: "'Poppins', sans-serif", fontWeight: 'bold'
                  }}
                >
                  Buy 🐾
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Position indicator (navigation is via the side arrows) */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10, marginTop: '8px' }}>
        <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: '13px', fontWeight: 600, color: 'var(--text-soft)', letterSpacing: '0.06em' }} aria-live="polite">
          {currentIndex + 1} / {breeds.length}
        </span>
      </div>

      {/* Screen Query Media CSS overrides */}
      <style>{`
        .slider-side-arrow {
          position: absolute;
          top: 44%;
          transform: translateY(-50%);
          z-index: 30;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          border: 1px solid #EAE4DE;
          background: rgba(255, 255, 255, 0.92);
          color: var(--orange);
          font-size: 30px;
          line-height: 1;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 24px rgba(61, 41, 28, 0.16);
          backdrop-filter: blur(4px);
          transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
          padding-bottom: 4px;
        }
        .slider-side-arrow:hover {
          transform: translateY(-50%) scale(1.08);
          background: var(--orange);
          color: white;
          box-shadow: 0 12px 30px rgba(208, 92, 25, 0.32);
        }
        .slider-side-arrow--left { left: -6px; }
        .slider-side-arrow--right { right: -6px; }
        @media (prefers-reduced-motion: reduce) {
          .slider-side-arrow, .slider-side-arrow:hover { transition: none; transform: translateY(-50%); }
        }
        @media (max-width: 768px) {
          .slider-side-arrow { width: 44px; height: 44px; font-size: 24px; top: 40%; }
          .slider-side-arrow--left { left: 2px; }
          .slider-side-arrow--right { right: 2px; }
        }

        @media (max-width: 768px) {
          div[style*="grid-template-columns"] {
            grid-template-columns: 1fr !important;
            grid-gap: 20px !important;
            justify-items: center;
          }
          div[style*="flex-direction: column; gap: 12px"] {
            flex-direction: row !important;
            flex-wrap: wrap;
            justify-content: center;
            gap: 10px !important;
          }
          div[style*="background: white; padding: 13px 16px"] {
            padding: 10px 13px !important;
            flex: 1 1 120px;
            text-align: center;
          }
        }
      `}</style>
    </div>
  );
};

export default BreedSlider;
