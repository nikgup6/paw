/* The balloon, in one place.

   It started life inside components/results/MatchReveal.jsx, drawn once for the Top-5
   reveal, and was pulled out here when the home hero's dog badges needed the same balloon.
   Those badges were removed on 2026-10-20, so the reveal is the only caller again — but the
   drawing stays here rather than going back inline, because a second copy of an SVG is a
   copy that drifts the moment anything else wants a balloon.

   What deliberately did NOT move: MatchReveal's own layout and animation CSS (the
   full-screen rise, the sway, its reduced-motion rule). Those are still in that file,
   untouched, so the reveal renders exactly the same pixels it did before. Only the
   picture itself is shared.

   HOW TO EDIT
   - Balloon colours: BALLOON_COLOURS.
   - Where the reveal's balloons start and how fast they rise: BALLOON_LAYOUT. */

const NAVY = '#011E4A';

export const BALLOON_COLOURS = [
  { fill: '#F5691A' },
  { fill: '#FFD9BD' },
  { fill: '#011E4A' },
  { fill: '#E3ECF7' },
  { fill: '#FFFFFF' },
];

/* x = left position in %, size = balloon width in px, delay/dur in ms, c = index into
   BALLOON_COLOURS. Fixed values (no Math.random) so the layout is the same on every render.
   For a "Good" result only every second balloon is used (0, 2, 4, 6, 8). */
export const BALLOON_LAYOUT = [
  { x: 6, size: 60, delay: 0, dur: 2900, c: 0 },
  { x: 82, size: 52, delay: 350, dur: 3100, c: 3 },
  { x: 24, size: 72, delay: 120, dur: 3400, c: 1 },
  { x: 68, size: 46, delay: 600, dur: 2600, c: 4 },
  { x: 45, size: 76, delay: 250, dur: 3300, c: 2 },
  { x: 90, size: 64, delay: 700, dur: 3000, c: 1 },
  { x: 14, size: 44, delay: 500, dur: 2500, c: 4 },
  { x: 58, size: 56, delay: 50, dur: 3200, c: 0 },
  { x: 34, size: 50, delay: 650, dur: 2800, c: 3 },
  { x: 75, size: 70, delay: 400, dur: 3400, c: 2 },
];

/** One balloon, drawn. Decorative everywhere it is used, so it carries no label. */
export const BalloonArt = ({ size = 60, colour = BALLOON_COLOURS[0] }) => (
  <svg viewBox="0 0 60 92" width={size} height={Math.round((size * 92) / 60)} fill="none" aria-hidden="true" focusable="false">
    <ellipse cx="30" cy="30" rx="25" ry="29" fill={colour.fill} stroke={NAVY} strokeWidth="2.5" />
    <path d="M17 20c2-6 7-9 12-9" stroke="#fff" strokeOpacity=".55" strokeWidth="3" strokeLinecap="round" />
    <path d="M30 59l-4.5 6.5h9z" fill={colour.fill} stroke={NAVY} strokeWidth="2.5" strokeLinejoin="round" />
    <path d="M30 66c-5 5 5 8 0 13s-5 8 0 12" stroke={NAVY} strokeWidth="2" strokeLinecap="round" />
  </svg>
);
