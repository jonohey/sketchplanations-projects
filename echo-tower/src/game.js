// Game controller: screens, input, tweening, HUD. Owns a logic `state`
// (immutable — every move produces a new one) and renders through Renderer.

import { LEVELS } from './levels.js';
import { parseLevel, step, DIRS } from './logic.js';
import { Renderer, TILE } from './render.js';
import { Sound } from './audio.js';

const TWEEN_MS = 140;
const STORAGE_UNLOCKED = 'echoTower.unlocked';

const KEY_DIRS = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right',
  W: 'up', S: 'down', A: 'left', D: 'right',
};

export class Game {
  constructor({ canvas, overlay, floorLabel, movesLabel, hintLabel }) {
    this.renderer = new Renderer(canvas);
    this.sound = new Sound();
    this.overlay = overlay;
    this.floorLabel = floorLabel;
    this.movesLabel = movesLabel;
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
    this.totalMoves = 0;

    window.addEventListener('keydown', (e) => this.onKey(e));
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
    this.movesLabel.textContent = '';
    this.hintLabel.textContent = '';
  }

  renderTitle() {
    const floors = this.unlocked > 0
      ? `<p class="picker">Start on floor
           <span class="floor-num">&larr; ${this.selectedFloor + 1} &rarr;</span>
           <span class="soft">of ${LEVELS.length}</span></p>`
      : '';
    this.overlay.innerHTML = `
      <div class="panel">
        <h1>Echo Tower</h1>
        <p class="tagline">The statues echo your every move.<br>Outwit them, floor by floor.</p>
        <div class="keys-grid">
          <span><kbd>&uarr;</kbd><kbd>&darr;</kbd><kbd>&larr;</kbd><kbd>&rarr;</kbd> or <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span><span>move</span>
          <span><kbd>R</kbd></span><span>restart floor</span>
          <span><kbd>M</kbd></span><span>sound on/off</span>
          <span><kbd>Esc</kbd></span><span>pause</span>
        </div>
        ${floors}
        <p class="cta">Press <kbd>Enter</kbd> to play</p>
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
    this.updateMovesLabel();
    this.sound.startMusic();
  }

  updateMovesLabel() {
    this.movesLabel.textContent = this.state.moves === 0 ? '' : `${this.state.moves} moves`;
  }

  showComplete() {
    this.screen = 'complete';
    const secs = Math.round((Date.now() - this.levelStartedAt) / 1000);
    this.totalMoves += this.state.moves;
    const last = this.levelIndex === LEVELS.length - 1;
    if (!last) this.unlock(this.levelIndex + 1);
    this.overlay.innerHTML = `
      <div class="panel">
        <h2>${last ? 'You reached the top!' : `Floor ${this.levelIndex + 1} cleared`}</h2>
        <p class="stats">${this.state.moves} moves &middot; ${secs}s</p>
        ${last
          ? `<p class="tagline">The tower is quiet. The statues rest&hellip; for now.</p>
             <p class="cta">Press <kbd>Enter</kbd> for the title screen</p>`
          : `<p class="cta">Press <kbd>Enter</kbd> for floor ${this.levelIndex + 2}</p>`}
      </div>`;
    this.overlay.classList.remove('hidden');
  }

  showPause() {
    this.screen = 'paused';
    this.overlay.innerHTML = `
      <div class="panel">
        <h2>Paused</h2>
        <div class="keys-grid">
          <span><kbd>Esc</kbd></span><span>resume</span>
          <span><kbd>R</kbd></span><span>restart floor</span>
          <span><kbd>Q</kbd></span><span>quit to title</span>
        </div>
      </div>`;
    this.overlay.classList.remove('hidden');
  }

  resume() {
    this.screen = 'playing';
    this.overlay.classList.add('hidden');
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
          this.totalMoves = 0;
          this.startLevel(this.selectedFloor);
        } else if (k === 'ArrowLeft' && this.selectedFloor > 0) {
          this.selectedFloor--;
          this.renderTitle();
        } else if (k === 'ArrowRight' && this.selectedFloor < this.unlocked) {
          this.selectedFloor++;
          this.renderTitle();
        }
        return;

      case 'complete':
        if (k === 'Enter' || k === ' ') {
          e.preventDefault();
          if (this.levelIndex === LEVELS.length - 1) this.showTitle();
          else this.startLevel(this.levelIndex + 1);
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
          if (this.queue.length < 2) this.queue.push(dir);
          return;
        }
        if (k === 'r' || k === 'R') this.startLevel(this.levelIndex);
        else if (k === 'Escape') this.showPause();
        else if (k === ']') this.startLevel(Math.min(this.levelIndex + 1, LEVELS.length - 1));
        else if (k === '[') this.startLevel(Math.max(this.levelIndex - 1, 0));
        return;
      }
    }
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
    this.updateMovesLabel();
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
