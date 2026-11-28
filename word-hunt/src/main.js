// Word Hunt — UI: board rendering, drag/keyboard input, timer, word lists.
import {
  SIZES,
  DEFAULT_MIN_WORD,
  minWordsOnBoard,
  rollBoard,
  hasGoodVowelMix,
  isAdjacent,
  scoreWord,
  decodeWords,
  makeDictionary,
  lookup,
  pathWord,
  findPath,
  solve,
  shareParams,
  readShareParams,
} from "./logic.js";
import { define, wiktionaryUrl } from "./define.js";
import { createMusic } from "./music.js";

const $ = (id) => document.getElementById(id);

const els = {
  controls: $("controls"),
  board: $("board"),
  trail: $("trail"),
  trailLine: $("trail-line"),
  current: $("current"),
  clock: $("clock"),
  play: document.querySelector(".play"),
  boardArea: document.querySelector(".board-area"),
  pauseCard: $("pause-card"),
  resume: $("btn-resume"),
  peek: $("btn-peek"),
  clockText: $("clock-text"),
  found: $("found"),
  empty: $("empty"),
  words: $("words"),
  extras: $("extras"),
  extrasGroup: $("extras-group"),
  missed: $("missed"),
  missedGroup: $("missed-group"),
  missedLabel: $("missed-label"),
  score: $("score"),
  scoreUnit: $("score-unit"),
  count: $("count"),
  reveal: $("btn-reveal"),
  reroll: $("btn-reroll"),
  live: $("live"),
  help: $("help"),
  settings: $("settings"),
  optCount: $("opt-count"),
  optThree: $("opt-three"),
  share: $("share"),
  homeTip: $("home-tip"),
  shareUrl: $("share-url"),
  toast: $("toast"),
  themes: $("themes"),
  themeColor: document.querySelector('meta[name="theme-color"]'),
  define: $("define"),
  defineWord: $("define-word"),
  defineBody: $("define-body"),
  defineLink: $("define-link"),
  defineClose: $("define-close"),
};

// ---------------------------------------------------------------- settings

const STORE_KEY = "word-hunt:settings";
const THEMES = ["classic", "night", "sea", "forest", "berry", "contrast"];
const settings = {
  size: 4,
  timer: 0,
  showCount: false,
  theme: "classic",
  music: false,
  allowThree: false, // count 3-letter words (off: 4+ letters only)
};
try {
  Object.assign(settings, JSON.parse(localStorage.getItem(STORE_KEY) || "{}"));
} catch {
  /* ignore bad or blocked storage */
}
if (!SIZES.includes(settings.size)) settings.size = 4;
if (![0, 1, 2, 3].includes(settings.timer)) settings.timer = 0;
if (!THEMES.includes(settings.theme)) settings.theme = "classic";
settings.music = settings.music === true;
settings.allowThree = settings.allowThree === true;

const minWordSetting = () => (settings.allowThree ? 3 : DEFAULT_MIN_WORD);

function saveSettings() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}

const music = createMusic();

// ------------------------------------------------------------------- state

let dict = null;
let dictFailed = false;
const pending = []; // paths played before the dictionary finished loading

const game = {
  size: 4,
  tiles: [],
  solution: null, // all scoring words on the board, once the dictionary is in
  found: new Map(), // word -> { kind, display, points, el }
  score: 0,
  over: false,
  minWord: DEFAULT_MIN_WORD, // shortest word that counts in this game
  target: null, // points to beat, when playing a friend's shared board
  beaten: false,
};

const input = {
  path: [],
  typed: null, // string while the player is typing a word
  dragging: false,
  pointerId: null,
  lastX: 0,
  lastY: 0,
  rect: null,
  focus: 0, // roving tabindex position on the board
};

let tileEls = [];
let flashTimer = 0;

// ------------------------------------------------------------- dictionary

async function loadDictionary() {
  try {
    const [wordsText, extraText] = await Promise.all([
      fetch("words/words.txt").then((r) => {
        if (!r.ok) throw new Error(`words.txt ${r.status}`);
        return r.text();
      }),
      fetch("words/extra.txt")
        .then((r) => (r.ok ? r.text() : ""))
        .catch(() => ""),
    ]);
    dict = makeDictionary(decodeWords(wordsText), extraText.split("\n"));
  } catch (err) {
    console.error(err);
    dictFailed = true;
    showMessage("Couldn't load the word list — check your connection and reload.", "bad");
    return;
  }
  game.solution = solve(game.tiles, game.size, dict, game.minWord);
  renderTally();
  for (const p of pending.splice(0)) play(p);
}

// ------------------------------------------------------------- new games

