// Game controller: screens, input (keyboard + touch), tweening, HUD.
// Owns a logic `state` (immutable — every move produces a new one) and
// renders through Renderer.

import { LEVELS } from './levels.js';
import { parseLevel, step, DIRS } from './logic.js';
import { Renderer } from './render.js';
import { Sound } from './audio.js';
import { floorScore } from './score.js';

const TWEEN_MS = 140;
const SWIPE_MIN_PX = 24;
const STORAGE_UNLOCKED = 'echoTower.unlocked';

const KEY_DIRS = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right',
  W: 'up', S: 'down', A: 'left', D: 'right',
};

export class Game {
  constructor({ canvas, overlay, floorLabel, scoreLabel, hintLabel }) {
    this.renderer = new Renderer(canvas);
    this.sound = new Sound();
    this.overlay = overlay;
    this.floorLabel = floorLabel;
    this.scoreLabel = scoreLabel;
    this.hintLabel = hintLabel;

    this.screen = 'title';
    this.levelIndex = 0;
    this.selectedFloor = this.unlocked;
    this.state = null;
    this.prev = null; // entity positions before the last step, for tweening
    this.tweenStart = 0;
    this.queue = [];
    this.facing = { dx: 0, dy: 1 };
    this.levelStartedAt = 0;
    this.totalScore = 0;

    window.addEventListener('keydown', (e) => this.onKey(e));
    this.overlay.addEventListener('click', (e) => this.onOverlayClick(e));
    this.setupTouch(canvas);
    this.setupToolbar();
    requestAnimationFrame((t) => this.frame(t));
    this.showTitle();
  }

  get unlocked() {
    const n = Number(localStorage.getItem(STORAGE_UNLOCKED) ?? 0);
    return Number.isFinite(n) ? Math.min(Math.max(n, 0), LEVELS.length - 1) : 0;
  }

  unlock(index) {
    if (index > this.unlocked) localStorage.setItem(STORAGE_UNLOCKED, String(index));
  }

  // --- screens ---------------------------------------------------------

  showTitle() {
    this.screen = 'title';
    this.selectedFloor = this.unlocked;
    this.sound.stopMusic();
    this.renderTitle();
    this.floorLabel.textContent = 'Echo Tower';
    this.scoreLabel.textContent = '';
    this.hintLabel.textContent = '';
  }

  renderTitle() {
    const floors = this.unlocked > 0
      ? `<p class="picker">Start on floor
           <button class="mini" data-action="floor-prev">&larr;</button>
           <span class="floor-num">${this.selectedFloor + 1}</span>
           <button class="mini" data-action="floor-next">&rarr;</button>
           <span class="soft">of ${LEVELS.length}</span></p>`
      : '';
    this.overlay.innerHTML = `
      <div class="panel">
        <h1>Echo Tower</h1>
        <p class="tagline">The statues echo your every move.<br>Outwit them, floor by floor.</p>
        <div class="keys-grid">
          <span><kbd>&uarr;</kbd><kbd>&darr;</kbd><kbd>&larr;</kbd><kbd>&rarr;</kbd> / <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or swipe</span><span>move</span>
          <span><kbd>R</kbd></span><span>restart floor</span>
          <span><kbd>Q</kbd></span><span>quit to title</span>
          <span><kbd>M</kbd></span><span>sound on/off</span>
          <span><kbd>Esc</kbd></span><span>pause</span>
        </div>
        <p class="touch-help">Swipe — or tap a square beside you — to move.<br>
        Reach the stairs on each floor.</p>
        ${floors}
        <p class="cta"><button class="big" data-action="confirm">Play</button></p>
        <p class="credit">A <a href="https://sketchplanations.com" target="_blank" rel="noopener">Sketchplanations</a> experiment</p>
      </div>`;
    this.overlay.classList.remove('hidden');
  }

  startLevel(index) {
    this.levelIndex = index;
    this.state = parseLevel(LEVELS[index]);
    this.prev = null;
    this.queue = [];
    this.facing = { dx: 0, dy: 1 };
    this.levelStartedAt = Date.now();
    this.screen = 'playing';
    this.overlay.classList.add('hidden');
    this.overlay.innerHTML = '';
    this.renderer.resizeFor(this.state);
    this.floorLabel.textContent = `Floor ${index + 1} · ${this.state.name}`;
    this.hintLabel.textContent = this.state.hint;
    this.updateScoreLabel();
    this.sound.startMusic();
  }

  updateScoreLabel() {
    this.scoreLabel.textContent = this.totalScore > 0 ? `Score ${this.totalScore}` : '';
  }

