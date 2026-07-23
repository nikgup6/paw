import React from 'react';
import { motion } from 'framer-motion';

const CommunitySection = () => {
  return (
    <section style={{ padding: '100px 20px', background: 'var(--cream)', position: 'relative', overflow: 'hidden' }}>
      {/* Decorative Blob */}
      <div style={{ position: 'absolute', top: '-10%', left: '-5%', width: '300px', height: '300px', background: 'var(--orange-pale)', borderRadius: '50%', filter: 'blur(50px)', opacity: 0.6 }} />
      <div style={{ position: 'absolute', bottom: '-10%', right: '-5%', width: '250px', height: '250px', background: 'var(--green)', borderRadius: '50%', filter: 'blur(80px)', opacity: 0.1 }} />

      <div style={{ maxWidth: '1000px', margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          style={{ background: 'var(--white)', padding: '60px 40px', borderRadius: '32px', boxShadow: 'var(--shadow-lg)', border: '1px solid rgba(109, 76, 65, 0.05)' }}
        >
          <h2 className="text-h2" style={{ fontFamily: "'Fredoka', sans-serif", color: 'var(--brown)', marginBottom: '20px' }}>
            Join thousands of puppy lovers creating happier homes.
          </h2>
          <p className="text-body-lg" style={{ color: 'var(--text-soft)', marginBottom: '40px', maxWidth: '600px', margin: '0 auto 40px' }}>
            Whether you're ready to adopt or just want to support our mission, there's a place for you in the Paw Buddy family.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '40px', flexWrap: 'wrap', marginBottom: '40px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: "'Fredoka', sans-serif", fontSize: '36px', color: 'var(--orange)', fontWeight: 700 }}>23</div>
              <div style={{ color: 'var(--text-soft)', fontSize: '14px', fontWeight: 500 }}>Breeds analysed</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: "'Fredoka', sans-serif", fontSize: '36px', color: 'var(--orange)', fontWeight: 700 }}>500+</div>
              <div style={{ color: 'var(--text-soft)', fontSize: '14px', fontWeight: 500 }}>Recommendations</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: "'Fredoka', sans-serif", fontSize: '36px', color: 'var(--orange)', fontWeight: 700 }}>100%</div>
              <div style={{ color: 'var(--text-soft)', fontSize: '14px', fontWeight: 500 }}>Indian Specific</div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CommunitySection;