function newBoard(size, minLen) {
  // With the dictionary loaded, toss again until the board has enough words.
  for (let attempt = 0; attempt < 40; attempt++) {
    const tiles = rollBoard(size);
    if (!hasGoodVowelMix(tiles)) continue;
    if (!dict) return { tiles, solution: null };
    const solution = solve(tiles, size, dict, minLen);
    if (solution.length >= minWordsOnBoard(size, minLen)) return { tiles, solution };
  }
  const tiles = rollBoard(size);
  return { tiles, solution: dict ? solve(tiles, size, dict, minLen) : null };
}

/** Start a game: a fresh toss, or the board from a share link. */
function newGame(shared = null) {
  cancelInput();
  closeDefinition();
  if (!shared) clearShareLink();
  const size = shared ? shared.size : settings.size;
  const minWord = shared ? shared.minWord : minWordSetting();
  const { tiles, solution } = shared
    ? { tiles: shared.tiles, solution: dict ? solve(shared.tiles, size, dict, minWord) : null }
    : newBoard(size, minWord);
  Object.assign(game, {
    size,
    minWord,
    tiles,
    solution,
    found: new Map(),
    score: 0,
    over: false,
    target: shared?.target ?? null,
    beaten: false,
  });
  pending.length = 0;

  buildBoard();
  els.words.replaceChildren();
  els.extras.replaceChildren();
  els.missed.replaceChildren();
  els.extrasGroup.hidden = true;
  els.missedGroup.hidden = true;
  els.empty.hidden = false;
  showMessage("", "");
  renderTally();
  startTimer();

  els.board.classList.remove("rolling");
  void els.board.offsetWidth; // restart the toss animation
  els.board.classList.add("rolling");
}

function buildBoard() {
  const { size, tiles } = game;
  els.board.style.setProperty("--n", size);
  els.board.setAttribute(
    "aria-label",
    `Letter grid, ${size} by ${size}. Drag across touching letters, or type a word and press Enter.`,
  );
  els.board.classList.remove("over");
  els.trail.setAttribute("viewBox", `0 0 ${size} ${size}`);

  const frag = document.createDocumentFragment();
  tileEls = tiles.map((t, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "tile";
    b.dataset.i = i;
    b.style.setProperty("--i", i);
    b.tabIndex = i === 0 ? 0 : -1;
    b.setAttribute("aria-pressed", "false");
    const label = t === "qu" ? "Qu" : t.toUpperCase();
    b.setAttribute(
      "aria-label",
      `${label}, row ${Math.floor(i / size) + 1}, column ${(i % size) + 1}`,
    );
    if (t === "qu") {
      b.innerHTML = `Q<span class="qu">u</span>`;
    } else {
      b.textContent = label;
    }
    frag.append(b);
    return b;
  });
  input.focus = 0;
  els.board.querySelectorAll(".tile").forEach((t) => t.remove());
  els.board.append(frag);
}

// ---------------------------------------------------------------- render

function setPath(path) {
  input.path = path;
  renderPath();
}

function renderPath() {
  const { path } = input;
  const sel = new Set(path);
  tileEls.forEach((el, i) => {
    const on = sel.has(i);
    if ((el.getAttribute("aria-pressed") === "true") !== on) {
      el.setAttribute("aria-pressed", on ? "true" : "false");
    }
    el.classList.toggle("first", path[0] === i);
  });

  const n = game.size;
  els.trailLine.setAttribute(
    "points",
    path.length > 1
      ? path.map((i) => `${(i % n) + 0.5},${Math.floor(i / n) + 0.5}`).join(" ")
      : "",
  );
  els.board.classList.toggle("tracing", input.dragging && path.length > 0);

  if (input.typed !== null) {
    const shown = input.typed.toUpperCase();
    setCurrent(shown || "", path.length || !shown ? "" : "nopath");
  } else if (path.length) {
    setCurrent(pathWord(game.tiles, path).toUpperCase(), "");
  }
}

function setCurrent(text, cls) {
  els.current.className = "current" + (cls ? " " + cls : "");
  els.current.textContent = text;
}

function showMessage(text, cls) {
  els.current.className = "current msg" + (cls ? " " + cls : "");
  els.current.textContent = text;
}

function plural(n, one, many = one + "s") {
  return `${n} ${n === 1 ? one : many}`;
}

function renderTally() {
  const scoring = [...game.found.values()].filter((f) => f.kind === "word").length;
  els.score.textContent = game.score;
  els.scoreUnit.textContent = game.score === 1 ? "point" : "points";
  const showTotal = settings.showCount && game.solution;
  els.count.textContent = showTotal
    ? `${scoring} of ${plural(game.solution.length, "word")}`
    : plural(scoring, "word");
  if (game.target !== null) {
    const t = document.createElement("span");
    t.className = "target" + (game.beaten ? " beaten" : "");
    t.textContent = game.beaten ? `Beat ${game.target}!` : `${game.target} to beat`;
    els.count.append(" · ", t);
  }
  els.reveal.hidden = !settings.showCount || game.over;
}

