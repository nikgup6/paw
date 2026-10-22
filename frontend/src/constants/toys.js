/* SQUEAKY TOYS: the nine toys, and where each one sits on the site. Everything you may want to change is in this file.

   TO MOVE OR REMOVE A TOY: edit its row in TOY_PLACEMENTS (or delete the row).
   TO CHANGE HOW A TOY SOUNDS: change its `rate` (1 = the recording as it is, lower = deeper and a little slower).
   Keep every rate between 0.7 and 1.15, so it never sounds like a chipmunk or a slow tape.

   THE PICTURES
   - `file` is the picture you supplied, kept untouched in public/toys/ (up to 400 px wide, about 35 KB each).
   - `small` is a smaller copy of the same picture in public/toys/sm/ (220 px on the long side, about 10 to 16 KB each).
     The site shows toys at 70 to 140 px, so the page loads the small copies: that keeps the whole homepage's toy
     pictures under the 100 KB budget. To use your originals instead, point `small` at `file`.
   - w and h are the real pixel size of the supplied picture (they set the shape of the box, so nothing jumps around
     while it loads). */

export const TOYS = {
  'ball-orange':  { name: 'tennis ball',  file: '/toys/ball-orange.webp',  small: '/toys/sm/ball-orange.webp',  w: 328, h: 320, rate: 0.95 },
  'ball-paws':    { name: 'paw ball',     file: '/toys/ball-paws.webp',    small: '/toys/sm/ball-paws.webp',    w: 351, h: 350, rate: 1.05 },
  'ball-rainbow': { name: 'rainbow ball', file: '/toys/ball-rainbow.webp', small: '/toys/sm/ball-rainbow.webp', w: 372, h: 365, rate: 1.1 },
  'bone':         { name: 'chew bone',    file: '/toys/bone.webp',         small: '/toys/sm/bone.webp',         w: 400, h: 253, rate: 1.05 },
  'dumbbell':     { name: 'dumbbell toy', file: '/toys/dumbbell.webp',     small: '/toys/sm/dumbbell.webp',     w: 400, h: 202, rate: 1.0 },
  'fox-plush':    { name: 'fox plush',    file: '/toys/fox-plush.webp',    small: '/toys/sm/fox-plush.webp',    w: 400, h: 278, rate: 0.85 },
  'puppy-plush':  { name: 'puppy plush',  file: '/toys/puppy-plush.webp',  small: '/toys/sm/puppy-plush.webp',  w: 400, h: 245, rate: 0.8 },
  'ring-paws':    { name: 'ring toy',     file: '/toys/ring-paws.webp',    small: '/toys/sm/ring-paws.webp',    w: 355, h: 344, rate: 1.0 },
  'rope':         { name: 'rope toy',     file: '/toys/rope.webp',         small: '/toys/sm/rope.webp',         w: 400, h: 276, rate: 0.75 },
};

/* ---------------------------------------------------------------------------------------------
   WHERE THE TOYS SIT.

   Positions are fixed (so the layout never moves). WHICH toy is in each spot is picked at random once per page view and
   no toy appears twice on the same page: the nine toys are shuffled, and a spot's `index` says which one of the
   shuffled list it gets (0 = first, 1 = second ...; a negative number counts from the END of the list: -1 = last).
   Spots on the page itself use 0, 1, 2 ... and the footer uses -1, -2, -3, so they can never collide.

   One row = one toy spot:
     id      a name for the spot
     index   which toy of the shuffled list (see above)
     show    'all' | 'desktop' | 'phone'   (desktop = 700 px wide and up)
     size    how wide it is drawn, in px
     rotate  the tilt in degrees
     toy     OPTIONAL. A key of TOYS, to pin that exact toy to this spot instead of taking one from the
             shuffle. A pinned toy is removed from the shuffle, so it still cannot appear twice on a page.
     minW    OPTIONAL. Only show this spot at this viewport width or wider (px).
     maxW    OPTIONAL. Only show this spot at this viewport width or narrower (px).
             Use these when a group's layout breaks somewhere other than the 700px `show` split.
     pos     CSS position inside its group's box, e.g. { left: '2%', bottom: '10px' } (a toy near an edge is cropped there)

   Groups (each one is a box placed on a page, see where <ToySlots group="..."/> is used):
     homeHero    over the homepage's first screen          homeTrust   at the edge of the "wrong breed" section
     homeEnd     before the footer on the homepage         footer      a small pile sitting on top of the footer
     results     the results page, beside the #1 match     play        the margins of the /play page
     loading     the loading screen (not clickable)
   At most 3 toys show at once on a phone and 5 on a desktop. */
