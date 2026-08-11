import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import html2canvas from 'html2canvas';
import BreedCard from './BreedCard';
import FeedbackModal from './FeedbackModal';
import { useBreedList } from '../context/BreedsContext';
import { generatePersonalizedReason } from '../utils/breedUtils';

/* Top-5 recommendation results — hero-card + grid, plus the full results
   toolkit (retake, breed lookup, share) ported from the standalone page.
   #1 breed gets a large orange hero card; #2–#5 stagger in below. */
const RecommendationResults = ({ breeds, answers, user, onBack, onBuy, onFullProfile, onRetake }) => {
  const breedsData = useBreedList();
  const [searchQuery, setSearchQuery] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);

  if (!breeds || !breeds.length) return null;

  const top = breeds[0];
  const rest = breeds.slice(1);

  const matchLabel = (pct) =>
    pct >= 85 ? 'Exceptional Match'
      : pct >= 75 ? 'Excellent Match'
      : pct >= 60 ? 'Good Match'
      : 'Consider Carefully';

  const suggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return breedsData.filter(b => b.name.toLowerCase().includes(q)).slice(0, 6);
  }, [searchQuery]);

  const openSearched = (breed) => { setSearchQuery(''); onFullProfile(breed); };

  const shareWhatsApp = () => {
    const others = rest.slice(0, 3).map(b => b.name).join(', ');
    const txt = `I just found my perfect dog match on Paw Buddy!\n\n#1 Match: ${top.name}\nAlso great: ${others}\n\nFind YOUR perfect dog breed 👉 ${window.location.origin}\n\n#PawBuddy #DogBreed`;
    window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, '_blank');
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Paw Buddy Results',
          text: `My #1 perfect dog match is the ${top.name}! Find yours at Paw Buddy.`,
          url: window.location.origin,
        });
      } catch (e) { /* user dismissed */ }
    } else {
      alert('Native sharing is not supported on this browser.');
    }
  };

  const downloadImage = async () => {
    const el = document.getElementById('rec-top-match');
    if (!el) return;
    try {
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#fff9f5' });
      const link = document.createElement('a');
      link.download = `paw-buddy-${top.name.replace(/\s+/g, '-').toLowerCase()}.png`;
      link.href = canvas.toDataURL();
      link.click();
    } catch (e) {
      alert('Could not generate the image.');
    }
  };

  const pillBtn = (bg, color, border) => ({
    padding: '12px 24px', background: bg, color, border: border || 'none',
    borderRadius: '50px', cursor: 'pointer', fontWeight: 'bold',
    fontFamily: "'Poppins', sans-serif", fontSize: '14px'
  });

  return (
    <div className="results-wrap" style={{ maxWidth: '1120px', margin: '0 auto', padding: '0 12px' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
        <button
          onClick={onBack}
          style={{
            background: 'white', color: 'var(--brown)', border: '1px solid #EAE4DE',
            padding: '9px 20px', borderRadius: '50px', cursor: 'pointer',
            fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: '13px',
            boxShadow: 'var(--shadow)', display: 'flex', alignItems: 'center', gap: '8px'
          }}
        >
          ← Back
        </button>
      </div>

      <div className="results-header" style={{ textAlign: 'center', marginBottom: '26px' }}>
        <h2 style={{ fontFamily: "'Fredoka', sans-serif", color: 'var(--brown)' }}>Your Pawfect Matches</h2>
        <p style={{ fontFamily: "'Poppins', sans-serif", color: 'var(--text-soft)' }}>
          Based on your lifestyle, here are the best companions for you to welcome home.
        </p>
      </div>

      {/* #1 hero card */}
      <motion.div
        className="top-match"
        id="rec-top-match"
        initial={{ opacity: 0, y: 34, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="top-match-media">
          <img
            src={`/${top.img}`}
            alt={top.name}
            className="top-match-img"
            onClick={() => onFullProfile(top)}
            style={{ cursor: 'pointer' }}
            onError={(e) => { e.target.src = 'https://via.placeholder.com/180?text=Dog'; }}
          />
          <div style={{ color: 'white', fontFamily: "'Fredoka', sans-serif", lineHeight: 1, textAlign: 'center', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center' }}>
              <span style={{ fontSize: '46px', fontWeight: 800 }}>{top.matchPercentage}%</span>
              <span style={{ fontSize: '17px', opacity: 0.9, marginLeft: '6px' }}>Match</span>
            </div>
            <div style={{ fontSize: '13px', marginTop: '6px', fontWeight: 600, opacity: 0.9 }}>
              {matchLabel(top.matchPercentage)}
            </div>
          </div>
        </div>

        <div className="top-match-info">
          <div className="top-badge" style={{ marginBottom: '10px' }}>#1 RECOMMENDED</div>
          <h3 style={{ marginTop: 0 }}>{top.name}</h3>
          <p className="reason">{top.purpose}</p>
          <p style={{ fontSize: '14px', color: 'white', marginTop: '4px', lineHeight: 1.55, background: 'rgba(255,255,255,0.14)', padding: '11px 13px', borderRadius: '12px', borderLeft: '3px solid rgba(255,255,255,0.55)' }}>
            {generatePersonalizedReason(top, answers)}
          </p>

          {top.warnings?.length > 0 && (
            <p style={{ fontSize: '12.5px', color: 'white', marginTop: '10px', lineHeight: 1.5, background: 'rgba(0,0,0,0.12)', padding: '8px 12px', borderRadius: '10px', display: 'inline-block' }}>
              ⚠ {top.warnings[0]}
            </p>
          )}

          <div className="match-tags" style={{ marginTop: '15px' }}>
            {top.tags?.map((tag) => (
              <span key={tag} className="match-tag">{tag}</span>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px', flexWrap: 'wrap' }}>
            <button
              onClick={() => onBuy(top)}
              style={{ flex: '1 1 120px', padding: '12px', background: 'white', color: 'var(--orange)', border: 'none', borderRadius: '50px', fontWeight: 800, cursor: 'pointer', fontFamily: "'Poppins', sans-serif", boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}
            >
              Buy
            </button>
            <button
              onClick={() => onFullProfile(top)}
              style={{ flex: '1 1 120px', padding: '12px', background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '50px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Poppins', sans-serif", backdropFilter: 'blur(5px)' }}
            >
              Full Profile
            </button>
          </div>
        </div>
      </motion.div>

      {/* #2–#5 grid, staggered */}
      <div className="breeds-grid">
        {rest.map((breed, index) => (
          <motion.div
            key={breed.id || breed.name}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ delay: index * 0.06, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <BreedCard
              breed={breed}
              rank={index + 2}
              reason={generatePersonalizedReason(breed, answers)}
              hideCompareButton={true}
              onBuy={(b) => onBuy(b)}
              onFullProfile={(b) => onFullProfile(b)}
              onImageClick={(b) => onFullProfile(b)}
            />
          </motion.div>
        ))}
      </div>

      {/* Not quite sure? — retake */}
      <div style={{ marginTop: '44px', textAlign: 'center', padding: 'clamp(22px, 4vw, 30px)', background: '#fff9f5', borderRadius: '20px', border: '2px dashed var(--orange)' }}>
        <h3 style={{ color: 'var(--brown)', marginBottom: '10px', fontSize: '24px', fontFamily: "'Fredoka', sans-serif" }}>Not quite sure? Or wanna try again for fun? 🐾</h3>
        <p style={{ color: 'var(--text-soft)', marginBottom: '20px', fontSize: '16px' }}>There's no rush in finding your perfect furry friend. Take all the time you need!</p>
        <button onClick={onRetake} style={{ padding: '12px 28px', background: 'var(--orange)', color: 'white', border: 'none', borderRadius: '50px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px', boxShadow: '0 4px 15px rgba(255,107,43,0.3)' }}>Let's Retake the Quiz</button>
      </div>

      {/* Have a breed in mind? — search */}
      <div style={{ marginTop: '28px', background: 'var(--cream)', padding: '30px', borderRadius: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
        <h3 style={{ color: 'var(--brown)', marginBottom: '10px', fontFamily: "'Fredoka', sans-serif" }}>Have a breed in mind?</h3>
        <p style={{ color: 'var(--text-soft)', fontSize: '14px', marginBottom: '20px' }}>Type any breed name and we'll tell you the pros &amp; cons based on YOUR specific lifestyle answers</p>
        <div style={{ display: 'flex', gap: '10px', position: 'relative', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 220px', position: 'relative' }}>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="husky"
              style={{ width: '100%', padding: '15px', borderRadius: '50px', border: '1px solid #ddd', fontFamily: "'Poppins', sans-serif" }}
            />
            {suggestions.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, width: '100%', background: 'white', border: '1px solid #ddd', borderRadius: '12px', maxHeight: '220px', overflowY: 'auto', zIndex: 10, marginTop: '6px', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}>
                {suggestions.map(b => (
                  <div
                    key={b.name}
                    onClick={() => openSearched(b)}
                    style={{ padding: '12px', cursor: 'pointer', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: '10px' }}
                    onMouseOver={e => e.currentTarget.style.background = '#f9f9f9'}
                    onMouseOut={e => e.currentTarget.style.background = 'white'}
                  >
                    <img src={`/${b.img}`} alt={b.name} style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} />
                    <span style={{ fontFamily: "'Poppins', sans-serif", color: 'var(--brown)', fontWeight: 600 }}>{b.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => {
              const b = breedsData.find(x => x.name.toLowerCase().includes(searchQuery.trim().toLowerCase()));
              if (b) openSearched(b); else alert('Breed not found. Try the suggestions dropdown.');
            }}
            style={{ padding: '15px 30px', background: 'var(--orange)', color: 'white', border: 'none', borderRadius: '50px', cursor: 'pointer', fontWeight: 'bold', flex: '1 1 150px' }}
          >
            Check This Breed
          </button>
        </div>
      </div>

      {/* Share your results */}
      <div style={{ marginTop: '28px', textAlign: 'center', background: 'white', padding: '40px', borderRadius: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
        <h3 style={{ color: 'var(--brown)', marginBottom: '10px', fontFamily: "'Fredoka', sans-serif" }}>Share your results</h3>
        <p style={{ color: 'var(--text-soft)', fontSize: '14px', marginBottom: '20px' }}>Let your friends know what breed suits you!</p>
        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {navigator.share && (
            <button onClick={shareNative} style={pillBtn('#3B82F6', 'white')}>Share Results</button>
          )}
          <button onClick={shareWhatsApp} style={pillBtn('#25D366', 'white')}>Share on WhatsApp</button>
          <button onClick={downloadImage} style={pillBtn('var(--orange)', 'white')}>Download as Image</button>
          <button onClick={() => setShowFeedback(true)} style={pillBtn('transparent', 'var(--orange)', '1px solid var(--orange)')}>Share Feedback</button>
          <button onClick={onRetake} style={pillBtn('#D32F2F', 'white')}>Retake Quiz</button>
        </div>
      </div>

      {/* Fixed Retake Quiz CTA — always visible on the results */}
      <button
        onClick={onRetake}
        className="rec-retake-fab"
        aria-label="Retake Quiz"
      >
        🐾 Retake Quiz
      </button>

      <FeedbackModal isOpen={showFeedback} onClose={() => setShowFeedback(false)} user={user} />

      <style>{`
        .rec-retake-fab {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 1400;
          padding: 14px 26px;
          background: var(--orange);
          color: #fff;
          border: none;
          border-radius: 50px;
          font-family: 'Poppins', sans-serif;
          font-weight: 700;
          font-size: 15px;
          cursor: pointer;
          box-shadow: 0 10px 28px rgba(208, 92, 25, 0.4);
          display: flex;
          align-items: center;
          gap: 8px;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .rec-retake-fab:hover {
          transform: translateY(-2px) scale(1.03);
          box-shadow: 0 14px 34px rgba(208, 92, 25, 0.5);
        }
        @media (max-width: 768px) {
          .rec-retake-fab { bottom: 16px; right: 16px; padding: 12px 20px; font-size: 14px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .rec-retake-fab { transition: none; }
        }
      `}</style>
    </div>
  );
};

export default RecommendationResults;
