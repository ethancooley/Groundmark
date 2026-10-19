// Text utilities shared by the extension and the website.

const ABBREVIATIONS = new Set(
  (
    "dr mr mrs ms st jr sr vs etc inc ltd co no fig approx dept est gen gov mt prof rev u.s e.g i.e " +
    "a.m p.m jan feb mar apr jun jul aug sep sept oct nov dec mg kg oz lb lbs"
  ).split(" "),
);

/** Collapse whitespace and unify curly quotes and dashes so comparisons are fair. */
export function normalize(s) {
  return String(s)
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Sentence boundaries as [start, end) character offsets, with common
 * abbreviation false-splits repaired and whitespace trimmed.
 * @param {string} text
 * @returns {{start: number, end: number}[]}
 */
export function sentenceSpans(text) {
  const seg = new Intl.Segmenter("en", { granularity: "sentence" });
  const spans = [];
  for (const s of seg.segment(text)) {
    const prev = spans[spans.length - 1];
    if (prev) {
      const prevText = text.slice(prev.start, prev.end).trim();
      const last = (prevText.split(/\s+/).pop() || "").toLowerCase().replace(/\.$/, "");
      if (ABBREVIATIONS.has(last) || /^[a-z]$/i.test(last) || prevText.length < 4) {
        prev.end = s.index + s.segment.length;
        continue;
      }
    }
    spans.push({ start: s.index, end: s.index + s.segment.length });
  }
  return spans
    .map(({ start, end }) => {
      while (start < end && /\s/.test(text[start])) start++;
      while (end > start && /\s/.test(text[end - 1])) end--;
      return { start, end };
    })
    .filter((s) => s.end > s.start);
}

/** @param {string} text */
export function splitSentences(text) {
  return sentenceSpans(text).map(({ start, end }) => text.slice(start, end));
}

const STOPWORDS = new Set(
  (
    "a an the and or but if then than of to in on at by for with from as is are was were be been being " +
    "it its this that these those there their they them he she his her we our you your i me my " +
    "not no do does did doing have has had having can could should would will may might must shall " +
    "into onto over under about above below between through during before after up down out off " +
    "so such also just only very more most some any all each both few other which who whom whose " +
    "what when where why how one ones"
  ).split(" "),
);

function stem(w) {
  if (w.length > 5 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith("ed")) return w.slice(0, -2);
  if (w.length > 4 && w.endsWith("es")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

const NUMBER_WORDS = {
  zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8",
  nine: "9", ten: "10", eleven: "11", twelve: "12", thirteen: "13", fourteen: "14", fifteen: "15",
  sixteen: "16", seventeen: "17", eighteen: "18", nineteen: "19", twenty: "20", thirty: "30",
  forty: "40", fifty: "50", sixty: "60", seventy: "70", eighty: "80", ninety: "90",
  hundred: "100", thousand: "1000", million: "1000000", billion: "1000000000", dozen: "12",
  half: "0.5", twice: "2", double: "2", triple: "3",
};

/** Content tokens: lowercase, no stopwords, lightly stemmed. Numbers kept intact; number words become digits. */
export function tokens(text) {
  const words = normalize(text).toLowerCase().match(/[a-z0-9]+(?:[.,][0-9]+)*/g);
  if (!words) return [];
  return words
    .map((w) => NUMBER_WORDS[w] || w)
    .filter((w) => !STOPWORDS.has(w) && (w.length > 1 || /\d/.test(w)))
    .map((w) => (/\d/.test(w) ? w.replace(/,/g, "") : stem(w)));
}

/**
 * Numbers in text, normalized: commas removed and number words ("four",
 * "dozen") turned into digits, so "eight cups" and "8 cups" compare equal.
 */
export function numbersIn(text) {
  const out = [];
  for (const m of normalize(text).toLowerCase().matchAll(/\d+(?:[.,]\d+)*|[a-z]+/g)) {
    const t = m[0];
    if (/^\d/.test(t)) out.push(t.replace(/,/g, ""));
    else if (NUMBER_WORDS[t] && t !== "one" && t !== "half" && t !== "double" && t !== "triple" && t !== "twice") out.push(NUMBER_WORDS[t]);
  }
  return out;
}

/** Fraction of the claim's content tokens that appear in the passage. */
export function coverage(claim, passage) {
  const c = new Set(tokens(claim));
  if (c.size === 0) return 0;
  const p = new Set(tokens(passage));
  let hit = 0;
  for (const t of c) if (p.has(t)) hit++;
  return hit / c.size;
}
