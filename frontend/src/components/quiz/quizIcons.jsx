import React from 'react';

/* Small stroke icons for the quiz option cards.
   Every glyph is drawn on a 24x24 grid with `currentColor` strokes, so the
   card decides the colour (orange on a peach circle). No image files.

   HOW TO EDIT
   - To change which icon an answer uses, edit OPTION_ICON below. The key is
     the saved option value (`val` in questions.json). When two questions reuse
     the same value ('none', 'moderate'), use "questionId:val" to tell them apart.
   - To add a new drawing, add an entry to GLYPHS and point an option at it.
   - Anything without a mapping falls back to a paw print. */

const Person = ({ x = 0, scale = 1, cane = false }) => (
  <g transform={`translate(${x} 0) scale(${scale})`} style={{ transformOrigin: '12px 12px' }}>
    <circle cx="12" cy="8" r="3" />
    <path d="M6.5 20c0-3.2 2.4-5.5 5.5-5.5s5.5 2.3 5.5 5.5" />
    {cane && <path d="M19 14v6" />}
  </g>
);

const GLYPHS = {
  paw: (
    <>
      <ellipse cx="12" cy="16" rx="4.2" ry="3.4" />
      <circle cx="6" cy="11" r="1.6" />
      <circle cx="9.6" cy="6.8" r="1.6" />
      <circle cx="14.4" cy="6.8" r="1.6" />
      <circle cx="18" cy="11" r="1.6" />
    </>
  ),
  user: (<><circle cx="12" cy="8" r="3.4" /><path d="M5 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5" /></>),
  clock: (<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>),
  pin: (<><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.2" /></>),
  closeX: (<path d="M6 6l12 12M18 6L6 18" />),
  speaker: (<><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" /></>),
  speakerOff: (<><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="M16 9.5l5 5M21 9.5l-5 5" /></>),
  check: (<path d="M5 12.5l4.5 4.5L19 7.5" />),

  flat: (<><path d="M3 11l9-7 9 7" /><path d="M5.5 10v10h13V10" /><path d="M10 20v-5h4v5" /></>),
  flatBig: (<><path d="M5 21V4h14v17" /><path d="M9 8h2M13 8h2M9 12h2M13 12h2" /><path d="M10 21v-4h4v4" /></>),
  towers: (<><path d="M3 21V9h7v12M14 21V3h7v18" /><path d="M6 13h1M6 17h1M17 7h1M17 11h1M17 15h1" /></>),
  house: (<><path d="M3 12l9-7.5L21 12" /><path d="M5.5 10.5V20h13v-9.5" /><rect x="10" y="14" width="4" height="6" /></>),
  houseYard: (<><path d="M2.5 12l7-6 7 6" /><path d="M4.5 11v9h10v-9" /><path d="M19 20v-6" /><circle cx="19" cy="11.5" r="2.5" /></>),
  bed: (<><path d="M3 19V6" /><path d="M3 14h18v5" /><path d="M21 14v-2.5A2.5 2.5 0 0 0 18.5 9H11v5" /><circle cx="7" cy="11" r="1.6" /></>),
  question: (<><circle cx="12" cy="12" r="8.5" /><path d="M9.6 9.6a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1.1 1-1.1 1.8" /><path d="M12 17h.01" /></>),

  tile: (<><rect x="4" y="4" width="16" height="16" rx="1.5" /><path d="M12 4v16M4 12h16" /></>),
  tileRug: (<><rect x="4" y="4" width="16" height="16" rx="1.5" /><path d="M4 12h8v8M12 4v8h8" /></>),
  rug: (<><rect x="4.5" y="7" width="15" height="10" rx="1.5" /><path d="M8 7v10M16 7v10M2.5 10h2M2.5 14h2M19.5 10h2M19.5 14h2" /></>),

  baby: (<><circle cx="12" cy="9" r="4" /><path d="M10.2 9.2h.01M13.8 9.2h.01" /><path d="M10.5 11.4c.9.7 2.1.7 3 0" /><path d="M7 20c0-2.6 2.2-4.4 5-4.4s5 1.8 5 4.4" /></>),
  kids: (<><g transform="translate(-4 2) scale(.75)" style={{ transformOrigin: '12px 12px' }}><Person /></g><g transform="translate(4 1) scale(.85)" style={{ transformOrigin: '12px 12px' }}><Person /></g></>),
  senior: (<Person cane />),
  everyone: (<><Person x={-5} scale={0.78} /><Person x={5} scale={0.78} cane /></>),
  adults: (<><Person x={-5} scale={0.82} /><Person x={5} scale={0.82} /></>),

  sofa: (<><path d="M5 11V8.5A2.5 2.5 0 0 1 7.5 6h9A2.5 2.5 0 0 1 19 8.5V11" /><path d="M3 12.5a2 2 0 0 1 4 0V15h10v-2.5a2 2 0 0 1 4 0V18H3z" /><path d="M6 18v2M18 18v2" /></>),
  walk: (<><circle cx="13" cy="4.5" r="1.8" /><path d="M13 7.5l-2.5 4 3 2.5-1 5.5" /><path d="M10.5 11.5l-3 .5M13.5 14l3 1.5" /><path d="M10.5 11.5L12 9" /></>),
  bolt: (<path d="M13 3L5 13.5h6L10 21l8-10.5h-6z" />),

  homeAll: (<><path d="M3 11l9-7 9 7" /><path d="M5.5 10v10h13V10" /><path d="M12 17.5s-3-1.8-3-3.6a1.7 1.7 0 0 1 3-.9 1.7 1.7 0 0 1 3 .9c0 1.8-3 3.6-3 3.6z" /></>),
  clock4: (<><circle cx="12" cy="12" r="8.5" /><path d="M12 12V7.5M12 12h4.5" /></>),
  clock8: (<><circle cx="12" cy="12" r="8.5" /><path d="M12 12V7.5M12 12l-3.2 3.2" /></>),
  clockLong: (<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l-4 2" /><path d="M16.5 17.5l2.5 2.5" /></>),

  coin1: (<><circle cx="12" cy="12" r="8.5" /><path d="M9 8.5h6M9 11.5h6M10 8.5c3.5 0 3.5 4 0 4l4 3.5" /></>),
  coin2: (<><circle cx="9.5" cy="10" r="6" /><path d="M7.5 8h4M7.5 10.5h4" /><path d="M15.5 8.2A6 6 0 1 1 8.2 16" /></>),
  coin3: (<><rect x="3.5" y="7" width="17" height="11" rx="2" /><circle cx="12" cy="12.5" r="2.6" /><path d="M6.5 10v.01M17.5 15v.01" /></>),
  gem: (<><path d="M6 4h12l3 5-9 11L3 9z" /><path d="M3 9h18M9.5 4L8 9l4 11 4-11-1.5-5" /></>),

  sprout: (<><path d="M12 21v-8" /><path d="M12 13c0-3.5-2.5-5.5-6-5.5 0 3.5 2.5 5.5 6 5.5z" /><path d="M12 11c0-3 2.2-5 5.5-5 0 3-2.2 5-5.5 5z" /></>),
  repeat: (<><path d="M4 10V8a3 3 0 0 1 3-3h11" /><path d="M15 2l3 3-3 3" /><path d="M20 14v2a3 3 0 0 1-3 3H6" /><path d="M9 22l-3-3 3-3" /></>),
  medal: (<><circle cx="12" cy="9" r="5" /><path d="M8.5 13.5L7 21l5-2.5 5 2.5-1.5-7.5" /><path d="M12 6.8l.8 1.6 1.8.3-1.3 1.2.3 1.8-1.6-.9-1.6.9.3-1.8-1.3-1.2 1.8-.3z" /></>),
  star: (<path d="M12 4l2.4 5 5.4.7-4 3.7 1 5.4L12 16.2 7.2 18.8l1-5.4-4-3.7 5.4-.7z" />),

  heart: (<path d="M12 20s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 7.6 4.2 4.2 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" />),
  shield: (<><path d="M12 3l7.5 3v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V6z" /><path d="M9 12l2.2 2.2L15.5 10" /></>),
  mountain: (<><path d="M3 19l6-10 3.5 5.5L15 11l6 8z" /><path d="M7.7 12.5l1.3-.9 1.2 1" /></>),
  handHeart: (<><path d="M3 15l4-1.5 5 1.5c1 .3 1.5 1.3.8 2L9 19.5 3 18.5z" /><path d="M14 9.6c-1.7-1.2-3.2-2.6-3.2-4a2 2 0 0 1 3.2-1.4 2 2 0 0 1 3.2 1.4c0 1.4-1.5 2.8-3.2 4z" /></>),
  cane: (<><circle cx="10" cy="5.5" r="2.2" /><path d="M10 8.5v6l-2.5 5.5M10 14.5l3 5.5" /><path d="M17 9a2 2 0 0 0-3.5-1M17 9v11" /></>),
  book: (<><path d="M4 5.5A2 2 0 0 1 6 4h13v15H6a2 2 0 0 0-2 2z" /><path d="M4 5.5V21" /><path d="M8.5 8h7" /></>),

  hairShort: (<><path d="M5 14c0-4 3-7 7-7s7 3 7 7" /><path d="M8 11l1 1M12 9.5v1.5M16 11l-1 1" /><path d="M4 18h16" /></>),
  hairMedium: (<><path d="M5.5 11c0-3.6 2.7-6 6.5-6s6.5 2.4 6.5 6v7c-1 0-1.5-.8-2-1.7-.5.9-1.2 1.7-2.3 1.7s-1.8-.8-2.2-1.7c-.4.9-1.1 1.7-2.2 1.7s-1.8-.8-2.3-1.7c-.5.9-1 1.7-2 1.7z" /></>),
  hairLong: (<><path d="M6 10c0-3.2 2.4-5.5 6-5.5s6 2.3 6 5.5v10c-1 0-1.5-1-2-2.4-.6 1.4-1.3 2.4-2.4 2.4s-1.8-1-2.4-2.4c-.6 1.4-1.3 2.4-2.4 2.4S8.5 19 8 17.6C7.5 19 7 20 6 20z" /><path d="M10 11.5v.01M14 11.5v.01" /></>),
  sparkle: (<><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M18.5 16l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" /></>),

  noAllergy: (<><circle cx="12" cy="12" r="8.5" /><path d="M8.5 12.2l2.4 2.4 4.6-4.8" /></>),
  allergyMild: (<><path d="M12 3c3 3.5 5.5 6.2 5.5 9.5a5.5 5.5 0 0 1-11 0C6.5 9.2 9 6.5 12 3z" /><path d="M9.8 13.5a2.4 2.4 0 0 0 2.4 2.2" /></>),
  alert: (<><path d="M12 3.5L21 19H3z" /><path d="M12 10v4M12 16.8v.01" /></>),

  calendar1: (<><rect x="4" y="5.5" width="16" height="14.5" rx="2" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /><path d="M12 12.5v4" /></>),
  calendar3: (<><rect x="4" y="5.5" width="16" height="14.5" rx="2" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /><path d="M9 13.5h6M9 16.5h6" /></>),
  hourglass: (<><path d="M7 3.5h10M7 20.5h10" /><path d="M8 3.5c0 4 4 4.5 4 8.5s-4 4.5-4 8.5M16 3.5c0 4-4 4.5-4 8.5s4 4.5 4 8.5" /></>),
  search: (<><circle cx="10.5" cy="10.5" r="6" /><path d="M15 15l5 5" /></>),
  flag: (<><path d="M5 21V4" /><path d="M5 5h12l-2.5 4 2.5 4H5" /></>),
};

/* option value -> glyph. "questionId:val" wins over plain "val". */
export const OPTION_ICON = {
  // home
  'apt-1bhk': 'flat', 'apt-2bhk': 'flatBig', 'apt-3bhk': 'towers',
  'house-no-yard': 'house', 'house-yard': 'houseYard', pg: 'bed', 'still-figuring-out': 'question',
  // flooring
  hard: 'tile', mixed: 'tileRug', carpeted: 'rug',
  // family
  'young-kids': 'baby', 'older-kids': 'kids', seniors: 'senior', both: 'everyone', adults: 'adults',
  // experience
  'experience:none': 'sprout', some: 'repeat', experienced: 'medal',
  // activity
  relaxed: 'sofa', 'activity:moderate': 'walk', high: 'bolt',
  // schedule
  home: 'homeAll', 'up-to-4h': 'clock4', '4-8h': 'clock8', '8h-plus': 'clockLong',
  // budget
  under5k: 'coin1', '5k-10k': 'coin2', '10k-20k': 'coin3', above20k: 'gem',
  // training effort
  minimal: 'sprout', 'trainingEffort:moderate': 'repeat', committed: 'medal',
  // purpose
  family: 'heart', guard: 'shield', active: 'mountain', therapy: 'handHeart',
  // 'seniors' under purpose reuses the family-screen icon, swapped below
  'purpose:seniors': 'cane', breed: 'search',
  // hair
  short: 'hairShort', medium: 'hairMedium', long: 'hairLong', any: 'sparkle',
  // allergies
  'allergies:none': 'noAllergy', mild: 'allergyMild', diagnosed: 'alert',
  // timeline
  ready_now: 'flag', ready_soon: 'calendar1', planning: 'calendar3', researching: 'book',
};

export const SECTION_ICON = { user: 'user', clock: 'clock', paw: 'paw' };

export function Glyph({ name, size = 24, strokeWidth = 1.8 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {GLYPHS[name] || GLYPHS.paw}
    </svg>
  );
}

/** Icon for one answer option, orange stroke (colour comes from the parent). */
export function OptionIcon({ questionId, val, size = 22 }) {
  const name = OPTION_ICON[`${questionId}:${val}`] || OPTION_ICON[val] || 'paw';
  return <Glyph name={name} size={size} />;
}
