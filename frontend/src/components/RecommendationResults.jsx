import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import html2canvas from 'html2canvas';
import BreedCard from './BreedCard';
import FeedbackModal from './FeedbackModal';
import { useBreedList } from '../context/BreedsContext';
import { generatePersonalizedReason, noExcellentMatch, selectTopMatches } from '../utils/breedUtils';

/* Top-5 recommendation results — hero-card + grid, plus the full results
   toolkit (retake, breed lookup, share) ported from the standalone page.
   #1 breed gets a large orange hero card; #2–#5 stagger in below. */
/* ── Hand-drawn doodles — decorative only (aria-hidden), brand palette only ── */
const D_NAVY = '#011E4A';
const D_ORANGE = '#F57A1B';

const Crown = () => (
  <svg className="rbx-crown" viewBox="0 0 64 44" aria-hidden="true">
    <path d="M8 38 L4 11 L20 24 L32 6 L44 24 L60 11 L56 38 Z" fill="#FFFFFF" stroke={D_NAVY} strokeWidth="3" strokeLinejoin="round" />
    <path d="M10 38.5 H54" stroke={D_NAVY} strokeWidth="3" strokeLinecap="round" />
    <circle cx="4" cy="10" r="3.4" fill={D_ORANGE} stroke={D_NAVY} strokeWidth="2" />
    <circle cx="32" cy="5.5" r="3.4" fill={D_ORANGE} stroke={D_NAVY} strokeWidth="2" />
    <circle cx="60" cy="10" r="3.4" fill={D_ORANGE} stroke={D_NAVY} strokeWidth="2" />
  </svg>
);

const Heart = ({ className, stroke = D_NAVY }) => (
  <svg className={`rbx-doodle ${className || ''}`} viewBox="0 0 32 32" aria-hidden="true">
    <path d="M16 27s-10-6.2-10-13.2A5.6 5.6 0 0 1 16 10a5.6 5.6 0 0 1 10 3.8C26 20.8 16 27 16 27z" fill="none" stroke={stroke} strokeWidth="2.2" strokeLinejoin="round" />
  </svg>
);

const Sparks = ({ className, stroke = D_ORANGE }) => (
  <svg className={`rbx-doodle ${className || ''}`} viewBox="0 0 40 34" aria-hidden="true">
    <path d="M7 4 L13 16 M22 2 L22 15 M36 8 L26 17" fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
  </svg>
);

