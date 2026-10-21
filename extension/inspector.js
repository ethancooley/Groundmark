// Shows everything that went into one verdict: the sources, the passages, the
// exact text sent to Gemini Nano, its raw answer, and what Groundmark did with it.
// All page and model text is rendered with textContent, never as HTML.
import { EXAMPLES, SCHEMA, SYSTEM } from "./lib/judge.js";

const VERDICTS = {
  supported: "Supported by its source",
  not_found: "Not found in its source",
  contradicted: "Contradicted by its source",
  unverifiable: "Couldn't check",
};
const STATUS = {
  ok: "Read",
  blocked: "Not opened (local or unsafe address)",
  failed: "Couldn't load",
  unsupported_type: "File type not supported (for example, a PDF)",
  empty: "No readable text",
};

const main = document.getElementById("main");

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined && text !== null) e.textContent = text;
  return e;
}

function host(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function section(title, intro) {
  const s = el("section", "block");
  s.append(el("h2", "", title));
  if (intro) s.append(el("p", "intro", intro));
  main.append(s);
  return s;
}

function pre(text) {
  const p = el("pre", "code");
  p.textContent = text;
  return p;
}

function details(summary, ...children) {
  const d = el("details", "fold");
  d.append(el("summary", "", summary), ...children);
  return d;
}

function step(ok, title, body) {
  const li = el("li", ok === true ? "ok" : ok === false ? "warn" : "info");
  li.append(el("strong", "", title));
  if (body) li.append(el("span", "", body));
  return li;
}

function renderHeader(d) {
  const head = el("section", "hero");
  const pill = el("span", `pill v-${d.verdict}`, VERDICTS[d.verdict] || d.verdict);
  if (d.partial && d.verdict === "not_found") pill.textContent += " (partly)";
  head.append(el("p", "kicker", "How Groundmark checked this sentence"));
  const q = el("blockquote", "claim", d.claim);
  head.append(q, pill);
  if (d.explanation) head.append(el("p", "explain", d.explanation));
  const t = d.trace;
  const lite = "Checked in lite mode: matching words and figures";
  let engine = `${lite}, because the on-device AI isn't set up.`;
  if (t.mode === "model") {
    engine = "Checked on your computer by Gemini Nano, the language model built into Chrome.";
    if (t.ms) engine += ` It took ${(t.ms / 1000).toFixed(1)} seconds.`;
  } else if (t.unreadable) engine = "No check was run, because none of the cited pages could be read.";
  else if (t.why === "slow") engine = `${lite}, because the on-device AI was slow on this computer.`;
  else if (t.why === "lite-here") engine = `${lite}, because lite mode is on for this computer. You can change it in Groundmark's settings.`;
  else if (t.why === "lite") engine = `${lite}, because lite mode is chosen in Groundmark's settings.`;
  head.append(el("p", "engine", engine));
  main.append(head);
}

function renderSources(d) {
  const s = section(
    "Sources",
    d.scope === "overview"
      ? "Google didn't attach links to this sentence, so it was checked against the Overview's sources."
      : d.scope === "list"
        ? "This item had no links of its own, so it was checked against the links Google attached to its list."
        : "The links Google attached to this sentence.",
  );
  const list = el("ul", "sources");
  for (const src of d.trace.sources || []) {
    const li = el("li");
    const a = el("a", "", src.title || host(src.url));
    a.href = src.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    li.append(a, el("span", `status s-${src.status}`, STATUS[src.status] || src.status));
    if (src.detail && src.status !== "ok") li.append(el("small", "", src.detail));
    list.append(li);
  }
  s.append(list);
}

function renderPassages(d) {
  const t = d.trace;
  const sent = new Set(t.sentPassageIds || t.candidates.map((c) => c.id));
  const s = section(
    t.mode === "model" ? "Passages sent to the model" : "Passages compared",
    "Each cited page is split into short passages. Groundmark ranks them by how many of the sentence's key words and figures they share, and keeps the best few from each page. This is untrusted text copied from the web.",
  );
  const list = el("ol", "passages");
  for (const c of t.candidates) {
    const li = el("li", c.id === t.chosenPassageId ? "chosen" : "");
    if (!sent.has(c.id)) li.classList.add("unsent");
    const meta = el("div", "pmeta");
    meta.append(el("span", "pid", c.id), el("span", "psrc", c.sourceTitle || host(c.sourceUrl)));
    if (c.id === t.chosenPassageId) meta.append(el("span", "tag", t.mode === "model" ? "Model's pick" : "Best match"));
    if (!sent.has(c.id)) meta.append(el("span", "tag muted", "Dropped to fit"));
    li.append(meta, el("p", "ptext", c.text));
    list.append(li);
  }
  s.append(list);
}

function renderModel(d) {
  const t = d.trace;
  const s = section(
    "What Groundmark sent",
    "Every check starts from the same instructions and two worked examples, then adds this sentence and its passages. The answer must match a fixed JSON format.",
  );
  s.append(
    details("Instructions (the same for every sentence)", pre(SYSTEM)),
    details(
      "Worked examples (the same for every sentence)",
      ...EXAMPLES.map((m) => {
        const wrap = el("div", "example");
        wrap.append(el("p", "role", m.role === "user" ? "Example input" : "Example answer"), pre(m.content));
        return wrap;
      }),
    ),
    details("Required answer format", pre(JSON.stringify(SCHEMA, null, 2))),
  );
  s.append(el("h3", "", "This sentence's prompt, exactly as sent"));
  s.append(pre(t.prompt));
  if (t.retried) s.append(el("p", "note", "The first attempt didn't fit in the model's context window, so it was sent again with the two strongest passages."));

  const a = section("What the model answered", "The model's raw output, before Groundmark checked it.");
  let pretty = t.raw;
  try {
    pretty = JSON.stringify(JSON.parse(t.raw), null, 2);
  } catch {}
  a.append(pre(pretty));
}

function renderPostprocess(d) {
  const t = d.trace;
  const s =
    t.mode === "model"
      ? section("What Groundmark did with the answer", "The model's answer is never shown as-is. These checks decide what you saw.")
      : section("How the verdict was decided", "Lite mode doesn't use an AI model. It compares words and figures between the sentence and each passage.");
  const list = el("ul", "steps");
  if (t.fellBack) list.append(step(false, "The model failed, so lite mode was used.", "Matching words and figures replaced the model for this sentence."));
  if (t.overruled) {
    list.append(step(false, 'The model said "contradicted."', t.modelExplanation ? `It wrote: "${t.modelExplanation}"` : ""));
    list.append(
      step(
        false,
        "Groundmark didn't accept that.",
        t.overruled.reason === "quote"
          ? `Calling a sentence contradicted needs the conflicting text on the page, and the model's quote ("${t.modelQuote || ""}") isn't there.`
          : `The page's figure (${t.overruled.figure}) is within the sentence's range (${t.overruled.range}), so they agree rather than conflict.`,
      ),
    );
    list.append(step(null, "The lite check decided instead.", t.rule || ""));
    if (t.claimNumbers && t.claimNumbers.length) {
      list.append(
        t.numbersMatched
          ? step(true, `Figures found: ${t.claimNumbers.join(", ")}.`, "Every figure in the sentence appears in the best passage.")
          : step(false, `Figures missing: ${t.claimNumbers.join(", ")}.`, "At least one figure in the sentence doesn't appear in the best passage."),
      );
    }
  } else if (t.mode === "model") {
    list.append(
      t.modelPickedPassage
        ? step(true, `The model cited passage ${t.chosenPassageId}.`, "That passage was one of the ones it was sent.")
        : step(false, "The model named a passage it wasn't sent.", `The top-ranked passage, ${t.chosenPassageId}, was used instead.`),
    );
    list.append(
      t.quoteVerbatim
        ? step(true, "Its quote appears word for word in the passage.", d.evidence ? `"${d.evidence.quote}"` : "")
        : step(
            false,
            "Its quote didn't match the page, so it was replaced.",
            d.evidence?.quote
              ? `The model wrote "${t.modelQuote || ""}". You saw the closest real sentence instead: "${d.evidence.quote}".`
              : `The model wrote "${t.modelQuote || ""}". No sentence on the page was close enough, so no quote was shown.`,
          ),
    );
  } else {
    list.append(step(null, "The rule", t.rule || "Supported only when the passage contains the sentence's key words and figures."));
    if (t.claimNumbers && t.claimNumbers.length) {
      list.append(
        t.numbersMatched
          ? step(true, `Figures found: ${t.claimNumbers.join(", ")}.`, "Every figure in the sentence appears in the best passage.")
          : step(false, `Figures missing: ${t.claimNumbers.join(", ")}.`, "At least one figure in the sentence doesn't appear in the best passage."),
      );
    }
    list.append(step(null, "Lite mode never says \"contradicted.\"", "Word matching can't tell when a page disagrees, only whether it covers the same details."));
  }
  const level = t.confidence >= 0.75 ? "high" : t.confidence >= 0.5 ? "medium" : "low";
  list.append(
    step(
      null,
      `Confidence: ${level} (${Math.round(t.confidence * 100)}%).`,
      `Computed by Groundmark, not reported by the model. ${Math.round(t.overlap * 100)}% of the sentence's key words appear in the chosen passage${
        t.mode === "model" && !t.overruled ? `, and the quote ${t.quoteVerbatim ? "matched" : "didn't match"} the page.` : "."
      }`,
    ),
  );
  s.append(list);
}

function renderFooter() {
  const f = el("footer", "foot");
  f.append(
    el(
      "p",
      "",
      "This page was built on your computer from memory. Nothing on it was sent anywhere, and it's cleared when Chrome closes.",
    ),
  );
  main.append(f);
}

async function render() {
  const key = decodeURIComponent(location.hash.slice(1));
  const stored = key ? await chrome.storage.session.get(key) : {};
  const d = stored[key];
  document.getElementById("loading").remove();
  if (!d) {
    main.append(
      el("h1", "", "This check is no longer available"),
      el("p", "intro", "Inspector pages are kept in memory and cleared when Chrome restarts. Open one again from a verdict's evidence card."),
    );
    return;
  }
  renderHeader(d);
  renderSources(d);
  if (d.trace.unreadable) {
    renderFooter();
    return;
  }
  renderPassages(d);
  if (d.trace.mode === "model") renderModel(d);
  renderPostprocess(d);
  renderFooter();
}

render();