  showComplete() {
    this.screen = 'complete';
    const secs = (Date.now() - this.levelStartedAt) / 1000;
    const gain = floorScore(this.state.moves, secs);
    this.totalScore += gain;
    this.updateScoreLabel();
    const last = this.levelIndex === LEVELS.length - 1;
    if (!last) this.unlock(this.levelIndex + 1);
    this.overlay.innerHTML = `
      <div class="panel">
        <h2>${last ? 'You reached the top!' : `Floor ${this.levelIndex + 1} cleared`}</h2>
        <p class="stats">+${gain} &middot; score ${this.totalScore}</p>
        ${last
          ? `<p class="tagline">The tower is quiet. The statues rest&hellip; for now.</p>
             <p class="cta"><button class="big" data-action="confirm">Title screen</button></p>`
          : `<p class="cta"><button class="big" data-action="confirm">Floor ${this.levelIndex + 2} &rarr;</button></p>`}
      </div>`;
    this.overlay.classList.remove('hidden');
  }

  showPause() {
    this.screen = 'paused';
    this.overlay.innerHTML = `
      <div class="panel">
        <h2>Paused</h2>
        <div class="btn-col">
          <button data-action="resume">Resume <kbd>Esc</kbd></button>
          <button data-action="restart">Restart floor <kbd>R</kbd></button>
          <button data-action="quit">Quit to title <kbd>Q</kbd></button>
        </div>
      </div>`;
    this.overlay.classList.remove('hidden');
  }

  resume() {
    this.screen = 'playing';
    this.overlay.classList.add('hidden');
  }

  // Enter/tap: the default "go" action for the current screen.
  confirm() {
    if (this.screen === 'title') {
      this.totalScore = 0;
      this.startLevel(this.selectedFloor);
    } else if (this.screen === 'complete') {
      if (this.levelIndex === LEVELS.length - 1) this.showTitle();
      else this.startLevel(this.levelIndex + 1);
    } else if (this.screen === 'paused') {
      this.resume();
    }
  }

  // --- input -----------------------------------------------------------

  onKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;

    if (k === 'm' || k === 'M') {
      const on = this.sound.toggle();
      if (on && this.screen === 'playing') this.sound.startMusic();
      this.flashHint(`Sound ${on ? 'on' : 'off'}`);
      return;
    }

