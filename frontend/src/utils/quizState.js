const QUIZ_STATE_KEY = 'pb_quiz_state';

// ─── Quiz version ──────────────────────────────────────────────────────────
// Bump this string any time you add, remove, or rename a question.
// Old saves with a different (or missing) version are cleared automatically,
// so someone returning with answers from an older question set starts fresh
// instead of being scored on answers that no longer mean what they used to.
export const QUIZ_VERSION = 'v2'; // was implicitly "v1" (the 9-question quiz)

const fresh = () => ({ currentQ: 0, answers: {} });

/** Reads the saved quiz and validates it. Returns the parsed object, or null if
    there is no save, it is unreadable, or it is from a different quiz version
    (in which case it is also removed). */
function readValidSave() {
  try {
    const raw = localStorage.getItem(QUIZ_STATE_KEY);
    if (!raw) return null;

    const saved = JSON.parse(raw);

    // Reject any save that is missing the version field or is from another version.
    if (!saved || !saved.version || saved.version !== QUIZ_VERSION) {
      localStorage.removeItem(QUIZ_STATE_KEY);
      return null;           // caller starts a fresh quiz
    }
    return saved;            // version matches — safe to restore
  } catch {
    try { localStorage.removeItem(QUIZ_STATE_KEY); } catch { /* ignore */ }
    return null;
  }
}

/** Answers from a valid save of the current quiz version, or null. */
export function loadSavedAnswers() {
  const saved = readValidSave();
  return saved ? (saved.answers || {}) : null;
}

/** { currentQ, answers } to resume the quiz; a blank one when nothing valid is saved. */
export function loadQuizState() {
  const saved = readValidSave();
  if (!saved) return fresh();
  return {
    currentQ: typeof saved.currentQ === 'number' ? saved.currentQ : 0,
    answers: saved.answers || {},
  };
}

/** Always writes the current version alongside the answers. */
export function saveQuizState(state) {
  try {
    localStorage.setItem(QUIZ_STATE_KEY, JSON.stringify({ ...state, version: QUIZ_VERSION }));
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
