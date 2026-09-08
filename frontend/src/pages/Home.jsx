import React, { useContext, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthContext } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

// Existing Components
import LoadingScreen from '../components/home/LoadingScreen';
import HeroSection from '../components/home/HeroSection';
import TrustSection from '../components/home/TrustSection';
import HowItWorks from '../components/home/HowItWorks';
import FeaturedPuppies from '../components/home/FeaturedPuppies';
import SuccessStories from '../components/home/SuccessStories';
import CommunitySection from '../components/home/CommunitySection';
import QuizCTA from '../components/home/QuizCTA';
import PawBuddyMascot from '../components/home/PawBuddyMascot';
import Reveal from '../components/home/Reveal';

// New Revamped Components
import AuthModal from '../components/AuthModal';
import BreedSlider from '../components/BreedSlider';
import BreedProfileModal from '../components/BreedProfileModal';
import BreedModal from '../components/BreedModal';
import RecommendationResults from '../components/RecommendationResults';
import AboutModal from '../components/AboutModal';
import { getOwnerId, listDogs } from '../utils/dogs';
import CitySelect from '../components/CitySelect';

// Constants & Utilities
import { useBreeds } from '../context/BreedsContext';
import questionsData from '../constants/questions.json';
import { computeMatches } from '../utils/breedUtils';
import { parsePrompt } from '../utils/matchmaker';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const Home = () => {
  /* No `loading` here on purpose — `breeds` is never empty, so this page has
     nothing to wait for. See BreedsProvider. */
  const { breeds: breedsData } = useBreeds();
  const { user, logout, loading: authLoading } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  // Workflow State Management
  const [subView, setSubView] = useState('hero'); // 'hero', 'friend_dashboard', 'breed_slider'
  const [sliderBreeds, setSliderBreeds] = useState([]); // Breeds to display in the BreedSlider
  const [dashboardTab, setDashboardTab] = useState('menu'); // 'menu', 'inline_quiz', 'ai_matchmaker'

  // Auth modal gate state
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [pendingTab, setPendingTab] = useState('menu'); // dashboard tab to open after login

  // Inline Quiz State
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');

  // AI Matchmaker State
  const [matchmakerPrompt, setMatchmakerPrompt] = useState('');

  // Results context: Top-5 personalisation
  const [resultsAnswers, setResultsAnswers] = useState(null);
  const [resultsSource, setResultsSource] = useState(null); // 'quiz' | 'ai' | null (explore)
  const [profileBreed, setProfileBreed] = useState(null);
  const [profileView, setProfileView] = useState('profile'); // 'profile' | 'buy'
  const [compareBreed, setCompareBreed] = useState(null); // seeds the Compare overlay

  // Lock scroll on the single-screen views; let the hero and the Top-5 grid scroll.
  useEffect(() => {
    const lock = isLoading || subView === 'friend_dashboard' || subView === 'breed_slider';
    document.body.style.overflow = lock ? 'hidden' : 'auto';
    return () => { document.body.style.overflow = 'auto'; };
  }, [isLoading, subView]);

  const toggleDropdown = () => setDropdownOpen(!dropdownOpen);

  const handleLogout = () => {
    logout();
    setDropdownOpen(false);
  };

  // No auth gate up front — users explore freely and sign in after the Top 5.
  const openDashboard = (tab = 'menu') => {
    setSubView('friend_dashboard');
    setDashboardTab(tab);
    if (tab === 'inline_quiz') {
      setCurrentQIndex(0);
      setQuizAnswers({});
    }
  };

  const handleFriendPathClick = (tab = 'menu') => {
    openDashboard(typeof tab === 'string' ? tab : 'menu');
  };

  /* "Already a dog owner?" — the intake survey is for people arriving for the
     first time. Somebody who already has a dog on file is coming back for
     their health records, and putting eight questions between them and those
     records every visit would be the wrong trade. Asked once, not every time. */
  const handleDogOwnerClick = async () => {
    try {
      const existing = await listDogs(getOwnerId());
      navigate(existing.length > 0 ? '/app' : '/owner-survey');
    } catch {
      // Can't tell either way — send them to the dashboard, which knows how to
      // handle both cases on its own.
      navigate('/app');
    }
  };

  const handleAuthSuccess = () => {
    setIsAuthModalOpen(false);
    // Signed in from the post-results login prompt — keep them on their Top 5.
    if (subView === 'results') return;
    openDashboard(pendingTab);
    setPendingTab('menu');
  };

  // Deep link: /?ai=1 lands on the AI Matchmaker (used by the Results page)
  useEffect(() => {
    if (authLoading) return;
    const params = new URLSearchParams(location.search);
    if (params.get('ai') === '1') {
      navigate('/', { replace: true });
      handleFriendPathClick('ai_matchmaker');
    }
  }, [authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Explore path: full database in the premium slider (no match scoring, no gate)
  const openExploreSlider = () => {
    setResultsAnswers(null);
    setResultsSource(null);
    setSliderBreeds(breedsData);
    setSubView('breed_slider');
  };

  // Inline Quiz Handler
  const handleQuizAnswer = (qId, val) => {
    // "I already love a specific breed." aborts the quiz and opens Explore
    if (qId === 'purpose' && val === 'breed') {
      openExploreSlider();
      return;
    }

    setQuizAnswers(prev => {
      const currentAns = prev[qId] || [];
      const qConfig = questionsData.find(x => x.id === qId);

      if (qConfig && qConfig.multi === false) {
        return { ...prev, [qId]: currentAns.includes(val) ? [] : [val] };
      }

      const newAns = currentAns.includes(val)
        ? currentAns.filter(a => a !== val)
        : [...currentAns, val];
      return { ...prev, [qId]: newAns };
    });
  };

  const presentResults = (answers, source, top5) => {
    setResultsAnswers(answers);
    setResultsSource(source);
    setSliderBreeds(top5);
    setSubView('results');
  };

  // Login removed from the site — the auth code stays intact but is no longer
  // surfaced. (The 10s login pop-up on results has been disabled.)

  const submitInlineQuiz = async () => {
    setIsProcessing(true);
    setProcessingMessage('Analyzing your lifestyle answers...');

    // Premium processing animation beat before results reveal
    setTimeout(() => {
      try {
        const scoredBreeds = computeMatches(quizAnswers, breedsData);
        const top5 = scoredBreeds.slice(0, 5);

        // Save to DB (asynchronously)
        axios.post(`${API_URL}/api/quiz/submit`, {
          user_id: user?.id || null,
          answers: quizAnswers,
          top_breeds: top5.map(b => b.name)
        }).catch(err => console.error("Error saving quiz:", err));

        setIsProcessing(false);
        presentResults(quizAnswers, 'quiz', top5);
      } catch (error) {
        console.error(error);
        setIsProcessing(false);
      }
    }, 2000);
  };

  // Conversational AI Matchmaker: Claude parses the prompt into the same 9
  // structured answers as the quiz, then the RIGHTBREED engine scores breeds.
  const handleMatchmakerSubmit = async (e) => {
    e.preventDefault();
    if (!matchmakerPrompt.trim()) return;

    setIsProcessing(true);
    setProcessingMessage('AI Matchmaker reading your prompt...');

    const minDelay = new Promise(resolve => setTimeout(resolve, 1800));
    try {
      const [{ answers }] = await Promise.all([parsePrompt(matchmakerPrompt), minDelay]);
      const scoredBreeds = computeMatches(answers, breedsData);
      const top5 = scoredBreeds.slice(0, 5);

      // Save to DB (asynchronously)
      axios.post(`${API_URL}/api/quiz/submit`, {
        user_id: user?.id || null,
        answers: { ...answers, _prompt: matchmakerPrompt },
        top_breeds: top5.map(b => b.name)
      }).catch(err => console.error("Error saving matchmaker run:", err));

      presentResults(answers, 'ai', top5);
    } catch (error) {
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBuy = (breed) => {
    // "Buy" jumps straight to the verified breeder network for this breed.
    setProfileBreed(breed);
    setProfileView('buy');
  };

  return (
    <>
      <AnimatePresence>
        {isLoading && <LoadingScreen onComplete={() => setIsLoading(false)} />}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isLoading ? 0 : 1 }}
        transition={{ duration: 0.8 }}
        style={{ position: 'relative', background: 'var(--cream)', minHeight: '100dvh' }}
      >
        {/* Navigation / Header */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'clamp(10px, 2.5vw, 18px) clamp(14px, 3vw, 24px)', pointerEvents: 'none' }}>
          <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center' }}>
            <img src="/logo.png" alt="Paw Buddy" style={{ width: 'clamp(90px, 8vw, 115px)', mixBlendMode: 'multiply', cursor: 'pointer' }} onClick={() => { setSubView('hero'); }} />
          </div>
          
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center', pointerEvents: 'auto' }}>
            <button
              onClick={() => setIsAboutOpen(true)}
              className="about-nav-btn"
            >
              About
            </button>
            {user ? (
              <div style={{ position: 'relative' }}>
                <div 
                  className="user-avatar hover-lift" 
                  onClick={toggleDropdown}
                  style={{
                    width: '45px', height: '45px', borderRadius: '50%', background: 'var(--white)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--orange)',
                    fontWeight: 700, fontSize: '20px', cursor: 'pointer', border: '2px solid rgba(109,76,65,0.1)',
                    boxShadow: 'var(--shadow)'
                  }}
                >
                  {user.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                
                <AnimatePresence>
                  {dropdownOpen && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      style={{
                        position: 'absolute', top: '60px', right: '0', background: 'white', 
                        borderRadius: '15px', padding: '10px 0', minWidth: '180px',
                        boxShadow: 'var(--shadow-lg)', zIndex: 100, fontFamily: 'var(--font-body-family)'
                      }}
                    >
                      <div style={{ padding: '10px 20px', borderBottom: '1px solid rgba(0,0,0,0.05)', marginBottom: '5px' }}>
                        <strong style={{ color: 'var(--brown)' }}>{user.name}</strong><br/>
                        <span style={{ fontSize: '12px', color: 'var(--text-soft)' }}>{user.email || user.mobile}</span>
                      </div>
                      <div onClick={() => { setDropdownOpen(false); navigate('/profile'); }} style={{ padding: '10px 20px', cursor: 'pointer', color: 'var(--text-color)', transition: 'background 0.2s', fontWeight: 500 }} onMouseOver={e => e.currentTarget.style.background = 'rgba(0,0,0,0.02)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>👤 Profile</div>
                      {user.role === 'ADMIN' && (
                        <div onClick={() => { setDropdownOpen(false); navigate('/admin'); }} style={{ padding: '10px 20px', cursor: 'pointer', color: 'var(--text-color)', transition: 'background 0.2s', fontWeight: 500 }} onMouseOver={e => e.currentTarget.style.background = 'rgba(0,0,0,0.02)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>🛡️ Admin Dashboard</div>
                      )}
                      <div onClick={handleLogout} style={{ padding: '10px 20px', cursor: 'pointer', color: 'var(--red)', transition: 'background 0.2s', borderTop: '1px solid rgba(0,0,0,0.05)', marginTop: '5px', fontWeight: 600 }} onMouseOver={e => e.currentTarget.style.background = 'rgba(255,0,0,0.05)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>🚪 Logout</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              /* Login removed from the site — Sign In / Sign Up buttons hidden.
                 The auth code is preserved; only the entry points are gone. */
              null
            )}
          </div>
        </div>

        {/* WORKFLOW VIEW OR HERO SECTIONS */}
        <AnimatePresence mode="wait">
          {subView === 'hero' && (
            <motion.div
              key="hero-workflow"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            >
              <HeroSection
                onSelectFriendPath={() => handleFriendPathClick('menu')}
                /* Existing owners go straight to the product area: dashboard,
                   dog profiles and Health Records all live under /app now. */
                onDogOwner={handleDogOwnerClick}
              />
              <Reveal><HowItWorks /></Reveal>
              <Reveal><TrustSection /></Reveal>
              <Reveal><FeaturedPuppies user={user} /></Reveal>
              <Reveal><SuccessStories /></Reveal>
              <Reveal><CommunitySection /></Reveal>
              <Reveal><QuizCTA user={user} /></Reveal>
            </motion.div>
          )}

          {subView === 'friend_dashboard' && (
            <motion.div
              key="friend-dashboard-workflow"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.5 }}
              style={{ paddingTop: '100px', minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '100px 20px 40px' }}
            >
              <div style={{ maxWidth: '650px', width: '100%', background: 'white', borderRadius: '24px', padding: 'clamp(20px, 5vw, 40px)', boxShadow: 'var(--shadow-lg)', position: 'relative' }}>
                <button 
                  onClick={() => setSubView('hero')}
                  aria-label="Close"
                  style={{
                    position: 'absolute', top: '16px', right: '16px',
                    background: 'none', border: 'none', fontSize: '28px',
                    cursor: 'pointer', color: 'var(--text-soft)', fontWeight: 'bold',
                    zIndex: 10, lineHeight: 1, width: '36px', height: '36px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: '50%',
                  }}
                >
                  &times;
                </button>

                {isProcessing ? (
                  <div style={{ textAlign: 'center', padding: '40px 10px' }}>
                    <div className="loader-paw" style={{ fontSize: '50px', marginBottom: '20px', animation: 'spin 1.5s infinite linear' }}>🐾</div>
                    <h3 style={{ fontFamily: "'Fredoka', sans-serif", color: 'var(--brown)', fontSize: '22px', marginBottom: '10px' }}>
                      Please Wait
                    </h3>
                    <p style={{ color: 'var(--orange)', fontWeight: 'bold' }}>{processingMessage}</p>
                  </div>
                ) : (
                  <>
                    {dashboardTab === 'menu' && (
                      <div>
                        <h2 style={{ fontFamily: "'Fredoka', sans-serif", color: 'var(--brown)', fontSize: '28px', textAlign: 'center', marginBottom: '10px', paddingRight: '36px' }}>
                          🐶 Choose Your Journey
                        </h2>
                        <p style={{ color: 'var(--text-soft)', textAlign: 'center', fontSize: '15px', marginBottom: '35px' }}>
                          Let's help you discover your future furry best friend!
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                          {/* Option 1: Quiz */}
                          <div 
                            onClick={() => { setDashboardTab('inline_quiz'); setCurrentQIndex(0); setQuizAnswers({}); }}
                            className="hover-lift journey-card"
                            style={{
                              background: '#FCFAF7', border: '1px solid #EAE4DE', borderRadius: '18px',
                              padding: '20px 25px', cursor: 'pointer', transition: 'all 0.3s',
                              display: 'flex', alignItems: 'center', gap: '20px'
                            }}
                          >
                            <span style={{ fontSize: '32px' }}>📝</span>
                            <div>
                              <strong style={{ color: 'var(--brown)', fontSize: '16px', display: 'block', marginBottom: '2px', fontFamily: 'var(--font-display)' }}>
                                Find your recommended breed
                              </strong>
                              <span style={{ color: 'var(--text-soft)', fontSize: '13px' }}>
                                Via a small lifestyle quiz
                              </span>
                            </div>
                          </div>

                          {/* Option 2: Explore — "Already a dog owner?" now lives on
                              the hero, beside the main CTA, so this slot keeps the
                              breed matrix reachable from inside the dashboard too. */}
                          <div
                            onClick={openExploreSlider}
                            className="hover-lift journey-card"
                            style={{
                              background: '#FCFAF7', border: '1px solid #EAE4DE', borderRadius: '18px',
                              padding: '20px 25px', cursor: 'pointer', transition: 'all 0.3s',
                              display: 'flex', alignItems: 'center', gap: '20px'
                            }}
                          >
                            <span style={{ fontSize: '32px' }}>🔍</span>
                            <div>
                              <strong style={{ color: 'var(--brown)', fontSize: '16px', display: 'block', marginBottom: '2px', fontFamily: 'var(--font-display)' }}>
                                Explore breeds
                              </strong>
                              <span style={{ color: 'var(--text-soft)', fontSize: '13px' }}>
                                Browse the complete breed matrix with high-fidelity visuals
                              </span>
                            </div>
                          </div>

                          {/* AI Matchmaker removed from the menu — the view code stays
                              intact but is no longer reachable from here. */}
                        </div>
                      </div>
                    )}

                    {dashboardTab === 'inline_quiz' && (
                      <div>
                        {/* Inline Quiz Question */}
                        {(() => {
                          const q = questionsData[currentQIndex];
                          const pct = Math.round(((currentQIndex + 1) / questionsData.length) * 100);
                          const currentAnswers = quizAnswers[q?.id] || [];

                          if (!q) return null;

                          return (
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                <button 
                                  onClick={() => setDashboardTab('menu')}
                                  style={{ background: 'none', border: 'none', color: 'var(--orange)', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
                                >
                                  ← Cancel Quiz
                                </button>
                                <span style={{ fontSize: '12px', color: 'var(--text-soft)', fontWeight: 600 }}>
                                  Question {currentQIndex + 1} of {questionsData.length} ({pct}%)
                                </span>
                              </div>

                              <div style={{ background: 'var(--orange-pale)', height: '5px', borderRadius: '10px', overflow: 'hidden', marginBottom: '25px' }}>
                                <div style={{ background: 'var(--orange)', height: '100%', width: `${pct}%`, transition: 'width 0.3s' }}></div>
                              </div>

                              <h3 style={{ fontFamily: "'Fredoka', sans-serif", color: 'var(--brown)', fontSize: '20px', marginBottom: '20px', lineHeight: '1.4' }}>
                                {q.text}
                              </h3>

                              {q.type === 'city' ? (
                                <div style={{ marginBottom: '25px' }}>
                                  <CitySelect
                                    value={currentAnswers[0] || ''}
                                    placeholder={q.placeholder}
                                    onChange={(val) => setQuizAnswers(prev => ({ ...prev, [q.id]: [val] }))}
                                  />
                                </div>
                              ) : (
                              <div className="options-grid cols-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '25px' }}>
                                {q.options.map(opt => {
                                  const isSelected = currentAnswers.includes(opt.val);
                                  return (
                                    <button 
                                      key={opt.val}
                                      onClick={() => handleQuizAnswer(q.id, opt.val)}
                                      className={`option-btn ${isSelected ? 'selected multi-selected' : ''}`}
                                      style={{
                                        padding: '12px 15px', borderRadius: '12px',
                                        border: isSelected ? '2px solid var(--orange)' : '2px solid #EAE4DE',
                                        background: isSelected ? 'var(--orange-pale)' : 'white',
                                        color: isSelected ? 'var(--orange)' : 'var(--brown)',
                                        cursor: 'pointer', textAlign: 'left',
                                        transition: 'all 0.2s', display: 'flex', gap: '10px', alignItems: 'center'
                                      }}
                                    >
                                      <span style={{ fontSize: '18px' }}>{opt.icon}</span>
                                      <span style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-display)' }}>{opt.label}</span>
                                    </button>
                                  );
                                })}
                              </div>
                              )}

                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <button 
                                  onClick={() => setCurrentQIndex(prev => prev - 1)}
                                  disabled={currentQIndex === 0}
                                  style={{
                                    border: 'none', background: 'none', color: currentQIndex === 0 ? 'var(--text-soft)' : 'var(--brown)',
                                    fontWeight: 'bold', cursor: currentQIndex === 0 ? 'default' : 'pointer', fontSize: '14px'
                                  }}
                                >
                                  ← Back
                                </button>

                                {currentQIndex === questionsData.length - 1 ? (
                                  <button 
                                    onClick={submitInlineQuiz}
                                    disabled={currentAnswers.length === 0}
                                    className="hero-btn"
                                    style={{ padding: '8px 25px', fontSize: '13px', boxShadow: 'none' }}
                                  >
                                    Get Recommendations →
                                  </button>
                                ) : (
                                  <button 
                                    onClick={() => setCurrentQIndex(prev => prev + 1)}
                                    disabled={currentAnswers.length === 0}
                                    className="hero-btn"
                                    style={{ padding: '8px 25px', fontSize: '13px', boxShadow: 'none' }}
                                  >
                                    Next Question →
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {dashboardTab === 'ai_matchmaker' && (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
                          <button 
                            onClick={() => setDashboardTab('menu')}
                            style={{ background: 'none', border: 'none', color: 'var(--orange)', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
                          >
                            ← Back to menu
                          </button>
                        </div>

                        <h3 style={{ fontFamily: "'Fredoka', sans-serif", color: 'var(--brown)', fontSize: '24px', marginBottom: '10px', textAlign: 'center' }}>
                          ✨ AI Matchmaker
                        </h3>
                        <p style={{ color: 'var(--text-soft)', fontSize: '14px', textAlign: 'center', marginBottom: '25px' }}>
                          Tell us about your home, activity levels, or ideal puppy traits in your own words!
                        </p>

                        <form onSubmit={handleMatchmakerSubmit}>
                          <textarea 
                            value={matchmakerPrompt}
                            onChange={(e) => setMatchmakerPrompt(e.target.value)}
                            placeholder="e.g. I live in a small flat in Mumbai. I want a friendly, low shedding small dog that is good with kids..."
                            required
                            style={{
                              width: '100%', minHeight: '120px', padding: '15px', borderRadius: '16px',
                              border: '2px solid #EAE4DE', fontSize: '15px', fontFamily: 'var(--font-body-family)',
                              color: 'var(--brown)', outline: 'none', resize: 'vertical', marginBottom: '20px',
                              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
                            }}
                          />
                          <button 
                            type="submit"
                            className="hero-btn"
                            style={{ width: '100%', padding: '14px', fontSize: '15px', fontWeight: 'bold' }}
                          >
                            Find Matches with AI ✨
                          </button>
                        </form>
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          )}

          {subView === 'results' && (
            <motion.div
              key="results-workflow"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              transition={{ duration: 0.5 }}
              style={{ paddingTop: '92px', paddingBottom: '48px', minHeight: '100dvh' }}
            >
              <RecommendationResults
                breeds={sliderBreeds}
                answers={resultsAnswers}
                user={user}
                onBack={() => openDashboard('menu')}
                onBuy={handleBuy}
                onFullProfile={(breed) => { setProfileBreed(breed); setProfileView('profile'); }}
                onRetake={() => openDashboard('inline_quiz')}
              />
            </motion.div>
          )}

          {/* "Already a dog owner?" now routes to /app — the dashboard, dog
              profiles and Health Records module live there. */}

          {subView === 'breed_slider' && (
            <motion.div
              key="breed-slider-workflow"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.6 }}
              /* Bound to the viewport so the slider fits without page scroll —
                 the action row (Full Profile / Compare / Buy) stays on-screen. */
              style={{ height: '100dvh', paddingTop: '82px', paddingBottom: '14px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            >
              <div className="container" style={{ flex: 1, minHeight: 0, width: '100%', maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
                <BreedSlider
                  breeds={sliderBreeds}
                  answers={resultsAnswers}
                  isResults={false}
                  onClose={() => { setSubView('friend_dashboard'); setDashboardTab('menu'); }}
                  onBuy={handleBuy}
                  onFullProfile={(breed) => { setProfileBreed(breed); setProfileView('profile'); }}
                  onCompare={(breed) => setCompareBreed(breed)}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Auth modal Popup Gate */}
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          onSuccess={handleAuthSuccess}
        />

        {/* Full Profile modal for slider breeds (pros/cons intact) */}
        {profileBreed && (
          <BreedProfileModal
            key={`${profileBreed.name}-${profileView}`}
            breed={profileBreed}
            user={user}
            answers={resultsAnswers}
            topBreeds={sliderBreeds.map((b) => b.name)}
            initialView={profileView}
            onClose={() => { setProfileBreed(null); setProfileView('profile'); }}
          />
        )}

        {/* Compare overlay — reuses the Explore compare view, seeded with the
            breed the user was viewing in the slider. */}
        {compareBreed && (
          <BreedModal
            breed={compareBreed}
            modalType="compare"
            user={user}
            onClose={() => setCompareBreed(null)}
            setModalType={(t) => { if (!t) setCompareBreed(null); }}
          />
        )}

        {/* Friendly mascot — hidden on the results view (Retake FAB lives there) */}
        {!isLoading && subView !== 'results' && <PawBuddyMascot />}

        {/* About PawBuddy modal */}
        <AboutModal
          isOpen={isAboutOpen}
          onClose={() => setIsAboutOpen(false)}
          onTakeQuiz={() => { setIsAboutOpen(false); handleFriendPathClick('inline_quiz'); }}
        />
      </motion.div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .about-nav-btn {
          background: rgba(255,255,255,0.7);
          color: var(--orange);
          border: 1.5px solid rgba(230, 106, 26, 0.55);
          padding: 7px 18px;
          border-radius: 50px;
          cursor: pointer;
          font-family: var(--font-display);
          font-weight: 600;
          font-size: 14px;
          backdrop-filter: blur(4px);
          box-shadow: 0 0 0 0 rgba(230, 106, 26, 0.5);
          animation: aboutPulse 3.4s ease-in-out infinite;
          transition: transform 0.2s ease, background 0.2s ease, color 0.2s ease;
        }
        .about-nav-btn:hover {
          transform: translateY(-1px) scale(1.04);
          background: var(--orange);
          color: #fff;
        }
        @keyframes aboutPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(230, 106, 26, 0.0); }
          50% { box-shadow: 0 0 14px 2px rgba(230, 106, 26, 0.35); }
        }
        @media (prefers-reduced-motion: reduce) {
          .about-nav-btn { animation: none; transition: none; }
        }
      `}</style>
    </>
  );
};

export default Home;
