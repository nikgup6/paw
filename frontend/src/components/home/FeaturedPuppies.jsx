import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import BreedCard from '../BreedCard';
import BreedModal from '../BreedModal';
import { useBreedList } from '../../context/BreedsContext';

const FeaturedPuppies = ({ user }) => {
  const breedsData = useBreedList();
  const navigate = useNavigate();
  const [selectedBreed, setSelectedBreed] = useState(null);
  const [modalType, setModalType] = useState(null);

  const puppies = breedsData.slice(0, 4);

  const handleFullProfile = (breed) => {
    setSelectedBreed(breed);
    setModalType('full_profile');
  };

  const handleBuy = (breed) => {
    setSelectedBreed(breed);
    setModalType('buy');
  };

  const closeAction = () => {
    setModalType(null);
    setSelectedBreed(null);
  };

  return (
    <section id="breeds-section" style={{ padding: '80px 20px', background: 'var(--white)' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px', flexWrap: 'wrap', gap: '20px' }}>
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-h2" style={{ fontFamily: "'Fredoka', sans-serif", color: 'var(--brown)', marginBottom: '10px' }}>
              Meet the Pups!
            </h2>
            <p style={{ color: 'var(--text-soft)', fontSize: '16px' }}>
              Discover your pawfect match from our extensive breeds.
            </p>
          </motion.div>
          
          <motion.button 
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/explore')}
            style={{ 
              background: 'var(--orange-pale)', 
              color: 'var(--orange)', 
              border: 'none', 
              padding: '12px 24px', 
              borderRadius: '50px', 
              fontFamily: "'Poppins', sans-serif",
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            Explore All Puppies
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
          </motion.button>
        </div>

        <div className="trust-grid" style={{ display: 'grid', gap: '30px' }}>
          {puppies.map((puppy, i) => (
            <motion.div 
              key={puppy.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
            >
              <BreedCard 
                breed={puppy} 
                hideActionButtons={true}
                onBuy={() => handleBuy(puppy)}
                onFullProfile={() => handleFullProfile(puppy)}
                onImageClick={() => { setSelectedBreed(puppy); setModalType('image_preview'); }}
              />
            </motion.div>
          ))}
        </div>
      </div>

      <BreedModal 
        breed={selectedBreed} 
        modalType={modalType} 
        onClose={closeAction} 
        setModalType={setModalType} 
        user={user} 
      />
    </section>
  );
};

export default FeaturedPuppies;
