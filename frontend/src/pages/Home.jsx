import React, { useContext, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthContext } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

// Existing Components
import LoadingScreen from '../components/home/LoadingScreen';
import HeroSection from '../components/home/HeroSection';
import HiDog from '../components/home/HiDog';
import JourneyDog from '../components/home/JourneyDog';
import GoldenCircle from '../components/home/GoldenCircle';
import TrustSection from '../components/home/TrustSection';
import FeaturedPuppies from '../components/home/FeaturedPuppies';
import PlayTeaser from '../components/home/PlayTeaser';
import { ToySlots } from '../components/fun/SqueakyToy';
import { useToyGate } from '../components/fun/ToyContext';
import SuccessStories from '../components/home/SuccessStories';
import CommunitySection from '../components/home/CommunitySection';
import Reveal from '../components/home/Reveal';

// New Revamped Components
import AuthModal from '../components/AuthModal';
import ResultsPulse from '../components/results/ResultsPulse';
import NotUnlockedCard from '../components/paywall/NotUnlockedCard';
import { mayAskNotUnlocked } from '../components/paywall/notUnlocked';
import { AFTER_OVERLAY_MS } from '../config/pulse';
import BreedSlider from '../components/BreedSlider';
import BreedSwipe from '../components/swipe/BreedSwipe';
import { loadSavedAnswers } from '../utils/quizState';
import BreedProfileModal from '../components/BreedProfileModal';
import BreedModal from '../components/BreedModal';
import RecommendationResults from '../components/RecommendationResults';
import AboutModal from '../components/AboutModal';
import { hasBrowserOwnerId, listDogs } from '../utils/dogs';
import CitySelect from '../components/CitySelect';

// Constants & Utilities
import { useBreeds } from '../context/BreedsContext';
import questionsData from '../constants/questions.json';
import QuizFlow from '../components/quiz/QuizFlow';
import RoughRecommendation from '../components/paywall/RoughRecommendation';
import UnlockFlow from '../components/paywall/UnlockFlow';
import usePaywallStatus from '../components/paywall/usePaywallStatus';
import { PAYWALL_AFTER, ROUGH_PAUSE_MS } from '../config/paywall';
import { computeRoughMatches, FREE_SCREEN_COUNT, LAST_FREE_SCREEN_INDEX, TOTAL_SCREENS } from '../utils/roughMatches';
import { freePartCompleted, paywallCtaClicked, unlockContinued } from '../utils/paymentEvents';
import { computeMatches, computeReadiness, selectTopMatches } from '../utils/breedUtils';
import { track, saveProgress } from '../utils/analytics';
import { parsePrompt } from '../utils/matchmaker';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

/* Where this tab remembers the answers behind the current Top 5 (see presentResults). */
const LAST_RESULTS_KEY = 'pb_last_results';

/* "Choose Your Journey" line icons — brown strokes with a single orange accent,
   replacing the old emoji so they match the brand and render the same on every
   device. Decorative only (the card text carries the meaning). */
const JOURNEY_INK = 'var(--brown)';
const JOURNEY_ACCENT = 'var(--orange)';

const JourneyPawIcon = () => (
  <svg width="34" height="34" viewBox="0 0 32 32" fill="none" aria-hidden="true"
    stroke={JOURNEY_ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="7.5" cy="13" rx="2.6" ry="3.4" />
    <ellipse cx="12.5" cy="7" rx="2.7" ry="3.6" />
    <ellipse cx="19.5" cy="7" rx="2.7" ry="3.6" />
    <ellipse cx="24.5" cy="13" rx="2.6" ry="3.4" />
    <path d="M16 15.5c-4 0-7.5 4.2-7.5 7.6 0 2.4 1.9 3.6 4 3.6 1.5 0 2.2-.7 3.5-.7s2 .7 3.5.7c2.1 0 4-1.2 4-3.6 0-3.4-3.5-7.6-7.5-7.6Z" />
  </svg>
);

const JourneyQuizIcon = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {/* page with a folded corner and text lines */}
    <path d="M26 17V8.5A2.5 2.5 0 0 0 23.5 6h-13A2.5 2.5 0 0 0 8 8.5v23A2.5 2.5 0 0 0 10.5 34H18" stroke={JOURNEY_INK} />
    <path d="M13 13h8M13 18h8M13 23h4" stroke={JOURNEY_INK} />
    {/* pencil */}
    <path d="M22 34l1-4.5 9.5-9.5a2.1 2.1 0 0 1 3 3L26 32.5 22 34Z" stroke={JOURNEY_ACCENT} />
    <path d="M30.5 22l3 3" stroke={JOURNEY_ACCENT} />
  </svg>
);

