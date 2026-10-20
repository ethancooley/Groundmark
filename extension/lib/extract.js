import { normalize } from "./text.js";

// Elements that start a new block of text. Everything else (a, b, span, time,
// strong, em, ...) is inline and joins the text around it.
const BLOCK_TAGS = new Set(
  (
    "ADDRESS ARTICLE ASIDE BLOCKQUOTE BODY DD DETAILS DIALOG DIV DL DT FIELDSET FIGCAPTION FIGURE FOOTER FORM " +
    "H1 H2 H3 H4 H5 H6 HEADER HGROUP HR LI MAIN NAV OL P PRE SECTION SUMMARY TABLE TBODY TD TFOOT TH THEAD TR UL BR"
  ).split(" "),
);
const HEADINGS = new Set(["H1", "H2", "H3", "H4", "H5", "H6"]);

// Page furniture that never holds the facts an Overview cites.
const BOILERPLATE = [
  "script", "style", "noscript", "svg", "iframe", "template", "object", "embed", "canvas", "video", "audio",
  "nav", "[role=navigation]", "[role=menu]", "[role=menubar]", "[role=search]", "[role=dialog]", "[aria-modal=true]",
  "button", "select", "input", "textarea", "[hidden]", "[aria-hidden=true]",
  "[class*=cookie i]", "[id*=cookie i]", "[class*=consent i]", "[class*=breadcrumb i]",
].join(",");

const MIN_BLOCK = 3; // characters
const SHORT_BLOCK = 80; // short blocks are merged with their neighbors
const MERGE_LIMIT = 320;

/**
 * Walks the page in reading order and returns its text as blocks, split at
 * block-level elements. Unlike article extractors such as Readability, this
 * keeps every section of the page: event pages, product pages, and FAQs often
 * keep the cited fact outside what an article extractor treats as the article.
 */
function blocksFrom(root) {
  const blocks = [];
  let buf = "";
  let heading = false;
  const flush = () => {
    const t = normalize(buf);
    if (t.length >= MIN_BLOCK) blocks.push({ text: t, heading });
    buf = "";
  };
  const visit = (node) => {
    if (node.nodeType === 3) {
      buf += node.data;
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = node.tagName;
    if (tag === "IMG") {
      // Alt text can carry facts (an infographic's caption), but only when it's a real description.
      const alt = normalize(node.getAttribute("alt") || "");
      if (alt.split(" ").length >= 4) buf += ` ${alt} `;
      return;
    }
    const isBlock = BLOCK_TAGS.has(tag);
    if (isBlock) {
      flush();
      heading = HEADINGS.has(tag);
    } else if (tag === "TD" || tag === "TH") {
      buf += " ";
    }
    for (const child of node.childNodes) visit(child);
    if (isBlock) {
      flush();
      heading = false;
    }
  };
  visit(root);

  // Merge runs of short blocks (a card's title, date, and place) so a fact split
  // across several small elements stays together in one passage. A heading
  // starts a new group, and joins the text that follows it.
  const merged = [];
  let cur = null;
  for (const b of blocks) {
    const short = b.text.length < SHORT_BLOCK;
    if (cur && !b.heading && (short || cur.short) && cur.text.length + b.text.length < MERGE_LIMIT) {
      cur.text += (/[.!?:;]$/.test(cur.text) ? " " : ". ") + b.text;
      cur.short = short;
      continue;
    }
    if (cur) merged.push(cur.text);
    cur = { text: b.text, short: short || b.heading };
  }
  if (cur) merged.push(cur.text);

  // Drop exact repeats (menus and footers often appear twice) and fragments too short to check against.
  const seen = new Set();
  return merged.filter((t) => {
    if (t.length < 20 || seen.has(t)) return false;
    seen.add(t);
    return true;
  });
}

/**
 * Pulls the readable text out of an HTML page.
 * @param {string} html
 * @param {string} url
 * @param {{ DOMParser: typeof DOMParser }} env
 * @returns {{ title?: string, blocks: string[] }}
 */
export function extractFromHtml(html, url, env) {
  // Drop <link> tags before parsing. The page's preload hints (fonts, scripts) are
  // useless here, and without this Chrome flags them as unused preloads.
  const doc = new env.DOMParser().parseFromString(String(html).replace(/<link\b[^>]*>/gi, ""), "text/html");
  const base = doc.createElement("base");
  base.href = url;
  if (doc.head) doc.head.prepend(base);
  const title =
    normalize(doc.querySelector('meta[property="og:title"]')?.getAttribute("content") || "") ||
    normalize(doc.title || "") ||
    undefined;
  // Structured data and page summaries, which pages built in JavaScript often carry in their HTML.
  const extra = [];
  const desc = normalize(doc.querySelector('meta[name="description"], meta[property="og:description"]')?.getAttribute("content") || "");
  if (desc.length >= 40) extra.push(desc);
  for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      extra.push(...describeJsonLd(JSON.parse(s.textContent || "")));
    } catch {
      // Malformed structured data is common; skip it.
    }
  }
  doc.querySelectorAll(BOILERPLATE).forEach((n) => n.remove());
  const blocks = doc.body ? blocksFrom(doc.body) : [];
  return { title, blocks: [...blocks, ...extra.filter((e) => !blocks.includes(e))] };
}

/** Turns schema.org data (events, articles, FAQs) into plain sentences a passage can hold. */
function describeJsonLd(data, out = []) {
  if (!data || typeof data !== "object" || out.length > 20) return out;
  if (Array.isArray(data)) {
    for (const d of data) describeJsonLd(d, out);
    return out;
  }
  if (Array.isArray(data["@graph"])) describeJsonLd(data["@graph"], out);
  const type = [].concat(data["@type"] || []).join(" ");
  const name = typeof data.name === "string" ? normalize(data.name) : "";
  if (/Event/.test(type) && name) {
    const parts = [name];
    if (data.startDate) parts.push(`starts ${normalize(String(data.startDate))}`);
    if (data.endDate) parts.push(`ends ${normalize(String(data.endDate))}`);
    const place = data.location && (data.location.name || data.location.address?.addressLocality);
    if (place) parts.push(`at ${normalize(String(place))}`);
    out.push(parts.join(", ") + ".");
  }
  if (/FAQPage/.test(type) && Array.isArray(data.mainEntity)) {
    for (const q of data.mainEntity) {
      const a = q.acceptedAnswer && q.acceptedAnswer.text;
      if (q.name && a) out.push(`${normalize(String(q.name))} ${normalize(String(a).replace(/<[^>]+>/g, " "))}`);
    }
  }
  if (typeof data.description === "string" && normalize(data.description).length >= 40) {
    out.push(normalize(data.description.replace(/<[^>]+>/g, " ")));
  }
  return out;
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
