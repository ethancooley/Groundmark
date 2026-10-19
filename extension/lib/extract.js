import { normalize } from "./text.js";

const BLOCK_SELECTOR = "p, li, h1, h2, h3, h4, h5, h6, blockquote, td, th, dd, dt, figcaption, pre";

function blocksFrom(root) {
  const out = [];
  root.querySelectorAll(BLOCK_SELECTOR).forEach((el) => {
    // Skip blocks nested in another block we already take (e.g. p inside li).
    const parentBlock = el.parentElement && el.parentElement.closest(BLOCK_SELECTOR);
    if (parentBlock && root.contains(parentBlock)) return;
    const t = normalize(el.textContent || "");
    if (t.length >= 20) out.push(t);
  });
  return out;
}

/**
 * Pulls the main readable text out of an HTML page.
 * @param {string} html
 * @param {string} url
 * @param {{ DOMParser: typeof DOMParser, Readability: any }} env
 * @returns {{ title?: string, blocks: string[] }}
 */
export function extractFromHtml(html, url, env) {
  const doc = new env.DOMParser().parseFromString(html, "text/html");
  // Give relative links a base, and strip anything executable or decorative.
  const base = doc.createElement("base");
  base.href = url;
  doc.head && doc.head.prepend(base);
  doc.querySelectorAll("script, style, noscript, svg, iframe, template, object, embed").forEach((n) => n.remove());
  const pageTitle = normalize(doc.title || "") || undefined;

  let article = null;
  try {
    article = new env.Readability(doc.cloneNode(true), { charThreshold: 200 }).parse();
  } catch {
    article = null;
  }

  let blocks = [];
  if (article && article.content) {
    const frag = new env.DOMParser().parseFromString(`<body>${article.content}</body>`, "text/html");
    blocks = blocksFrom(frag.body);
    if (blocks.length === 0 && article.textContent && normalize(article.textContent)) {
      blocks = [normalize(article.textContent)];
    }
  }
  // Fallback when Readability can't find an article (forums, product pages, etc.).
  if (blocks.join(" ").length < 400 && doc.body) {
    const fromBody = blocksFrom(doc.body);
    if (fromBody.join(" ").length > blocks.join(" ").length) blocks = fromBody;
  }
  return { title: normalize((article && article.title) || "") || pageTitle, blocks };
}

/** Splits pasted or plain text into blocks on blank lines. */
export function extractFromText(text) {
  return {
    blocks: String(text)
      .split(/\n\s*\n/)
      .map(normalize)
      .filter((b) => b.length >= 20),
  };
}