const JourneyExploreIcon = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="17" cy="17" r="10" stroke={JOURNEY_INK} />
    <path d="M24.5 24.5l8 8" stroke={JOURNEY_INK} strokeWidth="3" />
    {/* lens highlight */}
    <path d="M12 15a6 6 0 0 1 4-4" stroke={JOURNEY_ACCENT} />
  </svg>
);

const Home = () => {
  /* No `loading` here on purpose — `breeds` is never empty, so this page has
     nothing to wait for. See BreedsProvider. */
  const { breeds: breedsData } = useBreeds();
  const { user, token, logout, loading: authLoading } = useContext(AuthContext);
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
  const [, setCurrentQIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState({});

  /* ---- Paywall (components/paywall/*). The server decides the mode; null = the
     server could not be asked, which runs the quiz without a paywall. ---- */
  const [paywall, refreshPaywall, paywallSettled] = usePaywallStatus(user?.id);
  const paywallActive = !!paywall && paywall.mode !== 'off' && !paywall.unlocked;
  /* For the "Was this useful?" card on the full results: "paid" only when real
     money moved; a fake-door unlock asks the price question hypothetically. */
  const resultsPulseKind = !paywall || paywall.mode === 'off' ? 'none'
    : paywall.unlocked_via === 'paid' ? 'paid' : 'fake_door';
  const [quizStage, setQuizStage] = useState('quiz');   // 'quiz' | 'sniffing' | 'rough'
  const [roughBreeds, setRoughBreeds] = useState([]);
  const [resume, setResume] = useState(null);           // { startAt, runId, key } after the gate
  const [unlockFor, setUnlockFor] = useState(null);     // why the unlock flow is open: 'quiz' | 'submit' | 'ai'
  const [pendingAi, setPendingAi] = useState(null);     // matchmaker answers waiting for an unlock
  const [paywallClosed, setPaywallClosed] = useState(false); // closed the unlock card from the rough recommendation without paying
  // "What stopped you from unlocking?" (components/paywall/NotUnlockedCard.jsx): null or the moment.
  const [notUnlocked, setNotUnlocked] = useState(null);
  const [askedWhyThisVisit, setAskedWhyThisVisit] = useState(false);
  const askWhyNotUnlocked = (moment) => mayAskNotUnlocked().then((ok) => {
    if (ok) { setAskedWhyThisVisit(true); setNotUnlocked(moment); }
  });
  const returnToRough = React.useRef(false);            // Explore / Tinder opened from the rough card
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');

  // AI Matchmaker State
  const [matchmakerPrompt, setMatchmakerPrompt] = useState('');

  // Results context: Top-5 personalisation
  const [resultsAnswers, setResultsAnswers] = useState(null);
  const [revealRun, setRevealRun] = useState(0);
  const [revealSeen, setRevealSeen] = useState(0);
  const [resultsSource, setResultsSource] = useState(null); // 'quiz' | 'ai' | null (explore)
  const [profileBreed, setProfileBreed] = useState(null);
  const [profileView, setProfileView] = useState('profile'); // 'profile' | 'buy'
  const [compareBreed, setCompareBreed] = useState(null); // seeds the Compare overlay
  const [swipeAnswers, setSwipeAnswers] = useState(null);   // answers the swipe deck scores with (or null)
  const [swipeExclude, setSwipeExclude] = useState([]);     // breed names left out of the deck (the Top 5)
  const [swipeFrom, setSwipeFrom] = useState('breed_slider'); // where the deck returns to

  /* find_dog_clicked: any button that starts the quiz, with which one it was.
     has_account: this browser already has a token, so the contact form will be
     skipped at the unlock step - those sessions are not counted as form drop-outs on the Pilot tab. */
  const findDog = (source) => track('find_dog_clicked', { source, has_account: !!token });

  // Lock scroll on the single-screen views; let the hero and the Top-5 grid scroll.
  useEffect(() => {
    const lock = isLoading || subView === 'friend_dashboard' || subView === 'breed_slider' || subView === 'breed_swipe';
    document.body.style.overflow = lock ? 'hidden' : 'auto';
    return () => { document.body.style.overflow = 'auto'; };
  }, [isLoading, subView]);

  // Squeaky toys may show on the landing page and the results page, but not while the loading screen, the quiz,
  // the breed slider or the swipe cards are open (this also keeps the footer's toys out of the keyboard's way).
  // On the results page they also wait until the match reveal has been seen, so there is no gap while the quiz fades out.
  useToyGate(!isLoading && (subView === 'hero' || (subView === 'results' && !(revealRun && revealRun !== revealSeen))));

  const toggleDropdown = () => setDropdownOpen(!dropdownOpen);

  const handleLogout = () => {
    logout();
    setDropdownOpen(false);
  };

  // Explore and the free questions need no details. They are asked for once, at the unlock step (UnlockFlow).
  const openDashboard = (tab = 'menu') => {
    setSubView('friend_dashboard');
    setDashboardTab(tab);
    // Any fresh start leaves the paywall's in-between screens behind.
    setQuizStage('quiz');
    setResume(null);
    setUnlockFor(null);
    if (tab === 'inline_quiz') {
      setCurrentQIndex(0);
      setQuizAnswers({});
    }
  };

  // NOTE: the hero button already reports itself as `cta_click { source: 'hero' }` (HeroSection.jsx), so
  // this handler no longer also fires `hero_cta_clicked`: one tap, one event. (`hero_cta_clicked`
  // stays in the backend whitelist so old rows still show.)
  const handleFriendPathClick = (tab = 'menu') => {
    openDashboard(typeof tab === 'string' ? tab : 'menu');
  };

  /* "Already a dog owner?" — the intake survey is for people arriving for the
     first time. Somebody who already has a dog on file is coming back for
     their health records, and putting eight questions between them and those
     records every visit would be the wrong trade. Asked once, not every time. */
  const handleDogOwnerClick = async () => {
    track('journey_selected', { choice: 'owner' });
    // Dog profiles need an account. Not signed in: a browser that once had dogs
    // goes to the sign-in screen in /app; anyone else starts with the survey.
    if (!token) {
      navigate(hasBrowserOwnerId() ? '/app' : '/owner-survey');
      return;
    }
    try {
      const existing = await listDogs();
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

  /* Left the site last time with the paywall open (PaywallSheet sets the flag
     with a beacon): ask "what stopped you" once, in the corner, if they still
     have not unlocked. */
  useEffect(() => {
    if (!paywallSettled) return;
    let left = false;
    try { left = localStorage.getItem('pb_paywall_left_open') === '1'; localStorage.removeItem('pb_paywall_left_open'); } catch { /* blocked */ }
    if (left && paywallActive) askWhyNotUnlocked('next_visit');
  }, [paywallSettled]); // eslint-disable-line react-hooks/exhaustive-deps

  // Deep link: /?ai=1 lands on the AI Matchmaker (used by the Results page)
  useEffect(() => {
    if (authLoading) return;
    const params = new URLSearchParams(location.search);
    if (params.get('ai') === '1') {
      navigate('/', { replace: true });
      // Only the choice is tracked. The text a person types into the matchmaker is never sent anywhere.
      track('journey_selected', { choice: 'ai_matchmaker' });
      handleFriendPathClick('ai_matchmaker');
    } else if (params.get('quiz') === '1') {
      // Deep link /?quiz=1 starts the quiz (used by the "Walk the dog" game's "Find my dog" button).
      navigate('/', { replace: true });
      track('journey_selected', { choice: 'quiz' });
      findDog('quiz_link');      // the game's button, the old /quiz address, a locked /results
      handleFriendPathClick('inline_quiz');
    }
  }, [authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Explore path: full database in the premium slider (no match scoring, no gate)
  const openExploreSlider = (source = 'unknown') => {
    track('explore_opened', { source: typeof source === 'string' ? source : 'unknown' });
    setResultsAnswers(null);
    setResultsSource(null);
    setSliderBreeds(breedsData);
    setSubView('breed_slider');
  };

  // Breed profile / compare overlays. These wrappers only add the tracking call.
  const openProfile = (breed, source) => {
    track('breed_opened', { breed: breed?.name, source });
    setProfileBreed(breed);
    setProfileView('profile');
  };
  const openCompare = (breed) => {
    track('compare_opened', { breed: breed?.name });
    setCompareBreed(breed);
  };

  // Breed Swipe: from Explore (saved quiz answers if any) or from the Top-5 results
  // (the answers that produced them, minus the five already shown).
  const openSwipe = (answers, excludeNames = [], from = null) => {
    setSwipeFrom(from || (subView === 'results' ? 'results' : 'breed_slider'));
    setSwipeAnswers(answers);
    setSwipeExclude(excludeNames);
    setSubView('breed_swipe');
  };

  // Inline Quiz Handler
  const handleQuizAnswer = (qId, val) => {
    // "I already love a specific breed." aborts the quiz and opens Explore
    if (qId === 'purpose' && val === 'breed') {
      openExploreSlider('quiz');
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
    /* Remember the answers for as long as this tab is open, so leaving for a full page
       (the heat check) and coming back can rebuild the same Top 5 - see the /?results=1
       branch below. sessionStorage, not localStorage: it is a convenience for this visit,
       not something to keep. The inline quiz here does not write pb_quiz_state (only the
       older /quiz page does), which is why this cannot just read that. */
    try { sessionStorage.setItem(LAST_RESULTS_KEY, JSON.stringify(answers)); } catch { /* storage blocked: the X just lands on the hero */ }
    // Fresh quiz / matchmaker result only: one reveal per run id.
    if (source === 'quiz' || source === 'ai') setRevealRun(Date.now());

    // results_viewed: presentResults runs once per submit, so going into a breed
    // profile and coming back (which does not call it) can never double count.
    try {
      const top = top5 && top5[0];
      // The AI matchmaker has no timeline answer; don't invent a readiness level for it.
      const readiness_code = answers && answers.timeline ? computeReadiness(answers).code : undefined;
      track('results_viewed', {
        top_breed: top?.name, label: top?.label, match_pct: top?.matchPercentage, readiness_code, source,
      });
      saveProgress({ top_breed: top?.name, readiness_code, status: 'completed' });
    } catch { /* tracking never blocks results */ }
  };

  /* Deep link /?results=1 goes straight back to the Top 5 - the X on the heat check page.

     The Top 5 is in-page state, not a route, so leaving for a full page loses it. The answers
     behind it are kept in sessionStorage for the life of the tab (see presentResults above) and
     the same five breeds are rebuilt here from the same engine. Nothing stored means nothing to
     rebuild, so that visitor simply stays on the hero - which is right for someone who arrived
     on a shared heat-check link and has never taken the quiz.

     Deliberately its own effect, below presentResults rather than up with the other deep links:
     calling it from up there reads as using a value before it is declared. */
  useEffect(() => {
    if (authLoading) return;
    if (new URLSearchParams(location.search).get('results') !== '1') return;
    navigate('/', { replace: true });
    let saved;
    try { saved = JSON.parse(sessionStorage.getItem(LAST_RESULTS_KEY) || 'null'); } catch { /* storage blocked */ }
    if (!saved) saved = loadSavedAnswers();            // the older /quiz page's save, if there is one
    if (!saved || !Object.keys(saved).length) return;
    try {
      const { matches: top5 } = selectTopMatches(computeMatches(saved, breedsData), 5);
      // source 'restored': presentResults only starts the reveal for 'quiz' and 'ai', so the
      // portal never replays on the way back.
      if (top5 && top5.length) presentResults(saved, 'restored', top5);
    } catch { /* a stale save the engine cannot read: leave them on the hero */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  // Visitors give a contact detail through the contact form; sign-in is for dog owners and admins only.

  /* ---- The paywall gate (PAYWALL_AFTER = 'rough'). QuizFlow calls this instead
     of moving past the last free screen. ---- */
  const handleQuizGate = (runId) => {
    freePartCompleted();
    setResume({ startAt: LAST_FREE_SCREEN_INDEX + 1, runId, key: `resume-${runId}` });
    const rough = computeRoughMatches(quizAnswers, breedsData);
    if (!rough.length) console.warn('[paywall] the engine returned no rough matches for these free answers');
    setRoughBreeds(rough);
    setQuizStage('sniffing');
    setTimeout(() => setQuizStage((s) => (s === 'sniffing' ? 'rough' : s)), ROUGH_PAUSE_MS);
  };

  /* "Find my match". While the account is locked, the unlock flow opens first and
     the results follow it. This is the trigger for PAYWALL_AFTER = 'questions',
     and the safety net for 'rough' (e.g. the status arrived after the visitor had
     already passed the free screens). */
  const handleQuizSubmit = () => {
    if (paywallActive) {
      paywallCtaClicked('submit');
      setUnlockFor('submit');
      return;
    }
    submitInlineQuiz();
  };

  const handleUnlocked = (fresh) => {
    const reason = unlockFor;
    setUnlockFor(null);
    setPaywallClosed(false);
    try { localStorage.removeItem('pb_paywall_left_open'); } catch { /* nothing stored */ }
    unlockContinued(fresh?.mode || paywall?.mode);
    if (reason === 'quiz') {
      // Back into the quiz at the first paid screen, answers kept.
      setResume((r) => (r ? { ...r, key: `${r.key}-go` } : r));
      setQuizStage('quiz');
    } else if (reason === 'submit') {
      submitInlineQuiz();
    } else if (reason === 'ai' && pendingAi) {
      const { answers, top5, prompt } = pendingAi;
      setPendingAi(null);
      saveMatchmakerRun(answers, prompt, top5);
      presentResults(answers, 'ai', top5);
    }
  };

  const submitInlineQuiz = async () => {
    track('quiz_completed');
    saveProgress({ status: 'completed' });
    setIsProcessing(true);
    setProcessingMessage('Sniffing out your match...');

    // Premium processing animation beat before results reveal
    setTimeout(() => {
      try {
        const scoredBreeds = computeMatches(quizAnswers, breedsData);
        const { matches: top5 } = selectTopMatches(scoredBreeds, 5);

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
  // Save to DB (asynchronously)
  const saveMatchmakerRun = (answers, prompt, top5) => {
    axios.post(`${API_URL}/api/quiz/submit`, {
      user_id: user?.id || null,
      answers: { ...answers, _prompt: prompt },
      top_breeds: top5.map(b => b.name)
    }).catch(err => console.error("Error saving matchmaker run:", err));
  };

  const handleMatchmakerSubmit = async (e) => {
    e.preventDefault();
    if (!matchmakerPrompt.trim()) return;

    setIsProcessing(true);
    setProcessingMessage('AI Matchmaker reading your prompt...');

    const minDelay = new Promise(resolve => setTimeout(resolve, 1800));
    try {
      const [{ answers }] = await Promise.all([parsePrompt(matchmakerPrompt), minDelay]);
      const scoredBreeds = computeMatches(answers, breedsData);
      const { matches: top5 } = selectTopMatches(scoredBreeds, 5);

      // A full Top 5, so the same paywall as the quiz. The run is saved and shown
      // only once unlocked (handleUnlocked), never for a result nobody saw.
      if (paywallActive) {
        setPendingAi({ answers, top5, prompt: matchmakerPrompt });
        paywallCtaClicked('matchmaker');
        setUnlockFor('ai');
        return;
      }
      saveMatchmakerRun(answers, matchmakerPrompt, top5);
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
        style={{ position: 'relative', background: subView === 'results' ? '#FFF6EC' : 'var(--cream)', minHeight: '100dvh' }}
      >
        {/* Navigation / Header — hidden on the hero view, which renders its own
            white header bar inside HeroSection (the new landing design). */}
        {subView !== 'hero' && subView !== 'breed_swipe' && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'clamp(10px, 2.5vw, 18px) clamp(14px, 3vw, 24px)', pointerEvents: 'none' }}>
          <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center' }}>
            {subView === 'results' ? (
              /* Results view: clean brand wordmark instead of the cartoon-dog logo. */
              <div onClick={() => { setSubView('hero'); }} style={{ cursor: 'pointer', lineHeight: 1 }} role="link" aria-label="Paw Buddy home">
                <div style={{ fontFamily: "'Gabarito', system-ui, sans-serif", fontWeight: 800, fontSize: 'clamp(20px, 2.4vw, 26px)', letterSpacing: '-0.01em' }}>
                  <span style={{ color: '#011E4A' }}>PAW </span><span style={{ color: '#F5691A' }}>BUDDY</span>
                </div>
                <div style={{ fontFamily: "'Figtree', system-ui, sans-serif", fontWeight: 500, fontSize: 'clamp(9px, 1vw, 11px)', color: '#011E4A', opacity: 0.75, marginTop: '3px' }} className="rbx-tagline">
                  India's #1 Dog Companion Platform
                </div>
              </div>
            ) : (
              <img src="/logo.png" alt="Paw Buddy" style={{ width: 'clamp(90px, 8vw, 115px)', mixBlendMode: 'multiply', cursor: 'pointer' }} onClick={() => { setSubView('hero'); }} />
            )}
          </div>
          
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center', pointerEvents: 'auto' }}>
            <button
              onClick={() => setIsAboutOpen(true)}
              className="about-nav-btn"
              style={subView === 'results' ? { background: '#FFFFFF', color: '#011E4A', border: 0, borderRadius: '999px', fontFamily: "'Figtree', system-ui, sans-serif", fontWeight: 700, animation: 'none', boxShadow: '0 1px 3px rgba(1,30,74,.08)' } : undefined}
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
              /* Visitors give a contact detail through the contact form; sign-in is for dog owners and admins only. */
              null
            )}
          </div>
        </div>
        )}

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
              <div style={{ position: 'relative' }}>
              <HeroSection
                onSelectFriendPath={(source) => { findDog(source || 'hero'); handleFriendPathClick('menu'); }}
                /* Existing owners go straight to the product area: dashboard,
                   dog profiles and Health Records all live under /app now.
                   Wired to the hero header's account icon. */
                onDogOwner={handleDogOwnerClick}
                /* Hero header's hamburger opens the About panel (the only
                   nav item on this minimal landing for now). */
                onMenu={() => setIsAboutOpen(true)}
                /* Account dropdown (login / dashboard / profile / logout). */
                user={user}
                onLogin={() => navigate('/login')}
                onProfile={() => navigate('/profile')}
                onAdmin={() => navigate('/admin')}
                onLogout={handleLogout}
              />
              {/* Squeaky toys on the first screen (decoration only; see constants/toys.js to move them) */}
              {!isLoading && <ToySlots group="homeHero" page="home" />}
              </div>
              {/* The "Hiii!" dog: greets once per page load, only on the landing page, only after the loading screen */}
              {!isLoading && <HiDog />}
              <GoldenCircle />
              <Reveal><CommunitySection /></Reveal>
              <div style={{ position: 'relative' }}>
                <Reveal><TrustSection /></Reveal>
                {!isLoading && <ToySlots group="homeTrust" page="home" />}
              </div>
              <Reveal><PlayTeaser /></Reveal>
              <Reveal><FeaturedPuppies user={user} /></Reveal>
              <Reveal><SuccessStories /></Reveal>
              <div style={{ position: 'relative', height: 110 }}>
                {!isLoading && <ToySlots group="homeEnd" page="home" />}
              </div>
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
                  className="journey-close"
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

                {/* While the QUIZ is submitting, the quiz layer itself stays on screen (the dog sits at the end of its bar). */}
                {isProcessing && dashboardTab !== 'inline_quiz' ? (
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
                        <h2 style={{ fontFamily: "'Fredoka', sans-serif", color: 'var(--brown)', fontSize: '28px', textAlign: 'center', marginBottom: '10px', paddingRight: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                          <JourneyPawIcon /> Choose Your Journey
                        </h2>
                        <p style={{ color: 'var(--text-soft)', textAlign: 'center', fontSize: '15px', marginBottom: '35px' }}>
                          Let's help you discover your future furry best friend!
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                          {/* Option 1: Quiz */}
                          <div 
                            onClick={() => { track('journey_selected', { choice: 'quiz' }); findDog('journey_card'); setDashboardTab('inline_quiz'); setCurrentQIndex(0); setQuizAnswers({}); }}
                            className="hover-lift journey-card"
                            style={{
                              background: '#FCFAF7', border: '1px solid #EAE4DE', borderRadius: '18px',
                              padding: '20px 25px', cursor: 'pointer', transition: 'all 0.3s',
                              display: 'flex', alignItems: 'center', gap: '20px'
                            }}
                          >
                            <span style={{ display: 'inline-flex', flexShrink: 0 }}><JourneyQuizIcon /></span>
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
                            onClick={() => { track('journey_selected', { choice: 'explore' }); openExploreSlider('journey_menu'); }}
                            className="hover-lift journey-card"
                            style={{
                              background: '#FCFAF7', border: '1px solid #EAE4DE', borderRadius: '18px',
                              padding: '20px 25px', cursor: 'pointer', transition: 'all 0.3s',
                              display: 'flex', alignItems: 'center', gap: '20px'
                            }}
                          >
                            <span style={{ display: 'inline-flex', flexShrink: 0 }}><JourneyExploreIcon /></span>
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

                          {/* A dog with a speech bubble under the two cards: four lines,
                              one every five seconds. See components/home/JourneyDog.jsx. */}
                          <JourneyDog />
                        </div>
                      </div>
                    )}

                    {/* No details needed to answer. The contact screen comes later, when they tap
                        Unlock at the end of "About you" (components/paywall/UnlockFlow.jsx). */}
                    {dashboardTab === 'inline_quiz' && quizStage === 'quiz' && (
                      <QuizFlow
                        key={resume?.key || 'quiz'}
                        questions={questionsData}
                        answers={quizAnswers}
                        onAnswer={handleQuizAnswer}
                        onSubmit={handleQuizSubmit}
                        onCancel={() => setDashboardTab('menu')}
                        onBrowseBreeds={() => openExploreSlider('quiz_link')}
                        submitting={isProcessing}
                        processingMessage={processingMessage}
                        gateAt={paywallActive && PAYWALL_AFTER === 'rough' ? LAST_FREE_SCREEN_INDEX : null}
                        onGate={handleQuizGate}
                        startAt={resume?.startAt || 0}
                        runId={resume?.runId}
                      />
                    )}

                    {dashboardTab === 'inline_quiz' && quizStage !== 'quiz' && (
                      <RoughRecommendation
                        sniffing={quizStage === 'sniffing'}
                        breeds={roughBreeds}
                        freeCount={FREE_SCREEN_COUNT}
                        totalCount={TOTAL_SCREENS}
                        price={paywall?.price_rupees}
                        onUnlock={() => { paywallCtaClicked('rough'); setUnlockFor('quiz'); }}
                        onHome={() => openDashboard('menu')}
                        onExplore={() => { returnToRough.current = true; openExploreSlider('rough_rec'); }}
                        onSwipe={() => { returnToRough.current = true; openSwipe(null, [], 'friend_dashboard'); }}
                      />
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
                              border: '2px solid #EAE4DE', fontSize: '16px', fontFamily: 'var(--font-body-family)',
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
                onFullProfile={(breed) => openProfile(breed, 'results')}
                onRetake={() => { track('retake_clicked'); findDog('retake'); openDashboard('inline_quiz'); }}
                onExploreMore={() => openSwipe(resultsAnswers, (sliderBreeds || []).map((b) => b.name))}
                /* "Compare breeds" in the results paw menu: the full breed matrix, where Compare lives. */
                onCompareBreeds={() => openExploreSlider('results_fan')}
                /* "Games" in the same menu: the Street Zoomies page. */
                onPlayGames={() => { track('cta_click', { source: 'results_fan_games' }); navigate('/play'); }}
                revealRun={revealRun}
                revealSeen={revealSeen}
                onRevealDone={() => setRevealSeen(revealRun)}
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
                  onClose={() => {
                    setSubView('friend_dashboard');
                    // Opened from the rough recommendation: go back to it, answers intact.
                    if (!returnToRough.current) setDashboardTab('menu');
                    returnToRough.current = false;
                  }}
                  onBuy={handleBuy}
                  onFullProfile={(breed) => openProfile(breed, 'explore')}
                  onCompare={openCompare}
                  onSwipeMode={() => openSwipe(loadSavedAnswers(), [])}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>


        {subView === 'breed_swipe' && (
          <BreedSwipe
            breeds={breedsData}
            answers={swipeAnswers}
            excludeNames={swipeExclude}
            source={swipeFrom === 'results' ? 'results' : 'explore'}
            onClose={() => setSubView(swipeFrom)}
            onSliderView={() => setSubView('breed_slider')}
            onBuy={handleBuy}
            onFullProfile={(breed) => openProfile(breed, 'swipe')}
            onCompare={openCompare}
            onTakeQuiz={() => { findDog('swipe'); openDashboard('inline_quiz'); }}
          />
        )}

        {/* The paywall: sign-in if needed, then the sheet (components/paywall/UnlockFlow.jsx). */}
        <UnlockFlow
          open={!!unlockFor}
          status={paywall}
          refreshStatus={refreshPaywall}
          onUnlocked={handleUnlocked}
          onCancel={(closed) => {
            // Closing the unlock card from the rough recommendation is moment (a)
            // for the "Was this useful?" card below.
            if (unlockFor === 'quiz') setPaywallClosed(true);
            setUnlockFor(null);
            // Closed the sheet itself (not the sign-in step) without tapping Pay:
            // ask why, right there.
            if (closed?.how && !closed.tappedPay && paywallActive) askWhyNotUnlocked('dismissed');
          }}
        />

        {notUnlocked && <NotUnlockedCard moment={notUnlocked} onDone={() => setNotUnlocked(null)} />}

        {/* "Was this useful?" (components/results/ResultsPulse.jsx), at two moments only.
            (a) closed the paywall without paying: on the rough recommendation, 5 seconds later. */}
        <ResultsPulse
          key="pulse-dismissed"
          kind="dismissed"
          price={paywall?.price_rupees}
          active={paywallClosed && paywallActive && !unlockFor && !askedWhyThisVisit
            && subView === 'friend_dashboard' && dashboardTab === 'inline_quiz' && quizStage === 'rough'}
          blocked={isAboutOpen || !!profileBreed || !!compareBreed}
          needsInteraction={false}
          delayMs={AFTER_OVERLAY_MS}
        />
        {/* (b) the full recommendation, for people with access ('paid', which includes a
            fake-door "Pay" tap) or with the paywall off ('none'). Never during the reveal. */}
        <ResultsPulse
          key={`pulse-results-${resultsPulseKind}`}
          kind={resultsPulseKind}
          price={paywall?.price_rupees}
          active={paywallSettled && subView === 'results' && !!resultsAnswers && !paywallActive}
          blocked={!!(revealRun && revealRun !== revealSeen) || !!unlockFor || isAboutOpen
            || !!profileBreed || !!compareBreed || isAuthModalOpen}
        />

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

        {/* About PawBuddy modal */}
        <AboutModal
          isOpen={isAboutOpen}
          onClose={() => setIsAboutOpen(false)}
          onTakeQuiz={() => { setIsAboutOpen(false); findDog('about'); handleFriendPathClick('inline_quiz'); }}
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
          min-height: 44px;            /* full-size tap target on phones */
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
