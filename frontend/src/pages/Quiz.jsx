import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import questionsData from '../constants/questions.json';
import CitySelect from '../components/CitySelect';
import {
  loadQuizState,
  saveQuizState,
  clearQuizState,
  shouldResetQuiz,
} from '../utils/quizState';

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
  }, [currentQ, answers]);

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

  const handleNext = () => {
    if (currentQ < questionsData.length - 1) {
      setCurrentQ(prev => prev + 1);
    } else {
      navigate('/results');
    }
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
          <h2 style={{ fontFamily: "'Fredoka', sans-serif" }}>Let's find your pawfect match</h2>
          <p style={{ fontFamily: "'Poppins', sans-serif" }}>Tell us a bit about your lifestyle so we can introduce you to the puppy of your dreams.</p>
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
                borderRadius: '15px',
                border: '1px solid rgba(0,0,0,0.1)',
                fontFamily: "'Poppins', sans-serif",
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
