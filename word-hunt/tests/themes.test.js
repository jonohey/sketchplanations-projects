// Checks every colour scheme in style.css for WCAG AA contrast:
// 4.5:1 for text, 3:1 for the edges that make up the board and controls.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../style.css", import.meta.url), "utf8");

function parseThemes() {
  const themes = {};
  for (const [, name, body] of css.matchAll(/\[data-theme="([\w-]+)"\]\s*\{([^}]*)\}/g)) {
    const vars = {};
    for (const [, k, v] of body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) vars[k] = v;
    themes[name] = vars;
  }
  return themes;
}

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// [foreground, background, what it is]
const TEXT = [
  ["ink", "paper", "body text"],
  ["ink-soft", "paper", "secondary text, missed words"],
  ["ink", "hover", "text on hover backgrounds"],
  ["ink-soft", "hover", "missed word on hover"],
  ["good", "paper", "found-word message"],
  ["bad", "paper", "not-a-word message"],
  ["extra", "paper", "names and slang, links"],
  ["accent-ink", "paper", "already-found message"],
  ["tile-ink", "tile", "letters on dice"],
  ["on-accent", "accent", "selected dice, primary button, chosen option"],
  ["on-accent", "flash-good", "letters flashing green"],
  ["on-accent", "flash-bad", "letters flashing red"],
  ["on-accent", "flash-dup", "letters flashing yellow"],
  ["on-accent", "flash-extra", "letters flashing blue"],
  ["on-bad", "bad", "timer in the last ten seconds"],
];

const EDGES = [
  ["ink", "paper", "outlines of buttons, tray and dialogs"],
  ["extra", "paper", "keyboard focus ring"],
];

const themes = parseThemes();

test("there are 3 to 6 schemes, each defining every colour", () => {
  const names = Object.keys(themes);
  assert.ok(names.length >= 3 && names.length <= 6, names.join(", "));
  const keys = Object.keys(themes.classic).sort();
  for (const [name, vars] of Object.entries(themes)) {
    assert.deepEqual(Object.keys(vars).sort(), keys, `${name} is missing colours`);
  }
});

for (const [name, v] of Object.entries(themes)) {
  test(`${name}: text meets 4.5:1`, () => {
    for (const [fg, bg, what] of TEXT) {
      const r = contrast(v[fg], v[bg]);
      assert.ok(r >= 4.5, `${what} (${fg} on ${bg}) is ${r.toFixed(2)}:1`);
    }
  });

  test(`${name}: edges meet 3:1`, () => {
    for (const [fg, bg, what] of EDGES) {
      const r = contrast(v[fg], v[bg]);
      assert.ok(r >= 3, `${what} (${fg} on ${bg}) is ${r.toFixed(2)}:1`);
    }
    // Each die must stand out from the tray, by its fill or its outline.
    const die = Math.max(contrast(v.tile, v.tray), contrast(v.ink, v.tray));
    assert.ok(die >= 3, `dice against tray is ${die.toFixed(2)}:1`);
  });
}
