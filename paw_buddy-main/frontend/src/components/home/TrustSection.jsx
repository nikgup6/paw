import React from 'react';
import { motion } from 'framer-motion';

const TrustSection = () => {
  const trustPoints = [
    { icon: '⚡', title: 'Energy Mismatch', desc: 'Active dogs in small apartments lead to frustration.' },
    { icon: '☀️', title: 'Climate Conflict', desc: 'Cold-weather breeds suffer in Indian summers.' },
    { icon: '⏰', title: 'Time Constraints', desc: 'High-maintenance coats require daily grooming.' }
  ];

  return (
    <section style={{ padding: '80px 20px', background: 'var(--cream)' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '60px' }}>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-h2"
            style={{ fontFamily: "'Fredoka', sans-serif", color: 'var(--brown)', marginBottom: '16px' }}
          >
            Pitfalls in Choosing The Wrong Breed
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-body-lg"
            style={{ color: 'var(--text-soft)' }}
          >
            Find your perfect match and avoid the heartbreak of mismatched expectations. A happy pup means a happy home!
          </motion.p>
        </div>

        <div className="trust-grid" style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '30px' 
        }}>
          {trustPoints.map((point, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="hover-lift"
              style={{ 
                background: 'var(--white)', 
                padding: '40px 30px', 
                borderRadius: 'var(--radius)', 
                textAlign: 'center',
                boxShadow: 'var(--shadow)'
              }}
            >
              <div style={{ fontSize: '48px', marginBottom: '20px' }}>
                {point.icon}
              </div>
              <h3 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: '22px', color: 'var(--brown)', marginBottom: '12px' }}>
                {point.title}
              </h3>
              <p style={{ color: 'var(--text-soft)', fontSize: '15px', lineHeight: 1.6, margin: 0 }}>
                {point.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrustSection;
