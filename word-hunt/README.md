# Word Hunt

Trace words across a fresh toss of letter dice. Drag through touching tiles
(sides and diagonals, no reusing or skipping a tile), let go to play the word.

- Grids from 3×3 to 6×6, untimed or 1 / 2 / 3 minute timer
- Mouse, touch or keyboard (type a word and press Enter, or arrow keys + Space)
- Names and slang are recorded in blue but score nothing
- Tap any found (or missed) word to see its definition, fetched from
  Wiktionary on demand. Inflections like "jumped" also show the base word
- Share button copies a link to the current board (size, letters, timer and
  your score so far), so friends can play the same letters and see the
  points to beat. The link uses `?b=` plus a code with
  one shifted letter per tile, so it doesn't give the board away. It only
  appears in the address bar when you open someone's link
- Music button (speaker / muted speaker) plays "After the Practice" by Jono
  Hey on a loop, with fades. Off by default and remembered; the file only
  downloads when music is first turned on, and it rests while the timer is
  paused or the tab is hidden. Tracks are listed in `src/music.js`
- Full screen button (corner brackets). Uses the browser's full screen mode
  where it's allowed (desktop, Android, Safari on iPad). Where it isn't
  (iPhone, and other iPad browsers if they don't offer it), the button
  explains Add to Home Screen; the manifest
  and icons in `icons/` make the home-screen version open without browser bars
- Words need 4+ letters by default; Settings can allow 3-letter words.
  Share links carry this rule (`m=3` or `m=4`) along with the board
- Optional (Settings): show how many words are on the board and reveal the
  ones you missed

Scoring: 3 letters (when allowed) and 4 letters 1, 5 letters 2, 6 letters 3, 7 letters 5, 8+ letters 11.
**Qu** is one tile and counts as two letters.

Plain HTML, CSS and JS modules — no build step. Serve the folder with any
static server, e.g. `python3 -m http.server` from the repo root.

## Files

| Path | What |
|------|------|
| `index.html`, `style.css` | Page and styles (mobile first; landscape phones get a side-by-side layout) |
| `src/logic.js` | Pure logic: dice, adjacency, scoring, word lookup, solver |
| `src/main.js` | UI: drag + keyboard input, timer, word lists, dialogs, definition popover |
| `src/music.js` | Background music: track list, fades, pause handling |
| `music/` | Music files (AAC, ~96 kbps). Convert with `afconvert -f m4af -d aac -b 96000 in.wav out.m4a` |
| `src/define.js` | Fetches and caches definitions from Wiktionary's REST API |
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
- Definitions: [Wiktionary](https://en.wiktionary.org/) (CC BY-SA), fetched
  live when a word is tapped; nothing is bundled.

To rebuild after editing the lists:

```sh
curl -sSLO https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt
node tools/build-words.mjs enable1.txt
```

The dice are an original set of 36, dealt from an English letter-frequency pool.
