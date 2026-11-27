# Word Hunt

Trace words across a fresh toss of letter dice. Drag through touching tiles
(sides and diagonals, no reusing or skipping a tile), let go to play the word.

- Grids from 3×3 to 6×6, untimed or 1 / 2 / 3 minute timer
- Mouse, touch or keyboard (type a word and press Enter, or arrow keys + Space)
- Names and slang are recorded in blue but score nothing
- Optional (Settings): show how many words are on the board and reveal the
  ones you missed

Scoring: 3–4 letters 1, 5 letters 2, 6 letters 3, 7 letters 5, 8+ letters 11.
**Qu** is one tile and counts as two letters.

Plain HTML, CSS and JS modules — no build step. Serve the folder with any
static server, e.g. `python3 -m http.server` from the repo root.

## Files

| Path | What |
|------|------|
| `index.html`, `style.css` | Page and styles (mobile first; landscape phones get a side-by-side layout) |
| `src/logic.js` | Pure logic: dice, adjacency, scoring, word lookup, solver |
| `src/main.js` | UI: drag + keyboard input, timer, word lists, dialogs |
| `words/words.txt` | Scoring words, front-coded (see `tools/build-words.mjs`) |
| `words/extra.txt` | Zero-point names (capitalised) and slang (lowercase) |
| `tools/` | Word list build script plus hand-written place and slang lists |
| `tests/` | `npm test` (Node 20+) |

## Word lists

- Scoring words: [ENABLE](https://github.com/dolph/dictionary/blob/master/enable1.txt)
  (public domain), 3+ letters.
- Names: Webster's Second International and `propernames` from `/usr/share/dict`
  (public domain), plus `tools/places.txt`.
- Slang: `tools/slang.txt`.

To rebuild after editing the lists:

```sh
curl -sSLO https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt
node tools/build-words.mjs enable1.txt
```

The dice are an original set of 36, dealt from an English letter-frequency pool.
