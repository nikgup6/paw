import { useState, useEffect, useContext, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useBreeds } from '../context/BreedsContext';
import BreedCard from '../components/BreedCard';
import FeedbackModal from '../components/FeedbackModal';
import { AuthContext } from '../context/AuthContext';
import { buildLivingConditions, computeMatches, computeReadiness, generateProsCons, generatePersonalizedReason } from '../utils/breedUtils';
import { clearQuizState } from '../utils/quizState';
import { isSoftCta, saveProgress, showsBreederCta, showsPrepCapture, track } from '../utils/analytics';
import { buildWhatsAppEnquiryLink, WHATSAPP_DISPLAY } from '../utils/whatsapp';
import WhatsAppButton from '../components/WhatsAppButton';
import BreederDirectory from '../components/BreederDirectory';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

/* What the page offers someone who isn't buying yet.

   Defined at module level so it isn't a fresh component type on every render.
   Two shapes: "Planning Ahead" is three to six months out and worth staying in
   touch with, so we trade a prep guide for an email. "Just Researching" hasn't
   decided anything — they get the reading and nothing else. Neither sees a
   breeder. Showing a "buy now" button to someone who just told us they haven't
   decided is how a recommendation engine starts reading as a sales funnel. */
const PrepPanel = ({ readinessCode, topBreed, onSubmitEmail }) => {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const cold = readinessCode === 'researching';

  const submit = () => {
    const value = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(value)) return;
    onSubmitEmail(value);
    setSent(true);
  };

  return (
    <div style={{
      margin: '30px auto 0', maxWidth: '760px', padding: '24px',
      background: 'white', borderRadius: '20px', border: '1px solid #EFE6DC',
      boxShadow: '0 8px 24px -18px rgba(61,41,28,.5)', fontFamily: "'Poppins', sans-serif",
    }}>
      <h3 style={{ fontFamily: "'Fredoka', sans-serif", color: 'var(--brown)', margin: '0 0 6px', fontSize: '20px' }}>
        {cold ? 'Your Starter Kit' : 'Your 90-day prep guide'}
      </h3>
      <p style={{ color: 'var(--text-soft, #7a6a5c)', fontSize: '14px', margin: '0 0 16px', lineHeight: 1.6 }}>
        {cold
          ? `No rush — nobody should pick a dog on a deadline. Here is what to work through before you decide on a ${topBreed || 'breed'}.`
          : `You have time, which is the best position to be in. Here is what to sort out before your ${topBreed || 'puppy'} comes home.`}
      </p>

      <ul style={{ margin: '0 0 18px', paddingLeft: '18px', color: 'var(--brown)', fontSize: '14px', lineHeight: 1.9 }}>
        <li>What a puppy actually costs in the first year — food, vaccines, sterilisation, emergencies.</li>
        <li>The questions that separate an ethical breeder from a mediator.</li>
        <li>The Indian vaccination and deworming schedule, and when each dose is due.</li>
        <li>What your home needs before day one, and what can wait.</li>
      </ul>

      {cold ? (
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Link to="/explore" style={{ padding: '11px 20px', borderRadius: '50px', background: 'var(--orange)', color: 'white', fontWeight: 700, textDecoration: 'none', fontSize: '14px' }}>
            Read about the breeds
          </Link>
          <Link to="/app" style={{ padding: '11px 20px', borderRadius: '50px', border: '1px solid #E3D9CE', color: 'var(--brown)', fontWeight: 700, textDecoration: 'none', fontSize: '14px' }}>
            Health tracker
          </Link>
        </div>
      ) : sent ? (
        <p style={{ margin: 0, color: '#1B8046', fontSize: '14px', fontWeight: 700 }}>
          Sent. Check your inbox — we will not email you about anything else.
        </p>
      ) : (
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            placeholder="you@example.com"
            style={{ flex: '1 1 220px', padding: '12px 14px', borderRadius: '12px', border: '2px solid #EAE4DE', fontFamily: 'inherit', fontSize: '14px', color: 'var(--brown)', outline: 'none' }}
          />
          <button
            onClick={submit}
            style={{ padding: '12px 22px', borderRadius: '50px', border: 'none', background: 'var(--orange)', color: 'white', fontWeight: 700, fontFamily: 'inherit', fontSize: '14px', cursor: 'pointer' }}
          >
            Send it to me
          </button>
        </div>
      )}
    </div>
  );
};


