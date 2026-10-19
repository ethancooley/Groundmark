// Shared text utilities: normalization, sentence splitting, tokenizing.

const ABBREVIATIONS = new Set([
  "dr", "mr", "mrs", "ms", "st", "jr", "sr", "vs", "etc", "inc", "ltd", "co",
  "no", "fig", "approx", "dept", "est", "gen", "gov", "mt", "prof", "rev", "u.s",
  "e.g", "i.e", "a.m", "p.m", "jan", "feb", "mar", "apr", "jun", "jul", "aug",
  "sep", "sept", "oct", "nov", "dec", "mg", "kg", "oz", "lb", "lbs",
]);

/** Collapse whitespace and unify curly quotes/dashes so comparisons are fair. */
export function normalize(s: string): string {
  return s
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Split text into sentences, repairing common abbreviation false-splits. */
export function splitSentences(text: string): string[] {
  const seg = new Intl.Segmenter("en", { granularity: "sentence" });
  const raw = Array.from(seg.segment(text), (s) => s.segment);
  const out: string[] = [];
  for (const piece of raw) {
    const prev = out[out.length - 1];
    if (prev !== undefined) {
      const lastWord = prev.trim().split(/\s+/).pop()?.toLowerCase().replace(/\.$/, "") ?? "";
      const prevTrim = prev.trim();
      const isAbbrev = ABBREVIATIONS.has(lastWord) || /^[a-z]$/i.test(lastWord);
      if (isAbbrev || prevTrim.length < 4) {
        out[out.length - 1] = prev + piece;
        continue;
      }
    }
    out.push(piece);
  }
  return out.map((s) => s.trim()).filter((s) => s.length > 0);
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

function stem(w: string): string {
  if (w.length > 5 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith("ed")) return w.slice(0, -2);
  if (w.length > 4 && w.endsWith("es")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

/** Content tokens: lowercase, no stopwords, lightly stemmed. Numbers kept intact. */
export function tokens(text: string): string[] {
  const words = normalize(text)
    .toLowerCase()
    .match(/[a-z0-9]+(?:[.,][0-9]+)*/g);
  if (!words) return [];
  return words
    .filter((w) => !STOPWORDS.has(w) && (w.length > 1 || /\d/.test(w)))
    .map((w) => (/\d/.test(w) ? w.replace(/,/g, "") : stem(w)));
}

/** Numbers that appear in text, normalized (commas removed). */
export function numbersIn(text: string): string[] {
  return (normalize(text).match(/\d+(?:[.,]\d+)*/g) ?? []).map((n) => n.replace(/,/g, ""));
}

/** Fraction of the claim's content tokens that appear in the passage. */
export function coverage(claim: string, passage: string): number {
  const c = new Set(tokens(claim));
  if (c.size === 0) return 0;
  const p = new Set(tokens(passage));
  let hit = 0;
  for (const t of c) if (p.has(t)) hit++;
  return hit / c.size;
}
