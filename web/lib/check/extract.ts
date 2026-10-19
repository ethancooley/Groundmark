import { JSDOM, VirtualConsole } from "jsdom";
import { Readability } from "@mozilla/readability";
import { normalize } from "./text";

export interface ExtractedDoc {
  title?: string;
  /** Readable blocks of text (paragraphs, list items, table cells, headings). */
  blocks: string[];
}

const BLOCK_SELECTOR = "p, li, h1, h2, h3, h4, h5, h6, blockquote, td, th, dd, dt, figcaption, pre";

function blocksFrom(root: ParentNode): string[] {
  const out: string[] = [];
  root.querySelectorAll(BLOCK_SELECTOR).forEach((el) => {
    // Skip blocks nested inside another block we already take (e.g. p inside li)
    const parentBlock = el.parentElement?.closest(BLOCK_SELECTOR);
    if (parentBlock && root.contains(parentBlock)) return;
    const t = normalize(el.textContent ?? "");
    if (t.length >= 20) out.push(t);
  });
  return out;
}

/** Pulls the main readable text out of an HTML page. */
export function extractFromHtml(html: string, url: string): ExtractedDoc {
  const virtualConsole = new VirtualConsole(); // swallow CSS/script parse noise
  const dom = new JSDOM(html, { url, virtualConsole });
  const doc = dom.window.document;
  doc.querySelectorAll("script, style, noscript, svg, iframe, template").forEach((n) => n.remove());
  const pageTitle = normalize(doc.title ?? "") || undefined;

  // Readability mutates the document, so give it a clone.
  const article = new Readability(doc.cloneNode(true) as Document, { charThreshold: 200 }).parse();

  let blocks: string[] = [];
  if (article?.content) {
    const frag = JSDOM.fragment(article.content);
    blocks = blocksFrom(frag);
    if (blocks.length === 0 && article.textContent) {
      blocks = normalize(article.textContent).length > 0 ? [normalize(article.textContent)] : [];
    }
  }
  // Fallback when Readability can't find an article (forums, product pages, etc.)
  if (blocks.join(" ").length < 400) {
    const fromBody = blocksFrom(doc.body ?? doc);
    if (fromBody.join(" ").length > blocks.join(" ").length) blocks = fromBody;
  }
  dom.window.close();
  return { title: normalize(article?.title ?? "") || pageTitle, blocks };
}

export function extractFromText(text: string): ExtractedDoc {
  const blocks = text
    .split(/\n\s*\n/)
    .map(normalize)
    .filter((b) => b.length >= 20);
  return { blocks };
}
