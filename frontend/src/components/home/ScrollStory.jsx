import React from 'react';
import { motion } from 'framer-motion';

const ScrollStory = () => {
  const textVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
  };

  const cards = [
    { title: "Energy Mismatch", desc: "Active dogs in small apartments lead to frustration.", icon: "⚡" },
    { title: "Climate Conflict", desc: "Cold-weather breeds suffer in Indian summers.", icon: "☀️" },
    { title: "Time Constraints", desc: "High-maintenance coats require daily grooming.", icon: "⏰" }
  ];

  return (
    <section style={{ padding: '100px 20px', background: '#fff', position: 'relative' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', textAlign: 'center' }}>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          <motion.h2 variants={textVariants} className="text-h2" style={{ color: 'var(--text-h)', marginBottom: '20px' }}>
            Pitfalls when you choose a <span style={{ color: 'var(--red)' }}>wrong breed</span>
          </motion.h2>
          <motion.p variants={textVariants} style={{ fontSize: '20px', color: 'var(--text-soft)', maxWidth: '600px', margin: '0 auto 60px' }}>
            Every year, thousands of dogs are rehomed simply because their needs didn't align with their owner's lifestyle.
          </motion.p>
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '30px' }}>
          {cards.map((card, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, delay: i * 0.2 }}
              className="glass-panel hover-lift"
              style={{ padding: '40px 30px', background: 'var(--cream)' }}
            >
              <div style={{ fontSize: '48px', marginBottom: '20px' }}>{card.icon}</div>
              <h3 style={{ fontSize: '22px', color: 'var(--brown)', marginBottom: '15px' }}>{card.title}</h3>
              <p style={{ color: 'var(--text-soft)', lineHeight: 1.6 }}>{card.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ScrollStory;
