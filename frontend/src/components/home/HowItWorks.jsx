import React, { useRef, useEffect, useState } from 'react';

const steps = [
  { step: 1, title: 'Tell us about your lifestyle.', desc: 'Take a quick 9-question quiz covering your living space, family, and free time.', icon: '📝' },
  { step: 2, title: 'We analyze compatibility.', desc: 'Our algorithm matches your answers against 23 Indian-suitable breeds. ', icon: '🔍' },
  { step: 3, title: 'Meet your perfect companion.', desc: 'Get a detailed profile of your top match, including care costs and living conditions.', icon: '❤️' },
  { step: 4, title: 'Connect with Verified Breeders.', desc: 'We connect you directly to our exclusive network of verified, ethical breeders. ', icon: '✅' }
];

const HowItWorks = () => {
  const sectionRef = useRef(null);
  const [inView, setInView] = useState(false);

  /* One clean scroll transition: header fades/slides in, then the four cards
     stagger in after it. Fires once when the section is ~15% visible. Replaces
     the old framer whileInView + <Reveal> double-wrap (which read as a hard
     cut). Honours prefers-reduced-motion by showing the final state at once. */
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setInView(true); return; }
    const io = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) { setInView(true); io.disconnect(); } },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="how-it-works"
      className={`hiw ${inView ? 'is-in' : ''}`}
      style={{ padding: 'clamp(48px, 8vw, 64px) 20px 100px', background: 'var(--cream)' }}
    >
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <div className="hiw-head" style={{ textAlign: 'center', marginBottom: '60px' }}>
          <h2 className="text-h2" style={{ fontFamily: "'Fredoka', sans-serif", color: 'var(--brown)', marginBottom: '16px' }}>
            Your Journey to Love
          </h2>
          <p className="text-body-lg" style={{ color: 'var(--text-soft)', maxWidth: '600px', margin: '0 auto' }}>
            Four simple steps to welcoming your new best friend into your family.
          </p>
        </div>

        <div className="steps-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '30px'
        }}>
          {steps.map((s, i) => (
            <div
              key={i}
              className="hiw-card hover-lift"
              style={{
                background: 'white',
                padding: '40px 30px',
                borderRadius: 'var(--radius)',
                textAlign: 'center',
                position: 'relative',
                boxShadow: 'var(--shadow)',
                border: '1px solid rgba(109, 76, 65, 0.05)'
              }}
            >
              <div style={{
                width: '70px',
                height: '70px',
                background: 'var(--orange-pale)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '32px',
                margin: '0 auto 24px',
                color: 'var(--orange)'
              }}>
                {s.icon}
              </div>
              <h3 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: '22px', color: 'var(--brown)', marginBottom: '12px' }}>
                {s.title}
              </h3>
              <p style={{ color: 'var(--text-soft)', fontSize: '15px', lineHeight: 1.6, margin: 0 }}>
                {s.desc}
              </p>

              {/* Step Number Indicator */}
              <div style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                fontFamily: "'Fredoka', sans-serif",
                fontSize: '48px',
                fontWeight: 800,
                color: '#492727',
                opacity: 0.5,
                lineHeight: 1
              }}>
                0{s.step}
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes hiw-in {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        /* Start hidden; the header leads, the cards follow 120ms apart. */
        .hiw-head, .hiw-card { opacity: 0; transform: translateY(20px); }
        .hiw.is-in .hiw-head { animation: hiw-in 450ms ease-out forwards; }
        .hiw.is-in .hiw-card { animation: hiw-in 400ms ease-out forwards; }
        .hiw.is-in .hiw-card:nth-child(1) { animation-delay: 180ms; }
        .hiw.is-in .hiw-card:nth-child(2) { animation-delay: 300ms; }
        .hiw.is-in .hiw-card:nth-child(3) { animation-delay: 420ms; }
        .hiw.is-in .hiw-card:nth-child(4) { animation-delay: 540ms; }

        @media (prefers-reduced-motion: reduce) {
          .hiw-head, .hiw-card { opacity: 1; transform: none; animation: none; }
        }
      `}</style>
    </section>
  );
};

export default HowItWorks;