/** A word chip: a button that opens the word's definition. */
function makeChip(display) {
  const li = document.createElement("li");
  const b = document.createElement("button");
  b.type = "button";
  b.className = "chip";
  b.dataset.word = display;
  b.setAttribute("aria-haspopup", "dialog");
  const w = document.createElement("span");
  w.textContent = display;
  b.append(w);
  li.append(b);
  return li;
}

function addChip(word, entry) {
  const li = makeChip(entry.display);
  const b = li.firstChild;
  if (entry.kind === "word") {
    const pts = document.createElement("span");
    pts.className = "pts";
    pts.innerHTML = `${entry.points}<span class="sr-only"> ${entry.points === 1 ? "point" : "points"}</span>`;
    b.append(pts);
    els.words.append(li);
  } else {
    b.title = entry.kind === "name" ? "Proper noun — no points" : "Slang — no points";
    els.extras.append(li);
    els.extrasGroup.hidden = false;
  }
  els.empty.hidden = true;
  entry.el = li;
  li.scrollIntoView({ block: "nearest" });
}

function ping(el) {
  if (!el) return;
  el.classList.remove("ping");
  void el.offsetWidth;
  el.classList.add("ping");
  el.scrollIntoView({ block: "nearest" });
}

function announce(text) {
  els.live.textContent = "";
  // A fresh text node each time so repeated messages are still read out.
  setTimeout(() => (els.live.textContent = text), 30);
}

// ------------------------------------------------------------ playing words

function play(path) {
  if (game.over || !path.length) return;
  const word = pathWord(game.tiles, path);

  if (word.length < game.minWord) {
    if (path.length > 1) {
      flash(path, "bad", `Too short: ${game.minWord}+ letters`, `Too short, ${game.minWord} or more letters`);
    } else clearPath();
    return;
  }
  if (!dict) {
    if (dictFailed) {
      flash(path, "bad", "Word list didn't load", "Word list didn't load");
    } else {
      pending.push(path);
      flash(path, "dup", "Checking…", "");
    }
    return;
  }

  const { kind, display } = lookup(dict, word);
  const shown = word.toUpperCase();

  if (!kind) {
    flash(path, "bad", `${shown} isn't in the word list`, `${word}: not in the word list`);
    return;
  }
  const existing = game.found.get(word);
  if (existing) {
    flash(path, "dup", `Already found ${shown}`, `Already found ${word}`);
    ping(existing.el);
    return;
  }

  const points = kind === "word" ? scoreWord(word.length) : 0;
  const entry = { kind, display, points, el: null };
  game.found.set(word, entry);
  game.score += points;
  addChip(word, entry);
  if (game.target !== null && !game.beaten && game.score > game.target) {
    game.beaten = true;
    toast(`You beat ${plural(game.target, "point")}!`);
  }
  renderTally();

  if (kind === "word") {
    flash(path, "good", null, `${word}, ${plural(points, "point")}. Total ${game.score}.`);
    els.current.className = "current good";
    els.current.innerHTML = "";
    els.current.append(shown);
    const pts = document.createElement("span");
    pts.className = "pts";
    pts.textContent = `+${points}`;
    els.current.append(pts);
  } else {
    const what = kind === "name" ? "name" : "slang";
    flash(path, "extra", `${display} — ${what}, no points`, `${display}: ${what}, no points`);
  }
}

/** Colour the traced tiles briefly to show the result, then clear them. */
function flash(path, kind, message, spoken) {
  clearTimeout(flashTimer);
  input.typed = null;
  input.path = path;
  renderPath();
  els.board.dataset.flash = kind;
  if (message) showMessage(message, kind);
  if (spoken) announce(spoken);
  flashTimer = setTimeout(clearPath, kind === "bad" ? 520 : 420);
}

function clearPath() {
  clearTimeout(flashTimer);
  delete els.board.dataset.flash;
  input.typed = null;
  setPath([]);
}

function cancelInput() {
  input.dragging = false;
  if (input.pointerId !== null && els.board.hasPointerCapture?.(input.pointerId)) {
    els.board.releasePointerCapture(input.pointerId);
  }
  input.pointerId = null;
  clearPath();
}

// ---------------------------------------------------------- pointer input

/** Which tile is under (x, y)? `loose` accepts the whole cell; otherwise
 *  only a circle around the centre, so diagonal drags don't clip neighbours. */