/* Hand-drawn arrow: the line draws itself, then the head fades in. */
const ARROWS = {
  down: { line: 'M12 6 C 8 26, 24 40, 38 50', head: 'M33.9 40.9 L38 50 L28 49' },
  left: { line: 'M48 6 C 52 26, 36 40, 14 50', head: 'M24 51 L14 50 L19.8 41.9' },
};
const Arrow = ({ dir = 'down', className }) => (
  <svg className={`rbx-arrow ${className || ''}`} viewBox="0 0 60 60" aria-hidden="true">
    <path className="rbx-arrow-line" pathLength="1" d={ARROWS[dir].line} fill="none" stroke={D_NAVY} strokeWidth="2.4" strokeLinecap="round" />
    <path className="rbx-arrow-head" d={ARROWS[dir].head} fill="none" stroke={D_NAVY} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const RecommendationResults = ({ breeds, answers, user, onBack, onBuy, onFullProfile, onRetake }) => {
  const breedsData = useBreedList();
  const [searchQuery, setSearchQuery] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);

  if (!breeds || !breeds.length) return null;

  // Same rule as the quiz Results page: never list a "Not recommended" breed as a match.
  const { matches, hiddenCount } = selectTopMatches(breeds, 5);
  const top = matches[0];
  const rest = matches.slice(1);

  // Was recomputing its own label from matchPercentage at 85/75/60 cutoffs,
  // with a 4th "Exceptional" tier the engine doesn't have — completely
  // independent of the engine's own `label`, which caps at "Fair" when a
  // severe issue (a bad gate, or the SPACE flag) is present. That's how a
  // 0/15-home-fit breed with a SPACE warning still read "Excellent" here:
  // this function never looked at the flag, only the raw percentage.
  // breed.label is already the right answer — computed once, in one place.

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
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#FFFFFF' });
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
    borderRadius: '50px', cursor: 'pointer', fontWeight: 'var(--weight-semibold)',
    fontFamily: 'var(--font-display)', fontSize: '14px'
  });

  return (
    <div className="results-wrap rbx" style={{ maxWidth: '1120px', margin: '0 auto', padding: '0 12px' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
        <button
          onClick={onBack}
          style={{
            background: '#FFFFFF', color: '#011E4A', border: '1.5px solid #011E4A',
            padding: '9px 20px', borderRadius: '50px', cursor: 'pointer',
            fontFamily: 'var(--font-display)', fontWeight: 'var(--weight-semibold)', fontSize: '13px',
            boxShadow: 'none', display: 'flex', alignItems: 'center', gap: '8px'
          }}
        >
          ← Back
        </button>
      </div>

      <div className="results-header" style={{ textAlign: 'center', marginBottom: '26px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--weight-semibold)', color: 'var(--brown)' }}>
          <span className="rbx-title">
            Your Pawfect Matches
            <Heart className="rbx-title-heart" stroke={D_ORANGE} />
            <Sparks className="rbx-title-sparks" />
          </span>
        </h2>
        <p style={{ fontFamily: 'var(--font-body-family)', color: 'var(--text-soft)' }}>
          Based on your lifestyle, here are the best companions for you to welcome home.
        </p>
      </div>

      {/* Was computed correctly by the engine this whole time (noExcellentMatch,
          showsScheduleDisclaimer, showsPgDisclaimer, showsHomeUnsureDisclaimer)
          and tested in a standalone harness, but never actually wired into this
          component — so none of it ever reached a real user. The allergies
          question's own text promises "we'll flag this clearly"; nothing in
          this file read the answer at all. All five now render here, once,
          before the hero card, since each is about the whole result set or the
          whole answer set — not about any one breed. */}
      {(() => {
        const noExcellent = noExcellentMatch(matches);
        const allergyAns = Array.isArray(answers?.allergies) ? answers.allergies[0] : answers?.allergies;
        const showAllergy = allergyAns === 'mild' || allergyAns === 'diagnosed';
        const showSchedule = top.showsScheduleDisclaimer;
        const showPg = top.showsPgDisclaimer;
        const showUnsure = top.showsHomeUnsureDisclaimer;
        if (!noExcellent && !showAllergy && !showSchedule && !showPg && !showUnsure) return null;
        const boxStyle = { borderRadius: '14px', padding: '14px 18px', fontSize: '13.5px', lineHeight: 1.55 };
        return (
          <div style={{ marginBottom: '22px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {noExcellent && (
              <div style={{ ...boxStyle, background: '#fff4e5', border: '1px solid #ffd699', color: 'var(--brown)' }}>
                <strong style={{ display: 'block', marginBottom: '4px' }}>{noExcellent.headline}</strong>
                <span style={{ color: 'var(--text-soft)' }}>{noExcellent.reasons.join(' · ')}</span>
              </div>
            )}
            {showPg && (
              <div style={{ ...boxStyle, background: '#f8f9fa', border: '1px dashed #d8d2ca', color: 'var(--text-soft)' }}>
                <strong style={{ color: 'var(--brown)' }}>PG / shared accommodation: </strong>
                most PG setups restrict or limit pets, and space here is scored tighter than a self-contained flat.
                Check your landlord's actual pet policy before anything else — this is a fit estimate, not a guarantee
                you're allowed a dog at all.
              </div>
            )}
            {showUnsure && (
              <div style={{ ...boxStyle, background: '#f8f9fa', border: '1px dashed #d8d2ca', color: 'var(--text-soft)' }}>
                <strong style={{ color: 'var(--brown)' }}>Home type not yet known: </strong>
                these results use a typical 2BHK as a neutral placeholder. Come back and answer this once you know —
                home type changes which breeds actually fit, in both directions.
              </div>
            )}
            {showAllergy && (
              <div style={{ ...boxStyle, background: '#f8f9fa', border: '1px dashed #d8d2ca', color: 'var(--text-soft)' }}>
                No dog breed is truly allergen-free, including ones marketed as "hypoallergenic" — two peer-reviewed
                studies found no meaningful difference in allergen protein between breeds. Spend real time with a
                specific dog before committing.
              </div>
            )}
            {showSchedule && (
              <div style={{ ...boxStyle, background: '#f8f9fa', border: '1px dashed #d8d2ca', color: 'var(--text-soft)' }}>
                General welfare note: RSPCA, PDSA, Dogs Trust and Blue Cross all recommend no more than 4 hours alone
                for any dog, regardless of breed — this applies to every result below, not just the ones flagged.
              </div>
            )}
          </div>
        );
      })()}

      {/* Breeder availability note — shown above results always */}
      <div style={{ background: '#F5F9FC', border: '1.5px solid #CCE9F8', borderRadius: '12px', padding: '12px 16px', fontSize: '13px', fontFamily: 'var(--font-body-family)', color: 'var(--brown)', lineHeight: 1.55, marginBottom: '16px' }}>
        🛒 <strong>About availability:</strong> if your first-choice breeder doesn't have this breed in stock right now, don't worry — other verified breeders on PAW BUDDY may have your match ready. Always check a second listing before giving up on your top pick.
      </div>

      <div className="rbx-hero-wrap">
        {/* "Your best match!" speech bubble + arrow (decorative) */}
        <div className="rbx-callout rbx-callout--best" aria-hidden="true">
          <span className="rbx-bubble">Your best match!</span>
          <Arrow dir="down" className="rbx-arrow--best" />
        </div>

      {/* #1 hero card */}
      <motion.div
        className="top-match"
        id="rec-top-match"
        onClick={() => onFullProfile(top)}
        style={{ cursor: 'pointer' }}
        initial={{ opacity: 0, y: 34, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="top-match-media">
          <div className="rbx-photo">
          <Crown />
          <img
            src={`/${top.img}`}
            alt={top.name}
            className="top-match-img"
            onClick={(e) => { e.stopPropagation(); onFullProfile(top); }}
            style={{ cursor: 'pointer' }}
            onError={(e) => { e.target.src = 'https://via.placeholder.com/180?text=Dog'; }}
          />
          </div>
          <div style={{ color: 'white', fontFamily: 'var(--font-body-family)', lineHeight: 1, textAlign: 'center', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center' }}>
              <span style={{ fontSize: '46px', fontWeight: 800, fontFamily: 'var(--font-accent)' }}>{top.matchPercentage}%</span>
              <span style={{ fontSize: '17px', opacity: 0.9, marginLeft: '6px' }}>Match</span>
            </div>
            <div style={{ fontSize: '13px', marginTop: '6px', fontWeight: 'var(--weight-medium)', opacity: 0.9 }}>
              {top.label}
            </div>
          </div>
        </div>

        <div className="top-match-info">
          {/* Was a hardcoded "#1 RECOMMENDED" regardless of the engine's own
              label — confirmed a breed labelled "Not recommended" still
              carried this exact badge. Now reflects what the engine actually
              concluded; #1 in the ranking isn't the same claim as "we
              recommend this." */}
          <div className="top-badge" style={{ marginBottom: '10px', ...(top.label?.startsWith('Not recommended') ? { background: 'rgba(0,0,0,0.35)' } : top.label?.startsWith('Fair') ? { background: 'rgba(0,0,0,0.22)' } : {}) }}>
            {top.label?.startsWith('Not recommended') ? 'BEST AVAILABLE — NOT RECOMMENDED'
              : top.label?.startsWith('Fair') ? '#1 MATCH — CHECK WARNINGS'
              : '#1 RECOMMENDED'}
          </div>
          <h3 style={{ marginTop: 0 }}>{top.name}</h3>
          <p className="reason">{top.purpose}</p>
          <p style={{ fontSize: '14px', color: 'white', marginTop: '4px', lineHeight: 1.55, background: 'rgba(255,255,255,0.14)', padding: '11px 13px', borderRadius: '12px', borderLeft: '3px solid rgba(255,255,255,0.55)' }}>
            {generatePersonalizedReason(top, answers)}
          </p>

          {top.warnings?.length > 0 && (
            <div style={{ marginTop: '10px' }}>
              {top.warnings.map((w, i) => (
                <div key={i} style={{ marginTop: i ? '6px' : 0 }}>
                  <p style={{ fontSize: '12.5px', color: 'white', lineHeight: 1.5, background: 'rgba(0,0,0,0.12)', padding: '8px 12px', borderRadius: '10px', margin: 0, display: 'inline-block' }}>
                    ⚠ {w}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="match-tags" style={{ marginTop: '15px' }}>
            {top.tags?.map((tag) => (
              <span key={tag} className="match-tag">{tag}</span>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px', flexWrap: 'wrap' }}>
            <button
              onClick={(e) => { e.stopPropagation(); onBuy(top); }}
              style={{ flex: '1 1 120px', padding: '12px', background: '#011E4A', color: '#FFFFFF', border: '1.5px solid #011E4A', borderRadius: '50px', fontWeight: 'var(--weight-bold)', cursor: 'pointer', fontFamily: 'var(--font-display)', boxShadow: 'none' }}
            >
              Buy
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onFullProfile(top); }}
              style={{ flex: '1 1 120px', padding: '12px', background: '#FFFFFF', color: '#011E4A', border: '1.5px solid #011E4A', borderRadius: '50px', fontWeight: 'var(--weight-semibold)', cursor: 'pointer', fontFamily: 'var(--font-display)' }}
            >
              Full Profile
            </button>
            {/* Adoption path — shown for adoption-typical breeds (Pariah, Mudhol, Rajapalayam
                and any breed the network has no breeder listings for). Routing to a real
                rescue/shelter page is a TODO on the data side; the button is there so the
                UX exists before the partner list is ready. */}
            <button
              disabled
              style={{ flex: '1 1 120px', padding: '12px', background: 'transparent', color: '#FFFFFF', border: '1.5px dashed rgba(255,255,255,0.8)', borderRadius: '50px', fontWeight: 'var(--weight-semibold)', cursor: 'not-allowed', fontFamily: 'var(--font-display)', fontSize: '13px', opacity: 0.85 }}
              title="Adoption partners coming soon — check back before launch"
            >
              Adoption – Coming Soon
            </button>
          </div>
        </div>
        <Heart className="rbx-hero-heart" />
        <Sparks className="rbx-hero-sparks" stroke={D_NAVY} />
      </motion.div>
      </div>

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

      {hiddenCount > 0 && (
        <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-soft)', margin: '18px auto 0', maxWidth: '560px', lineHeight: 1.5 }}>
          {hiddenCount} other breed{hiddenCount === 1 ? '' : 's'} scored "Not recommended" for your answers, so we haven't listed {hiddenCount === 1 ? 'it' : 'them'} as matches.
        </p>
      )}

      {/* Have a breed in mind? — search */}
      <div style={{ position: 'relative', marginTop: '44px', background: 'var(--cream)', padding: '30px', borderRadius: '20px', border: '2px solid #CCE9F8' }}>
        <div className="rbx-callout rbx-callout--check" aria-hidden="true">
          <span className="rbx-hand">Let's check!</span>
          <Arrow dir="left" className="rbx-arrow--small" />
        </div>
        <h3 style={{ color: 'var(--brown)', marginBottom: '10px', fontFamily: 'var(--font-display)', fontWeight: 'var(--weight-semibold)' }}>Have a breed in mind?</h3>
        <p style={{ color: 'var(--text-soft)', fontSize: '14px', marginBottom: '20px' }}>Type any breed name and we'll tell you the pros &amp; cons based on YOUR specific lifestyle answers</p>
        <div style={{ display: 'flex', gap: '10px', position: 'relative', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 220px', position: 'relative' }}>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="husky"
              style={{ width: '100%', padding: '15px', borderRadius: '50px', border: '1.5px solid #CCE9F8', background: '#FFFFFF', color: '#050C1E', fontFamily: 'var(--font-body-family)' }}
            />
            {suggestions.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, width: '100%', background: 'white', border: '1.5px solid #CCE9F8', borderRadius: '12px', maxHeight: '220px', overflowY: 'auto', zIndex: 10, marginTop: '6px', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}>
                {suggestions.map(b => (
                  <div
                    key={b.name}
                    onClick={() => openSearched(b)}
                    style={{ padding: '12px', cursor: 'pointer', borderBottom: '1px solid #CCE9F8', display: 'flex', alignItems: 'center', gap: '10px' }}
                    onMouseOver={e => e.currentTarget.style.background = '#F5F9FC'}
                    onMouseOut={e => e.currentTarget.style.background = 'white'}
                  >
                    <img src={`/${b.img}`} alt={b.name} style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} />
                    <span style={{ fontFamily: 'var(--font-body-family)', color: 'var(--brown)', fontWeight: 'var(--weight-regular)' }}>{b.name}</span>
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
            style={{ padding: '15px 30px', background: 'var(--orange)', color: 'white', border: 'none', borderRadius: '50px', cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: 'var(--weight-semibold)', flex: '1 1 150px' }}
          >
            Check This Breed
          </button>
        </div>
      </div>

      {/* Share your results */}
      <div style={{ position: 'relative', marginTop: '28px', textAlign: 'center', background: 'white', padding: '40px', borderRadius: '20px', border: '2px solid #CCE9F8' }}>
        <div className="rbx-callout rbx-callout--share" aria-hidden="true">
          <span className="rbx-hand">Share the paw love! <Heart className="rbx-inline-heart" stroke={D_ORANGE} /></span>
          <Arrow dir="left" className="rbx-arrow--small" />
        </div>
        <h3 style={{ color: 'var(--brown)', marginBottom: '10px', fontFamily: 'var(--font-display)', fontWeight: 'var(--weight-semibold)' }}>Share your results</h3>
        <p style={{ color: 'var(--text-soft)', fontSize: '14px', marginBottom: '20px' }}>Let your friends know what breed suits you!</p>
        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {navigator.share && (
            <button onClick={shareNative} style={pillBtn('#011E4A', '#FFFFFF')}>Share Results</button>
          )}
          <button onClick={shareWhatsApp} style={pillBtn('#011E4A', '#FFFFFF')}>Share on WhatsApp</button>
          <button onClick={downloadImage} style={pillBtn('var(--orange)', 'white')}>Download as Image</button>
          <button onClick={() => setShowFeedback(true)} style={pillBtn('#FFFFFF', '#011E4A', '1.5px solid #011E4A')}>Share Feedback</button>
          <button onClick={onRetake} style={pillBtn('#FFFFFF', '#011E4A', '1.5px solid #011E4A')}>Retake Quiz</button>
        </div>
      </div>

      {/* Fixed Retake Quiz CTA — always visible on the results */}
      <button
        onClick={onRetake}
        className="rec-retake-fab"
        aria-label="Retake Quiz"
      >
        <svg width="18" height="18" viewBox="0 0 30 30" fill="#FFFFFF" aria-hidden="true">
          <ellipse cx="6" cy="10" rx="3.2" ry="4.1" /><ellipse cx="11.5" cy="4.6" rx="3.3" ry="4.3" />
          <ellipse cx="18.5" cy="4.6" rx="3.3" ry="4.3" /><ellipse cx="24" cy="10" rx="3.2" ry="4.1" />
          <path d="M15 13.5c-4.6 0-8.5 4.4-8.5 8.3 0 2.6 2 3.9 4.4 3.9 1.7 0 2.5-.8 4.1-.8s2.4.8 4.1.8c2.4 0 4.4-1.3 4.4-3.9 0-3.9-3.9-8.3-8.5-8.3Z" />
        </svg>
        Retake Quiz
      </button>

      <FeedbackModal isOpen={showFeedback} onClose={() => setShowFeedback(false)} user={user} />

      <style>{`
        /* PAW BUDDY brand system — scoped to the quiz results view only */
        .rbx {
          --orange: #F57A1B;
          --orange-pale: #CCE9F8;
          --brown: #011E4A;
          --text-soft: rgba(5, 12, 30, 0.72);
          --text-color: #050C1E;
          --cream: #F5F9FC;
          --shadow: none;
          --shadow-lg: none;
          --font-display: 'Clash Display', 'Sora', sans-serif;
          --font-accent: 'Clash Display', 'Sora', sans-serif;
          --font-body-family: 'Satoshi', 'Inter', sans-serif;
          color: #050C1E;
          font-family: 'Satoshi', 'Inter', sans-serif;
        }
        .rbx h2, .rbx h3, .rbx h4 {
          font-family: 'Clash Display', 'Sora', sans-serif !important;
          font-weight: 700 !important;
          letter-spacing: -0.01em;
        }
        .rbx button, .rbx input, .rbx .match-tag, .rbx .pill, .rbx .top-badge {
          font-family: 'Satoshi', 'Inter', sans-serif !important;
        }
        /* hero card: flat brand orange, crisp navy border */
        .rbx .top-match {
          background: #F57A1B;
          border: 2px solid #011E4A;
          box-shadow: none;
        }
        .rbx .top-badge { background: #011E4A !important; color: #FFFFFF; }   /* label text differs per verdict; colour stays on-brand */
        .rbx .match-tag { background: #FFFFFF; color: #011E4A; font-weight: 700; }
        .rbx .top-match-img { border: 3px solid #FFFFFF; background: #CCE9F8; }
        .rbx .match-score, .rbx .breed-rank { font-family: 'Clash Display', 'Sora', sans-serif !important; }
        /* secondary cards: crisp light-blue border, navy on hover */
        .rbx .breed-card { background: #FFFFFF; border: 2px solid #CCE9F8; box-shadow: none; }
        .rbx .breed-card:hover { border-color: #011E4A; box-shadow: none; }
        .rbx .breed-card-img { background: #CCE9F8; }
        .rbx .breed-rank { background: #011E4A; color: #FFFFFF; }
        .rbx .pill-orange { background: #CCE9F8; color: #011E4A; }
        .rbx .breed-reason-box {
          background: #F5F9FC !important;
          border-left: 3px solid #F57A1B !important;
          color: #050C1E !important;
        }
        .rbx .breed-btn--buy { background: #F57A1B !important; color: #FFFFFF !important; border: 1.5px solid #F57A1B !important; }
        .rbx .breed-btn--profile { background: #FFFFFF !important; color: #011E4A !important; border: 1.5px solid #011E4A !important; }
        /* ── Doodles: layout ── */
        .rbx .top-match { position: relative; }
        .rbx-hero-wrap { position: relative; padding-top: 50px; }
        .rbx-callout { position: absolute; z-index: 3; pointer-events: none; user-select: none; }
        .rbx-callout--best { left: 20px; top: 0; }
        .rbx-bubble {
          position: relative;
          display: inline-block;
          background: #FFFFFF;
          border: 2px solid #011E4A;
          border-radius: 18px;
          padding: 5px 16px 7px;
          font: 600 22px/1 'Caveat', 'Segoe Print', cursive;
          color: #011E4A;
          transform: rotate(-3deg);
          transform-origin: 30% 100%;
        }
        .rbx-bubble::after {
          content: '';
          position: absolute;
          left: 96px; bottom: -9px;
          width: 14px; height: 14px;
          background: #FFFFFF;
          border-right: 2px solid #011E4A;
          border-bottom: 2px solid #011E4A;
          transform: rotate(45deg);
        }
        .rbx-arrow { position: absolute; width: 60px; height: 60px; overflow: visible; }
        .rbx-arrow--best { left: 100px; top: 34px; }
        .rbx-photo { position: relative; width: 180px; flex-shrink: 0; }
        .rbx-crown {
          position: absolute;
          left: 50%; top: -26px;
          width: 58px;
          z-index: 2;
          transform: translateX(-50%) rotate(-7deg);
          pointer-events: none;
        }
        .rbx-doodle { position: absolute; pointer-events: none; overflow: visible; }
        .rbx-title { position: relative; display: inline-block; }
        .rbx-title-heart { left: -40px; top: -8px; width: 28px; rotate: -14deg; }
        .rbx-title-sparks { right: -44px; top: -14px; width: 32px; }
        .rbx-hero-heart { right: 26px; top: 16px; width: 32px; rotate: 12deg; }
        .rbx-hero-sparks { right: 66px; top: 10px; width: 30px; }
        .rbx-hand {
          display: inline-block;
          font: 600 27px/1 'Caveat', 'Segoe Print', cursive;
          color: #011E4A;
          transform: rotate(-5deg);
          white-space: nowrap;
        }
        .rbx-inline-heart { position: static; display: inline-block; width: 20px; height: 20px; vertical-align: -3px; rotate: 10deg; }
        .rbx-callout--check { right: 70px; top: 16px; }
        .rbx-callout--share { right: 56px; top: 16px; }
        .rbx-arrow--small { right: 14px; top: 30px; width: 54px; height: 54px; }
        .rbx-callout--check .rbx-arrow--small,
        .rbx-callout--share .rbx-arrow--small { position: absolute; }

        @media (max-width: 900px) {
          /* narrower boxes: keep the handwriting as a tag on the box edge, no arrow */
          .rbx-callout--check, .rbx-callout--share { top: -17px; right: 20px; }
          .rbx-callout--check .rbx-arrow, .rbx-callout--share .rbx-arrow { display: none; }
        }
        @media (max-width: 640px) {
          .rbx-hero-wrap { padding-top: 56px; }
          .rbx-callout--best { left: 0; right: 0; text-align: center; }
          .rbx-bubble::after { left: calc(50% - 7px); }
          .rbx-arrow--best { left: calc(50% + 26px); top: 36px; }
          .rbx-title-heart { display: none; }   /* would sit on the Back button on phones */
          .rbx-title-sparks { right: 2px; top: -28px; }
          .rbx-hero-heart { right: 18px; top: 14px; width: 28px; }
          .rbx-hero-sparks { right: 54px; top: 8px; width: 26px; }
          .rbx-hand { font-size: 24px; }
        }

        /* ── Doodles: motion (once, on arrival) ── */
        @keyframes rbx-pop { 0% { opacity: 0; scale: 0.6; } 70% { opacity: 1; scale: 1.06; } 100% { opacity: 1; scale: 1; } }
        @keyframes rbx-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes rbx-draw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
        @keyframes rbx-beat { 0%, 100% { scale: 1; } 50% { scale: 1.12; } }
        @keyframes rbx-crown-drop {
          0% { opacity: 0; transform: translateX(-50%) translateY(-20px) rotate(-22deg); }
          70% { opacity: 1; transform: translateX(-50%) translateY(2px) rotate(-4deg); }
          100% { opacity: 1; transform: translateX(-50%) rotate(-7deg); }
        }
        .rbx-crown { animation: rbx-crown-drop 750ms cubic-bezier(0.34, 1.4, 0.64, 1) 450ms both; }
        .rbx-bubble { animation: rbx-pop 520ms cubic-bezier(0.34, 1.4, 0.64, 1) 700ms both; }
        .rbx-arrow-line { stroke-dasharray: 1; stroke-dashoffset: 1; animation: rbx-draw 520ms ease-out 1100ms forwards; }
        .rbx-arrow-head { opacity: 0; animation: rbx-fade 200ms ease-out 1550ms forwards; }
        .rbx-title-heart, .rbx-title-sparks, .rbx-hero-heart, .rbx-hero-sparks { animation: rbx-fade 450ms ease-out 900ms both; }
        .rbx-title-heart, .rbx-hero-heart { animation: rbx-fade 450ms ease-out 900ms both, rbx-beat 3.4s ease-in-out 1.6s infinite; }
        .rbx-hand { animation: rbx-fade 600ms ease-out 400ms both; }
        .rbx-callout--check .rbx-arrow-line, .rbx-callout--share .rbx-arrow-line { animation-delay: 700ms; }
        .rbx-callout--check .rbx-arrow-head, .rbx-callout--share .rbx-arrow-head { animation-delay: 1150ms; }
        @media (prefers-reduced-motion: reduce) {
          .rbx-crown { animation: none; opacity: 1; transform: translateX(-50%) rotate(-7deg); }
          .rbx-bubble, .rbx-hand, .rbx-title-heart, .rbx-title-sparks, .rbx-hero-heart, .rbx-hero-sparks { animation: none; opacity: 1; scale: 1; }
          .rbx-arrow-line { animation: none; stroke-dasharray: none; stroke-dashoffset: 0; }
          .rbx-arrow-head { animation: none; opacity: 1; }
        }
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
          font-family: var(--font-display);
          font-weight: var(--weight-semibold);
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
