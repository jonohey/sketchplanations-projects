# Echo Tower

A tiny top-down puzzle game where stone statues **echo your every move**.
Climb the tower floor by floor: reach the stairs on each floor to go up.

**Play it:** https://jonohey.github.io/sketchplanations-projects/echo-tower/

A [Sketchplanations](https://sketchplanations.com) experiment.

## How to play

| Key | Action |
|-----|--------|
| Arrow keys / WASD | Move |
| R | Restart floor |
| Q | Quit to title |
| M | Sound on/off |
| Esc | Pause menu |
| Enter | Confirm / next floor |

On a phone or tablet: **swipe** on the board to step in that direction, or
**tap a square next to your character**. Footer buttons cover restart,
sound and the pause menu.

Everything moves on a grid, one step at a time. There is no clock and no
way to die — if you get stuck, press **R** and try a different idea.
Each floor cleared adds to your score; quicker, tidier solves score a
little higher (the exact recipe is the tower's secret).

### The pieces you'll meet

- **Echo statues** copy the direction you move — even when *you* are blocked.
  Walls stop them; use that to shift them out of your way (or into position).
- **Mirror statues** move in the *opposite* direction to you.
- **Round buttons** work only while something heavy stands on them —
  you, a statue, or a crate.
- **Square switches** stay pressed forever once pressed.
- **Doors** open while a button of the same colour is active.
- **Crates** can be pushed (one at a time). Push one into **water** and it
  sinks, becoming a bridge.
- **Stairs** end the floor. Statues are afraid of them.

## Running locally

No build step, no dependencies — it's plain HTML/JS/Canvas. Serve the folder
with any static server (ES modules don't load from `file://`):

```sh
cd echo-tower
python3 -m http.server 8000
# open http://localhost:8000
```

## Tests

The game logic is pure and fully covered by tests, including a BFS solver
that proves every shipped level is solvable:

```sh
cd echo-tower
npm test               # runs node --test (no install needed)
node tools/check-levels.js       # print + solve every level
node tools/check-levels.js 3     # inspect level 3 and its shortest solution
```

See [DEVELOPMENT.md](DEVELOPMENT.md) for how to add levels, mechanics,
sprites and sounds.
