import { coverage, normalize, splitSentences } from "./text";

/**
 * The judge is asked to quote the source verbatim. We never trust that blindly:
 * if the quote isn't literally in the passage, we swap in the passage's closest
 * real sentence. Every receipt the user sees is text that exists on the page.
 */
export function verifyQuote(
  quote: string | undefined,
  passageText: string,
  claim: string,
): { quote: string; verbatim: boolean } {
  const passage = normalize(passageText);
  const q = normalize(quote ?? "").replace(/^["']|["']$/g, "").replace(/^\.\.\.|\.\.\.$/g, "").trim();
  if (q.length >= 8 && passage.toLowerCase().includes(q.toLowerCase())) {
    const start = passage.toLowerCase().indexOf(q.toLowerCase());
    return { quote: passage.slice(start, start + q.length), verbatim: true };
  }
  return { quote: bestSentence(passage, q || claim), verbatim: false };
}

export function bestSentence(passage: string, target: string): string {
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

function encodeFragmentPart(s: string): string {
  // Text fragments reserve "-", "," and "&", so encode them on top of the usual escaping.
  return encodeURIComponent(s).replace(/-/g, "%2D").replace(/,/g, "%2C").replace(/&/g, "%26");
}

/** Builds a link that opens the page and highlights the quote (Chrome text fragments). */
export function fragmentUrl(pageUrl: string, quote: string): string {
  const clean = normalize(quote).replace(/…$/, "").trim();
  const words = clean.split(" ");
  let directive: string;
  if (words.length <= 8) {
    directive = encodeFragmentPart(clean);
  } else {
    directive = `${encodeFragmentPart(words.slice(0, 5).join(" "))},${encodeFragmentPart(words.slice(-4).join(" "))}`;
  }
  const base = pageUrl.split("#")[0];
  return `${base}#:~:text=${directive}`;
}