    switch (this.screen) {
      case 'title':
        if (k === 'Enter' || k === ' ') {
          e.preventDefault();
          this.confirm();
        } else if (k === 'ArrowLeft') {
          this.pickFloor(-1);
        } else if (k === 'ArrowRight') {
          this.pickFloor(1);
        }
        return;

      case 'complete':
        if (k === 'Enter' || k === ' ') {
          e.preventDefault();
          this.confirm();
        }
        return;

      case 'paused':
        if (k === 'Escape' || k === 'Enter') this.resume();
        else if (k === 'r' || k === 'R') this.startLevel(this.levelIndex);
        else if (k === 'q' || k === 'Q') this.showTitle();
        return;

      case 'playing': {
        const dir = KEY_DIRS[k];
        if (dir) {
          e.preventDefault();
          this.enqueue(dir);
          return;
        }
        if (k === 'r' || k === 'R') this.startLevel(this.levelIndex);
        else if (k === 'q' || k === 'Q') this.showTitle();
        else if (k === 'Escape') this.showPause();
        else if (k === ']') this.startLevel(Math.min(this.levelIndex + 1, LEVELS.length - 1));
        else if (k === '[') this.startLevel(Math.max(this.levelIndex - 1, 0));
        return;
      }
    }
  }

  pickFloor(delta) {
    const next = this.selectedFloor + delta;
    if (next >= 0 && next <= this.unlocked) {
      this.selectedFloor = next;
      this.renderTitle();
    }
  }

  enqueue(dir) {
    if (this.queue.length < 2) this.queue.push(dir);
  }

  onOverlayClick(e) {
    const action = e.target.closest('[data-action]')?.dataset.action;
    switch (action) {
      case 'confirm': this.confirm(); return;
      case 'resume': this.resume(); return;
      case 'restart': this.startLevel(this.levelIndex); return;
      case 'quit': this.showTitle(); return;
      case 'floor-prev': this.pickFloor(-1); return;
      case 'floor-next': this.pickFloor(1); return;
      default:
        // Tapping anywhere on the "cleared" overlay advances — feels right on touch.
        if (this.screen === 'complete') this.confirm();
    }
  }

  // Touch / pointer: swipe anywhere on the board to step in that direction,
  // or tap a square orthogonally adjacent to the player.
  setupTouch(canvas) {
    let start = null;
    canvas.addEventListener('pointerdown', (e) => {
      start = { x: e.clientX, y: e.clientY };
      if (e.pointerType === 'touch') e.preventDefault();
    });
    canvas.addEventListener('pointerup', (e) => {
      if (!start || this.screen !== 'playing') { start = null; return; }
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      start = null;
      if (Math.hypot(dx, dy) >= SWIPE_MIN_PX) {
        const dir = Math.abs(dx) > Math.abs(dy)
          ? (dx > 0 ? 'right' : 'left')
          : (dy > 0 ? 'down' : 'up');
        this.enqueue(dir);
      } else {
        this.tapMove(e);
      }
    });
    canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  }

  tapMove(e) {
    const rect = this.renderer.canvas.getBoundingClientRect();
    const tx = Math.floor(((e.clientX - rect.left) / rect.width) * this.state.width);
    const ty = Math.floor(((e.clientY - rect.top) / rect.height) * this.state.height);
    const dx = tx - this.state.player.x;
    const dy = ty - this.state.player.y;
    if (Math.abs(dx) + Math.abs(dy) !== 1) return;
    this.enqueue(dx === 1 ? 'right' : dx === -1 ? 'left' : dy === 1 ? 'down' : 'up');
  }

  // Footer buttons (always clickable; mainly for touch devices).
  setupToolbar() {
    document.getElementById('btn-restart')?.addEventListener('click', () => {
      if (this.screen === 'playing' || this.screen === 'paused') this.startLevel(this.levelIndex);
    });
    document.getElementById('btn-menu')?.addEventListener('click', () => {
      if (this.screen === 'playing') this.showPause();
      else if (this.screen === 'paused') this.resume();
    });
    document.getElementById('btn-sound')?.addEventListener('click', () => {
      const on = this.sound.toggle();
      if (on && this.screen === 'playing') this.sound.startMusic();
      this.flashHint(`Sound ${on ? 'on' : 'off'}`);
    });
  }

  flashHint(text) {
    const old = this.state?.hint ?? '';
    this.hintLabel.textContent = text;
    clearTimeout(this._hintTimer);
    this._hintTimer = setTimeout(() => {
      this.hintLabel.textContent = this.screen === 'playing' ? old : '';
    }, 1200);
  }

  // --- stepping & animation --------------------------------------------

  applyMove(dir) {
    const before = this.state;
    const { state: after, events } = step(before, dir);
    this.prev = {
      player: { ...before.player },
      statues: before.statues.map((s) => ({ ...s })),
      crates: new Map(before.crates.map((c) => [c.id, { x: c.x, y: c.y }])),
    };
    this.state = after;
    this.tweenStart = performance.now();
    this.facing = { dx: DIRS[dir].dx, dy: DIRS[dir].dy };
    for (const ev of events) this.sound.play(ev);
    if (after.won) {
      // Let the final step finish animating before the overlay appears.
      setTimeout(() => this.showComplete(), TWEEN_MS + 180);
    }
  }

  frame(time) {
    requestAnimationFrame((t) => this.frame(t));
    if (!this.state) return;

    const t = this.prev ? Math.min(1, (performance.now() - this.tweenStart) / TWEEN_MS) : 1;
    if (t >= 1 && this.queue.length > 0 && this.screen === 'playing') {
      this.applyMove(this.queue.shift());
    }
    this.renderer.draw(this.buildView(time));
  }

  buildView(time) {
    const s = this.state;
    const t = this.prev ? Math.min(1, (performance.now() - this.tweenStart) / TWEEN_MS) : 1;
    const ease = t * (2 - t); // easeOutQuad
    const lerp = (a, b) => a + (b - a) * ease;

    const player = this.prev
      ? { x: lerp(this.prev.player.x, s.player.x), y: lerp(this.prev.player.y, s.player.y) }
      : { ...s.player };
    const playerMoving =
      t < 1 && this.prev &&
      (this.prev.player.x !== s.player.x || this.prev.player.y !== s.player.y);

    const statues = s.statues.map((st, i) => {
      const p = this.prev?.statues[i];
      const moving = t < 1 && p && (p.x !== st.x || p.y !== st.y);
      return p
        ? { x: lerp(p.x, st.x), y: lerp(p.y, st.y), type: st.type, moving }
        : { ...st, moving: false };
    });

    const crates = s.crates.map((c) => {
      const p = this.prev?.crates.get(c.id);
      return p ? { x: lerp(p.x, c.x), y: lerp(p.y, c.y) } : { x: c.x, y: c.y };
    });

    return { state: s, player, statues, crates, time, playerMoving, playerFacing: this.facing };
  }
}
