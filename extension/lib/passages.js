import { numbersIn, splitSentences, tokens } from "./text.js";

const WINDOW = 3;
const STRIDE = 2;
const MAX_PASSAGES_PER_DOC = 600;
const MAX_PASSAGE_CHARS = 700;

/**
 * @typedef {{ id: string, sourceUrl: string, text: string }} Passage
 */

/**
 * Turns readable blocks into small overlapping passages (about three sentences each).
 * @param {string[]} blocks
 * @param {string} sourceUrl
 * @param {number} sourceIndex
 * @returns {Passage[]}
 */
export function buildPassages(blocks, sourceUrl, sourceIndex) {
  const out = [];
  for (const block of blocks) {
    const sents = splitSentences(block);
    if (sents.length <= WINDOW) {
      out.push(sents.join(" ").slice(0, MAX_PASSAGE_CHARS));
    } else {
      for (let i = 0; i < sents.length; i += STRIDE) {
        out.push(sents.slice(i, i + WINDOW).join(" ").slice(0, MAX_PASSAGE_CHARS));
        if (i + WINDOW >= sents.length) break;
      }
    }
    if (out.length >= MAX_PASSAGES_PER_DOC) break;
  }
  return out.map((text, i) => ({ id: `S${sourceIndex + 1}-P${i + 1}`, sourceUrl, text }));
}

/**
 * Ranks passages for a claim with BM25, plus a bonus for passages that contain
 * the claim's numbers (dates, doses, and counts are where errors tend to hide).
 * @param {string} claim
 * @param {Passage[]} passages
 * @param {number} k
 * @returns {Passage[]}
 */
export function rankPassages(claim, passages, k = 4) {
  if (passages.length === 0) return [];
  const q = Array.from(new Set(tokens(claim)));
  const claimNums = new Set(numbersIn(claim));
  const docs = passages.map((p) => tokens(p.text));
  const N = docs.length;
  const avgdl = docs.reduce((s, d) => s + d.length, 0) / N || 1;
  const df = new Map();
  for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) || 0) + 1);

  const k1 = 1.2;
  const b = 0.75;
  return passages
    .map((p, i) => {
      const d = docs[i];
      const tf = new Map();
      for (const t of d) tf.set(t, (tf.get(t) || 0) + 1);
      let score = 0;
      for (const t of q) {
        const f = tf.get(t);
        if (!f) continue;
        const n = df.get(t) || 0;
        const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
        score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.length) / avgdl)));
      }
      if (claimNums.size > 0) {
        const pn = new Set(numbersIn(p.text));
        for (const n of claimNums) if (pn.has(n)) score += 1.5;
      }
      return { p, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((s) => s.p);
}