export const TOY_PLACEMENTS = {
  /* The hero's toys are PINNED by name (the `toy` field) rather than drawn from the shuffle,
     because the hero is the one screen whose composition is designed rather than surprising:
     the tennis ball peeks over the top right corner, the puppy plush sits by the button on a
     phone and beside the trust row on a desktop, and the bone and fox frame the breed stage.
     A pinned toy is taken out of the shuffle, so no other spot on the page can repeat it.
     Phone shows 2, desktop shows 5. */
  homeHero: [
    /* Widths are set with minW / maxW, not `show`, because this hero switches to two
       columns at 900px while `show` splits at 700px — using `show` here would drop the
       desktop toys onto the phone layout for everything between 768 and 899. */
    { id: 'hero-ball', toy: 'ball-orange', index: 0, show: 'all', size: 88, rotate: 12, pos: { right: '-42px', top: '64px' } },
    /* phone and tablet: tucked into the empty margin beside the breed photo, not near the
       button — there the button is full width with the trust row under it, so a toy down
       there would land on the words */
    { id: 'hero-pup-phone', toy: 'puppy-plush', index: 1, show: 'all', maxW: 899, size: 72, rotate: -9, pos: { left: '-32px', top: '32%' } },
    /* Left of the trust row. Only from 1360px up: below that the text column is flush with
       the page edge and there is no margin to sit in without covering the trust row. */
    { id: 'hero-pup-desk', toy: 'puppy-plush', index: 1, show: 'all', minW: 1360, size: 96, rotate: -12, pos: { left: '2px', bottom: '24%' } },
    /* in the gap between the text column and the breed stage */
    { id: 'hero-rainbow', toy: 'ball-rainbow', index: 2, show: 'all', minW: 900, size: 66, rotate: 16, pos: { left: '45%', top: '84px' } },
    /* low in the corner: at 1280 the thumbnail row reaches further right than at 1440, and
       anything higher than this clipped its last thumbnail */
    { id: 'hero-bone', toy: 'bone', index: 3, show: 'all', minW: 900, size: 92, rotate: -18, pos: { right: '0%', bottom: '-18px' } },
    { id: 'hero-fox', toy: 'fox-plush', index: 4, show: 'all', minW: 900, size: 84, rotate: 9, pos: { right: '46%', bottom: '-34px' } },
  ],
  homeTrust: [   // this group's box starts 80 px above the section (see TOY_GROUP_BOX), so top: 90px = 10 px into the section
    { id: 'trust-desk', index: 2, show: 'desktop', size: 96, rotate: 16, pos: { left: '-26px', top: '90px' } },
    { id: 'trust-phone', index: 2, show: 'phone', size: 90, rotate: 14, pos: { left: '-34px', top: '0px' } },
  ],
  homeEnd: [
    { id: 'end-a', index: 3, show: 'all', size: 100, rotate: -10, pos: { right: '-24px', bottom: '8px' } },
  ],
  footer: [   // a pile resting on the footer: 2 toys on a phone, 3 on a desktop (each pile is centred on its own)
    { id: 'foot-phone-a', index: -1, show: 'phone', size: 84, rotate: -8, pos: { left: 'calc(50% - 88px)', bottom: '0px' } },
    { id: 'foot-phone-b', index: -2, show: 'phone', size: 78, rotate: 7, pos: { left: 'calc(50% + 6px)', bottom: '0px' } },
    { id: 'foot-desk-a', index: -1, show: 'desktop', size: 92, rotate: -8, pos: { left: 'calc(50% - 150px)', bottom: '0px' } },
    { id: 'foot-desk-b', index: -2, show: 'desktop', size: 84, rotate: 6, pos: { left: 'calc(50% - 42px)', bottom: '0px' } },
    { id: 'foot-desk-c', index: -3, show: 'desktop', size: 90, rotate: -4, pos: { left: 'calc(50% + 62px)', bottom: '0px' } },
  ],
  results: [   // attached to the "Your Pawfect Matches" heading block (its box reaches 96 px below it, see TOY_GROUP_BOX)
    { id: 'res-phone', index: 0, show: 'phone', size: 80, rotate: -12, pos: { left: '2px', bottom: '14px' } },
    /* The Top 5 heading is now a 72px two-line title filling the left half of the block, so the
       old left-hand spot sat on the words. Measured at 1280: the title text ends at x572 and the
       warnings chip starts at x1052, which leaves this middle band empty. Below 1200 the band is
       too narrow to be sure of, so that toy simply does not show there. */
    { id: 'res-desk-a', index: 0, show: 'desktop', minW: 1200, size: 100, rotate: -12, pos: { left: '46%', top: '30px' } },
    /* Above the warnings chip, which sits at the bottom right of the title block. */
    { id: 'res-desk-b', index: 1, show: 'desktop', minW: 1024, size: 104, rotate: 10, pos: { right: '8px', top: '18px' } },
  ],
  play: [   // the page itself: the header's empty right side on a phone, the side margins around the game on a desktop
    { id: 'play-phone', index: 0, show: 'phone', size: 54, rotate: -10, pos: { right: '12px', top: '3px' } },
    { id: 'play-desk-a', index: 0, show: 'desktop', size: 104, rotate: -10, pos: { right: '-26px', top: '150px' } },
    { id: 'play-desk-b', index: 1, show: 'desktop', size: 104, rotate: 9, pos: { left: '-26px', top: '400px' } },
  ],
  loading: [
    { id: 'load-a', index: 4, show: 'all', size: 96, rotate: 0, pos: { left: 'calc(50% - 48px)', bottom: '16%' } },
  ],
};

