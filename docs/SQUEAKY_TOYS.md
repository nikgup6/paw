# Squeaky toys: a plain-language guide

Nine illustrated dog toys sit on a few pages. Tap or click one: it squashes and bounces for a quarter of a second and
plays a short squeak. They are decoration only, and no toy is needed for anything on the site.

## Where things are

| File | What it does |
|---|---|
| `frontend/src/constants/toys.js` | **The one place to edit.** The nine toys (name, picture, shape, pitch `rate`) and `TOY_PLACEMENTS`, which lists every spot: where, how big, how tilted, and on which screen size. Move or delete a row to move or remove a toy. |
| `frontend/src/components/fun/SqueakyToy.jsx` | One toy (a real button), the box that holds a group of toys (`ToySlots`), and the non-clickable one for the loading screen (`ToyPlain`). |
| `frontend/src/components/fun/ToyContext.jsx` | The random order for this page view, and the "stay away now" switch (used while the loading screen, quiz or match reveal is open). |
| `frontend/src/utils/sounds.js` (`playToy`) | Loads the squeak the first time a toy is tapped and plays it. |
| `frontend/src/constants/quizAudio.js` (`TOY_VOLUME`) | How loud the squeak is. |
| `frontend/public/toys/` | Your nine pictures, untouched. `toys/sm/` holds smaller copies (220 px) that the page actually loads. |
| `frontend/public/audio/toy-squeak.ogg` and `.mp3` | Your squeak, untouched (the `.mp3` is for browsers that cannot play Ogg Opus). |

## How it behaves

- Which toy goes where is random once per page view, and a toy never appears twice on the same page.
- No sound on page load, ever. The squeak file is fetched the first time a toy is tapped, then kept.
- Each tap plays the whole squeak once at the toy's own pitch (plus or minus 5 percent). At most 3 sound at once; a toy
  ignores taps during its own squish. If the site is muted, or sound is blocked, or the file cannot load, the toy still
  squishes and stays silent.
- Reduced motion: no wobble and no squash; the sound still plays.
- Not on: the quiz, the lead gate, login, signup, admin, the owner app, or during the match reveal.
- After 8 squeaks in one visit, the toy you just squeezed barks once and says "Good boy!" for 1.5 seconds (once per visit).
- Tracking: `toy_squeaked {toy, page}`, at most once per toy per page per visit. No personal data.

## Changing the sound's pitch

Each toy has a `rate` in `constants/toys.js` (1 = the recording as it is; lower = deeper and a little longer). Keep every
rate between 0.7 and 1.15. Your recording is bright (most of its energy is around 5 to 6 kHz), so lowering it makes it
deeper without making it muddy, but listen to the rope (0.75) and the plush toys (0.8 to 0.85) and raise them if you
want them lighter.
