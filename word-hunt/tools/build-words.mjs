#!/usr/bin/env node
// Builds the word files Word Hunt loads at runtime.
//
//   node tools/build-words.mjs <enable1.txt> [web2] [propernames]
//
// Inputs
//   enable1.txt  The ENABLE word list (public domain), e.g. from
//                https://github.com/dolph/dictionary/blob/master/enable1.txt
//   web2         Webster's 2nd International (public domain). Defaults to
//                /usr/share/dict/web2, which ships with macOS and BSDs.
//   propernames  Defaults to /usr/share/dict/propernames.
//   tools/places.txt Hand-written place and other proper names (in this repo).
//   tools/slang.txt  Hand-written list of informal words (in this repo).
//
// Outputs (in words/)
//   words.txt  Scoring words (3+ letters), front-coded: each line is one digit
//              (how many leading letters it shares with the previous word,
//              capped at 9) followed by the rest of the word. Sorted.
//   extra.txt  Recognised-but-zero-point words, one per line. Capitalised
//              entries are proper nouns, lowercase entries are slang.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const [enablePath, web2Path = "/usr/share/dict/web2", namesPath = "/usr/share/dict/propernames"] =
  process.argv.slice(2);
if (!enablePath) {
  console.error("usage: node tools/build-words.mjs <enable1.txt> [web2] [propernames]");
  process.exit(1);
}

const lines = (path) =>
  readFileSync(path, "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

// --- scoring words -------------------------------------------------------
const words = [...new Set(lines(enablePath).filter((w) => /^[a-z]{3,}$/.test(w)))].sort();
const wordSet = new Set(words);

let prev = "";
const coded = words.map((w) => {
  let n = 0;
  const max = Math.min(prev.length, w.length, 9);
  while (n < max && prev[n] === w[n]) n++;
  prev = w;
  return n + w.slice(n);
});
writeFileSync(join(root, "words/words.txt"), coded.join("\n") + "\n");

// --- zero-point words ----------------------------------------------------
const extra = new Map(); // lowercase -> display form
const addExtra = (display) => {
  const key = display.toLowerCase();
  if (key.length < 3 || wordSet.has(key) || extra.has(key)) return;
  extra.set(key, display);
};

for (const w of [...lines(join(here, "places.txt")), ...lines(web2Path), ...lines(namesPath)]) {
  if (/^[A-Z][a-z]+$/.test(w)) addExtra(w);
}
for (const w of lines(join(here, "slang.txt"))) {
  if (/^[a-z]+$/.test(w)) addExtra(w);
}

const extraList = [...extra.values()].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
writeFileSync(join(root, "words/extra.txt"), extraList.join("\n") + "\n");

console.log(`words.txt: ${words.length} words`);
console.log(`extra.txt: ${extraList.length} words`);
