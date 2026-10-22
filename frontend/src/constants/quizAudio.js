/* Sound settings for the quiz and the match reveal. Edit here.

   MUSIC (optional, off until you supply the file)
   - QUIZ_MUSIC_LIVE = false hides the speaker button completely (no dead button).
   - To turn it on: put your track at public/audio/quiz-music.mp3, then set QUIZ_MUSIC_LIVE = true.
   - It never starts by itself (browsers block that): it plays only after a person taps the speaker,
     it remembers their choice, and it stops when the quiz closes.

   DRUMROLL + BARK (match reveal)
   - By default the drumroll is made in code (Web Audio), so no file is needed.
   - To use your own sound instead, put it in public/audio/ and set DRUMROLL_FILE to its path,
     for example '/audio/drumroll.mp3'. */

export const QUIZ_MUSIC_LIVE = false;
export const QUIZ_MUSIC_FILE = '/audio/quiz-music.mp3';
export const QUIZ_MUSIC_VOLUME = 0.35;

export const DRUMROLL_FILE = '';
export const DRUMROLL_VOLUME = 0.7;

/* THE PORTAL (match reveal, phase 1).
   Vibhuvan's own recording, used exactly as supplied - nothing is re-encoded here.
   It is 2.26s long, which is about the length of the portal itself; whatever is left
   is cut with a short fade when the portal opens, so the cut is never heard.
   It is only fetched when a reveal actually runs, never on page load.

   Set PORTAL_FILE to '' to go back to a silent portal.

   NOTE: this is a .wav, so it is 389 KB. The same sound as an .mp3 would be about a
   tenth of that. Worth converting before launch; it is downloaded once per visitor. */
export const PORTAL_FILE = '/audio/portal.wav';
export const PORTAL_VOLUME = 0.55;

/* REAL DOG RECORDINGS (public/audio/). Three takes, each used where it fits:

     bark-1.mp3  a long volley, 5 barks   -> the big moment: the match reveal, right after the drumroll.
                 The file runs 4.3s but only the first BARK_REVEAL_MAX_SECONDS are played, with a short
                 fade so the cut is not heard. The file itself is untouched — nothing is re-encoded.
     bark-3.mp3  a quick flurry of 4      -> the "zoomies", the dogs sprinting across the results.
                 Played ONCE for the whole burst: it already contains four barks, so playing it per dog
                 would be a cacophony.
     bark-2.mp3  a short double woof      -> "Hear it" and the dogs on the breed cards. Pitched by breed
                 size (small = higher, large = deeper), so breeds still sound different.

   Any of these can be swapped by dropping a new file in and changing the line here. If a file is missing
   or unreadable the built-in Web Audio bark plays instead, so the site is never silent by accident. */
export const BARK_REVEAL_FILE = '/audio/bark-1.mp3';
export const BARK_REVEAL_MAX_SECONDS = 3;      // "the first 3 seconds", per the brief
export const BARK_ZOOMIES_FILE = '/audio/bark-3.mp3';
export const BARK_DEFAULT_FILE = '/audio/bark-2.mp3';

/* The in-code bark, now only a fallback (and the squeaky-toy "good boy" / game crash sound). */
export const BARK_FILE = '';
export const BARK_VOLUME = 0.8;
export const BARK_COUNT = 2;

/* PER-BREED BARKS (Bark Mixer + "Hear it" buttons)
   To add a real recording: drop the file into public/audio/barks/ and add ONE line to BARK_FILES,
   keyed by the exact breed name from breeds.json, e.g.  'Beagle': '/audio/barks/beagle.mp3'.
   A breed with no line falls back to the in-code Web Audio bark, whose pitch and tempo come from the
   breed's size (small = higher and quicker, large = lower and slower), so breeds still sound different.
   Use only recordings you own or have the rights to; nothing is downloaded or hot-linked. */
export const BARK_FILES = {
  // 'Beagle': '/audio/barks/beagle.mp3',
};

/* The order in which the "Walk the dog" game unlocks bark buttons (every 10 streets = 1,000 m in one
   run unlocks the next breed). Breeds NOT listed here are always playable, and the matched #1 breed on
   the results page is always unlocked. */
export const BARK_UNLOCK_ORDER = [
  'Beagle', 'Pug', 'Shih Tzu', 'Pomeranian', 'Labrador Retriever', 'Golden Retriever',
  'German Shepherd', 'Dachshund', 'Cocker Spaniel', 'Siberian Husky', 'Boxer', 'Rottweiler',
];

export const BARK_MAX_SECONDS = 2; // the longest a bark (or a remixed bark) may sound

/* SQUEAKY TOYS (components/fun/SqueakyToy.jsx). The squeak is ONE recording you supplied, played as it is:
   public/audio/toy-squeak.ogg, with toy-squeak.mp3 for browsers that cannot play Ogg Opus (older Safari).
   TOY_VOLUME is how loud it is (0 to 1). Each toy's own pitch is its `rate` in constants/toys.js. */
export const TOY_VOLUME = 0.6;
