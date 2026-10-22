/* Small display helpers for Breed Swipe. They only READ breed fields and
   format them; nothing here scores, ranks or changes a breed.

   NOTE: nothing here (or in the swipe components) uses any looks-based field to
   sort, filter or highlight. The product is "the right breed, not the cutest breed". */

/** Copied from BreedSlider.jsx (describeBreed) so that file stays untouched.
    Editorial one-liner for a breed with no quiz answers to personalise on. */
export const describeBreed = (b) => {
  const sizeWord = { S: 'small', M: 'medium-sized', L: 'large', X: 'giant' }[(b.size || 'M').trim()[0]] || '';
  const role = (b.purpose || 'Companion').split('/')[0].trim().toLowerCase();
  const energy = (b.energy || 'Medium').split('–')[0].trim().toLowerCase();
  return `A ${sizeWord} ${role} with ${energy} energy — happiest with ${(b.time || 'about an hour').toLowerCase()} of engagement every day.`;
};

const cap = (s = '') => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** "Large · Family Dog" */
export function cardLine(b) {
  const size = { S: 'Small', M: 'Medium', L: 'Large', X: 'Giant' }[(b.size || 'M').trim()[0]] || '';
  const purpose = (b.purpose || 'Companion').split('/')[0].trim();
  return [size, purpose].filter(Boolean).join(' · ');
}

/** "High – 1–2 hrs vigorous daily" -> ['High', '1–2 hrs vigorous daily'] */
export function splitLead(text = '') {
  const i = text.indexOf(' – ');
  if (i === -1) return [text.trim(), ''];
  return [text.slice(0, i).trim(), text.slice(i + 3).trim()];
}

const fmtK = (n) => `${+(Number(n) / 1000).toFixed(1)}k`;
export const monthlyChip = (b) => `₹${fmtK(b.monthlyCostMin)}–${fmtK(b.monthlyCostMax)} / month`;
export const rupees = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
export const monthlyRange = (b) => `${rupees(b.monthlyCostMin)} to ${rupees(b.monthlyCostMax)} a month`;
export const puppyRange = (b) => `${rupees(b.puppyPriceMin)} to ${rupees(b.puppyPriceMax)}`;

/** Four practical facts for the FRONT of the card, taken from real fields. */
export function factChips(b) {
  const energy = splitLead(b.energy || '')[0] || 'Medium';
  return [
    `${energy} energy`,
    /^yes/i.test((b.apt || '').trim()) ? 'Flat OK' : 'Needs a house',
    `${(b.shedding || 'Medium')} shedding`,
    monthlyChip(b),
  ];
}

/** Ring colour follows the engine's label. */
export function ringColour(label = '') {
  if (/^(Excellent|Good)/.test(label)) return '#F5691A';
  if (/^Fair/.test(label)) return '#E8A33D';
  return '#C0463C'; // Not recommended
}

/** First 3 health items, source in brackets removed. */
export function healthItems(b) {
  return (b.health || '')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3)
    .map(cap);
}

/** The raw `climate` field is multi-line ("MEDIUM CLIMATE / Best cities / Manageable with").
    We never print it raw: a short band label plus the first sentence of the
    "Manageable with" line. */
export function climateInfo(b) {
  const lines = String(b.climate || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const band = lines[0] ? cap(lines[0].toLowerCase()) : '';
  const manage = (lines.find((l) => /^manageable with:/i.test(l)) || '').replace(/^manageable with:\s*/i, '');
  const first = manage.match(/^.*?[.!?](?=\s|$)/);
  const note = manage ? cap((first ? first[0] : manage).trim()) : '';
  return { band, note: note && !/[.!?]$/.test(note) ? `${note}.` : note };
}

export const cities = (b) => (b.idealCities || '').split(',').map((s) => s.trim()).filter(Boolean);