function cellAt(x, y, loose) {
  const r = input.rect;
  const n = game.size;
  const cell = r.width / n;
  const fx = (x - r.left) / cell;
  const fy = (y - r.top) / cell;
  const col = Math.floor(fx);
  const row = Math.floor(fy);
  if (col < 0 || row < 0 || col >= n || row >= n) return -1;
  if (!loose) {
    const dx = fx - col - 0.5;
    const dy = fy - row - 0.5;
    if (dx * dx + dy * dy > 0.42 * 0.42) return -1;
  }
  return row * n + col;
}

function considerCell(i) {
  const { path } = input;
  if (i < 0 || i === path[path.length - 1]) return;
  if (path.length > 1 && i === path[path.length - 2]) {
    path.pop(); // slid back: undo the last letter
  } else if (!path.includes(i) && isAdjacent(path[path.length - 1], i, game.size)) {
    path.push(i);
  } else {
    return;
  }
  renderPath();
}

els.board.addEventListener("pointerdown", (e) => {
  if (locked() || !e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
  input.rect = els.board.getBoundingClientRect();
  const i = cellAt(e.clientX, e.clientY, true);
  if (i < 0) return;
  e.preventDefault();
  clearTimeout(flashTimer);
  delete els.board.dataset.flash;
  els.board.setPointerCapture(e.pointerId);
  input.pointerId = e.pointerId;
  input.dragging = true;
  input.typed = null;
  input.lastX = e.clientX;
  input.lastY = e.clientY;
  setPath([i]);
});

els.board.addEventListener("pointermove", (e) => {
  if (!input.dragging || e.pointerId !== input.pointerId) return;
  const coalesced = e.getCoalescedEvents?.();
  const events = coalesced && coalesced.length ? coalesced : [e];
  for (const ev of events) {
    // Sample along the move so fast swipes don't skip a tile.
    const dx = ev.clientX - input.lastX;
    const dy = ev.clientY - input.lastY;
    const step = input.rect.width / game.size / 5;
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / step));
    for (let k = 1; k <= n; k++) {
      considerCell(cellAt(input.lastX + (dx * k) / n, input.lastY + (dy * k) / n, false));
    }
    input.lastX = ev.clientX;
    input.lastY = ev.clientY;
  }
});

function endDrag(e, submit) {
  if (!input.dragging || e.pointerId !== input.pointerId) return;
  input.dragging = false;
  input.pointerId = null;
  els.board.classList.remove("tracing");
  if (submit) play(input.path.slice());
  else clearPath();
}

els.board.addEventListener("pointerup", (e) => endDrag(e, true));
els.board.addEventListener("pointercancel", (e) => endDrag(e, false));
els.board.addEventListener("lostpointercapture", (e) => endDrag(e, true));
els.board.addEventListener("contextmenu", (e) => e.preventDefault());

// --------------------------------------------------------- keyboard input

// Tiles are buttons: Enter/Space (or a screen reader "click") picks a letter.
// Real pointer clicks have e.detail > 0 and are handled by the drag code.
els.board.addEventListener("click", (e) => {
  const tile = e.target.closest(".tile");
  if (!tile || e.detail !== 0 || locked()) return;
  const i = Number(tile.dataset.i);
  const { path } = input;
  clearTimeout(flashTimer);
  delete els.board.dataset.flash;
  input.typed = null;

  if (path[path.length - 1] === i) {
    play(path.slice());
    return;
  }
  const at = path.indexOf(i);
  if (at >= 0) path.length = at + 1;
  else if (path.length && isAdjacent(path[path.length - 1], i, game.size)) path.push(i);
  else input.path = [i];
  renderPath();
  announce(`${pathWord(game.tiles, input.path).toUpperCase().split("").join(" ")}`);
});

els.board.addEventListener("keydown", (e) => {
  const tile = e.target.closest(".tile");
  if (!tile) return;
  const n = game.size;
  let i = Number(tile.dataset.i);
  const moves = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] };
  if (moves[e.key]) {
    const [dr, dc] = moves[e.key];
    const r = Math.min(n - 1, Math.max(0, Math.floor(i / n) + dr));
    const c = Math.min(n - 1, Math.max(0, (i % n) + dc));
    i = r * n + c;
  } else if (e.key === "Home") i = Math.floor(i / n) * n;
  else if (e.key === "End") i = Math.floor(i / n) * n + n - 1;
  else return;
  e.preventDefault();
  e.stopPropagation();
  tileEls[input.focus].tabIndex = -1;
  input.focus = i;
  tileEls[i].tabIndex = 0;
  tileEls[i].focus();
});

function dialogOpen() {
  return els.help.open || els.settings.open || els.share.open || els.homeTip.open;
}

