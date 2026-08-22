import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import questionsData from '../constants/questions.json';
import CitySelect from '../components/CitySelect';
import { READINESS_LEVELS } from '../utils/breedUtils';
import { rememberReadiness, saveProgress, track } from '../utils/analytics';
import {
  loadQuizState,
  saveQuizState,
  clearQuizState,
  shouldResetQuiz,
} from '../utils/quizState';

/* The answer sheet is kept in localStorage so a refresh doesn't lose it, and
   mirrored to the server after every answer so a CLOSED TAB doesn't either.
   The two are independent on purpose: localStorage is for the person coming
   back, the server copy is for us seeing that they left. */

const TIMELINE_QUESTION = 'timeline';

/** Answers are stored per question as an array (multi-select) or a raw string
    (free text). Events and the progress row want the plain value. */
const flatten = (value) => (Array.isArray(value) ? (value.length === 1 ? value[0] : value) : value);

const Quiz = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const resetOnMount = shouldResetQuiz(location);
  const skipSaveRef = useRef(resetOnMount);

  const [currentQ, setCurrentQ] = useState(() => {
    if (resetOnMount) {
      clearQuizState();
      return 0;
    }
    return loadQuizState().currentQ;
  });

  const [answers, setAnswers] = useState(() => {
    if (resetOnMount) return {};
    return loadQuizState().answers;
  });

  // Clean up reset signals after mount so refresh does not re-reset
  useEffect(() => {
    if (!shouldResetQuiz(location)) return;

    clearQuizState();
    setCurrentQ(0);
    setAnswers({});
    skipSaveRef.current = true;

    const hasQueryReset = new URLSearchParams(location.search).get('reset') === '1';
    if (location.state?.reset || hasQueryReset) {
      navigate('/quiz', { replace: true, state: {} });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- run once on mount

  // Persist progress; skip the first write after a reset to avoid stale re-save
  useEffect(() => {
    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }
    saveQuizState({ currentQ, answers });

    /* Mirrored to the server on every answer, deliberately un-debounced. A
       debounce would drop exactly the write we care about most — the one
       interrupted by the tab closing. */
    const flat = Object.fromEntries(
      Object.entries(answers).map(([id, value]) => [id, flatten(value)]));
    saveProgress({
      answers: flat,
      current_question: currentQ,
      city: flatten(answers.city) || undefined,
    });
  }, [currentQ, answers]);

  /* One quiz_started per visit. The ref is what makes it once — StrictMode
     double-invokes mount effects in dev, and an empty dep array alone would
     log the start twice. */
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    track('quiz_started');
  }, []);

  /* One question_viewed per question actually shown. Guarded by a ref rather
     than by the effect's own deps: going Back and Next again re-renders the
     same question, and counting that as a second view would understate the
     drop-off at every question people revisit. */
  const viewedRef = useRef(new Set());
  useEffect(() => {
    const question = questionsData[currentQ];
    if (!question || viewedRef.current.has(question.id)) return;
    viewedRef.current.add(question.id);
    track('question_viewed', { q_index: currentQ, q_id: question.id });
  }, [currentQ]);

  const handleOptionSelect = (qId, val) => {
    // "I already love a specific breed." aborts the quiz → Explore breeds
    if (qId === 'purpose' && val === 'breed') {
      clearQuizState();
      navigate('/explore');
      return;
    }

    setAnswers(prev => {
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

  /* Fired on Next, not on selection. Toggling an option and then quitting is
     not an answered question — it's a drop-off, and the whole value of the
     viewed-vs-answered gap is that it says so. */
  const handleNext = () => {
    const question = questionsData[currentQ];
    const answer = flatten(answers[question.id]);
    track('question_answered', { q_index: currentQ, q_id: question.id, answer });

    /* The option's value IS the readiness code — no label→code lookup, so
       rewording an option can never silently break the mapping. `rank` and
       `label` come from the one place they're defined. */
    if (question.id === TIMELINE_QUESTION) {
      const level = READINESS_LEVELS[answer];
      const chosen = question.options.find((o) => o.val === answer);
      rememberReadiness(answer);
      track('timeline_selected', {
        value: chosen?.label || answer,
        readiness_code: answer,
        readiness_rank: level?.rank,
      });
      saveProgress({
        // Stored as the wording the person actually read, not the code —
        // the code is already in its own column.
        purchase_timeline: chosen?.label || answer,
        readiness_code: answer,
      });
    }

    if (currentQ < questionsData.length - 1) {
      setCurrentQ(prev => prev + 1);
      return;
    }

    track('quiz_completed');
    saveProgress({ status: 'completed', current_question: currentQ });
    navigate('/results');
  };

  const handleBack = () => {
    if (currentQ > 0) {
      setCurrentQ(prev => prev - 1);
    }
  };

  const q = questionsData[currentQ];
  const pct = Math.round(((currentQ + 1) / questionsData.length) * 100);
  const currentAnswers = answers[q?.id] || [];

  if (!q) return <div>Loading...</div>;

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      
      <section id="quiz-section" style={{ display: 'block', minHeight: '100dvh' }}>
        <div className="quiz-logo-wrapper">
          <img src="/logo.png" alt="Paw Buddy" style={{ width: '140px', mixBlendMode: 'multiply', cursor: 'pointer' }} onClick={() => navigate('/')} />
        </div>
      <div className="quiz-blob quiz-blob-1"></div>
      <div className="quiz-blob quiz-blob-2"></div>
      <div className="quiz-blob quiz-blob-3"></div>
      <div className="quiz-wrap" style={{ paddingTop: '20px' }}>
        <div className="quiz-header">
          <h2 style={{ fontFamily: 'var(--font-display)' }}>Let's find your pawfect match</h2>
          <p style={{ fontFamily: 'var(--font-body-family)' }}>Tell us a bit about your lifestyle so we can introduce you to the puppy of your dreams.</p>
        </div>

        <div className="progress-wrap">
          <div className="progress-labels">
            <span id="q-progress-label">Question {currentQ + 1} of {questionsData.length}</span>
            <span id="q-progress-pct">{pct}%</span>
          </div>
          <div className="progress-bar-bg">
            <div className="progress-bar-fill" id="progress-fill" style={{ width: `${pct}%` }}></div>
          </div>
        </div>

        <div className="question-card">
          <div className="q-num">Q{currentQ + 1} / {questionsData.length}</div>
          <div className="q-text">{q.text}</div>
          <div className="multi-hint">{q.type === 'text' ? 'Optional text response' : q.type === 'city' ? 'Pick the city you live in' : (q.multi === false ? 'Select one option' : 'Select one or more options')}</div>

          {q.type === 'city' ? (
            <CitySelect
              value={currentAnswers[0] || ''}
              placeholder={q.placeholder}
              onChange={(val) => setAnswers(prev => ({ ...prev, [q.id]: [val] }))}
            />
          ) : q.type === 'text' ? (
            <textarea
              className="text-input"
              placeholder={q.placeholder || 'Type here...'}
              value={answers[q.id] || ''}
              onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
              style={{
                width: '100%',
                minHeight: '120px',
                padding: '15px',
                borderRadius: 'var(--radius)',
                border: '1px solid rgba(0,0,0,0.1)',
                fontFamily: 'var(--font-body-family)',
                fontSize: '16px',
                resize: 'vertical',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)'
              }}
            />
          ) : (
            <div className={`options-grid ${q.cols === 3 ? 'cols-3' : q.cols === 2 ? 'cols-2' : ''}`}>
              {q.options.map(opt => (
                <button 
                  key={opt.val}
                  className={`option-btn ${currentAnswers.includes(opt.val) ? 'selected multi-selected' : ''}`}
                  onClick={() => handleOptionSelect(q.id, opt.val)}
                >
                  <span className="opt-icon">{opt.icon}</span>
                  <span className="opt-content">
                    <span className="opt-label">{opt.label}</span>
                    {opt.desc && <span className="opt-desc">{opt.desc}</span>}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="quiz-nav">
            <button 
              className="btn-back" 
              onClick={handleBack} 
              style={{ visibility: currentQ === 0 ? 'hidden' : 'visible' }}
            >
              ← Back
            </button>
            <button 
              className="btn-next" 
              onClick={handleNext}
              disabled={q.type !== 'text' && currentAnswers.length === 0}
            >
              {currentQ === questionsData.length - 1 ? 'See My Results' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </section>
    </div>
  );
};

export default Quiz;
