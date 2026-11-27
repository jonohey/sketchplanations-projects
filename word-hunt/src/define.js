// Word definitions, fetched on demand from Wiktionary's REST API
// (content CC BY-SA). Results are cached for the session.

const API = "https://en.wiktionary.org/api/rest_v1/page/definition/";
const SKIP_POS = new Set(["Symbol", "Letter"]);
const MAX_SENSES = 3;

const cache = new Map(); // word -> Promise<result>

export function wiktionaryUrl(word) {
  return `https://en.wiktionary.org/wiki/${encodeURIComponent(word)}#English`;
}

/** Strip Wiktionary's HTML to plain text (never inserted as HTML). */
function toText(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.body.textContent.replace(/\s+/g, " ").trim();
}

/** The base word of a "plural of X" style definition, if it is one. */
function formOfTarget(html) {
  if (!html.includes("form-of-definition")) return null;
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.querySelector(".form-of-definition-link a[title]")?.getAttribute("title") || null;
}

async function fetchSenses(word) {
  const res = await fetch(API + encodeURIComponent(word), {
    headers: { Accept: "application/json" },
  });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`Wiktionary ${res.status}`);
  const data = await res.json();
  const senses = [];
  for (const entry of data.en || []) {
    if (SKIP_POS.has(entry.partOfSpeech)) continue;
    const def = (entry.definitions || []).find((d) => toText(d.definition || ""));
    if (!def) continue;
    senses.push({
      pos: entry.partOfSpeech.toLowerCase(),
      text: toText(def.definition),
      formOf: formOfTarget(def.definition),
    });
    if (senses.length >= MAX_SENSES) break;
  }
  return senses;
}

/**
 * Look up a word. Resolves to { senses, base } where `base` is
 * { word, senses } when the first sense is an inflection ("plural of X").
 */
export function define(word) {
  if (!cache.has(word)) {
    const p = (async () => {
      const senses = await fetchSenses(word);
      const target = senses[0]?.formOf;
      let base = null;
      if (target && target !== word) {
        const baseSenses = await fetchSenses(target).catch(() => []);
        if (baseSenses.length) base = { word: target, senses: baseSenses.slice(0, 2) };
      }
      return { senses, base };
    })();
    cache.set(word, p);
    p.catch(() => cache.delete(word)); // let a failed lookup be retried
  }
  return cache.get(word);
}
