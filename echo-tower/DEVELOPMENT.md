# Echo Tower — development guide

This file is the context document for future work (human or AI). It explains
the architecture, the rules engine, and exactly how to extend the game.

## Architecture

Zero dependencies, no build step. Plain ES modules + Canvas 2D.

```
index.html      page shell (header / canvas stage / footer, overlay div)
style.css       sketchy paper look for the DOM around the canvas
src/
  logic.js      PURE game rules: parseLevel(), step(state, dir), no DOM.
  levels.js     level data — ASCII maps. Add levels here.
  solver.js     BFS solver used by tests and the level checker.
  score.js      per-floor score from moves+time. Never shown raw to players.
  render.js     Canvas renderer. All "sprites" are drawn procedurally.
  audio.js      WebAudio-synthesised sound effects + ambient pad. No files.
  game.js       controller: screens, input, tween animation, HUD, storage.
  main.js       bootstrap.
tests/          node:test suites (run: npm test — no install needed)
tools/check-levels.js   design aid: prints each level + shortest solution
```

**The golden rule:** `logic.js` stays pure (no DOM/canvas/audio). Every
mechanic lives there, is exercised by `tests/`, and `game.js`/`render.js`
only *display* what logic decides. This is what keeps new mechanics cheap.

## The rules (as implemented)

- Turn-based. Player resolves first, then statues in map order.
- Statues copy the player's **attempted** direction (echo = same,
  mirror = opposite) even if the player's own move was blocked.
  Walking into a wall on purpose to shift a statue is a core tactic.
- Nothing moves into an occupied cell. Statues never step onto stairs or
  into water, and never push crates.
- Player pushes crates Sokoban-style. Crate + water = permanent bridge.
- A door is open while any button on its channel is weighted or latched.
  When a mover enters a door cell, its *own* vacated cell doesn't count as
  weight (you can't hold a door open for yourself). A door never closes on
  an occupant (the "jam" rule).
- Win = player on stairs. No death, no timer. `R` restarts (soft-locks are
  possible by design, e.g. a crate pushed into a corner).

## Map legend (levels.js)

```
#  wall          (space) void      .  floor       >  stairs
@  player        E  echo statue    M  mirror statue
$  crate         ~  water
a b c   momentary buttons (channels a/b/c)
p q r   latching buttons  (channels a/b/c)
A B C   doors              (channels a/b/c)
```

⚠️ Gotcha: keep `@` flanked by `.` or `#` in map strings. Some AI tooling
mangles email-like character runs (e.g. `x@y.$`) into literal
"[email protected]" text. If a map fails to parse with a weird
character error, check for that first.

## How to add things

### A new level
Add an entry to `LEVELS` in `src/levels.js` (name, hint, map). Then:
`node tools/check-levels.js` — it prints the shortest solution. The test
suite fails if any level is unsolvable, trivial (<3 moves), or unparseable.
Design tip: check the printed solution *length and shape*; if the solver
solves your "hard" level by holding one direction, add walls or move pieces.
Replay a custom sequence with `node tools/check-levels.js 7 right,up,up`.

### A new mechanic (terrain or entity)
1. Add the map character + cell/entity in `parseLevel()` (logic.js).
2. Implement its rules in `step()` / `tryMovePlayer()` / `tryMoveStatue()`.
3. Include its dynamic state in `serialize()` (solver correctness!).
4. Add tests in `tests/logic.test.js`.
5. Draw it in `render.js` (`drawCell` or a new entity drawer).
6. Optionally add a sound event: push a string into `events` in logic.js,
   map it in `audio.js` `play()`.

Ideas queued: lava (kills → restart), one-way tiles, horizontal-only mirror
statues, statues that fall into water (filling it), ice (slide), teleports,
multiple stairs / branching floors.

### Sprites / art
All art is procedural in `render.js` (TILE = 64px). To move to real sprites,
replace the `draw*` methods with `ctx.drawImage` from a spritesheet — the
draw interface (fractional tile coords, `moving` flags, `time` for animation)
already supports it. Colours/style constants are at the top of render.js.

### Sound / music
`audio.js` synthesises everything. Add cases to `play()`. Music is a quiet
generative pad in `startMusic()` — replace with an `<audio>` loop if real
music is wanted. `M` toggles all sound; preference persists in localStorage.

## State & storage

- `echoTower.unlocked` — highest floor index reached (title screen lets you
  start on any unlocked floor with ←/→).
- `echoTower.sound` — 'on' / 'off'.

## Dev keys & debugging

- `[` / `]` — jump to previous/next floor while playing (undocumented in UI).
- `window.echoTower` — the live Game instance (inspect `echoTower.state`,
  call `echoTower.startLevel(n)`, etc.). Also how automated browser
  playtests drive the game: dispatch `KeyboardEvent`s on `window` or
  `PointerEvent`s on the canvas (touch: swipe ≥24px = step; tap adjacent
  square = step; both handled in `setupTouch`).

## Scoring

`floorScore(moves, seconds)` in src/score.js — starts at 1000, gently
penalises moves and time, floors at 150, rounds to 10s. Total accumulates
across a run (reset when starting from the title). Deliberately never shows
players their move count or time; keep it that way — it's meant to be light.

## Deployment

The parent repo (sketchplanations-projects) serves GitHub Pages from `main`,
so merging to main deploys automatically:
https://jonohey.github.io/sketchplanations-projects/echo-tower/

## Roadmap / open ideas

- Touch controls (swipe or on-screen d-pad) for mobile.
- Move-count "par" per floor with a gentle star/tick for hitting it.
- Undo (logic states are immutable — keep a stack, pop on Z. Cheap to add.)
- Level editor: the ASCII format + check-levels.js is already most of one.
- More floors: the 10 current floors teach mechanics; floors 11+ can combine
  them harder. Keep one new idea OR one difficulty twist per floor.
- Real sprite art + Sketchplanations hand-drawn style pass.
- Package for Steam later via Electron/Tauri if it proves fun.
