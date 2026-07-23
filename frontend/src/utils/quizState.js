const QUIZ_STATE_KEY = 'pb_quiz_state';

export function loadQuizState() {
  try {
    const saved = localStorage.getItem(QUIZ_STATE_KEY);
    if (!saved) return { currentQ: 0, answers: {} };
    const parsed = JSON.parse(saved);
    return {
      currentQ: typeof parsed.currentQ === 'number' ? parsed.currentQ : 0,
      answers: parsed.answers || {},
    };
  } catch {
    return { currentQ: 0, answers: {} };
  }
}

export function saveQuizState(state) {
  try {
    localStorage.setItem(QUIZ_STATE_KEY, JSON.stringify(state));
  } catch {
    // Storage may be unavailable in private browsing or restricted contexts
  }
}

export function clearQuizState() {
  try {
    localStorage.removeItem(QUIZ_STATE_KEY);
  } catch {
    // Ignore storage errors
  }
}

/** Detect reset intent from router state or URL (state can be lost after deploy/navigation). */
export function shouldResetQuiz(location) {
  if (location?.state?.reset === true) return true;
  try {
    return new URLSearchParams(location?.search || '').get('reset') === '1';
  } catch {
    return false;
  }
}
