import type { Passage } from "./types";
import { numbersIn, splitSentences, tokens } from "./text";

const WINDOW = 3;
const STRIDE = 2;
const MAX_PASSAGES_PER_DOC = 600;

/** Turns readable blocks into small overlapping passages (about three sentences each). */
export function buildPassages(blocks: string[], sourceUrl: string, sourceIndex: number): Passage[] {
  const out: Passage[] = [];
  for (const block of blocks) {
    const sents = splitSentences(block);
    if (sents.length <= WINDOW) {
      out.push({ id: "", sourceUrl, text: sents.join(" ").slice(0, 900) });
    } else {
      for (let i = 0; i < sents.length; i += STRIDE) {
        out.push({ id: "", sourceUrl, text: sents.slice(i, i + WINDOW).join(" ").slice(0, 900) });
        if (i + WINDOW >= sents.length) break;
      }
    }
    if (out.length >= MAX_PASSAGES_PER_DOC) break;
  }
  return out.map((p, i) => ({ ...p, id: `S${sourceIndex + 1}-P${i + 1}` }));
}

/**
 * Ranks passages for a claim with BM25, plus a small bonus for passages that
 * contain the claim's numbers (dates, doses, counts are where errors hide).
 */
export function rankPassages(claim: string, passages: Passage[], k = 4): Passage[] {
  if (passages.length === 0) return [];
  const q = Array.from(new Set(tokens(claim)));
  const claimNums = new Set(numbersIn(claim));
  const docs = passages.map((p) => tokens(p.text));
  const N = docs.length;
  const avgdl = docs.reduce((s, d) => s + d.length, 0) / N || 1;
  const df = new Map<string, number>();
  for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) ?? 0) + 1);

  const k1 = 1.2;
  const b = 0.75;
  const scored = passages.map((p, i) => {
    const d = docs[i];
    const tf = new Map<string, number>();
    for (const t of d) tf.set(t, (tf.get(t) ?? 0) + 1);
    let score = 0;
    for (const t of q) {
      const f = tf.get(t);
      if (!f) continue;
      const n = df.get(t) ?? 0;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.length) / avgdl)));
    }
    if (claimNums.size > 0) {
      const pn = new Set(numbersIn(p.text));
      for (const n of claimNums) if (pn.has(n)) score += 1.5;
    }
    return { p, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((s) => s.p);
}