document.addEventListener("keydown", (e) => {
  if (dialogOpen() || e.metaKey || e.ctrlKey || e.altKey || locked()) return;
  if (definitionOpen()) {
    if (!hasPopover && e.key === "Escape") {
      closeDefinition();
      onDefinitionClosed();
    }
    return;
  }
  const key = e.key;

  if (/^[a-zA-Z]$/.test(key)) {
    if (input.dragging) return;
    e.preventDefault();
    clearTimeout(flashTimer);
    delete els.board.dataset.flash;
    input.typed = (input.typed ?? "") + key.toLowerCase();
    input.path = findPath(game.tiles, game.size, input.typed, input.path) ?? [];
    renderPath();
    return;
  }

  const busy = input.typed !== null || input.path.length > 0;
  if (!busy || input.dragging) return;

  if (key === "Enter") {
    // Only claim Enter for a typed word; on a tile, the click handler plays it.
    if (input.typed === null) return;
    e.preventDefault();
    if (input.path.length) play(input.path.slice());
    else if (input.typed.length) {
      const shown = input.typed.toUpperCase();
      input.typed = null;
      showMessage(`${shown} isn't on the board`, "bad");
      announce(`${shown}: not on the board`);
      setPath([]);
    }
  } else if (key === "Backspace") {
    e.preventDefault();
    if (input.typed !== null) {
      input.typed = input.typed.slice(0, -1);
      input.path = input.typed
        ? findPath(game.tiles, game.size, input.typed, input.path) ?? []
        : [];
      if (!input.typed) input.typed = null;
      renderPath();
      if (!input.path.length && input.typed === null) setCurrent("", "");
    } else {
      input.path.pop();
      renderPath();
      if (!input.path.length) setCurrent("", "");
    }
  } else if (key === "Escape") {
    e.preventDefault();
    clearPath();
    setCurrent("", "");
  }
});

// ------------------------------------------------------------------- timer

const timer = {
  total: 0,
  remaining: 0,
  endsAt: 0,
  running: false,
  tick: 0,
  shown: -1,
  userPaused: false, // paused by tapping the clock (not just a hidden tab)
};

/** Is the board closed to play right now? */
function locked() {
  return game.over || timer.userPaused;
}

function startTimer() {
  stopTicking();
  timer.total = settings.timer * 60000;
  timer.remaining = timer.total;
  timer.shown = -1;
  setUserPaused(false);
  els.clock.disabled = false;
  els.clock.hidden = !timer.total;
  els.clock.classList.remove("low", "paused");
  if (!timer.total) return;
  updateClock();
  if (!document.hidden && !dialogOpen()) resumeTimer();
  else els.clock.classList.add("paused");
}

function resumeTimer() {
  if (!timer.total || timer.running || locked() || timer.remaining <= 0) return;
  timer.endsAt = performance.now() + timer.remaining;
  timer.running = true;
  els.clock.classList.remove("paused");
  timer.tick = setInterval(updateClock, 200);
}

function pauseTimer() {
  if (!timer.running) return;
  timer.remaining = Math.max(0, timer.endsAt - performance.now());
  stopTicking();
  els.clock.classList.add("paused");
}

function stopTicking() {
  timer.running = false;
  clearInterval(timer.tick);
}

function updateClock() {
  const ms = timer.running ? timer.endsAt - performance.now() : timer.remaining;
  const secs = Math.max(0, Math.ceil(ms / 1000));
  if (secs !== timer.shown) {
    timer.shown = secs;
    els.clockText.textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
    els.clock.classList.toggle("low", secs <= 10);
    if (timer.running && (secs === 30 || secs === 10)) announce(`${secs} seconds left`);
  }
  if (timer.running && ms <= 0) {
    timer.remaining = 0;
    endGame("time");
  }
}

// Tap the clock to pause; the board blurs until you resume or peek.
function setUserPaused(on, peek = false) {
  timer.userPaused = on;
  els.clock.setAttribute("aria-pressed", on ? "true" : "false");
  els.play.classList.toggle("paused", on);
  els.play.classList.toggle("peek", on && peek);
  els.pauseCard.hidden = !on || peek;
  // Music rests while the player has paused the game.
  if (on) music.hold("paused");
  else music.release("paused");
  // While blurred, keep the letters and words away from screen readers too.
  els.boardArea.querySelector(".board").inert = on && !peek;
  els.found.inert = on && !peek;
}

function pauseByPlayer() {
  if (!timer.total || locked()) return;
  cancelInput();
  closeDefinition();
  pauseTimer();
  els.clock.classList.remove("paused");
  setUserPaused(true);
  showMessage("Paused", "muted");
  announce("Timer paused. No peeking!");
  els.resume.focus({ preventScroll: true });
}

