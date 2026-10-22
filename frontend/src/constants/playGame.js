/* "Walk the dog" (/play): the numbers and words you may want to change.
   The 2D game is components/play/engine2d.js (rules + drawing) and components/play/WalkTheDog.jsx (screen).
   The 3D game keeps ITS numbers in components/play/engine/config.js instead. */

/* Which game /play shows:
     '3d'  the three-lane 3D runner, "Street Zoomies" (components/play/engine/*)   <- default
     '2d'  the original 2D canvas game, "Walk the dog" (components/play/WalkTheDog.jsx)
   The 2D game is also what a visitor sees if the 3D one cannot run on their device (no WebGL, an error). */
export const GAME_MODE = '3d';

export const METRES_PER_STREET = 100;   // every 100 m the dog passes one street
export const STREETS_PER_BARK = 10;     // every 10 streets walked unlocks the next breed in BARK_UNLOCK_ORDER (constants/quizAudio.js)

export const BEST_KEY = 'pb_play_best';        // localStorage: your best distance in metres (this device only)
export const STREETS_KEY = 'pb_play_streets';  // localStorage: total streets walked on this device

export const COPY = {
  title: 'Walk the dog',
  lede: 'Keep your dog walking down a busy Indian street. Hop over everything on the road.',
  controls: 'Tap anywhere, or press Space or the Up arrow, to hop.',
  start: 'Start walking',
  again: 'Play again',
  skip: 'Skip to the quiz',
  findDog: 'Find my dog',
  findLine: 'Now find the real dog that fits you.',
  share: 'Share',
  stillTitle: 'Motion is turned off on your device',
  stillBody: 'The game moves quickly, so it is paused. You can still play if you like.',
  playAnyway: 'Play anyway',
};

/** The bucket sent with game_over. Never the exact score. */
export function scoreBucket(metres) {
  if (metres < 100) return '0-99';
  if (metres < 300) return '100-299';
  return '300+';
}

export const shareLine = (metres) => `I walked ${metres} m with my PAW BUDDY dog. Beat me:`;
