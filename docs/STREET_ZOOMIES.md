# Street Zoomies (the 3D game at /play): a plain-language guide

A three-lane runner. The orange dog runs down a street at golden hour. Dodge autos, cows, puddles, potholes and
hanging cloth lines, grab bones, get as far as you can. One life. Swipe on a phone, keys on a laptop.

This is the CORE LOOP only. Not built yet (each has a marked `// TODO` in `engine/config.js`): the boss chase every
500 m, the "zoomies" boost pickup, and unlocking barks by running streets.

## Where things are

| File | What it does |
|---|---|
| `src/pages/Play.jsx` | The /play page. Picks which game to show, keeps the page safe if the game fails, always shows "Skip to the quiz". |
| `src/components/play/ZoomiesGame.jsx` | The React side: loads the game, keeps the best score, tracking, sound button, Share. |
| `src/components/play/Hud.jsx` | The buttons and cards drawn on top of the game (score, pause, start, game over). All the words are at the top. |
| `src/components/play/engine/config.js` | **Every number you may want to change.** Speeds, jump height, lane width, camera, colours, quality limits. |
| `src/components/play/engine/GameEngine.js` | The game loop, the rules, collisions, the quality manager, and clean-up. No React inside. |
| `src/components/play/engine/spawner.js` | Decides what is on the road ahead, and keeps every run fair (see below). |
| `src/components/play/engine/models.js` | The dog, autos, cows, puddles, potholes, cloth lines and bones, built from boxes in code. |
| `src/components/play/engine/world.js` | The street, sky, lights and fog. |
| `src/components/play/engine/input.js` | Keyboard and swipe handling, in one place. |
| `src/components/play/WalkTheDog.jsx`, `engine2d.js` | The original 2D game. It is the fallback (see below). |

## Tuning the feel

Open `engine/config.js`, change a number, save, reload /play. Examples: `RUN.startSpeed`, `RUN.maxSpeed`,
`RUN.rampPerMetre` (how fast it speeds up), `MOVES.jumpHeight`, `LANES.changeMs`, `CAMERA.height`, `SPAWN.spreadSeconds`
(how crowded the street is). The switch between the 3D and the old 2D game is `GAME_MODE` in `src/constants/playGame.js`.

## How it works, in plain language

- **Fixed steps.** The rules always advance in tiny steps of 1/60 of a second, however fast the screen draws. So the game
  is the same speed on any device. A very long frame (you switched tabs) is cut short so the dog never teleports.
- **Nothing is created while playing.** The street tiles, obstacles and bones are made once and re-used, like a conveyor
  belt. Creating things mid-game makes browsers stutter.
- **Few draw calls.** Each kind of thing is one glued shape with colours on its corners, and everything shares one
  material. A whole frame is about 25 to 35 draw calls and about 24,000 triangles.
- **Fairness.** Every row of obstacles is checked: a row never blocks all three lanes, there is always time to change lane,
  and after a jump or slide there is time to recover before the next one. `selfCheck()` in `spawner.js` re-checks 10,000
  rows with fresh code. In development it runs on its own when /play opens and prints the result in the console.
  You can also run it in Node: it has no 3D code in it.
- **Quality manager.** If the game runs below about 45 fps it quietly steps down one level at a time (lower resolution, then
  no fog and a shorter view, then a "lite" look), never back up in the same run, and remembers the level for next time.
  Phones with 2 GB of memory or 2 CPU cores start in "lite".
- **Fallbacks.** No WebGL, the download fails, or an error happens: the old 2D game is shown and one `game_fallback_used`
  event is sent (`no_webgl`, `context_failed`, `load_failed` or `runtime_error`). If even that fails, a friendly card with a
  link to the quiz. If the phone takes the graphics away (switching apps) the game pauses and says "Tap to resume".
- **Reduced motion.** With "reduce motion" on, the 3D scene does not start by itself: a still picture and a "Play anyway" button.
- **Privacy.** The only things sent anywhere are analytics events: `game_started`, `game_over` (a score BUCKET, never the
  exact score), `game_cta_clicked`, `game_fallback_used`. The best score and the quality level stay on the device.

## Testing tips (development server only)

In the browser console while /play is open: `__zoomies.god = true` ignores collisions (to look around),
`__zoomies.s.dist += 500` jumps ahead, `__zoomies.level` shows the quality level, and
`__zoomies.renderer.info.render` shows draw calls and triangles. These helpers do not exist in the production build.

## The one extra library

`three` (version 0.186.1, pinned exactly, MIT licence, no dependencies of its own). It and the whole game are one separate
download that only /play fetches, so the homepage and the quiz do not get any heavier.
