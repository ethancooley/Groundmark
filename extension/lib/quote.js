import { coverage, normalize, splitSentences } from "./text.js";

/**
 * The model is asked to quote the source word for word. We never trust that:
 * if the quote isn't literally in the passage, the passage's closest real
 * sentence replaces it. Every receipt a user sees is text that exists on the page.
 * @returns {{ quote: string, verbatim: boolean }}
 */
export function verifyQuote(quote, passageText, claim) {
  const passage = normalize(passageText);
  const q = normalize(quote || "")
    .replace(/^["']|["']$/g, "")
    .replace(/^\.\.\.|\.\.\.$/g, "")
    .trim();
  if (q.length >= 8) {
    const at = passage.toLowerCase().indexOf(q.toLowerCase());
    if (at >= 0) return { quote: passage.slice(at, at + q.length), verbatim: true };
  }
  return { quote: bestSentence(passage, q || claim), verbatim: false };
}

export function bestSentence(passage, target) {
  const sents = splitSentences(passage);
  if (sents.length === 0) return passage.slice(0, 300);
  let best = sents[0];
  let bestScore = -1;
  for (const s of sents) {
    const score = coverage(target, s);
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return best.length > 400 ? best.slice(0, 400) + "…" : best;
}

function encodeFragmentPart(s) {
  // Text fragments reserve "-", "," and "&", so encode them on top of the usual escaping.
  return encodeURIComponent(s).replace(/-/g, "%2D").replace(/,/g, "%2C").replace(/&/g, "%26");
}

/** Builds a link that opens the page and highlights the quote (text fragments). */
export function fragmentUrl(pageUrl, quote) {
  const clean = normalize(quote).replace(/…$/, "").trim();
  const words = clean.split(" ");
  const directive =
    words.length <= 8
      ? encodeFragmentPart(clean)
      : `${encodeFragmentPart(words.slice(0, 5).join(" "))},${encodeFragmentPart(words.slice(-4).join(" "))}`;
  return `${pageUrl.split("#")[0]}#:~:text=${directive}`;
}
