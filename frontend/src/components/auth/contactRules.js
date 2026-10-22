/* The contact form's rules, kept in step with backend/app/services/contact_service.py.
   The server decides; these only let the form say what is wrong before a round trip. */

/* Stored codes and what people see. Never free text. */
export const AGE_RANGES = [
  ['u20', 'Under 20'],
  ['20_24', '20 to 24'],
  ['25_29', '25 to 29'],
  ['30_34', '30 to 34'],
  ['35_44', '35 to 44'],
  ['45p', '45 and above'],
  ['na', 'Prefer not to say'],
];

const OBVIOUSLY_FAKE = new Set(['1234567890', '9876543210']);

/* What someone typed -> 10 digits: drops spaces and dashes, and a leading +91, 91 or 0. */
export function normaliseMobile(raw = '') {
  let d = String(raw).replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d;
}

/* Plain words for what is wrong with the number, or '' when it looks fine. */
export function mobileProblem(digits) {
  if (!digits) return 'Please enter your mobile number.';
  if (digits.length !== 10) return 'Please enter a 10-digit mobile number.';
  if (!/^[6-9]/.test(digits)) return 'Indian mobile numbers start with 6, 7, 8 or 9.';
  if (/^(\d)\1{9}$/.test(digits) || OBVIOUSLY_FAKE.has(digits)) return 'Please enter your real mobile number.';
  return '';
}

export function nameProblem(name) {
  return name.trim().length < 2 ? 'Please enter your name.' : '';
}

export function emailProblem(email) {
  const e = email.trim();
  return e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? 'That email does not look right. You can also leave it empty.' : '';
}
