import { coverage, normalize, numbersIn, splitSentences } from "./text.js";

/**
 * The model is asked to quote the source word for word. We never trust that:
 * if the quote isn't literally in the passage, the passage's closest real
 * sentence replaces it, or nothing does when no sentence is close. Every
 * receipt a user sees is text that exists on the page.
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
  return { quote: bestSentence(passage, claim, q), verbatim: false };
}

/**
 * The passage's sentence closest to the claim (and to the model's attempted
 * quote, if any), favoring sentences with the claim's figures. Returns "" when
 * nothing is close, so an unrelated sentence is never shown as evidence.
 */
export function bestSentence(passage, claim, quote = "") {
  const sents = splitSentences(passage);
  if (sents.length === 0) return "";
  const claimNums = numbersIn(claim);
  let best = "";
  let bestScore = 0;
  for (const s of sents) {
    const nums = numbersIn(s);
    const numberHits = claimNums.filter((n) => nums.includes(n)).length;
    const words = Math.max(coverage(claim, s), quote ? coverage(quote, s) * 0.8 : 0);
    const score = words + (claimNums.length ? (0.5 * numberHits) / claimNums.length : 0);
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  if (bestScore < 0.3) return "";
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
