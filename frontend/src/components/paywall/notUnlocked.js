import axios from 'axios';
import { sessionId } from '../../utils/analytics';
import { PULSE_VERSION } from '../../config/pulse';

/* "Asked once per person" for NotUnlockedCard.jsx: this browser, then the server. */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
export const ASKED_KEY = `pb_not_unlocked_asked_v${PULSE_VERSION}`;
let askedThisLoad = false;          // storage blocked: still once per page load
export const markAskedNotUnlocked = () => {
  askedThisLoad = true;
  try { localStorage.setItem(ASKED_KEY, '1'); } catch { /* the in-memory flag covers this load */ }
};

const wasAskedHere = () => {
  if (askedThisLoad) return true;
  try { return !!localStorage.getItem(ASKED_KEY); } catch { return false; }
};

/** May we ask? This browser first, then the server. */
export async function mayAskNotUnlocked() {
  if (wasAskedHere()) return false;
  try {
    const { data } = await axios.get(`${API_URL}/api/feedback/pulse/status`, {
      params: { session_id: sessionId, version: PULSE_VERSION },
    });
    return !(data?.not_unlocked_asked || (data?.steps_done || []).includes('not_paid_reason'));
  } catch {
    return true;                    // server unreachable: this browser's memory decides
  }
}