function resumeByPlayer() {
  if (!timer.userPaused) return;
  const hadFocus = els.pauseCard.contains(document.activeElement);
  setUserPaused(false);
  showMessage("", "");
  if (!document.hidden && !dialogOpen()) resumeTimer();
  announce("Timer running");
  if (hadFocus) els.clock.focus({ preventScroll: true });
}

els.clock.addEventListener("click", () => {
  if (timer.userPaused) resumeByPlayer();
  else pauseByPlayer();
});
els.resume.addEventListener("click", resumeByPlayer);
els.peek.addEventListener("click", () => {
  setUserPaused(true, true);
  showMessage("Paused. Tap timer to resume", "muted");
  announce("Showing the board. The timer is still paused.");
  els.clock.focus({ preventScroll: true });
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) music.hold("hidden");
  else music.release("hidden");
  if (document.hidden) pauseTimer();
  else if (!dialogOpen()) resumeTimer();
});

// ---------------------------------------------------------------- endings

function endGame(reason) {
  if (game.over) return;
  setUserPaused(false);
  els.clock.disabled = true;
  stopTicking();
  cancelInput();
  game.over = true;
  els.board.classList.add("over");
  const scoring = [...game.found.values()].filter((f) => f.kind === "word").length;
  const summary = `${plural(game.score, "point")} from ${plural(scoring, "word")}`;
  const lead = reason === "time" ? "Time's up!" : "Revealed.";
  showMessage(`${lead} ${summary}`, "muted");
  announce(`${lead} ${summary}.`);
  renderTally();
  if (settings.showCount) renderMissed();
}

function renderMissed() {
  if (!game.solution) return;
  const missed = game.solution.filter((w) => !game.found.has(w));
  els.missedLabel.textContent = missed.length ? `Missed (${missed.length})` : "You found them all!";
  const frag = document.createDocumentFragment();
  for (const w of missed) frag.append(makeChip(w));
  els.missed.replaceChildren(frag);
  els.missedGroup.hidden = false;
  els.empty.hidden = true;
  els.missedGroup.scrollIntoView({ block: "start", behavior: "smooth" });
}

// ------------------------------------------------------------- controls

function applyTheme() {
  document.documentElement.dataset.theme = settings.theme;
  // Match the browser toolbar on phones to the page background.
  const paper = getComputedStyle(document.documentElement).getPropertyValue("--paper").trim();
  if (paper) els.themeColor.setAttribute("content", paper);
}

function syncControls() {
  els.themes.elements.theme.value = settings.theme;
  els.controls.elements.size.value = String(settings.size);
  els.controls.elements.timer.value = String(settings.timer);
  els.optCount.checked = settings.showCount;
  els.optThree.checked = settings.allowThree;
}

els.controls.addEventListener("change", (e) => {
  const { name, value } = e.target;
  if (name === "size") settings.size = Number(value);
  else if (name === "timer") settings.timer = Number(value);
  else return;
  saveSettings();
  newGame();
});
els.controls.addEventListener("submit", (e) => e.preventDefault());

els.reroll.addEventListener("click", () => newGame());
els.reveal.addEventListener("click", () => endGame("reveal"));

els.themes.addEventListener("change", (e) => {
  if (e.target.name !== "theme") return;
  settings.theme = e.target.value;
  saveSettings();
  applyTheme();
});
els.themes.addEventListener("submit", (e) => e.preventDefault());

els.optThree.addEventListener("change", () => {
  settings.allowThree = els.optThree.checked;
  saveSettings();
  newGame(); // the rules changed, so start a fresh board under them
  toast(settings.allowThree ? "New board: 3-letter words count" : "New board: 4+ letter words only");
});

els.optCount.addEventListener("change", () => {
  settings.showCount = els.optCount.checked;
  saveSettings();
  renderTally();
  if (game.over && settings.showCount) renderMissed();
  if (!settings.showCount) els.missedGroup.hidden = true;
});

function openDialog(d) {
  cancelInput();
  closeDefinition();
  pauseTimer();
  d.showModal();
}

for (const d of [els.help, els.settings, els.share, els.homeTip]) {
  d.addEventListener("close", () => {
    if (!dialogOpen() && !document.hidden) resumeTimer();
  });
  // A click on the backdrop (outside the dialog box) closes it.
  d.addEventListener("click", (e) => {
    if (e.target !== d) return;
    const r = d.getBoundingClientRect();
    const inside =
      e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (!inside) d.close();
  });
}

$("btn-help").addEventListener("click", () => openDialog(els.help));
$("btn-settings").addEventListener("click", () => openDialog(els.settings));

// ------------------------------------------------------------ definitions

const hasPopover = typeof HTMLElement.prototype.showPopover === "function";
let defineFor = null; // the chip button whose definition is showing
let pressedOpenChip = null; // chip whose definition was open when pressed

