import axios from 'axios';
import cityZonesCfg from '../config/cityZones.json';

const CITY_NAMES = Object.keys(cityZonesCfg.cities).sort((a, b) => b.length - a.length);
const escapeRe = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/* The AI Matchmaker turns one natural-language prompt into the same
   structured answers the lifestyle quiz produces, then the RIGHTBREED
   engine scores breeds identically for both paths.

   Primary: backend /api/matchmaker/parse (Claude).
   Fallback: local keyword parser, so the feature always works. */

const has = (text, words) => words.some((w) => text.includes(w));

export function parsePromptLocally(prompt) {
  const t = (prompt || '').toLowerCase();
  const answers = {};

  // Purpose
  const purposes = [];
  if (has(t, ['guard', 'protect', 'security', 'watch dog', 'watchdog'])) purposes.push('guard');
  if (has(t, ['run', 'jog', 'hik', 'trek', 'adventure', 'workout', 'cycling'])) purposes.push('active');
  if (has(t, ['emotional', 'support', 'therapy', 'comfort', 'lonely', 'anxiety', 'stress'])) purposes.push('therapy');
  if (has(t, ['senior citizen', 'elderly parents', 'aged parents', 'retired'])) purposes.push('seniors');
  answers.purpose = purposes.length ? purposes : ['family'];

  // Home
  if (has(t, ['1bhk', '1 bhk', 'studio', 'small flat', 'tiny apartment', 'small apartment'])) answers.home = ['apt-1bhk'];
  else if (has(t, ['3bhk', '3 bhk', '4bhk', '4 bhk', 'big apartment', 'large flat'])) answers.home = ['apt-3bhk'];
  else if (has(t, ['paying guest', 'pg accommodation', 'shared accommodation', 'hostel']) || /\bpg\b/.test(t)) answers.home = ['pg'];
  else if (has(t, ['yard', 'garden', 'lawn', 'farmhouse', 'villa'])) answers.home = ['house-yard'];
  else if (has(t, ['independent house', 'bungalow', 'duplex'])) answers.home = ['house-no-yard'];
  else if (has(t, ['2bhk', '2 bhk', 'apartment', 'flat'])) answers.home = ['apt-2bhk'];

  // Climate — a real city name first, so the matchmaker and the quiz resolve
  // the SAME city to the SAME zone through config/cityZones.json (before, the
  // parser sent "hot" for Hyderabad, which maps to HOT_HUMID, while the quiz
  // maps Hyderabad to HOT_DRY — one person, two different results). Longest
  // names first so "Navi Mumbai" wins over "Mumbai"; whole-word match only.
  const cityHit = CITY_NAMES.find((name) => new RegExp(`\\b${escapeRe(name.toLowerCase())}\\b`).test(t));
  if (cityHit) answers.city = [cityHit];
  else if (has(t, ['hill station', 'cold', 'chilly', 'snow'])) answers.city = ['zone:COLD'];
  else if (has(t, ['humid', 'coastal', 'tropical'])) answers.city = ['zone:HOT_HUMID'];
  else if (has(t, ['dry heat', 'desert'])) answers.city = ['zone:HOT_DRY'];
  else if (has(t, ['hot city', 'hot weather'])) answers.city = ['zone:HOT_HUMID']; // unknown kind of hot -> the stricter zone
  else if (has(t, ['pleasant', 'moderate'])) answers.city = ['zone:MODERATE'];

  // Experience
  if (has(t, ['first time', 'first-time', 'beginner', 'never owned', 'never had', 'new to dogs'])) answers.experience = ['none'];
  else if (has(t, ['experienced', 'owned dogs before', 'had dogs', 'grew up with dogs'])) answers.experience = ['experienced'];

  // Activity
  if (has(t, ['very active', 'running', 'jogging', 'gym', 'trekking', 'hiking', 'high energy lifestyle'])) answers.activity = ['high'];
  else if (has(t, ['lazy', 'couch', 'calm life', 'relaxed', 'busy schedule', 'work long', 'not very active', 'low energy'])) answers.activity = ['relaxed'];

  // Budget
  const rupees = t.match(/(?:rs\.?|₹|inr)\s*([\d,]+)/);
  if (rupees) {
    const amount = parseInt(rupees[1].replace(/,/g, ''), 10);
    if (amount < 5000) answers.budget = ['under5k'];
    else if (amount <= 10000) answers.budget = ['5k-10k'];
    else if (amount <= 20000) answers.budget = ['10k-20k'];
    else answers.budget = ['above20k'];
  } else if (has(t, ['cheap', 'low budget', 'affordable', 'low cost', 'budget friendly'])) {
    answers.budget = ['under5k'];
  } else if (has(t, ['premium', 'luxury', 'money is not', 'no budget limit'])) {
    answers.budget = ['above20k'];
  }

  // Family
  const kids = has(t, ['kid', 'child', 'baby', 'toddler', 'son', 'daughter']);
  const seniors = has(t, ['senior', 'elder', 'grandmother', 'grandfather', 'grandparents', 'old parents', 'aged']);
  if (kids && seniors) answers.family = ['both'];
  else if (kids) answers.family = ['kids'];
  else if (seniors) answers.family = ['seniors'];

  // Flooring — hard (tile/marble/stone) is the Indian default; only flip to
  // carpeted/mixed on an explicit mention, matching the backend's own hint.
  if (has(t, ['carpet', 'carpeted', 'rug', 'rugs', 'rugged floor'])) answers.flooring = ['carpeted'];
  else if (has(t, ['tile', 'tiles', 'marble', 'granite', 'slippery floor', 'stone floor'])) answers.flooring = ['hard'];

  // Daily schedule — how long the dog is typically alone
  if (has(t, ['work from home', 'wfh', 'always home', 'home most of the day', 'retired', 'stay at home', 'stay-at-home'])) answers.schedule = ['home'];
  else if (has(t, ['full time job', 'full-time job', 'office all day', '9 to 5', '9-5', 'away most of the day', 'work long hours', 'long office hours'])) answers.schedule = ['8h-plus'];
  else if (has(t, ['part time', 'part-time', 'hybrid work', 'few hours a day'])) answers.schedule = ['4-8h'];

  // Training effort — how much time/effort they're signalling, not experience
  if (has(t, ['no time to train', 'easy dog', 'low maintenance dog', "don't have time to train", 'minimal training'])) answers.trainingEffort = ['minimal'];
  else if (has(t, ['hire a trainer', 'serious training', 'willing to train hard', 'committed to training', 'work hard on training'])) answers.trainingEffort = ['committed'];

  // Coat
  if (has(t, ['fluffy', 'long hair', 'long coat', 'furry'])) answers.hair = ['long'];
  else if (has(t, ['short hair', 'short coat', 'sleek', 'easy grooming'])) answers.hair = ['short'];

  return answers;
}

/** Parse with Claude on the backend; falls back to the local parser.
    Returns { answers, source: 'ai' | 'local' }. */
export async function parsePrompt(prompt) {
  try {
    const res = await axios.post(`${API_URL}/api/matchmaker/parse`, { prompt }, { timeout: 20000 });
    if (res.data?.answers && Object.keys(res.data.answers).length) {
      return { answers: res.data.answers, source: res.data.source || 'ai' };
    }
  } catch (err) {
    console.warn('AI matchmaker unavailable, using local parser', err?.message);
  }
  return { answers: parsePromptLocally(prompt), source: 'local' };
}
