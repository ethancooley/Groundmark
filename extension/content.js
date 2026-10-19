// Overview Check: finds a Google AI Overview, splits it into sentences, sends
// each sentence with the links Google attached to it for checking, and marks
// each sentence with a verdict and the evidence behind it.
(() => {
  if (window.__ocxLoaded) return;
  window.__ocxLoaded = true;

  const MAX_CLAIMS = 20;
  const MAX_SOURCES = 5;
  const STABLE_MS = 1200;
  const LABEL_RE = /^\s*AI Overview\s*$/i;
  const STOP_SELECTOR = "#rso, #search, #center_col, #rcnt, #main, main, body";

  const VERDICTS = {
    pending: { title: "Checking…", short: "Checking" },
    supported: { title: "Supported by its source", short: "Supported" },
    not_found: { title: "Not found in its source", short: "Not in source" },
    contradicted: { title: "Contradicted by its source", short: "Contradicted" },
    unverifiable: { title: "Couldn't check", short: "Couldn't check" },
  };

  const ICONS = {
    pending: '<circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="20 12" />',
    supported: '<path d="M4.5 8.4 7 10.8l4.6-5.3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    not_found: '<path d="M6.2 6.2a1.9 1.9 0 1 1 2.6 1.8c-.5.2-.8.6-.8 1.1v.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="8" cy="11.6" r="1" fill="currentColor"/>',
    contradicted: '<path d="m5.3 5.3 5.4 5.4m0-5.4-5.4 5.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    unverifiable: '<path d="M5 8h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  };

  const state = {
    root: null,
    label: null,
    bar: null,
    claims: new Map(), // id -> { id, text, range, badge, sources, scope, result }
    checkedTexts: new Set(),
    settings: { autoRun: true },
    pending: 0,
    error: null,
    setupNeeded: false,
    mode: null, // "model" (on-device AI) or "heuristic" (lite mode)
    highlights: null,
    card: null,
    pinned: null,
  };

  // ---------- text helpers ----------

  const ABBREV = new Set(
    "dr mr mrs ms st jr sr vs etc inc ltd co no fig approx dept est gen gov mt prof rev u.s e.g i.e a.m p.m jan feb mar apr jun jul aug sep sept oct nov dec mg kg oz lb lbs".split(" "),
  );

  function sentenceSpans(text) {
    const seg = new Intl.Segmenter("en", { granularity: "sentence" });
    const spans = [];
    for (const s of seg.segment(text)) {
      const prev = spans[spans.length - 1];
      if (prev) {
        const prevText = text.slice(prev.start, prev.end).trim();
        const last = (prevText.split(/\s+/).pop() || "").toLowerCase().replace(/\.$/, "");
        if (ABBREV.has(last) || /^[a-z]$/i.test(last) || prevText.length < 4) {
          prev.end = s.index + s.segment.length;
          continue;
        }
      }
      spans.push({ start: s.index, end: s.index + s.segment.length });
    }
    // Trim whitespace off both ends of each span.
    return spans
      .map(({ start, end }) => {
        while (start < end && /\s/.test(text[start])) start++;
        while (end > start && /\s/.test(text[end - 1])) end--;
        return { start, end };
      })
      .filter((s) => s.end > s.start);
  }

  function hash(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  const clean = (s) => s.replace(/\s+/g, " ").trim();

  // ---------- finding the Overview ----------

  function isOurs(node) {
    const el = node.nodeType === 1 ? node : node.parentElement;
    return Boolean(el && el.closest(".ocx-ui"));
  }

  function findLabel() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (LABEL_RE.test(n.data) && !isOurs(n) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP),
    });
    let n;
    while ((n = walker.nextNode())) {
      const el = n.parentElement;
      if (el && el.checkVisibility?.() !== false) return el;
    }
    return null;
  }

  function textLength(el) {
    return (el.innerText || el.textContent || "").trim().length;
  }

  function findRoot(label) {
    let el = label;
    while (el.parentElement) {
      const parent = el.parentElement;
      if (parent.matches(STOP_SELECTOR)) return el;
      el = parent;
      if (textLength(el) > 300) return el;
    }
    return null;
  }

  /** A wider container around the Overview text, for finding its source list. */
  function sourceScope(root) {
    let scope = root;
    const base = textLength(root);
    while (scope.parentElement && !scope.parentElement.matches(STOP_SELECTOR)) {
      const p = scope.parentElement;
      if (textLength(p) > base * 3 + 2500) break;
      scope = p;
    }
    return scope;
  }

  function externalUrl(a) {
    let url;
    try {
      url = new URL(a.href, location.href);
    } catch {
      return null;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    const isGoogle = /(^|\.)google\.[a-z.]+$/i.test(url.hostname) || /(^|\.)gstatic\.com$/i.test(url.hostname);
    if (isGoogle && url.pathname === "/url") {
      const q = url.searchParams.get("q") || url.searchParams.get("url");
      return q && /^https?:/i.test(q) ? q.split("#")[0] : null;
    }
    if (isGoogle || url.hostname === location.hostname) return null;
    url.hash = "";
    return url.toString();
  }

  function linksIn(el) {
    const out = [];
    el.querySelectorAll("a[href]").forEach((a) => {
      if (isOurs(a)) return;
      const u = externalUrl(a);
      if (u && !out.includes(u)) out.push(u);
    });
    return out;
  }

  // ---------- splitting into claims ----------

  const blockCache = new WeakMap();
  function blockOf(el, root) {
    let cur = el;
    while (cur && cur !== root) {
      let isBlock = blockCache.get(cur);
      if (isBlock === undefined) {
        const d = getComputedStyle(cur).display;
        isBlock = !/^(inline|inline-block|inline-flex|contents)$/.test(d);
        blockCache.set(cur, isBlock);
      }
      if (isBlock) return cur;
      cur = cur.parentElement;
    }
    return root;
  }

  function collectGroups(root) {
    const groups = new Map();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (!n.data.trim()) return NodeFilter.FILTER_SKIP;
        const p = n.parentElement;
        if (!p || isOurs(p)) return NodeFilter.FILTER_REJECT;
        if (p.closest("script, style, noscript, button, [role='button'], [aria-hidden='true'], h1, h2, h3, [role='heading']"))
          return NodeFilter.FILTER_SKIP;
        if (state.label && state.label.contains(n)) return NodeFilter.FILTER_SKIP;
        if (p.checkVisibility && !p.checkVisibility()) return NodeFilter.FILTER_SKIP;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let n;
    while ((n = walker.nextNode())) {
      const block = blockOf(n.parentElement, root);
      if (!groups.has(block)) groups.set(block, []);
      groups.get(block).push(n);
    }
    const out = [];
    for (const [block, nodes] of groups) {
      const text = nodes.map((t) => t.data).join("");
      if (clean(text).length < 25) continue;
      const linkChars = nodes.filter((t) => t.parentElement.closest("a")).reduce((s, t) => s + t.data.length, 0);
      if (linkChars / text.length > 0.6) continue; // a source card, not Overview prose
      out.push({ block, nodes, text });
    }
    return out;
  }

  function locate(nodes, index) {
    let acc = 0;
    for (const node of nodes) {
      if (index <= acc + node.data.length) return { node, offset: index - acc };
      acc += node.data.length;
    }
    const last = nodes[nodes.length - 1];
    return { node: last, offset: last.data.length };
  }

  /** Links Google attached near this block: inside it, or in the citation chips right after it. */
  function citedLinks(block) {
    const links = linksIn(block);
    let sib = block.nextElementSibling;
    for (let i = 0; i < 2 && sib && links.length === 0; i++, sib = sib.nextElementSibling) {
      if (textLength(sib) < 120) links.push(...linksIn(sib));
    }
    return Array.from(new Set(links));
  }

  /**
   * Assigns each citation link in a block to the sentence it follows: a link
   * belongs to the last sentence that starts before it.
   */
  function linksBySentence(block, ranges) {
    const owned = ranges.map(() => []);
    block.querySelectorAll("a[href]").forEach((a) => {
      if (isOurs(a)) return;
      const u = externalUrl(a);
      if (!u) return;
      let owner = -1;
      for (let i = 0; i < ranges.length; i++) {
        // comparePoint: -1 if the link is before the sentence starts.
        const startRange = document.createRange();
        startRange.setStart(ranges[i].startContainer, ranges[i].startOffset);
        if (startRange.comparePoint(a, 0) >= 0) owner = i;
        else break;
      }
      if (owner >= 0 && !owned[owner].includes(u)) owned[owner].push(u);
    });
    return owned;
  }

  function extractClaims(root) {
    const overviewSources = linksIn(sourceScope(root)).slice(0, MAX_SOURCES);
    const claims = [];
    for (const group of collectGroups(root)) {
      const blockLinks = citedLinks(group.block);
      const sentences = [];
      for (const span of sentenceSpans(group.text)) {
        const start = locate(group.nodes, span.start);
        const end = locate(group.nodes, span.end);
        const range = document.createRange();
        try {
          range.setStart(start.node, start.offset);
          range.setEnd(end.node, end.offset);
        } catch {
          continue;
        }
        sentences.push({ text: clean(group.text.slice(span.start, span.end)), range });
      }
      const perSentence = linksBySentence(group.block, sentences.map((s) => s.range));

      sentences.forEach((s, i) => {
        const { text, range } = s;
        if (text.split(" ").length < 5 || /:$/.test(text) || !/[a-z]{3}/i.test(text)) return;
        if (state.checkedTexts.has(text)) return;
        // Most specific first: links right after this sentence, then the block's, then the Overview's.
        let sources = perSentence[i];
        let scope = "sentence";
        if (sources.length === 0 && blockLinks.length) sources = blockLinks;
        if (sources.length === 0) {
          sources = overviewSources;
          scope = "overview";
        }
        claims.push({ id: `${hash(text)}-${claims.length}`, text, range, sources: sources.slice(0, MAX_SOURCES), scope });
      });
    }
    return claims;
  }

  // ---------- UI: badges, highlights, bar, card ----------

  function svg(name) {
    return `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">${ICONS[name]}</svg>`;
  }

  function themeOf(el) {
    let node = el;
    while (node) {
      const bg = getComputedStyle(node).backgroundColor;
      const m = bg.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/);
      if (m && (m[4] === undefined || Number(m[4]) > 0.5)) {
        const lum = (0.299 * m[1] + 0.587 * m[2] + 0.114 * m[3]) / 255;
        return lum < 0.5 ? "dark" : "light";
      }
      node = node.parentElement;
    }
    return "light";
  }

  function makeBadge(claim) {
    const b = document.createElement("span");
    b.className = "ocx-ui ocx-badge";
    b.dataset.verdict = "pending";
    b.tabIndex = 0;
    b.setAttribute("role", "button");
    b.setAttribute("aria-label", `Overview Check: checking "${claim.text.slice(0, 80)}"`);
    b.innerHTML = svg("pending");
    b.addEventListener("mouseenter", () => showCard(claim, false));
    b.addEventListener("mouseleave", () => !state.pinned && hideCard());
    b.addEventListener("focus", () => showCard(claim, false));
    b.addEventListener("blur", () => !state.pinned && hideCard());
    b.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (state.pinned === claim.id) {
        state.pinned = null;
        hideCard();
      } else {
        state.pinned = claim.id;
        showCard(claim, true);
      }
    });
    b.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        b.click();
      }
    });
    return b;
  }

  function placeBadges(claims) {
    // Insert from last to first so earlier positions don't shift.
    const sorted = [...claims].sort((a, b) => a.range.compareBoundaryPoints(Range.END_TO_END, b.range));
    for (let i = sorted.length - 1; i >= 0; i--) {
      const c = sorted[i];
      c.badge = makeBadge(c);
      const at = document.createRange();
      at.setStart(c.range.endContainer, c.range.endOffset);
      at.collapse(true);
      at.insertNode(c.badge);
    }
  }

  function setupHighlights() {
    if (!window.CSS?.highlights || state.highlights) return;
    state.highlights = {};
    for (const v of ["supported", "not_found", "contradicted", "focus"]) {
      const h = new Highlight();
      CSS.highlights.set(`ocx-${v}`, h);
      state.highlights[v] = h;
    }
  }

  function updateBadge(claim) {
    const r = claim.result;
    const v = r ? r.verdict : "pending";
    claim.badge.dataset.verdict = v;
    claim.badge.innerHTML = svg(v);
    claim.badge.setAttribute("aria-label", `Overview Check: ${VERDICTS[v].title}. ${r?.explanation || ""}`);
    if (state.highlights && r && state.highlights[v]) state.highlights[v].add(claim.range);
  }

  function ensureBar() {
    if (state.bar && state.bar.isConnected) return state.bar;
    const bar = document.createElement("div");
    bar.className = "ocx-ui ocx-bar";
    bar.dataset.theme = themeOf(state.root);
    bar.innerHTML = `
      <span class="ocx-mark" aria-hidden="true"></span>
      <span class="ocx-bar-name">Overview Check</span>
      <span class="ocx-bar-status" role="status" aria-live="polite"></span>
      <span class="ocx-bar-tally"></span>
      <button type="button" class="ocx-bar-action" hidden></button>`;
    // Put it right under the "AI Overview" heading row.
    let anchor = state.label;
    while (anchor.parentElement && anchor.parentElement !== state.root && !anchor.parentElement.contains(state.root)) {
      if (textLength(anchor.parentElement) > 80) break;
      anchor = anchor.parentElement;
    }
    if (state.root.contains(anchor) && anchor !== state.root) anchor.after(bar);
    else state.root.prepend(bar);
    state.bar = bar;
    return bar;
  }

  function tally() {
    const t = { supported: 0, not_found: 0, contradicted: 0, unverifiable: 0, pending: 0 };
    for (const c of state.claims.values()) t[c.result ? c.result.verdict : "pending"]++;
    return t;
  }

  function renderBar() {
    const bar = ensureBar();
    const status = bar.querySelector(".ocx-bar-status");
    const tallyEl = bar.querySelector(".ocx-bar-tally");
    const action = bar.querySelector(".ocx-bar-action");
    const t = tally();
    const total = state.claims.size;
    action.hidden = true;
    tallyEl.replaceChildren();

    if (state.setupNeeded) {
      bar.dataset.state = "idle";
      status.textContent = "Overview Check needs a one-time setup before it can read the pages Google cited.";
      action.hidden = false;
      action.textContent = "Finish setup";
      action.onclick = () => chrome.runtime.sendMessage({ type: "open_setup" }).catch(() => {});
      return;
    }
    if (state.error) {
      bar.dataset.state = "error";
      status.textContent = state.error;
      action.hidden = false;
      action.textContent = "Try again";
      action.onclick = () => retryFailed();
      return;
    }
    if (total === 0) {
      bar.dataset.state = "idle";
      status.textContent = state.settings.autoRun ? "Looking for sentences to check…" : "Ready to check this Overview.";
      if (!state.settings.autoRun) {
        action.hidden = false;
        action.textContent = "Check this Overview";
        action.onclick = () => runCheck(true);
      }
      return;
    }
    bar.dataset.state = t.pending ? "checking" : "done";
    status.textContent = t.pending
      ? `Checking ${total} ${total === 1 ? "sentence" : "sentences"} against the pages Google cited…`
      : `${t.supported} of ${total} ${total === 1 ? "sentence" : "sentences"} supported by the pages Google cited.`;
    if (state.mode === "heuristic") {
      const lite = document.createElement("span");
      lite.className = "ocx-chip ocx-lite";
      lite.textContent = "Lite mode";
      lite.title = "The on-device AI isn't set up on this computer, so verdicts come from matching words and figures.";
      tallyEl.append(lite);
    }
    for (const v of ["supported", "not_found", "contradicted", "unverifiable"]) {
      if (!t[v]) continue;
      const chip = document.createElement("span");
      chip.className = "ocx-chip";
      chip.dataset.verdict = v;
      chip.innerHTML = svg(v);
      chip.append(`${t[v]} ${VERDICTS[v].short.toLowerCase()}`);
      tallyEl.append(chip);
    }
    try {
      chrome.runtime.sendMessage({ type: "tally", tally: { ...t, total, url: location.href } }).catch(() => {});
    } catch {
      // The extension was reloaded; this page's copy of the script is orphaned.
    }
  }

  // Hover card lives in a shadow root so Google's styles can't reach it.
  function cardHost() {
    if (state.card) return state.card;
    const host = document.createElement("div");
    host.className = "ocx-ui ocx-card-host";
    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = CARD_CSS;
    const card = document.createElement("div");
    card.className = "card";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-label", "Overview Check evidence");
    card.addEventListener("mouseenter", () => (state.overCard = true));
    card.addEventListener("mouseleave", () => {
      state.overCard = false;
      if (!state.pinned) hideCard();
    });
    shadow.append(style, card);
    document.documentElement.append(host);
    state.card = { host, card };
    return state.card;
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text; // never innerHTML for page or server text
    return e;
  }

  function hostOf(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return url;
    }
  }

  function showCard(claim, pinned) {
    clearTimeout(state.hideTimer);
    const { host, card } = cardHost();
    const r = claim.result;
    const v = r ? r.verdict : "pending";
    host.dataset.theme = themeOf(claim.badge.parentElement || document.body);
    card.dataset.verdict = v;
    card.replaceChildren();

    const head = el("div", "head");
    const icon = el("span", "icon");
    icon.innerHTML = svg(v);
    head.append(icon, el("span", "verdict", VERDICTS[v].title));
    if (r?.partial && v === "not_found") head.append(el("span", "tag", "Partly"));
    if (r?.mode === "heuristic") head.append(el("span", "tag", "Lite check"));
    card.append(head);

    if (!r) {
      card.append(el("p", "explain", "Reading the pages Google cited for this sentence."));
    } else {
      card.append(el("p", "explain", r.explanation));
      if (r.evidence) {
        const fig = el("figure", "evidence");
        const q = el("blockquote", "quote");
        q.append(el("mark", "", r.evidence.quote));
        fig.append(q);
        const cap = el("figcaption", "source");
        cap.append(el("span", "site", r.evidence.sourceTitle || hostOf(r.evidence.sourceUrl)));
        cap.append(el("span", "host", hostOf(r.evidence.sourceUrl)));
        fig.append(cap);
        card.append(fig);
        if (!r.evidence.verbatim) {
          card.append(el("p", "note", "The checker's quote didn't match the page exactly, so this is the closest real sentence."));
        }
        const a = el("a", "open", "Open the source at this passage");
        a.href = r.evidence.fragmentUrl;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        card.append(a);
      }
      const meta = el("p", "meta");
      const scope =
        claim.scope === "sentence"
          ? "Checked against the links Google attached to this sentence."
          : "Google didn't attach links to this sentence, so it was checked against the Overview's sources.";
      const engine =
        r.mode === "heuristic"
          ? "Lite check: matched words and figures, because the on-device AI isn't set up."
          : "Checked on this computer by Gemini Nano.";
      const level = r.confidence >= 0.75 ? "high" : r.confidence >= 0.5 ? "medium" : "low";
      meta.textContent = r.verdict === "unverifiable" ? scope : `${scope} ${engine} Confidence: ${level}.`;
      card.append(meta);
    }

    // Position near the badge.
    const rect = claim.badge.getBoundingClientRect();
    card.style.visibility = "hidden";
    host.style.display = "block";
    const w = Math.min(360, window.innerWidth - 24);
    card.style.width = `${w}px`;
    const left = Math.min(Math.max(12, rect.left + window.scrollX - 24), window.scrollX + window.innerWidth - w - 12);
    const below = rect.bottom + window.scrollY + 8;
    card.style.left = `${left}px`;
    card.style.top = `${below}px`;
    requestAnimationFrame(() => {
      const ch = card.getBoundingClientRect().height;
      if (rect.bottom + ch + 16 > window.innerHeight && rect.top > ch + 16) {
        card.style.top = `${rect.top + window.scrollY - ch - 8}px`;
      }
      card.style.visibility = "visible";
      card.classList.toggle("pinned", pinned);
    });

    if (state.highlights) {
      state.highlights.focus.clear();
      state.highlights.focus.add(claim.range);
    }
  }

  function hideCard() {
    state.hideTimer = setTimeout(() => {
      if (state.overCard) return;
      if (state.card) state.card.host.style.display = "none";
      state.highlights?.focus.clear();
    }, 120);
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.card) {
      state.pinned = null;
      state.overCard = false;
      hideCard();
    }
  });
  document.addEventListener("click", (e) => {
    if (state.pinned && state.card && !e.composedPath().includes(state.card.host)) {
      state.pinned = null;
      hideCard();
    }
  });

  // ---------- checking ----------

  function send(claims) {
    if (claims.length === 0) return;
    state.error = null;
    state.pending += claims.length;
    const port = chrome.runtime.connect({ name: "ocx" });
    const open = new Set(claims.map((c) => c.id));
    port.onMessage.addListener((msg) => {
      if (msg.type === "start") {
        state.mode = msg.mode;
        renderBar();
      } else if (msg.type === "setup") {
        state.setupNeeded = true;
        resetClaims();
        renderBar();
        port.disconnect();
      } else if (msg.type === "result") {
        const c = state.claims.get(msg.result.id);
        if (c) {
          c.result = msg.result;
          open.delete(c.id);
          updateBadge(c);
          if (state.pinned === c.id || state.card?.host.style.display === "block") {
            if (state.pinned === c.id) showCard(c, true);
          }
        }
        renderBar();
      } else if (msg.type === "error") {
        state.error = msg.message;
        for (const id of open) state.claims.get(id).failed = true;
        renderBar();
        port.disconnect();
      } else if (msg.type === "done") {
        port.disconnect();
      }
    });
    port.onDisconnect.addListener(() => {
      state.pending -= claims.length;
    });
    port.postMessage({
      type: "check",
      claims: claims.map(({ id, text, sources }) => ({ id, text, sources })),
    });
    renderBar();
  }

  /** Removes this page's badges and marks so the Overview can be checked fresh. */
  function resetClaims() {
    for (const c of state.claims.values()) c.badge?.remove();
    state.claims.clear();
    state.checkedTexts.clear();
    if (state.highlights) for (const h of Object.values(state.highlights)) h.clear();
    hideCard();
  }

  // The background asks every tab to retry once the user finishes setup.
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "ocx_retry" && state.setupNeeded) {
      state.setupNeeded = false;
      runCheck(true);
    }
    return false;
  });

  function retryFailed() {
    const failed = [...state.claims.values()].filter((c) => !c.result);
    for (const c of failed) c.failed = false;
    state.error = null;
    send(failed);
  }

  function runCheck(force = false) {
    if (!state.root) return;
    if (!state.settings.autoRun && !force && state.claims.size === 0) {
      renderBar();
      return;
    }
    const room = MAX_CLAIMS - state.claims.size;
    if (room <= 0) return;
    const fresh = extractClaims(state.root).slice(0, room);
    if (fresh.length === 0) {
      renderBar();
      return;
    }
    setupHighlights();
    for (const c of fresh) {
      state.claims.set(c.id, c);
      state.checkedTexts.add(c.text);
    }
    placeBadges(fresh);
    send(fresh);
  }

  // Wait for Google to finish streaming the Overview before reading it.
  let lastLen = -1;
  let stableSince = 0;
  let scanTimer = null;

  function scan() {
    scanTimer = null;
    if (!state.root || !state.root.isConnected) {
      const label = findLabel();
      if (!label) return;
      const root = findRoot(label);
      if (!root) return;
      state.label = label;
      state.root = root;
      ensureBar();
      renderBar();
    }
    const len = textLength(state.root);
    const now = Date.now();
    if (len !== lastLen) {
      lastLen = len;
      stableSince = now;
      schedule(STABLE_MS + 50);
      return;
    }
    if (now - stableSince < STABLE_MS) {
      schedule(STABLE_MS - (now - stableSince) + 50);
      return;
    }
    runCheck();
  }

  function schedule(ms = 400) {
    if (scanTimer) clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, ms);
  }

  const observer = new MutationObserver((mutations) => {
    if (mutations.every((m) => isOurs(m.target))) return;
    schedule();
  });

  chrome.runtime.sendMessage({ type: "settings" }, (s) => {
    if (s) state.settings = s;
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    schedule(200);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.autoRun) {
      state.settings.autoRun = changes.autoRun.newValue;
      if (state.root) {
        if (state.settings.autoRun) runCheck();
        else renderBar();
      }
    }
  });

  const CARD_CSS = `
    :host { all: initial; }
    .card {
      position: absolute; z-index: 2147483000; box-sizing: border-box;
      font: 14px/1.5 "Google Sans Text", "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
      color: #0f2240; background: #ffffff;
      border: 1px solid rgba(15, 34, 64, 0.12); border-radius: 14px;
      box-shadow: 0 12px 32px rgba(15, 34, 64, 0.16), 0 2px 6px rgba(15, 34, 64, 0.08);
      padding: 14px 16px 12px; text-align: left;
    }
    :host([data-theme="dark"]) .card {
      color: #e8edf5; background: #1c2333; border-color: rgba(255,255,255,0.12);
      box-shadow: 0 12px 32px rgba(0,0,0,0.5);
    }
    .head { display: flex; align-items: center; gap: 8px; margin: 0 0 6px; }
    .icon { display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; color: #fff; flex: none; }
    .icon svg { width: 16px; height: 16px; }
    .verdict { font-weight: 600; font-size: 15px; letter-spacing: -0.01em; }
    .tag { font-size: 12px; padding: 1px 8px; border-radius: 999px; background: rgba(15,34,64,0.07); color: inherit; }
    :host([data-theme="dark"]) .tag { background: rgba(255,255,255,0.1); }
    .card[data-verdict="supported"] .icon { background: #12a150; }
    .card[data-verdict="not_found"] .icon { background: #e8590c; }
    .card[data-verdict="contradicted"] .icon { background: #e5383b; }
    .card[data-verdict="unverifiable"] .icon, .card[data-verdict="pending"] .icon { background: #8a94a6; }
    .explain { margin: 0 0 10px; }
    .evidence { margin: 0 0 8px; }
    .quote { margin: 0; font-size: 14px; line-height: 1.6; }
    .quote mark {
      background: linear-gradient(transparent 12%, #ffe14d 12%, #ffe14d 88%, transparent 88%);
      color: #0f2240; padding: 0 2px; box-decoration-break: clone; -webkit-box-decoration-break: clone;
    }
    .source { display: flex; gap: 6px; align-items: baseline; margin-top: 6px; font-size: 12.5px; min-width: 0; }
    .site { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .host { opacity: 0.65; white-space: nowrap; }
    .note { margin: 0 0 8px; font-size: 12.5px; opacity: 0.75; }
    .open { display: inline-block; font-size: 13px; font-weight: 600; color: #1a56db; text-decoration: none; margin: 2px 0 8px; }
    :host([data-theme="dark"]) .open { color: #8ab4f8; }
    .open:hover { text-decoration: underline; }
    .open:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; border-radius: 4px; }
    .meta { margin: 0; padding-top: 8px; border-top: 1px solid rgba(15,34,64,0.1); font-size: 12px; opacity: 0.7; }
    :host([data-theme="dark"]) .meta { border-color: rgba(255,255,255,0.12); }
  `;
})();