function definitionOpen() {
  return hasPopover ? els.define.matches(":popover-open") : els.define.classList.contains("open");
}

function placeDefinition(chip) {
  const pop = els.define;
  const r = chip.getBoundingClientRect();
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const w = pop.offsetWidth;
  const h = pop.offsetHeight;
  const left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), vw - w - 8);
  // Prefer above the word (the list sits low on the screen), else below.
  let top = r.top - h - 8;
  if (top < 8) top = Math.min(r.bottom + 8, vh - h - 8);
  pop.style.left = `${Math.round(left)}px`;
  pop.style.top = `${Math.round(Math.max(8, top))}px`;
}

function renderSenses(container, senses) {
  const ol = document.createElement("ol");
  for (const s of senses) {
    const li = document.createElement("li");
    const pos = document.createElement("i");
    pos.className = "pos";
    pos.textContent = s.pos;
    li.append(pos, " ", s.text);
    ol.append(li);
  }
  container.append(ol);
}

function setDefinitionBody(nodes) {
  els.defineBody.replaceChildren(...nodes);
  if (defineFor) placeDefinition(defineFor);
}

function para(text, cls) {
  const p = document.createElement("p");
  if (cls) p.className = cls;
  p.textContent = text;
  return p;
}

async function openDefinition(chip) {
  const word = chip.dataset.word;
  if (defineFor === chip) {
    // Open: close it. Already closed by light-dismiss (its toggle event
    // hasn't run yet): leave it closed.
    closeDefinition();
    return;
  }
  // Tapping the open word: light-dismiss has already closed it.
  if (pressedOpenChip === chip) {
    pressedOpenChip = null;
    return;
  }
  defineFor = chip;
  els.defineWord.textContent = word;
  els.defineLink.href = wiktionaryUrl(word);
  els.defineBody.replaceChildren(para("Looking it up…", "define-note"));
  chip.setAttribute("aria-expanded", "true");
  if (hasPopover) {
    if (!definitionOpen()) els.define.showPopover();
  } else {
    els.define.classList.add("open");
  }
  placeDefinition(chip);
  els.defineClose.focus({ preventScroll: true });

  try {
    const { senses, base } = await define(word);
    if (defineFor !== chip) return; // another word was opened meanwhile
    if (!senses.length) {
      setDefinitionBody([para("No definition found. Try the full entry below.", "define-note")]);
      return;
    }
    const frag = document.createElement("div");
    renderSenses(frag, senses);
    if (base) {
      const h = document.createElement("h3");
      h.textContent = base.word;
      frag.append(h);
      renderSenses(frag, base.senses);
    }
    setDefinitionBody([frag]);
  } catch (err) {
    console.warn(err);
    if (defineFor !== chip) return;
    setDefinitionBody([para("Couldn't reach Wiktionary. Check your connection.", "define-note")]);
  }
}

function closeDefinition() {
  if (!defineFor) return;
  if (hasPopover && definitionOpen()) els.define.hidePopover();
  else els.define.classList.remove("open");
}

// The popover may also close itself (tap outside, Esc): tidy up either way.
function onDefinitionClosed() {
  const chip = defineFor;
  defineFor = null;
  if (!chip) return;

  chip.setAttribute("aria-expanded", "false");
  if (els.define.contains(document.activeElement) && chip.isConnected) {
    chip.focus({ preventScroll: true });
  }
}

if (hasPopover) {
  els.define.addEventListener("toggle", (e) => {
    if (e.newState === "closed") onDefinitionClosed();
  });
} else {
  els.define.removeAttribute("popover");
  document.addEventListener("pointerdown", (e) => {
    if (definitionOpen() && !els.define.contains(e.target) && !e.target.closest?.(".chip")) {
      closeDefinition();
      onDefinitionClosed();
    }
  });
}

els.defineClose.addEventListener("click", () => {
  closeDefinition();
  if (!hasPopover) onDefinitionClosed();
});

// Note before light-dismiss runs whether the pressed word was already open.
els.found.addEventListener("pointerdown", (e) => {
  const chip = e.target.closest(".chip");
  pressedOpenChip = chip && chip === defineFor && definitionOpen() ? chip : null;
});

els.found.addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (chip) openDefinition(chip);
});

window.addEventListener("resize", () => {
  if (defineFor && definitionOpen()) placeDefinition(defineFor);
});
els.found.addEventListener("scroll", () => closeDefinition(), { passive: true });

// ---------------------------------------------------------------- sharing

const SHARE_PARAMS = ["b", "t", "s"];

/** Link to this board with the current timer and, once you've scored,
 *  your points as the score to beat. */
function shareLink() {
  const url = new URL(location.pathname, location.origin);
  url.search = shareParams(game.tiles, game.size, settings.timer, game.score, game.minWord);
  return url.href;
}

