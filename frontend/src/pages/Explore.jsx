import React, { useState, useContext, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthContext } from '../context/AuthContext';
import BreedCard from '../components/BreedCard';
import BreedModal from '../components/BreedModal';
import { useBreedList } from '../context/BreedsContext';

const Explore = () => {
  const breedsData = useBreedList();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const [searchTerm, setSearchTerm] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [selectedBreed, setSelectedBreed] = useState(null);
  const [modalType, setModalType] = useState(null);

  const filteredBreeds = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return breedsData;
    /* Name + tags (original) PLUS a derived trait "haystack" so the searches
       the placeholder actually advertises — "apartment", "playful", "low
       shedding", "family", "guard", "small/large", "beginner" — return matches
       instead of "No breeds found". Everything is derived from existing breed
       fields; no new data. */
    return breedsData.filter((b) => {
      const energy = (b.energy || '').toLowerCase();
      const size = (b.size || '');
      const parts = [
        b.name, ...(b.tags || []),
        b.purpose, b.energy, b.grooming, b.shedding, b.climate, b.experienceLevel, b.idealCities,
        (b.apt === 'Yes' || /1BHK|2BHK/i.test(b.minApartmentSize || '')) && 'apartment flat apartment-friendly',
        /house only|3BHK/i.test(b.minApartmentSize || '') && 'house yard needs-space',
        (energy.startsWith('high') || energy.startsWith('very high')) && 'playful energetic active high-energy',
        energy.startsWith('low') && 'calm relaxed easygoing low-energy laid-back',
        ['Low', 'Very Low'].includes(b.shedding) && 'low shedding low-shedding hypoallergenic',
        (b.risk || '').startsWith('Low') && 'gentle friendly family kids child-friendly',
        /guard/i.test(b.purpose || '') && 'guard guardian protective watchdog',
        b.experienceLevel === 'First-timer OK' && 'beginner first-timer first-time easy',
        /^S\b|small/i.test(size) && 'small small-breed',
        /^M\b|medium/i.test(size) && 'medium medium-breed',
        /^(L|XL|Giant)\b|large|giant/i.test(size) && 'large big large-breed',
      ];
      return parts.filter(Boolean).join(' ').toLowerCase().includes(q);
    });
  }, [searchTerm, breedsData]);

  const suggestions = useMemo(() => {
    if (!searchTerm) return [];
    return breedsData
      .filter(b => b.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .slice(0, 5);
  }, [searchTerm]);

  const handleFullProfile = (breed) => {
    setSelectedBreed(breed);
    setModalType('full_profile');
  };

  const handleBuy = (breed) => {
    setSelectedBreed(breed);
    setModalType('buy');
  };

  const handleCompare = (breed) => {
    setSelectedBreed(breed);
    setModalType('compare');
  };

  const closeAction = () => {
    setModalType(null);
    setSelectedBreed(null);
  };

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--cream)' }}>
      {/* Header */}
      <div className="container" style={{ padding: '30px 20px', display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', background: 'var(--cream)', position: 'sticky', top: 0, zIndex: 100, maxWidth: 'none' }}>
        <img src="/logo.png" alt="Paw Buddy" style={{ width: '140px', mixBlendMode: 'multiply', cursor: 'pointer' }} onClick={() => navigate('/')} />
        <button 
          onClick={() => navigate('/')}
          style={{
            background: 'var(--white)', color: 'var(--brown)', border: '1px solid var(--brown)',
            padding: '10px 20px', borderRadius: 'var(--radius-pill)', cursor: 'pointer',
            fontFamily: 'var(--font-body-family)', fontWeight: 'var(--weight-semibold)',
            transition: 'all 0.3s ease'
          }}
          onMouseOver={e => { e.currentTarget.style.background = 'var(--brown)'; e.currentTarget.style.color = 'var(--white)'; }}
          onMouseOut={e => { e.currentTarget.style.background = 'var(--white)'; e.currentTarget.style.color = 'var(--brown)'; }}
        >
          Home
        </button>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1 className="text-h1" style={{ fontFamily: 'var(--font-display)', color: 'var(--brown)', marginBottom: '15px' }}>
            Explore All Breeds
          </h1>
          <p style={{ color: 'var(--text-soft)', fontSize: '18px', maxWidth: '600px', margin: '0 auto' }}>
            Search through our extensive database to find the perfect companion that matches your lifestyle.
          </p>
        </div>

        {/* Search Bar */}
        <div style={{ maxWidth: '600px', margin: '0 auto 50px', position: 'relative' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', background: 'white', borderRadius: 'var(--radius-pill)', padding: '5px 20px', boxShadow: '0 8px 25px rgba(208, 92, 25, 0.15)' }}>
            <span style={{ fontSize: '20px', color: 'var(--orange)', marginRight: '10px' }}>🔍</span>
            <input 
              type="text" 
              placeholder="Search by breed name or trait (e.g. playful, apartment)..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setTimeout(() => setIsFocused(false), 200)}
              style={{ flex: 1, border: 'none', outline: 'none', padding: '15px 0', fontSize: '16px', fontFamily: 'var(--font-body-family)', color: 'var(--brown)', background: 'transparent' }}
            />
          </div>

          {/* Autocomplete Suggestions */}
          <AnimatePresence>
            {isFocused && searchTerm && suggestions.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                style={{ position: 'absolute', top: '110%', left: 0, right: 0, background: 'white', borderRadius: 'var(--radius)', padding: '10px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', zIndex: 50 }}
              >
                {suggestions.map(s => (
                  <div 
                    key={s.id}
                    onClick={() => { setSearchTerm(s.name); setIsFocused(false); }}
                    style={{ padding: '12px 20px', cursor: 'pointer', borderRadius: 'var(--radius-sm)', transition: 'background 0.2s', display: 'flex', alignItems: 'center', gap: '15px' }}
                    onMouseOver={e => e.currentTarget.style.background = 'var(--cream)'}
                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <img src={`/${s.img}`} alt={s.name} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                    <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--brown)', fontFamily: 'var(--font-body-family)' }}>{s.name}</span>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Breeds Grid */}
        <div className="trust-grid" style={{ display: 'grid', gap: '30px' }}>
          {filteredBreeds.length > 0 ? (
            filteredBreeds.map((breed, i) => (
              <motion.div 
                key={breed.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: (i % 10) * 0.05 }}
              >
                <BreedCard
                  breed={breed}
                  hideActionButtons={false}
                  hideFullProfileButton={false}
                  onBuy={() => handleBuy(breed)}
                  onCompare={() => handleCompare(breed)}
                  onFullProfile={() => handleFullProfile(breed)}
                  onImageClick={() => { setSelectedBreed(breed); setModalType('image_preview'); }}
                />
              </motion.div>
            ))
          ) : (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 20px', color: 'var(--text-soft)' }}>
              <div style={{ fontSize: '60px', marginBottom: '20px' }}>🐕</div>
              <h3>No breeds found matching "{searchTerm}"</h3>
              <p>Try searching for a different name or trait.</p>
            </div>
          )}
        </div>

      </div>

      <BreedModal 
        breed={selectedBreed} 
        modalType={modalType} 
        onClose={closeAction} 
        setModalType={setModalType} 
        user={user} 
      />
    </div>
  );
};

export default Explore;
