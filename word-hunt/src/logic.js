// Pure game logic for Word Hunt: dice, boards, adjacency, scoring, word
// lists and the board solver. No DOM in here, so it runs under `node --test`.

// 36 six-sided letter dice. Faces were dealt from an English letter-frequency
// pool so every die mixes vowels and consonants with no repeated faces.
// "Q" is shown as "Qu" and counts as two letters.
export const DICE = [
  "ABEILT", "EHIOPW", "AELMOT", "AILNOR", "ABDELO", "ACNOUV",
  "AENPRU", "ADEHLO", "DEIPSU", "AEMNOR", "EFINRT", "DEKMNO",
  "EHIMRS", "ELNOST", "ELRSTU", "ACFOST", "CEINST", "ADEFNT",
  "ACLORS", "AELNRT", "ABIRWY", "ACDINR", "GIKLOP", "AEMSWX",
  "HIQSTU", "ACDEGS", "EMRSTU", "AGHILY", "BEHILN", "CINRUY",
  "EINRST", "CDETUZ", "EGJORV", "GHIKOY", "AEPRST", "EFMOPT",
];

export const SIZES = [3, 4, 5, 6];
export const MIN_WORD = 3;

const VOWELS = new Set(["a", "e", "i", "o", "u"]);

/** Face letter → the lowercase text it contributes to a word. */
export function faceText(face) {
  return face === "Q" ? "qu" : face.toLowerCase();
}

function shuffle(arr, rand) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Toss the dice: pick size² dice, shuffle their positions and roll each one.
 * Returns an array of tile strings ("a", "qu", ...) in row-major order.
 */
export function rollBoard(size, rand = Math.random) {
  const dice = shuffle(DICE.slice(), rand).slice(0, size * size);
  return dice.map((die) => faceText(die[Math.floor(rand() * 6)]));
}

/** True if the share of vowel tiles is in a playable range. */
export function hasGoodVowelMix(tiles) {
  const vowels = tiles.filter((t) => VOWELS.has(t[0])).length;
  const share = vowels / tiles.length;
  return share >= 0.22 && share <= 0.55;
}

/** Index lists of each cell's neighbours (sides and diagonals). */
export function neighbours(size) {
  const out = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const list = [];
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const rr = r + dr;
          const cc = c + dc;
          if (rr >= 0 && rr < size && cc >= 0 && cc < size) list.push(rr * size + cc);
        }
      }
      out.push(list);
    }
  }
  return out;
}

export function isAdjacent(a, b, size) {
  if (a === b) return false;
  const dr = Math.abs(Math.floor(a / size) - Math.floor(b / size));
  const dc = Math.abs((a % size) - (b % size));
  return dr <= 1 && dc <= 1;
}

/** Points for a word of the given letter count (Qu counts as two). */
export function scoreWord(length) {
  if (length < MIN_WORD) return 0;
  if (length <= 4) return 1;
  if (length === 5) return 2;
  if (length === 6) return 3;
  if (length === 7) return 5;
  return 11;
}

/** Decode the front-coded words.txt into a sorted array of words. */
export function decodeWords(text) {
  const out = [];
  let prev = "";
  let start = 0;
  const len = text.length;
  while (start < len) {
    let end = text.indexOf("\n", start);
    if (end === -1) end = len;
    if (end > start) {
      const keep = text.charCodeAt(start) - 48;
      prev = prev.slice(0, keep) + text.slice(start + 1, end);
      out.push(prev);
    }
    start = end + 1;
  }
  return out;
}

/**
 * The dictionary: a sorted word array (for prefix search), a Set for exact
 * lookups, and the zero-point extras (lowercase → display form).
 */
export function makeDictionary(words, extraLines = []) {
  const set = new Set(words);
  const extras = new Map();
  for (const line of extraLines) {
    const w = line.trim();
    if (w) extras.set(w.toLowerCase(), w);
  }
  return { words, set, extras };
}

/** Is any word in the sorted list starting with `prefix`? (binary search) */
export function hasPrefix(words, prefix) {
  let lo = 0;
  let hi = words.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (words[mid] < prefix) lo = mid + 1;
    else hi = mid;
  }
  return lo < words.length && words[lo].startsWith(prefix);
}

/**
 * Classify a word: "word" (scores), "name" (proper noun), "slang", or null.
 * Returns { kind, display }.
 */
export function lookup(dict, word) {
  if (word.length < MIN_WORD) return { kind: null, display: word };
  if (dict.set.has(word)) return { kind: "word", display: word };
  const extra = dict.extras.get(word);
  if (extra) {
    const kind = extra[0] !== extra[0].toLowerCase() ? "name" : "slang";
    return { kind, display: extra };
  }
  return { kind: null, display: word };
}

/** The word spelled by a path of tile indexes. */
export function pathWord(tiles, path) {
  let w = "";
  for (const i of path) w += tiles[i];
  return w;
}