/** Every toy pinned by name anywhere in TOY_PLACEMENTS. ToySlots takes these out of the shuffled
    list, so a pinned toy can never also be handed to an unpinned spot on the same page. */
export const PINNED_TOYS = new Set(
  Object.values(TOY_PLACEMENTS).flat().map((p) => p.toy).filter(Boolean),
);

/** Some groups need a box that reaches past the edge of the place they are attached to, so a toy can sit in the gap
    above a section. Values are CSS (a negative `top` reaches upward). */
export const TOY_GROUP_BOX = {
  homeTrust: { top: '-80px' },
  results: { bottom: '-96px' },
};

/** The pages where the pile of toys on the footer may show. Never on login, signup, admin, the owner app or the quiz page. */
export const FOOTER_TOY_PATHS = ['/', '/play', '/explore', '/stickers', '/results'];

/* ---- the shuffle (small and seeded, nothing is stored anywhere) ---- */

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The nine toy names in a random order that depends only on `seed`. */
export function shuffledToyKeys(seed) {
  const keys = Object.keys(TOYS);
  const rnd = mulberry32(seed);
  for (let i = keys.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [keys[i], keys[j]] = [keys[j], keys[i]];
  }
  return keys;
}

/** The toy for a spot: `index` counts from the start (0, 1, 2 ...) or from the end (-1, -2 ...).
    Both ends wrap, so a short list (one with several toys pinned elsewhere, see PINNED_TOYS)
    repeats a picture instead of handing back undefined. */
export const toyForIndex = (order, index) => {
  const n = order.length;
  if (!n) return undefined;
  return order[((index % n) + n) % n];
};