/** A fresh toss is no longer the shared board, so drop it from the address. */
function clearShareLink() {
  const url = new URL(location.href);
  if (!SHARE_PARAMS.some((p) => url.searchParams.has(p))) return;
  SHARE_PARAMS.forEach((p) => url.searchParams.delete(p));
  history.replaceState(null, "", url.pathname + url.search + url.hash);
}

/** The board in this page's address, if it was opened from a share link. */
function readShareLink() {
  const link = readShareParams(location.search);
  if (link.board) {
    link.board.target = link.target;
    link.board.minWord = link.minWord;
  }
  return link;
}

let toastTimer = 0;
function toast(text) {
  clearTimeout(toastTimer);
  els.toast.textContent = text;
  els.toast.classList.add("show");
  toastTimer = setTimeout(() => {
    els.toast.classList.remove("show");
    setTimeout(() => (els.toast.textContent = ""), 250);
  }, 2600);
}

/** Older copy route, for browsers that block the async clipboard API. */
function legacyCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.cssText = "position:fixed;opacity:0;pointer-events:none";
  document.body.append(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  ta.remove();
  return ok;
}

$("btn-share").addEventListener("click", async () => {
  const link = shareLink();
  let copied = false;
  try {
    await navigator.clipboard.writeText(link);
    copied = true;
  } catch {
    copied = legacyCopy(link);
  }
  if (copied) {
    toast(
      game.score > 0
        ? `Link copied, with ${plural(game.score, "point")} to beat!`
        : "Link copied. Send it to a friend!",
    );
  } else {
    // No clipboard access (old browser, or blocked): show the link to copy.
    els.shareUrl.value = link;
    openDialog(els.share);
    els.shareUrl.focus();
    els.shareUrl.select();
  }
});

// ------------------------------------------------------------------ music

const musicBtn = $("btn-music");

function renderMusic() {
  musicBtn.setAttribute("aria-pressed", settings.music ? "true" : "false");
}

if (music.available) {
  musicBtn.hidden = false;
  $("music-credit").hidden = false;
  renderMusic();
  // Left on last time: it starts at the first tap or key press.
  if (settings.music) music.setOn(true);
  musicBtn.addEventListener("click", () => {
    settings.music = !settings.music;
    saveSettings();
    renderMusic();
    music.setOn(settings.music);
    announce(settings.music ? "Music on" : "Music off");
  });
}

// ------------------------------------------------------------- full screen

const fsBtn = $("btn-fullscreen");
const root = document.documentElement;
const canFullscreen = Boolean(
  (document.fullscreenEnabled || document.webkitFullscreenEnabled) &&
    (root.requestFullscreen || root.webkitRequestFullscreen),
);
const fullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement;
// Already opened from the home screen, without browser bars.
const standalone =
  matchMedia("(display-mode: standalone), (display-mode: fullscreen)").matches ||
  navigator.standalone === true;

function renderFullscreen() {
  const on = Boolean(fullscreenElement());
  fsBtn.setAttribute("aria-pressed", on ? "true" : "false");
  fsBtn.title = on ? "Exit full screen" : "Full screen";
}

// Where pages can't go full screen (iPhone), the button explains the
// home-screen route instead, unless we're already running from there.
fsBtn.hidden = !canFullscreen && standalone;
fsBtn.addEventListener("click", async () => {
  if (!canFullscreen) {
    openDialog(els.homeTip);
    return;
  }
  try {
    if (fullscreenElement()) {
      await (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } else {
      await (root.requestFullscreen || root.webkitRequestFullscreen).call(root, {
        navigationUI: "hide",
      });
    }
  } catch {
    toast("Full screen isn't available here");
  }
});
document.addEventListener("fullscreenchange", renderFullscreen);
document.addEventListener("webkitfullscreenchange", renderFullscreen);
renderFullscreen();

// ------------------------------------------------------------------ start

applyTheme();
const fromLink = readShareLink();
if (fromLink.board) {
  // Play the shared board at its size and timer, without saving them as
  // this player's own preferences.
  settings.size = fromLink.board.size;
  settings.timer = fromLink.timer;
  settings.allowThree = fromLink.minWord === 3;
}
syncControls();
newGame(fromLink.board);
if (fromLink.board) {
  const target = fromLink.board.target;
  showMessage(target ? `${plural(target, "point")} to beat!` : "Shared board. Good luck!", "muted");
  announce(target ? `Shared board. ${plural(target, "point")} to beat.` : "Shared board. Good luck!");
} else if (fromLink.invalid) {
  clearShareLink();
  showMessage("That link didn't work. New board!", "bad");
}
loadDictionary();
