import React, { useState, useContext, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useBreedList } from '../../context/BreedsContext';
import BreedProfileModal from '../BreedProfileModal';
import { AuthContext } from '../../context/AuthContext';

const TopBreedsShowcase = () => {
  const allBreeds = useBreedList();
  const [selectedBreed, setSelectedBreed] = useState(null);
  const { user } = useContext(AuthContext);
  const scrollRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    let interval;
    if (!isHovered && !selectedBreed) {
      interval = setInterval(() => {
        if (scrollRef.current) {
          const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
          if (scrollLeft + clientWidth >= scrollWidth - 10) {
            scrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
          } else {
            scrollRef.current.scrollBy({ left: 300, behavior: 'smooth' });
          }
        }
      }, 3000); // auto-scroll every 3 seconds
    }
    return () => clearInterval(interval);
  }, [isHovered, selectedBreed]);

  const scrollLeft = () => {
    if (scrollRef.current) scrollRef.current.scrollBy({ left: -300, behavior: 'smooth' });
  };

  const scrollRight = () => {
    if (scrollRef.current) scrollRef.current.scrollBy({ left: 300, behavior: 'smooth' });
  };

  return (
    <section style={{ padding: '100px 0', background: '#fff', overflow: 'hidden', position: 'relative' }} id="top-breeds">
      <div style={{ textAlign: 'center', marginBottom: '50px', padding: '0 20px' }}>
        <motion.h2 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-h2"
          style={{ color: 'var(--text-h)' }}
        >
          India's Most Loved Breeds
        </motion.h2>
        <p style={{ color: 'var(--text-soft)', marginTop: '10px' }}>Explore all available breeds in our database.</p>
      </div>

      {/* Navigation Buttons */}
      <button onClick={scrollLeft} style={{ position: 'absolute', left: '20px', top: '60%', transform: 'translateY(-50%)', zIndex: 100, background: 'var(--cream)', border: 'none', borderRadius: '50%', width: '50px', height: '50px', fontSize: '24px', color: 'var(--orange)', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>←</button>
      <button onClick={scrollRight} style={{ position: 'absolute', right: '20px', top: '60%', transform: 'translateY(-50%)', zIndex: 100, background: 'var(--cream)', border: 'none', borderRadius: '50%', width: '50px', height: '50px', fontSize: '24px', color: 'var(--orange)', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>→</button>

      {/* Auto / User Controlled Horizontal Scroll */}
      <div 
        ref={scrollRef}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ 
          display: 'flex', 
          overflowX: 'auto', 
          gap: '30px', 
          padding: '20px 80px', 
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none', /* Firefox */
          msOverflowStyle: 'none'  /* IE/Edge */
        }}
      >
        <style>
          {`
            div::-webkit-scrollbar { display: none; } /* Chrome/Safari */
          `}
        </style>
        {allBreeds.map((breed, idx) => (
          <motion.div
            key={idx}
            className="breed-card-3d glass-panel"
            whileHover={{ scale: 1.05, zIndex: 10 }}
            onClick={() => setSelectedBreed(breed)}
            style={{
              flex: '0 0 min(280px, 75vw)',
              height: 'min(380px, 100vw)',
              borderRadius: '24px',
              overflow: 'hidden',
              position: 'relative',
              cursor: 'pointer',
              scrollSnapAlign: 'start',
              boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
            }}
          >
            <motion.img 
              src={`/${breed.img}`} 
              alt={breed.name} 
              whileHover={{ scale: 1.1 }}
              transition={{ duration: 0.4 }}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => { e.target.src = 'https://via.placeholder.com/300x400?text=Dog'; }}
            />
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
              padding: '40px 20px 20px',
              color: 'white'
            }}>
              <h3 style={{ margin: 0, fontSize: '24px' }}>{breed.name}</h3>
            </div>
          </motion.div>
        ))}
      </div>

      {selectedBreed && (
        <BreedProfileModal breed={selectedBreed} user={user} onClose={() => setSelectedBreed(null)} />
      )}
    </section>
  );
};

export default TopBreedsShowcase;
