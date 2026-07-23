import React, { useState, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import allBreeds from '../../constants/breeds.json';
import BreedProfileModal from '../BreedProfileModal';
import { AuthContext } from '../../context/AuthContext';

const lifestyles = [
  {
    id: 'apartment',
    label: 'Apartment Living',
    desc: 'Quiet, low-energy dogs perfect for smaller spaces.',
    breeds: [
      { name: 'Pug', img: '/assets/Pug.jpg', traits: 'Calm • Affectionate' },
      { name: 'Shih Tzu', img: '/assets/shihtzu.jpg', traits: 'Friendly • Low Energy' }
    ]
  },
  {
    id: 'family',
    label: 'Family & Kids',
    desc: 'Gentle, patient companions that love being part of a pack.',
    breeds: [
      { name: 'Golden Retriever', img: '/assets/golder_retriever.jpeg', traits: 'Gentle • Playful' },
      { name: 'Beagle', img: '/assets/beagle.jpg', traits: 'Curious • Merry' }
    ]
  },
  {
    id: 'active',
    label: 'Active Lifestyle',
    desc: 'High-energy partners ready for hiking and running.',
    breeds: [
      { name: 'German Shepherd', img: '/assets/german_shepherd.jpg', traits: 'Loyal • Courageous' },
      { name: 'Indian Pariah Dog', img: '/assets/indian_pariaha.jpg', traits: 'Hardy • Intelligent' }
    ]
  }
];

const LifestyleVisualizer = () => {
  const [activeTab, setActiveTab] = useState(lifestyles[0].id);
  const [selectedBreed, setSelectedBreed] = useState(null);
  const { user } = useContext(AuthContext);

  const activeData = lifestyles.find(l => l.id === activeTab);

  const handleBreedClick = (breedName) => {
    // Find full breed object from DB
    // Check various names for Indian Pariah since it might be named Indie
    const b = allBreeds.find(x => x.name.toLowerCase().includes(breedName.toLowerCase().replace(' dog', '')) || (breedName === 'Indian Pariah Dog' && x.name.toLowerCase() === 'indie'));
    if (b) {
      setSelectedBreed(b);
    } else {
      alert('Breed not found in current database.');
    }
  };

  return (
    <section style={{ padding: '100px 20px', background: 'var(--cream)', position: 'relative' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '60px' }}>
          <motion.h2 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-h2"
            style={{ color: 'var(--text-h)', marginBottom: '20px' }}
          >
            Every lifestyle deserves a <span style={{ color: 'var(--orange)' }}>different dog.</span>
          </motion.h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', flexWrap: 'wrap' }}>
            {lifestyles.map((l) => (
              <button
                key={l.id}
                onClick={() => setActiveTab(l.id)}
                style={{
                  padding: '12px 24px',
                  borderRadius: '50px',
                  border: 'none',
                  fontSize: '16px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: activeTab === l.id ? 'var(--orange)' : 'white',
                  color: activeTab === l.id ? 'white' : 'var(--text-soft)',
                  boxShadow: activeTab === l.id ? '0 10px 20px rgba(255,107,43,0.3)' : '0 4px 6px rgba(0,0,0,0.05)',
                  transition: 'all 0.3s ease'
                }}
              >
                {l.label}
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div style={{ minHeight: '350px', position: 'relative' }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.98 }}
                transition={{ duration: 0.4 }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
              >
                <p style={{ fontSize: '18px', color: 'var(--text-soft)', marginBottom: '40px', textAlign: 'center' }}>
                  {activeData.desc}
                </p>

                <div style={{ display: 'flex', gap: '30px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  {activeData.breeds.map((breed, idx) => (
                    <motion.div 
                      key={idx}
                      whileHover={{ y: -10, scale: 1.02 }}
                      onClick={() => handleBreedClick(breed.name)}
                      className="glass-panel"
                      style={{ width: '280px', overflow: 'hidden', padding: '15px', background: 'white', cursor: 'pointer' }}
                    >
                      <div style={{ height: '200px', borderRadius: '15px', overflow: 'hidden', marginBottom: '15px' }}>
                        <motion.img 
                          whileHover={{ scale: 1.1 }}
                          transition={{ duration: 0.4 }}
                          src={breed.img} 
                          alt={breed.name} 
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        />
                      </div>
                      <h4 style={{ fontSize: '20px', margin: '0 0 5px 0', color: 'var(--brown)' }}>{breed.name}</h4>
                      <p style={{ margin: 0, color: 'var(--text-soft)', fontSize: '14px' }}>{breed.traits}</p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {selectedBreed && (
        <BreedProfileModal breed={selectedBreed} user={user} onClose={() => setSelectedBreed(null)} />
      )}
    </section>
  );
};

export default LifestyleVisualizer;