const Results = () => {
  const [loading, setLoading] = useState(true);
  const [topBreeds, setTopBreeds] = useState([]);
  const [modalType, setModalType] = useState(null); // 'buy', 'full_profile', 'compare', 'buy_success'
  const [showFab, setShowFab] = useState(true);
  const [waLink, setWaLink] = useState('');
  const [selectedBreed, setSelectedBreed] = useState(null);
  const [answers, setAnswers] = useState({});
  const [compareList, setCompareList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const { user } = useContext(AuthContext);
  /* Breeds are fetched now, not bundled. Scoring must wait for them —
     computeMatches against an empty catalogue returns an empty ranking. */
  const { breeds: breedsData, loading: breedsLoading } = useBreeds();
  const navigate = useNavigate();
  const compareRef = useRef(null);
  const viewedRef = useRef(false);   // results_viewed is logged once per visit

  useEffect(() => {
    if (breedsLoading) return;          // catalogue still arriving

    const savedState = localStorage.getItem('pb_quiz_state');
    if (!savedState) {
      navigate('/quiz');
      return;
    }

    let parsedAnswers = {};
    try {
      const parsed = JSON.parse(savedState);
      parsedAnswers = parsed.answers || {};
      setAnswers(parsedAnswers);
    } catch (e) {
      console.error('Failed to parse saved state', e);
      navigate('/quiz');
      return;
    }
    
    const fetchResults = async () => {
      try {
        const scoredBreeds = computeMatches(parsedAnswers, breedsData);
        const breeds = scoredBreeds.slice(0, 5);
        setTopBreeds(breeds);

        /* The top breed isn't known until the scoring runs, so results_viewed
           is fired here rather than on mount — otherwise the event carries no
           breed, which is half of what makes it worth logging.

           Guarded because this effect re-runs when `user` resolves from null
           to the signed-in account, which happens on a normal page load. */
        if (!viewedRef.current) {
          viewedRef.current = true;
          const viewed = computeReadiness(parsedAnswers);
          track('results_viewed', { top_breed: breeds[0]?.name, readiness_code: viewed.code });
          // top_breed is the exact breed-database name, so lead data can be
          // joined to breed data later without fuzzy matching.
          saveProgress({ top_breed: breeds[0]?.name, readiness_code: viewed.code, status: 'completed' });

          /* Inside the guard, deliberately. This effect re-runs when `user`
             resolves from null to the signed-in account — which happens on an
             ordinary page load, in production, not just under StrictMode. Left
             outside, every results view wrote two quiz_results rows and the
             "Quizzes Taken" figure counted roughly double. */
          await axios.post(`${API_URL}/api/quiz/submit`, {
            user_id: user?.id || null,
            answers: parsedAnswers,
            top_breeds: breeds.map(b => b.name)
          });
        }
        
        setTimeout(() => setLoading(false), 1500);
      } catch (error) {
        console.error("Error fetching results:", error);
        setTimeout(() => setLoading(false), 1500);
      }
    };

    fetchResults();
  }, [navigate, user, breedsLoading, breedsData]);

  useEffect(() => {
    if (modalType || showFeedback) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => document.body.classList.remove('modal-open');
  }, [modalType, showFeedback]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && topBreeds.length > 0) {
        setShowFeedback(true);
        observer.disconnect(); // Only show once
      }
    }, { threshold: 0.1 });
    const target = document.getElementById('end-of-recommendations');
    if (target) observer.observe(target);
    return () => observer.disconnect();
  }, [topBreeds]);

  useEffect(() => {
    if (loading) return; // Don't attach observer while loading
    
    const observer = new IntersectionObserver((entries) => {
      setShowFab(!entries[0].isIntersecting);
    }, { threshold: 0.1 });
    
    const target = document.getElementById('retake-quiz-section');
    if (target) {
      observer.observe(target);
    }
    
    return () => observer.disconnect();
  }, [loading]);

  // Hyper-personalised justification built from the user's own quiz answers
  const generateReason = (b) => generatePersonalizedReason(b, answers);

  // Q3 city, used to pick which verified breeder network to show.
  const quizCity = (Array.isArray(answers?.city) ? answers.city[0] : answers?.city) || null;

  /* The last question decides how hard this page sells:

       ready_now / ready_soon  → breeder CTA, ready_soon worded softer
       planning                → prep-guide email capture, NO breeder CTA
       researching             → Starter Kit only, NO breeder CTA

     Someone buying inside three months wants a breeder's number; someone
     still reading wants reading, and pushing a breeder at them wastes the
     breeder's time and the reader's goodwill in one move. */
  const readiness = computeReadiness(answers);
  const canConnect = showsBreederCta(readiness.code);
  const softCta = isSoftCta(readiness.code);
  const prepCapture = showsPrepCapture(readiness.code);

  const handleAction = (type, breed) => {
    if (type === 'buy') {
      if (!canConnect) return;      // no breeder path for a cold lead, ever
      track('breeder_cta_clicked', { breed: breed?.name, city: quizCity, readiness_code: readiness.code });
    }
    setSelectedBreed(breed);
    setModalType(type);
    if (type === 'compare') {
      setCompareList([topBreeds[0], breed].filter((v, i, a) => a.findIndex(t => (t.name === v.name)) === i));
      setSearchQuery('');
    }
  };

  const closeAction = () => {
    setModalType(null);
    setSelectedBreed(null);
    setCompareList([]);
  };

  const addBreedToCompare = () => {
    const val = searchQuery.trim().toLowerCase();
    const b = breedsData.find(x => x.name.toLowerCase().includes(val));
    if (!b) { alert('Breed not found. Try Poodle, Husky, etc.'); return; }
    if (compareList.find(c => c.name === b.name)) { alert('Already in comparison.'); return; }
    setCompareList([...compareList, b]);
    setSearchQuery('');
  };

  /** Logged when the user opens a breeder's WhatsApp chat. Best effort only. */
  const logBreederContact = (breeder) => {
    track('contact_submitted', { breeder_id: breeder?.id, breeder_name: breeder?.name, readiness_code: readiness.code });
    axios.post(`${API_URL}/api/buy`, {
      user_id: user?.id || null,
      user_name: user?.name || 'Guest',
      mobile: user?.mobile || 'Via breeder WhatsApp',
      city: quizCity || user?.city || 'Not Provided',
      breed_name: selectedBreed?.name,
      intent: `Contacted breeder: ${breeder.name} (${breeder.city})`,
      status: "NEW"
    }).catch(() => { /* best effort */ });
  };

  const downloadPDF = async () => {
    if (!compareRef.current) return;
    
    // Temporarily remove overflow to prevent cutoff during capture
    const originalStyle = compareRef.current.style.cssText;
    compareRef.current.style.overflow = 'visible';
    compareRef.current.style.width = 'max-content';

    try {
      const canvas = await html2canvas(compareRef.current, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape' });
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save('paw-buddy-comparison.pdf');
    } catch (e) {
      alert('Could not generate PDF');
    } finally {
      // Restore style
      compareRef.current.style.cssText = originalStyle;
    }
  };

  const shareWhatsApp = () => {
    const top = topBreeds[0];
    if (!top) return;
    const others = topBreeds.slice(1, 4).map(b => b.name).join(', ');
    const txt = `I just found my perfect dog match on Paw Buddy!\n\n#1 Match: ${top.name}\nAlso great: ${others}\n\nFind YOUR perfect dog breed 👉 ${window.location.origin}\n\n#PawBuddy #DogBreed`;
    window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, '_blank');
  };

  const handleRetakeQuiz = () => {
    clearQuizState();
    navigate('/quiz?reset=1', { state: { reset: true } });
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Paw Buddy Results',
          text: `My #1 perfect dog match is the ${topBreeds[0]?.name}! Find yours at Paw Buddy.`,
          url: window.location.origin,
        });
      } catch (e) {
        console.error('Error sharing:', e);
      }
    } else {
      alert('Native sharing is not supported on this browser.');
    }
  };

  const downloadTopMatchImage = async () => {
    const el = document.getElementById('top-match-container');
    if (!el) return;
    try {
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#fff9f5' });
      const link = document.createElement('a');
      link.download = `paw-buddy-${topBreeds[0]?.name.replace(/\s+/g, '-').toLowerCase()}.png`;
      link.href = canvas.toDataURL();
      link.click();
    } catch (e) {
      alert('Could not download image');
    }
  };

  if (loading) {
    return <div style={{ padding: '60px', textAlign: 'center', fontFamily: "'Poppins', sans-serif" }}><h2>Analyzing your answers... 🐾</h2></div>;
  }

  return (
    <section id="results-section" style={{ display: 'block', minHeight: '100dvh', position: 'relative', padding: 'clamp(16px, 2vw, 20px)' }}>
      
      <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <img src="/logo.png" alt="Paw Buddy" style={{ width: 'clamp(92px, 24vw, 128px)', mixBlendMode: 'multiply', cursor: 'pointer' }} onClick={() => navigate('/')} />

        <button 
          onClick={() => navigate('/')}
          style={{
            background: 'var(--orange)', color: 'white', border: 'none',
            padding: '8px 16px', borderRadius: '50px', cursor: 'pointer',
            fontFamily: "'Poppins', sans-serif", fontWeight: 600,
            transition: 'all 0.3s ease', boxShadow: '0 4px 15px rgba(255,107,43,0.3)',
            fontSize: 'clamp(12px, 2.5vw, 14px)'
          }}
          onMouseOver={e => { e.currentTarget.style.transform = 'translateX(-2px)'; }}
          onMouseOut={e => { e.currentTarget.style.transform = 'translateX(0)'; }}
        >
          ← Home
        </button>
      </div>

      <div className="results-wrap">
        <div className="results-header">
          <h2 style={{ fontFamily: "'Fredoka', sans-serif" }}>Your Pawfect Matches</h2>
          <p style={{ fontFamily: "'Poppins', sans-serif" }}>Based on your lifestyle, here are the best companions for you to welcome home.</p>
        </div>
        
        {topBreeds.length > 0 && (
          <div className="top-match" id="top-match-container">
            <div className="top-match-media">
              <img 
                src={`/${topBreeds[0].img}`} 
                alt={topBreeds[0].name} 
                className="top-match-img"
                onClick={() => handleAction('image_preview', topBreeds[0])}
                style={{ cursor: 'pointer' }}
                onError={(e) => { e.target.src = 'https://via.placeholder.com/180?text=Dog'; }}
              />
              <div style={{ color: 'white', fontFamily: "'Fredoka', sans-serif", lineHeight: 1, textAlign: 'center', width: '100%', marginTop: '5px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center' }}>
                  <span style={{ fontSize: '48px', fontWeight: 800 }}>{topBreeds[0].matchPercentage}%</span>
                  <span style={{ fontSize: '18px', opacity: 0.9, marginLeft: '6px' }}>Match</span>
                </div>
                <div style={{ fontSize: '14px', marginTop: '6px', fontWeight: 600, opacity: 0.9 }}>
                  {topBreeds[0].matchPercentage >= 85 ? 'Exceptional Match' : (topBreeds[0].matchPercentage >= 75 ? 'Excellent Match' : (topBreeds[0].matchPercentage >= 60 ? 'Good Match' : 'Warning'))}
                </div>
              </div>
            </div>
            <div className="top-match-info">
              <div className="top-badge" style={{ marginBottom: '10px' }}>#1 RECOMMENDED</div>
              <h3 style={{ marginTop: '0' }}>{topBreeds[0].name}</h3>
              <p className="reason">{topBreeds[0].purpose}</p>
              <p style={{ fontSize: '14px', color: 'white', marginTop: '8px', lineHeight: 1.5, background: 'rgba(255,107,43,0.1)', padding: '10px', borderRadius: '8px', borderLeft: '3px solid var(--orange)' }}>
                {generateReason(topBreeds[0])}
              </p>
              <div className="match-tags" style={{ marginTop: '15px' }}>
                {topBreeds[0].tags?.map(tag => (
                  <span key={tag} className="match-tag">{tag}</span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px', flexWrap: 'wrap' }}>
                {canConnect && (
                  <button
                    onClick={() => handleAction('buy', topBreeds[0])}
                    style={{
                      flex: '1 1 100px', padding: '12px', borderRadius: '50px',
                      fontWeight: softCta ? 700 : 800, cursor: 'pointer',
                      fontFamily: "'Poppins', sans-serif",
                      /* A cool lead still gets the door, just not a shove
                         through it — same control, quieter treatment. */
                      background: softCta ? 'rgba(255,255,255,0.15)' : 'white',
                      color: softCta ? 'white' : 'var(--orange)',
                      border: softCta ? '1px solid rgba(255,255,255,0.4)' : 'none',
                      backdropFilter: softCta ? 'blur(5px)' : undefined,
                      boxShadow: softCta ? undefined : '0 4px 15px rgba(0,0,0,0.1)',
                    }}
                  >
                    {softCta ? 'See breeders' : 'Buy'}
                  </button>
                )}
                <button onClick={() => handleAction('compare', topBreeds[0])} style={{ flex: '1 1 100px', padding: '12px', background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '50px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Poppins', sans-serif", backdropFilter: 'blur(5px)' }}>Compare</button>
                <button onClick={() => handleAction('full_profile', topBreeds[0])} style={{ flex: '1 1 100px', padding: '12px', background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '50px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Poppins', sans-serif", backdropFilter: 'blur(5px)' }}>Full Profile</button>
              </div>
            </div>
          </div>
        )}

        <div className="breeds-grid">
          {topBreeds.slice(1).map((breed, index) => (
            <BreedCard 
              key={breed.id || breed.name} 
              breed={breed} 
              rank={index + 2} 
              reason={generateReason(breed)}
              hideBuyButton={!canConnect}
              onBuy={(b) => handleAction('buy', b)}
              onCompare={(b) => handleAction('compare', b)}
              onFullProfile={(b) => handleAction('full_profile', b)}
              onImageClick={(b) => handleAction('image_preview', b)}
            />
          ))}
        </div>
        {/* Cool and cold leads get something to take away instead of a hard
            sell. Hot and warm don't need it — they have the breeder list. */}
        {(prepCapture || readiness.code === 'researching') && (
          <PrepPanel
            readinessCode={readiness.code}
            topBreed={topBreeds[0]?.name}
            onSubmitEmail={(email) => {
              track('prep_guide_requested', { email, readiness_code: readiness.code, top_breed: topBreeds[0]?.name });
              saveProgress({ email });
            }}
          />
        )}

        <div id="end-of-recommendations" style={{ height: '1px' }}></div>

        <div id="retake-quiz-section" style={{ marginTop: '40px', textAlign: 'center', padding: 'clamp(22px, 4vw, 30px)', background: '#fff9f5', borderRadius: '20px', border: '2px dashed var(--orange)', opacity: 0.9 }}>
          <h3 style={{ color: 'var(--brown)', marginBottom: '10px', fontSize: '24px' }}>Not quite sure? Or wanna try again for fun? 🐾</h3>
          <p style={{ color: 'var(--text-soft)', marginBottom: '20px', fontSize: '16px' }}>There's no rush in finding your perfect furry friend. Take all the time you need!</p>
          <button onClick={handleRetakeQuiz} style={{ padding: '11px 26px', background: 'var(--orange)', color: 'white', border: 'none', borderRadius: '50px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px', boxShadow: '0 4px 15px rgba(255,107,43,0.3)' }}>Let's Retake the Quiz</button>
        </div>

        <div style={{ marginTop: '50px', background: 'var(--cream)', padding: '30px', borderRadius: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
          <h3 style={{ color: 'var(--brown)', marginBottom: '10px' }}>Have a breed in mind?</h3>
          <p style={{ color: 'var(--text-soft)', fontSize: '14px', marginBottom: '20px' }}>Type any breed name and we'll tell you the pros & cons based on YOUR specific lifestyle answers</p>
          <div style={{ display: 'flex', gap: '10px', position: 'relative', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px', position: 'relative' }}>
              <input 
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="husky" 
                style={{ width: '100%', padding: '15px', borderRadius: '50px', border: '1px solid #ddd', fontFamily: "'Poppins', sans-serif" }} 
              />
              {searchQuery.trim().length > 0 && modalType !== 'compare' && (
                <div style={{ position: 'absolute', top: '100%', left: 0, width: '100%', background: 'white', border: '1px solid #ddd', borderRadius: '10px', maxHeight: '200px', overflowY: 'auto', zIndex: 10, marginTop: '5px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
                  {breedsData.filter(b => b.name.toLowerCase().includes(searchQuery.trim().toLowerCase())).map(b => (
                    <div 
                      key={b.name} 
                      onClick={() => { setSearchQuery(''); handleAction('searched_profile', b); }} 
                      style={{ padding: '12px', cursor: 'pointer', borderBottom: '1px solid #eee', transition: 'background 0.2s' }}
                      onMouseOver={e => e.currentTarget.style.background = '#f9f9f9'}
                      onMouseOut={e => e.currentTarget.style.background = 'white'}
                    >
                      <img src={`/${b.img}`} alt={b.name} style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover', verticalAlign: 'middle', marginRight: '10px' }} />
                      {b.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => {
              const val = searchQuery.trim().toLowerCase();
              const b = breedsData.find(x => x.name.toLowerCase().includes(val));
              if (b) { handleAction('searched_profile', b); setSearchQuery(''); }
              else { alert('Breed not found. Try the suggestions dropdown.'); }
            }} style={{ padding: '15px 30px', background: 'var(--orange)', color: 'white', border: 'none', borderRadius: '50px', cursor: 'pointer', fontWeight: 'bold', flex: '1 1 150px' }}>Check This Breed</button>
          </div>
        </div>

        <div style={{ marginTop: '30px', textAlign: 'center', background: 'white', padding: '40px', borderRadius: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
          <h3 style={{ color: 'var(--brown)', marginBottom: '10px' }}>Share your results</h3>
          <p style={{ color: 'var(--text-soft)', fontSize: '14px', marginBottom: '20px' }}>Let your friends know what breed suits you!</p>
          <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '30px' }}>
            {navigator.share && (
              <button onClick={shareNative} style={{ padding: '12px 24px', background: '#3B82F6', color: 'white', border: 'none', borderRadius: '50px', cursor: 'pointer', fontWeight: 'bold' }}>Share Results</button>
            )}
            <button onClick={shareWhatsApp} style={{ padding: '12px 24px', background: '#25D366', color: 'white', border: 'none', borderRadius: '50px', cursor: 'pointer', fontWeight: 'bold' }}>Share on WhatsApp</button>
            <button onClick={downloadTopMatchImage} style={{ padding: '12px 24px', background: 'var(--orange)', color: 'white', border: 'none', borderRadius: '50px', cursor: 'pointer', fontWeight: 'bold' }}>Download as Image</button>
            <button onClick={() => setShowFeedback(true)} style={{ padding: '12px 24px', background: 'transparent', color: 'var(--orange)', border: '1px solid var(--orange)', borderRadius: '50px', cursor: 'pointer', fontWeight: 'bold' }}>Share Feedback</button>
            <button onClick={handleRetakeQuiz} style={{ padding: '12px 24px', background: '#D32F2F', color: 'white', border: 'none', borderRadius: '50px', cursor: 'pointer', fontWeight: 'bold' }}>Retake Quiz</button>
          </div>
          <div style={{ background: '#fff9f5', padding: '20px', borderRadius: '15px', display: 'inline-block', width: '100%', maxWidth: '500px' }}>
            <h4 style={{ color: 'var(--brown)', marginBottom: '15px', fontSize: '18px' }}>Contact Me</h4>
            <p style={{ margin: '5px 0', color: 'var(--text-color)' }}><strong style={{ color: 'var(--orange)' }}>Phone:</strong> +91 7358444850</p>
            <p style={{ margin: '5px 0', color: 'var(--text-color)' }}><strong style={{ color: 'var(--orange)' }}>Email:</strong> pawbuddy.br@gmail.com</p>
          </div>
        </div>

      </div>

      {/* Modals */}
      {modalType && (
        <div onClick={closeAction} style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, fontFamily: "'Poppins', sans-serif", padding: '20px' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: modalType === 'image_preview' ? 'transparent' : 'white', padding: modalType === 'image_preview' ? '0' : '30px', borderRadius: '20px', width: '100%', maxWidth: modalType === 'compare' ? '900px' : (modalType === 'full_profile' ? '800px' : (modalType === 'buy' ? '900px' : '500px')), maxHeight: '90dvh', overflowY: 'auto', position: 'relative' }}>
            <button onClick={closeAction} style={{ position: 'absolute', top: modalType === 'image_preview' ? '-40px' : '20px', right: modalType === 'image_preview' ? '0' : '20px', background: 'var(--cream)', border: 'none', borderRadius: '50%', width: '35px', height: '35px', fontSize: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>×</button>
            
            {modalType === 'image_preview' && selectedBreed && (
              <div style={{ textAlign: 'center', background: 'white', padding: '20px', borderRadius: '15px' }}>
                <img src={`/${selectedBreed.img}`} alt={selectedBreed.name} style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: '10px' }} />
                <h3 style={{ marginTop: '15px', color: 'var(--brown)', fontSize: '24px' }}>{selectedBreed.name}</h3>
              </div>
            )}
            
            {modalType === 'buy' && selectedBreed && (
              <BreederDirectory
                userCity={quizCity}
                breedName={selectedBreed.name}
                topBreeds={topBreeds.map((b) => b.name)}
                onContact={logBreederContact}
              />
            )}

            {modalType === 'buy_success' && (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <div style={{ fontSize: '50px', marginBottom: '10px' }}>💬</div>
                <h3 style={{ color: 'var(--orange)', marginBottom: '15px' }}>We've opened WhatsApp for you!</h3>
                <p style={{ color: 'var(--text-soft)' }}>Just hit send on the chat to reach us. If WhatsApp didn't open, use the button below or message us at {WHATSAPP_DISPLAY}.</p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '20px' }}>
                  {waLink && (
                    <a href={waLink} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                      <WhatsAppButton type="button" style={{ padding: '12px 24px' }}>Open WhatsApp</WhatsAppButton>
                    </a>
                  )}
                  <button onClick={closeAction} style={{ padding: '12px 30px', background: 'var(--cream)', color: 'var(--brown)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '50px', cursor: 'pointer', fontWeight: 'bold' }}>Close</button>
                </div>
              </div>
            )}

            {(modalType === 'full_profile' || modalType === 'searched_profile') && selectedBreed && (
              <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 250px' }}>
                  <img src={`/${selectedBreed.img}`} alt={selectedBreed.name} style={{ width: '100%', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }} />
                  <div style={{ marginTop: '20px', padding: '15px', background: 'var(--cream)', borderRadius: '15px' }}>
                    <h4 style={{ margin: '0 0 10px 0', color: 'var(--orange)' }}>Quick Stats</h4>
                    <p style={{ margin: '5px 0', fontSize: '14px' }}><strong style={{color: 'var(--brown)'}}>Size:</strong> {selectedBreed.size}</p>
                    <p style={{ margin: '5px 0', fontSize: '14px' }}><strong style={{color: 'var(--brown)'}}>Shedding:</strong> {selectedBreed.shedding}</p>
                    <p style={{ margin: '5px 0', fontSize: '14px' }}><strong style={{color: 'var(--brown)'}}>Energy:</strong> {selectedBreed.energy}</p>
                    <p style={{ margin: '5px 0', fontSize: '14px' }}><strong style={{color: 'var(--brown)'}}>Apartment Friendly:</strong> {selectedBreed.apt}</p>
                  </div>
                  <div style={{ marginTop: '15px', padding: '15px', background: '#ffebee', borderRadius: '15px' }}>
                 <h4 style={{ margin: '0 0 10px 0', color: '#c62828' }}>Monthly Cost Estimate</h4>
                 <div style={{ margin: 0, color: '#c62828', fontSize: '14px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                   {(() => {
                     const costStr = selectedBreed.cost;
                     const breakdownMatch = costStr.match(/\[Breakdown:\s*(.*?)\]/i);
                     const mainCostMatch = costStr.split('[')[0];
                     const sourceMatch = costStr.match(/\]\s*(Source:.*)/i);

                     const mainCost = mainCostMatch ? mainCostMatch.replace(/\/month/gi, '').trim() : costStr;
                     const breakdownItems = breakdownMatch ? breakdownMatch[1].split('|').map(s => s.trim()) : [];
                     const source = sourceMatch ? sourceMatch[1].replace(/\/month/gi, '').trim() : '';

                     if (breakdownItems.length === 0) {
                       return <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{costStr}</div>;
                     }

                     return (
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                         <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '5px', textAlign: 'center', background: 'rgba(198, 40, 40, 0.1)', padding: '10px', borderRadius: '10px' }}>
                           {mainCost} <span style={{ fontSize: '12px', fontWeight: 'normal' }}>/ month</span>
                         </div>
                         
                         {breakdownItems.map((item, i) => {
                           const parts = item.split(/(?=Rs\.)/i);
                           const label = parts[0]?.trim();
                           const val = parts.slice(1).join('').trim();
                           return (
                             <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', borderBottom: '1px solid rgba(198, 40, 40, 0.1)', paddingBottom: '4px' }}>
                               <span style={{ fontWeight: 600 }}>{label}</span>
                               <span>{val}</span>
                             </div>
                           );
                         })}
                       </div>
                     );
                   })()}
                 </div>
                  </div>
                </div>
                <div style={{ flex: '2 1 300px' }}>
                  <h3 style={{ color: 'var(--brown)', marginBottom: '5px', fontSize: '28px' }}>{selectedBreed.name}</h3>
                  <p style={{ color: 'var(--text-soft)', marginBottom: '20px', fontStyle: 'italic' }}>{selectedBreed.purpose}</p>

                  {modalType === 'searched_profile' && (
                    <div style={{ marginBottom: '25px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div className="pros" style={{ background: '#f0fdf4', padding: '15px', borderRadius: '12px' }}>
                        <h5 style={{ color: '#27AE60', fontWeight: 700, marginBottom: '10px', fontSize: '14px', marginTop: 0 }}>Pros</h5>
                        <ul style={{ listStyle: 'none', paddingLeft: 0, margin: 0 }}>
                          {generateProsCons(selectedBreed).pros.map((pro, i) => (
                            <li key={i} style={{ fontSize: '13px', marginBottom: '6px', lineHeight: 1.5, color: 'var(--text-color)' }}>
                              <span style={{ color: '#27AE60', fontWeight: 700, marginRight: '5px' }}>✓</span>{pro}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="cons" style={{ background: '#fef2f2', padding: '15px', borderRadius: '12px' }}>
                        <h5 style={{ color: 'var(--red)', fontWeight: 700, marginBottom: '10px', fontSize: '14px', marginTop: 0 }}>Cons</h5>
                        <ul style={{ listStyle: 'none', paddingLeft: 0, margin: 0 }}>
                          {generateProsCons(selectedBreed).cons.map((con, i) => (
                            <li key={i} style={{ fontSize: '13px', marginBottom: '6px', lineHeight: 1.5, color: 'var(--text-color)' }}>
                              <span style={{ color: 'var(--red)', fontWeight: 700, marginRight: '5px' }}>✕</span>{con}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                  
                  <div style={{ marginBottom: '25px' }}>
                    <h4 style={{ color: 'var(--orange)', marginBottom: '15px', fontSize: '18px' }}>Best Living Conditions</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {buildLivingConditions(selectedBreed).map((cond, i) => (
                        <div key={i} style={{ background: '#f8f9fa', padding: '12px 15px', borderRadius: '10px', fontSize: '14px' }}>
                          <strong style={{ color: 'var(--brown)' }}>{cond.label}:</strong> {cond.text}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                    <div style={{ background: 'var(--cream)', padding: '15px', borderRadius: '15px' }}>
                      <h4 style={{ color: 'var(--orange)', marginBottom: '8px' }}>Ideal Indian Cities</h4>
                      <p style={{ fontSize: '14px', margin: 0, color: 'var(--text-soft)' }}>{selectedBreed.idealCities}</p>
                    </div>
                    <div style={{ background: 'var(--cream)', padding: '15px', borderRadius: '15px' }}>
                      <h4 style={{ color: 'var(--orange)', marginBottom: '8px' }}>Common Health Issues</h4>
                      <p style={{ fontSize: '14px', margin: 0, color: 'var(--text-soft)' }}>{selectedBreed.health}</p>
                    </div>
                  </div>
                  {canConnect && (
                    <div style={{ marginTop: '20px' }}>
                      <button
                        onClick={() => handleAction('buy', selectedBreed)}
                        style={{ padding: '12px 24px', background: 'var(--orange)', color: 'white', border: 'none', borderRadius: '50px', fontWeight: 800, cursor: 'pointer', fontFamily: "'Poppins', sans-serif", width: '100%', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}
                      >
                        {softCta ? 'See breeders for this breed' : 'Request to Buy'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {modalType === 'compare' && (
              <div>
                <h3 style={{ marginBottom: '10px', color: 'var(--orange)' }}>Compare Breeds</h3>
                <p style={{ marginBottom: '20px', color: 'var(--text-soft)', fontSize: '14px' }}>See how these breeds stack up across different parameters.</p>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', position: 'relative', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 200px', position: 'relative' }}>
                    <input 
                      value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Add a breed to compare... (e.g. Beagle)" 
                      style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ddd', fontFamily: "'Poppins', sans-serif" }} 
                    />
                    {searchQuery.trim().length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, width: '100%', background: 'white', border: '1px solid #ddd', borderRadius: '10px', maxHeight: '200px', overflowY: 'auto', zIndex: 10, marginTop: '5px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
                        {breedsData.filter(b => b.name.toLowerCase().includes(searchQuery.trim().toLowerCase())).map(b => (
                          <div 
                            key={b.name} 
                            onClick={() => {
                              if (!compareList.find(c => c.name === b.name)) {
                                setCompareList([...compareList, b]);
                              } else {
                                alert('Already in comparison.');
                              }
                              setSearchQuery('');
                            }} 
                            style={{ padding: '12px', cursor: 'pointer', borderBottom: '1px solid #eee', transition: 'background 0.2s' }}
                            onMouseOver={e => e.currentTarget.style.background = '#f9f9f9'}
                            onMouseOut={e => e.currentTarget.style.background = 'white'}
                          >
                            <img src={`/${b.img}`} alt={b.name} style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover', verticalAlign: 'middle', marginRight: '10px' }} />
                            {b.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={addBreedToCompare} style={{ padding: '10px 24px', background: 'var(--orange)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', flex: '0 1 auto', whiteSpace: 'nowrap' }}>Add to Compare</button>
                </div>
                <div ref={compareRef} style={{ overflowX: 'auto', background: 'var(--cream)', borderRadius: '15px', padding: '15px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', tableLayout: 'fixed', wordWrap: 'break-word', minWidth: '320px' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '35%', padding: '10px 5px', borderBottom: '2px solid rgba(0,0,0,0.1)' }}>Feature</th>
                        {compareList.map(b => (
                          <th key={b.name} style={{ width: `${65 / Math.max(1, compareList.length)}%`, padding: '10px 5px', borderBottom: '2px solid rgba(0,0,0,0.1)', textAlign: 'center' }}>
                            <img src={`/${b.img}`} alt={b.name} style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover', marginBottom: '5px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }} />
                            <div style={{ color: 'var(--brown)', fontSize: '13px' }}>{b.name}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ['Size', 'size'], ['Hair Length', 'hair'], ['Shedding', 'shedding'], ['Grooming', 'grooming'],
                        ['Energy Level', 'energy'], ['Climate Suitability', 'climate'], ['Apartment Friendly', 'apt'],
                        ['House Needed', 'house'], ['Monthly Cost', 'cost'], ['Family Risk', 'risk'],
                        ['Daily Time', 'time'], ['Ideal Cities', 'idealCities'], ['Common Health Issues', 'health']
                      ].map(([label, key]) => (
                        <tr key={key}>
                          <td style={{ padding: '12px 10px', borderBottom: '1px solid rgba(0,0,0,0.05)', fontWeight: 'bold', fontSize: '12px', textTransform: 'uppercase', color: 'var(--orange)' }}>{label}</td>
                          {compareList.map(b => (
                            <td key={b.name} style={{ padding: '12px 10px', borderBottom: '1px solid rgba(0,0,0,0.05)', fontSize: '13px', textAlign: 'center', color: 'var(--text-color)' }}>{b[key] || '-'}</td>
                          ))}
                        </tr>
                      ))}
                      <tr>
                        <td style={{ padding: '12px 10px', borderBottom: '1px solid rgba(0,0,0,0.05)', fontWeight: 'bold', fontSize: '12px', textTransform: 'uppercase', color: 'var(--orange)' }}>Best Living Conditions</td>
                        {compareList.map(b => (
                           <td key={b.name} style={{ padding: '12px 10px', borderBottom: '1px solid rgba(0,0,0,0.05)', fontSize: '13px', textAlign: 'left', color: 'var(--text-color)', verticalAlign: 'top' }}>
                             <ul style={{ margin: 0, paddingLeft: '15px' }}>
                               {buildLivingConditions(b).map((cond, i) => (
                                 <li key={i} style={{ marginBottom: '6px' }}><strong style={{ color: 'var(--brown)' }}>{cond.label}:</strong> {cond.text}</li>
                               ))}
                             </ul>
                           </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: '20px', textAlign: 'center' }}>
                  <button onClick={downloadPDF} style={{ padding: '12px 24px', background: 'var(--brown)', color: 'white', border: 'none', borderRadius: '50px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>Save to PDF</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showFab && (
        <button
          className="fab-retake"
          onClick={() => {
            const el = document.getElementById('retake-quiz-section');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
          aria-label="Retake Quiz"
        >
          🐾 Retake Quiz
        </button>
      )}

      <FeedbackModal isOpen={showFeedback} onClose={() => setShowFeedback(false)} user={user} />
    </section>
  );
};

export default Results;
