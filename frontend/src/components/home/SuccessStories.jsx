import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const stories = [
  {
    id: 1,
    family: "The Sharma Family",
    quote: "Adopting Max completely changed our home. He brings so much joy and energy every single day.",
    image: "/aarav.jpeg"
  },
  {
    id: 2,
    family: "Priya & Rahul",
    quote: "We were looking for a companion for our apartment, and Bella fits perfectly. The process was so transparent and helpful.",
    image: "/sample_1.png"
  },
  {
    id: 3,
    family: "Anita Desai",
    quote: "I never knew how much I needed a friend until Leo came along. Paw Buddy made finding him so effortless.",
    image: "/sample_2.png"
  }
];

const SuccessStories = () => {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const next = () => setCurrent((c) => (c + 1) % stories.length);
  const prev = () => setCurrent((c) => (c - 1 + stories.length) % stories.length);

  // Auto-rotate every 3s, pause if hovered/swiping
  // Including 'current' in deps resets the timer on manual navigation
  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
      setCurrent((c) => (c + 1) % stories.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [isPaused, current]);

  return (
    <section style={{ padding: '100px 20px', background: 'var(--orange-pale)', overflow: 'hidden' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', textAlign: 'center' }}>
        <motion.h2 
          className="text-h2"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          style={{ fontFamily: "'Fredoka', sans-serif", color: 'var(--brown)', marginBottom: '60px' }}
        >
          Happy Tails
        </motion.h2>

        <div 
          style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onTouchStart={() => setIsPaused(true)}
          onTouchEnd={() => setIsPaused(false)}
        >
          
          <button 
            onClick={prev}
            style={{ position: 'absolute', left: 0, zIndex: 10, background: 'white', border: 'none', width: '50px', height: '50px', borderRadius: '50%', boxShadow: 'var(--shadow)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brown)' }}
          >
            ←
          </button>

          <div style={{ width: '100%', maxWidth: '800px', margin: '0 auto' }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={current}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
                style={{ background: 'white', borderRadius: '32px', padding: 'clamp(20px, 3vw, 40px)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '30px', boxShadow: '0 20px 40px rgba(109, 76, 65, 0.08)' }}
              >
                <div style={{ width: '120px', height: '120px', borderRadius: '50%', overflow: 'hidden', border: '4px solid var(--orange-pale)' }}>
                  <img src={stories[current].image} alt="Happy family" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                
                <div style={{ maxWidth: '600px' }}>
                  <p className="text-body-lg" style={{ fontFamily: "'Fredoka', sans-serif", color: 'var(--brown)', lineHeight: 1.5, marginBottom: '20px', fontStyle: 'italic' }}>
                    "{stories[current].quote}"
                  </p>
                  <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', color: 'var(--orange)', fontWeight: 600, margin: 0, letterSpacing: '1px', textTransform: 'uppercase' }}>
                    - {stories[current].family}
                  </h4>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <button 
            onClick={next}
            style={{ position: 'absolute', right: 0, zIndex: 10, background: 'white', border: 'none', width: '50px', height: '50px', borderRadius: '50%', boxShadow: 'var(--shadow)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brown)' }}
          >
            →
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '40px' }}>
          {stories.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              style={{
                width: i === current ? '30px' : '10px',
                height: '10px',
                borderRadius: '5px',
                background: i === current ? 'var(--orange)' : 'rgba(109, 76, 65, 0.2)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      </div>
      
      {/* Mobile adjustment for carousel arrows */}
      <style>{`
        @media (max-width: 768px) {
          button[aria-label^="Go to slide"] {
             /* Keep dots */
          }
          /* We can hide the absolute arrows on mobile and let them use dots */
          div[style*="position: relative"] > button {
            display: none !important;
          }
        }
      `}</style>
    </section>
  );
};

export default SuccessStories;
