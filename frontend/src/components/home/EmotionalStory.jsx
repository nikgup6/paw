import React from 'react';
import { motion } from 'framer-motion';

const EmotionalStory = () => {
  return (
    <section style={{ padding: '100px 20px', background: 'var(--cream)' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          style={{ textAlign: 'center', marginBottom: '50px' }}
        >
          <h2 className="text-h2" style={{ color: 'var(--brown)', margin: 0 }}>More than a pet.</h2>
          <h2 className="text-h2" style={{ color: 'var(--orange)', margin: 0 }}>A family member.</h2>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="glass-panel"
          style={{ display: 'flex', flexWrap: 'wrap', overflow: 'hidden', width: '100%', background: 'white' }}
        >
          <div style={{ flex: '1 1 400px', minHeight: '300px', position: 'relative' }}>
            <img 
              src="/aarav.jpeg" 
              alt="Dog and owner" 
              style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }}
            />
          </div>
          <div style={{ flex: '1 1 400px', padding: '50px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h3 style={{ fontSize: '28px', color: 'var(--brown)', marginBottom: '20px' }}>Max & Aarav</h3>
            <p style={{ fontSize: '18px', color: 'var(--text-soft)', lineHeight: 1.8, fontStyle: 'italic' }}>
              "My humans thought they were choosing a dog. What they didn't realize was that they were choosing a best friend for their kids, a fetch partner for the backyard, and a professional cuddle expert. Because they picked a breed that matched their lifestyle from Paw Buddy, I have plenty of space to play, children to adore, and a yard that's basically my kingdom. No stress, no surprises—just a very happy Golden Retriever living his best life. 🐶💛"
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default EmotionalStory;
