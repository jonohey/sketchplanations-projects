import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DICE,
  SIZES,
  rollBoard,
  neighbours,
  isAdjacent,
  isValidPath,
  scoreWord,
  decodeWords,
  makeDictionary,
  lookup,
  hasPrefix,
  pathWord,
  findPath,
  solve,
} from "../src/logic.js";

const tiny = makeDictionary(["cat", "cats", "coat", "quit", "quite", "tac"], ["Paris", "yeet"]);

test("there are enough six-sided dice for a 6x6 board", () => {
  assert.equal(DICE.length, 36);
  for (const d of DICE) {
    assert.match(d, /^[A-Z]{6}$/);
    assert.equal(new Set(d).size, 6, `${d} repeats a face`);
  }
});

test("rollBoard gives size² tiles, Q becomes qu", () => {
  for (const n of SIZES) {
    const b = rollBoard(n);
    assert.equal(b.length, n * n);
    for (const t of b) assert.match(t, /^([a-pr-z]|qu)$/);
  }
});

test("scoring follows the table", () => {
  assert.deepEqual([2, 3, 4, 5, 6, 7, 8, 9, 12].map(scoreWord), [0, 1, 1, 2, 3, 5, 11, 11, 11]);
});

test("adjacency includes diagonals, not jumps", () => {
  assert.ok(isAdjacent(0, 1, 4));
  assert.ok(isAdjacent(0, 5, 4));
  assert.ok(!isAdjacent(0, 2, 4));
  assert.ok(!isAdjacent(3, 4, 4), "no wrap from row end to next row start");
  assert.equal(neighbours(3)[4].length, 8);
  assert.equal(neighbours(3)[0].length, 3);
});

test("paths can't reuse a tile or skip one", () => {
  assert.ok(isValidPath([0, 1, 5], 4));
  assert.ok(!isValidPath([0, 1, 0], 4));
  assert.ok(!isValidPath([0, 2], 4));
});

test("front-coded word lists decode", () => {
  assert.deepEqual(decodeWords("0aah\n3ed\n3ing\n0bat\n"), ["aah", "aahed", "aahing", "bat"]);
});

test("lookup separates scoring words, names and slang", () => {
  assert.equal(lookup(tiny, "cat").kind, "word");
  assert.deepEqual(lookup(tiny, "paris"), { kind: "name", display: "Paris" });
  assert.equal(lookup(tiny, "yeet").kind, "slang");
  assert.equal(lookup(tiny, "xyz").kind, null);
  assert.equal(lookup(tiny, "ca").kind, null);
});

test("prefix search", () => {
  assert.ok(hasPrefix(tiny.words.slice().sort(), "co"));
  assert.ok(!hasPrefix(tiny.words.slice().sort(), "cx"));
});

// c  a s
// t  i o
// qu e x
const board = ["c", "a", "s", "t", "i", "o", "qu", "e", "x"];

test("findPath traces typed words, including Qu tiles", () => {
  assert.deepEqual(findPath(board, 3, "cat"), [0, 1, 3]);
  assert.deepEqual(findPath(board, 3, "quit"), [6, 4, 3]);
  assert.equal(pathWord(board, findPath(board, 3, "quit")), "quit");
  assert.equal(findPath(board, 3, "coat"), null, "c and o aren't touching");
  assert.equal(findPath(board, 3, "q"), null, "a lone q can't match the Qu tile");
});

test("solve finds every dictionary word on the board", () => {
  const words = solve(board, 3, { ...tiny, words: tiny.words.slice().sort() });
  assert.deepEqual(words.sort(), ["cat", "quit", "quite", "tac"].sort());
});

test("shipped word list loads and has common words", () => {
  const url = new URL("../words/words.txt", import.meta.url);
  const words = decodeWords(readFileSync(url, "utf8"));
  assert.ok(words.length > 170000);
  for (let i = 1; i < words.length; i++) assert.ok(words[i - 1] < words[i], `unsorted at ${i}`);
  const dict = makeDictionary(words, readFileSync(new URL("../words/extra.txt", import.meta.url), "utf8").split("\n"));
  for (const w of ["cats", "quiet", "jumped", "boxes", "colour"]) assert.equal(lookup(dict, w).kind, "word", w);
  assert.equal(lookup(dict, "london").kind, "name");
  assert.equal(lookup(dict, "selfie").kind, "slang");
});