/** Is `path` a legal trace: distinct, each step to a neighbouring tile? */
export function isValidPath(path, size) {
  const seen = new Set();
  for (let i = 0; i < path.length; i++) {
    if (seen.has(path[i])) return false;
    seen.add(path[i]);
    if (i > 0 && !isAdjacent(path[i - 1], path[i], size)) return false;
  }
  return true;
}

/**
 * Find a path on the board that spells `word` (for typed input), or null.
 * `prefer` is an optional existing path to keep if it still matches.
 */
export function findPath(tiles, size, word, prefer = null) {
  if (!word) return [];
  if (prefer && prefer.length && pathWord(tiles, prefer) === word && isValidPath(prefer, size)) {
    return prefer;
  }
  const adj = neighbours(size);
  const used = new Uint8Array(tiles.length);
  const path = [];

  const dfs = (cell, pos) => {
    const t = tiles[cell];
    if (!word.startsWith(t, pos)) return false;
    used[cell] = 1;
    path.push(cell);
    const next = pos + t.length;
    if (next === word.length) return true;
    for (const n of adj[cell]) {
      if (!used[n] && dfs(n, next)) return true;
    }
    used[cell] = 0;
    path.pop();
    return false;
  };

  // Try extending the preferred path's start first so the highlight is stable.
  const starts = [...tiles.keys()];
  if (prefer && prefer.length) {
    starts.sort((a, b) => (b === prefer[0]) - (a === prefer[0]));
  }
  for (const s of starts) {
    if (dfs(s, 0)) return path;
  }
  return null;
}

/** Every scoring word on the board, sorted longest first then A–Z. */
export function solve(tiles, size, dict) {
  const adj = neighbours(size);
  const used = new Uint8Array(tiles.length);
  const found = new Set();
  const { words, set } = dict;

  const dfs = (cell, prefix) => {
    const w = prefix + tiles[cell];
    if (!hasPrefix(words, w)) return;
    if (w.length >= MIN_WORD && set.has(w)) found.add(w);
    used[cell] = 1;
    for (const n of adj[cell]) if (!used[n]) dfs(n, w);
    used[cell] = 0;
  };

  for (let i = 0; i < tiles.length; i++) dfs(i, "");
  return [...found].sort((a, b) => b.length - a.length || (a < b ? -1 : 1));
}

/** Minimum number of findable words for a board to feel worth playing. */
export const MIN_WORDS_ON_BOARD = { 3: 12, 4: 45, 5: 120, 6: 220 };

// ---------------------------------------------------------------- sharing
// A board travels in a link as one size digit plus one letter per tile
// ("q" is the Qu tile). Letters are shifted by position so the link doesn't
// spell out the board at a glance: "4abcd..." isn't the top row.

const A = 97;

function shiftFor(i) {
  return (i * 7 + 11) % 26;
}

/** Board → compact code for a share link, e.g. "4kxbq...". */
export function encodeBoard(tiles, size) {
  let out = String(size);
  tiles.forEach((t, i) => {
    const c = t.charCodeAt(0) - A; // "qu" → q
    out += String.fromCharCode(A + ((c + shiftFor(i)) % 26));
  });
  return out;
}

/** Share code → { size, tiles }, or null if it isn't a valid board. */
export function decodeBoard(code) {
  if (typeof code !== "string") return null;
  const m = /^([3-6])([a-z]+)$/i.exec(code.trim());
  if (!m) return null;
  const size = Number(m[1]);
  const letters = m[2].toLowerCase();
  if (letters.length !== size * size) return null;
  const tiles = [...letters].map((ch, i) => {
    const c = (ch.charCodeAt(0) - A - shiftFor(i) + 26 * 2) % 26;
    const letter = String.fromCharCode(A + c);
    return letter === "q" ? "qu" : letter;
  });
  return { size, tiles };
}

/** Query string for a share link: board, timer minutes and score to beat. */
export function shareParams(tiles, size, timer, score) {
  const p = new URLSearchParams();
  p.set("b", encodeBoard(tiles, size));
  p.set("t", String(timer));
  if (score > 0) p.set("s", String(score));
  return p.toString();
}

/**
 * Read a share link's query string. Returns { board: null } when there's no
 * board in it, { board: null, invalid: true } for a broken one, otherwise
 * { board, timer, target } (target is null when no score came with it).
 */
export function readShareParams(search) {
  const p = new URLSearchParams(search);
  if (!p.has("b")) return { board: null, invalid: false };
  const board = decodeBoard(p.get("b"));
  if (!board) return { board: null, invalid: true };
  const t = Number(p.get("t"));
  const s = p.get("s");
  return {
    board,
    invalid: false,
    timer: [0, 1, 2, 3].includes(t) ? t : 0,
    target: s && /^\d{1,4}$/.test(s) && Number(s) > 0 ? Number(s) : null,
  };
}
