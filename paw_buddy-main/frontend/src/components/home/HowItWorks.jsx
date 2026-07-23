import React from 'react';
import { motion } from 'framer-motion';

const steps = [
  { step: 1, title: 'Tell us about your lifestyle.', desc: 'Take a quick 9-question quiz covering your living space, family, and free time.', icon: '📝' },
  { step: 2, title: 'We analyze compatibility.', desc: 'Our algorithm matches your answers against 23 Indian-suitable breeds. ', icon: '🔍' },
  { step: 3, title: 'Meet your perfect companion.', desc: 'Get a detailed profile of your top match, including care costs and living conditions.', icon: '❤️' },
  { step: 4, title: 'Connect with Verified Breeders.', desc: 'We connect you directly to our exclusive network of verified, ethical breeders. ', icon: '✅' }
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" style={{ padding: '100px 20px', background: 'var(--cream)' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          style={{ textAlign: 'center', marginBottom: '60px' }}
        >
          <h2 className="text-h2" style={{ fontFamily: "'Fredoka', sans-serif", color: 'var(--brown)', marginBottom: '16px' }}>
            Your Journey to Love
          </h2>
          <p className="text-body-lg" style={{ color: 'var(--text-soft)', maxWidth: '600px', margin: '0 auto' }}>
            Four simple steps to welcoming your new best friend into your family.
          </p>
        </motion.div>

        <div className="steps-grid" style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
          gap: '30px' 
        }}>
          {steps.map((s, i) => (
            <motion.div 
              key={i}
              className="hover-lift"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.2, duration: 0.6 }}
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
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
