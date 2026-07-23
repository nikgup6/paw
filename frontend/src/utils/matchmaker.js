import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/* The AI Matchmaker turns one natural-language prompt into the same 9
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
  else if (has(t, ['yard', 'garden', 'lawn', 'farmhouse', 'villa'])) answers.home = ['house-yard'];
  else if (has(t, ['independent house', 'bungalow', 'duplex'])) answers.home = ['house-no-yard'];
  else if (has(t, ['2bhk', '2 bhk', 'apartment', 'flat'])) answers.home = ['apt-2bhk'];

  // Climate — city names first, then adjectives
  if (has(t, ['mumbai', 'chennai', 'kolkata', 'kochi', 'goa', 'hyderabad', 'humid', 'hot city', 'hot weather', 'tropical'])) answers.city = ['hot'];
  else if (has(t, ['shimla', 'dehradun', 'darjeeling', 'srinagar', 'ooty', 'hill station', 'cold', 'chilly'])) answers.city = ['cold'];
  else if (has(t, ['delhi', 'gurgaon', 'gurugram', 'noida', 'jaipur', 'lucknow', 'ahmedabad', 'mixed season'])) answers.city = ['mixed'];
  else if (has(t, ['bangalore', 'bengaluru', 'pune', 'chandigarh', 'mysore', 'pleasant', 'moderate'])) answers.city = ['moderate'];

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

  // Shedding
  if (has(t, ['no shed', 'low shed', 'hypoallergenic', 'allerg', 'hate hair', 'clean home', "doesn't shed", 'less hair'])) answers.shedding = ['low'];

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
