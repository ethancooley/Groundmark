import { extractFromHtml, extractFromText } from "./extract.js";
import { buildPassages, rankPassages } from "./passages.js";
import { fragmentUrl, verifyQuote } from "./quote.js";
import { coverage, figuresWithinClaimRanges } from "./text.js";
import { confidenceFor, createNanoJudge, judgeHeuristic, nanoStatus } from "./judge.js";

export const LIMITS = {
  maxClaims: 24,
  maxSourcesPerClaim: 5,
  maxUniqueSources: 12,
  passagesPerSource: 3,
  maxPassagesModel: 6, // the on-device model has a small context window
  maxPassagesLite: 10,
  maxBytes: 3_000_000,
  timeoutMs: 10_000,
  // In "auto", the model is dropped for the rest of an Overview when it's this slow.
  slowSentenceMs: 8_000, // two sentences slower than this...
  verySlowSentenceMs: 20_000, // ...or one slower than this
  readyMs: 30_000, // ...or the model not loaded and warmed up within this
};

/** How verdicts are made: "auto" (model when it's ready and fast enough), "model", or "lite". */
export const ENGINES = ["auto", "model", "lite"];

const DOC_TTL = 30 * 60 * 1000;

/** Hosts we never fetch: this computer, the local network, and Google itself. */
export function isFetchable(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  if (url.username || url.password) return false;
  if (url.port && url.port !== "80" && url.port !== "443") return false;
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (/^(localhost|.*\.localhost|.*\.local|.*\.internal|.*\.lan|.*\.home\.arpa)$/.test(host)) return false;
  if (/(^|\.)google\.[a-z.]+$/.test(host)) return false;
  // IP literals: allow only public IPv4. Skip IPv6 literals entirely.
  if (host.includes(":")) return false;
  const v4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
  }
  return true;
}

/** Unwraps Google redirect links and drops anything that isn't a fetchable page. */
export function cleanSourceUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (/(^|\.)google\.[a-z.]+$/i.test(url.hostname) && url.pathname === "/url") {
    const target = url.searchParams.get("q") || url.searchParams.get("url");
    return target ? cleanSourceUrl(target) : null;
  }
  url.hash = "";
  const out = url.toString();
  return isFetchable(out) ? out : null;
}

async function pool(items, size, fn) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        await fn(items[i], i);
      }
    }),
  );
}

/**
 * The whole checker, with its browser dependencies passed in so it runs the
 * same way in the extension, on the website, and in tests.
 */
export function createChecker(env) {
  const docs = new Map();
  const results = new Map();
  let judgePromise = null;

  async function readBody(res) {
    const reader = res.body && res.body.getReader();
    if (!reader) return await res.text();
    const decoder = new TextDecoder();
    let received = 0;
    let body = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      body += decoder.decode(value, { stream: true });
      if (received > LIMITS.maxBytes) {
        await reader.cancel();
        break;
      }
    }
    return body + decoder.decode();
  }

  async function fetchDoc(url, index) {
    if (!isFetchable(url)) return { url, finalUrl: url, status: "blocked", passages: [] };
    try {
      const res = await env.fetch(url, {
        credentials: "omit", // pages see an anonymous visit, never your logged-in session
        redirect: "follow",
        signal: AbortSignal.timeout(LIMITS.timeoutMs),
        headers: { accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5" },
      });
      const finalUrl = res.url || url;
      if (!isFetchable(finalUrl)) return { url, finalUrl, status: "blocked", passages: [] };
      if (!res.ok) return { url, finalUrl, status: "failed", passages: [], detail: `HTTP ${res.status}` };
      const type = (res.headers.get("content-type") || "").toLowerCase();
      if (type && !/text\/html|application\/xhtml|text\/plain/.test(type)) {
        if (res.body) await res.body.cancel();
        return { url, finalUrl, status: "unsupported_type", passages: [] };
      }
      const body = await readBody(res);
      const extracted = /text\/plain/.test(type) ? extractFromText(body) : extractFromHtml(body, finalUrl, env);
      const passages = buildPassages(extracted.blocks, url, index);
      return { url, finalUrl, title: extracted.title, status: passages.length ? "ok" : "empty", passages };
    } catch (e) {
      return { url, finalUrl: url, status: "failed", passages: [], detail: String((e && e.message) || e) };
    }
  }

  function loadDoc(url, index) {
    const now = Date.now();
    for (const [k, v] of docs) if (now - v.at > DOC_TTL) docs.delete(k);
    const hit = docs.get(url);
    if (hit) {
      return hit.doc.then((d) => ({ ...d, passages: d.passages.map((p, i) => ({ ...p, id: `S${index + 1}-P${i + 1}` })) }));
    }
    const doc = fetchDoc(url, index);
    docs.set(url, { at: now, doc });
    doc.then((d) => d.status === "failed" && docs.delete(url));
    return doc;
  }

  let warming = null;
  /** The judge, loaded and warmed up (once per checker). */
  async function readyJudge() {
    const judge = await getJudge();
    if (!warming) warming = judge.warmUp ? judge.warmUp().catch(() => {}) : Promise.resolve();
    await warming;
    return judge;
  }

  async function getJudge() {
    if (!judgePromise) {
      judgePromise = createNanoJudge(env.LanguageModel).catch((e) => {
        judgePromise = null;
        throw e;
      });
    }
    return judgePromise;
  }

  function unverifiable(claim, claimDocs, mode) {
    const statuses = new Set(claimDocs.map((d) => d.status));
    let explanation = "None of the cited pages could be read, so this sentence couldn't be checked.";
    if (claimDocs.length === 0) explanation = "Google didn't attach a readable source to this sentence.";
    else if (statuses.size === 1 && statuses.has("unsupported_type"))
      explanation = "The cited source is a file type Groundmark can't read yet, such as a PDF.";
    else if (statuses.size === 1 && statuses.has("blocked"))
      explanation = "The cited link points somewhere Groundmark won't open, such as a local address.";
    return {
      id: claim.id,
      claim: claim.text,
      verdict: "unverifiable",
      confidence: 1,
      partial: false,
      explanation,
      sources: claimDocs.map((d) => ({ url: d.url, status: d.status, title: d.title })),
      mode,
      trace: { mode, unreadable: true, sources: claimDocs.map((d) => ({ url: d.url, status: d.status, title: d.title, detail: d.detail })) },
    };
  }

  return {
    /** "model" when Gemini Nano is ready on this computer, otherwise "heuristic". */
    async mode() {
      return (await nanoStatus(env.LanguageModel)) === "available" ? "model" : "heuristic";
    },

    /**
     * Checks claims and reports progress through emit(): start, source, result,
     * slow, done.
     *
     * opts.engine is the setting ("auto", "model", or "lite"). opts.liteHere is
     * the person's choice to use lite mode on this computer, which "auto"
     * follows. In "auto", if the model is slow, the rest of the Overview gets
     * lite verdicts and a "slow" event lets the page offer that choice.
     */
    async run(claims, emit, opts = {}) {
      const started = Date.now();
      const engine = ENGINES.includes(opts.engine) ? opts.engine : "auto";
      const liteHere = engine === "auto" && Boolean(opts.liteHere);
      const mode = engine === "lite" || liteHere ? "heuristic" : await this.mode();
      const why = engine === "lite" ? "lite" : liteHere ? "lite-here" : mode === "heuristic" ? "unavailable" : "model";
      const cleaned = claims.slice(0, LIMITS.maxClaims).map((c) => ({
        id: String(c.id),
        text: String(c.text).slice(0, 1200),
        focus: c.focus ? String(c.focus).slice(0, 300) : undefined,
        sources: Array.from(new Set((c.sources || []).map(cleanSourceUrl).filter(Boolean))).slice(0, LIMITS.maxSourcesPerClaim),
      }));

      const unique = [];
      for (const c of cleaned) for (const s of c.sources) if (!unique.includes(s) && unique.length < LIMITS.maxUniqueSources) unique.push(s);
      emit({ type: "start", claims: cleaned.length, sources: unique.length, mode, engine, why });

      const byUrl = new Map();
      await pool(unique, 4, async (url, i) => {
        const doc = await loadDoc(url, i);
        byUrl.set(url, doc);
        emit({ type: "source", url, status: doc.status, title: doc.title });
      });

      const summary = { supported: 0, not_found: 0, contradicted: 0, unverifiable: 0 };
      const final = (result) => {
        summary[result.verdict]++;
        emit({ type: "result", result });
      };
      const docsFor = (claim) => claim.sources.map((u) => byUrl.get(u)).filter(Boolean);
      const liteFor = (claim, reason) => {
        const r = { ...check(claim, docsFor(claim), "heuristic"), id: claim.id };
        return { ...r, trace: { ...r.trace, why: reason } };
      };

      if (mode === "heuristic") {
        for (const claim of cleaned) final(liteFor(claim, why));
        emit({ type: "done", summary, ms: Date.now() - started });
        return;
      }

      // Get the model loaded and warmed up first; that time isn't counted against
      // the sentences. In "auto" it's capped, so a slow computer isn't left waiting.
      let slowCount = 0;
      let slow = false;
      const readying = readyJudge().then(
        () => true,
        () => true, // a failed load falls back per sentence below
      );
      let timer;
      const ready =
        engine === "auto"
          ? await Promise.race([readying, new Promise((r) => (timer = setTimeout(() => r(false), LIMITS.readyMs)))])
          : await readying;
      clearTimeout(timer);
      if (!ready) {
        slow = true;
        emit({ type: "slow", ms: LIMITS.readyMs, stage: "ready" });
      }
      for (const claim of cleaned) {
        if (slow) {
          final(liteFor(claim, "slow"));
          continue;
        }
        const watch = engine === "auto";
        const t0 = Date.now();
        const result = {
          ...(await checkWithModel(claim, docsFor(claim), watch ? LIMITS.verySlowSentenceMs : 0)),
          id: claim.id,
        };
        const ms = Date.now() - t0;
        if (result.timedOut) {
          // Too slow to wait for: this sentence and the rest get lite verdicts.
          slow = true;
          emit({ type: "slow", ms });
          final(liteFor(claim, "slow"));
          continue;
        }
        result.trace = { ...result.trace, ms };
        final(result);
        if (watch && result.mode === "model" && !result.cached) {
          if (ms > LIMITS.slowSentenceMs) slowCount++;
          if (slowCount >= 2) {
            slow = true;
            emit({ type: "slow", ms });
          }
        }
      }
      emit({ type: "done", summary, ms: Date.now() - started, slow });
    },
  };

  /** A lite (word and figure matching) verdict. Synchronous, so it's instant. */
  function check(claim, claimDocs, mode) {
    const key = `heuristic|${claim.text}|${claim.focus || ""}|${claim.sources.join("|")}`;
    const hit = results.get(key);
    if (hit) return hit;
    const readable = claimDocs.filter((d) => d.status === "ok");
    if (readable.length === 0) return unverifiable(claim, claimDocs, mode);
    const candidates = candidatesFor(claim, readable, LIMITS.maxPassagesLite);
    const result = finish(claim, claimDocs, readable, candidates, judgeHeuristic(claim.text, candidates, { focus: claim.focus }), "heuristic", "heuristic");
    results.set(key, result);
    return result;
  }

  /** The model's verdict. With timeoutMs, gives up after that long and returns { timedOut: true }. */
  async function checkWithModel(claim, claimDocs, timeoutMs = 0) {
    const key = `model|${claim.text}|${claim.sources.join("|")}`;
    const hit = results.get(key);
    if (hit) return { ...hit, cached: true };
    const readable = claimDocs.filter((d) => d.status === "ok");
    if (readable.length === 0) return unverifiable(claim, claimDocs, "model");
    const candidates = candidatesFor(claim, readable, LIMITS.maxPassagesModel);
    let judgment;
    let usedMode = "model";
    const signal = timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined;
    try {
      const judging = (await getJudge()).judge(claim.text, candidates, { signal });
      judging.catch(() => {}); // if the deadline wins, the late answer is ignored
      // Race the deadline too, in case the model doesn't stop when asked.
      judgment = signal
        ? await Promise.race([judging, new Promise((_, reject) => signal.addEventListener("abort", () => reject(signal.reason)))])
        : await judging;
    } catch (e) {
      if (signal?.aborted) return { timedOut: true };
      console.warn("On-device model failed; using lite check", e);
      judgment = judgeHeuristic(claim.text, candidates, { focus: claim.focus });
      usedMode = "heuristic";
    }
    const result = finish(claim, claimDocs, readable, candidates, judgment, usedMode, "model");
    if (usedMode === "model") results.set(key, result);
    return result;
  }

  function candidatesFor(claim, readable, max) {
    let candidates = [];
    for (const d of readable) candidates.push(...rankPassages(claim.text, d.passages, LIMITS.passagesPerSource));
    if (candidates.length === 0) for (const d of readable) candidates.push(...d.passages.slice(0, 2));
    return candidates.slice(0, max);
  }

  /**
   * Like build(), plus one safeguard: "contradicted" is the most serious
   * verdict, so it's only accepted from the model when its quote is really on
   * the page and the figure it relies on actually conflicts. Otherwise the
   * lite check decides, and the inspector shows that the model was overruled.
   */
  function finish(claim, claimDocs, readable, candidates, judgment, usedMode, mode) {
    const result = build(claim, claimDocs, readable, candidates, judgment, usedMode, mode);
    if (usedMode !== "model" || judgment.verdict !== "contradicted") return result;
    let overruled = null;
    if (!result.trace.quoteVerbatim) {
      overruled = { reason: "quote", text: "its quote isn't on the page" };
    } else {
      // Only the quote counts: it's text on the page. The explanation is the model's own words.
      const agree = figuresWithinClaimRanges(claim.text, result.evidence.quote);
      if (agree.length) overruled = { reason: "range", ...agree[0], text: `the page's figure (${agree[0].figure}) is within ${agree[0].range}` };
    }
    if (!overruled) return result;
    const lite = judgeHeuristic(claim.text, candidates, { focus: claim.focus });
    const decided = build(claim, claimDocs, readable, candidates, lite, "heuristic", mode);
    decided.explanation = `Gemini Nano said the page contradicts this, but ${overruled.text}, so Groundmark didn't accept that. ${lite.explanation}`;
    decided.mode = "model";
    decided.trace = {
      ...decided.trace,
      mode: "model",
      fellBack: false,
      prompt: result.trace.prompt,
      raw: result.trace.raw,
      sentPassageIds: result.trace.sentPassageIds,
      retried: result.trace.retried,
      modelPickedPassage: result.trace.modelPickedPassage,
      modelQuote: judgment.quote,
      modelVerdict: "contradicted",
      modelExplanation: judgment.explanation,
      overruled,
    };
    return decided;
  }

  /** Verifies the quote, computes confidence, and records everything for the inspector. */
  function build(claim, claimDocs, readable, candidates, judgment, usedMode, mode) {
    const matched = candidates.find((p) => p.id === judgment.passageId);
    const passage = matched || candidates[0];
    const doc = readable.find((d) => d.url === passage.sourceUrl);
    const { quote, verbatim } = verifyQuote(judgment.quote, passage.text, claim.text);
    const overlap = coverage(claim.text, passage.text);
    const confidence = confidenceFor(usedMode, judgment.verdict, { verbatim, overlap });
    const titleOf = (url) => readable.find((d) => d.url === url)?.title;
    const sources = claimDocs.map((d) => ({ url: d.url, status: d.status, title: d.title }));
    // Everything that went into this verdict, shown on the inspector page.
    const trace = {
      mode: usedMode,
      fellBack: usedMode !== mode,
      candidates: candidates.map((p) => ({ id: p.id, text: p.text, sourceUrl: p.sourceUrl, sourceTitle: titleOf(p.sourceUrl) })),
      chosenPassageId: passage.id,
      modelPickedPassage: usedMode === "model" ? Boolean(matched) : null,
      modelQuote: usedMode === "model" ? judgment.quote : null,
      quoteVerbatim: verbatim,
      overlap: Math.round(overlap * 100) / 100,
      confidence,
      sources,
      ...(judgment.trace || {}),
    };
    return {
      id: claim.id,
      claim: claim.text,
      verdict: judgment.verdict,
      confidence,
      partial: judgment.partial,
      explanation: judgment.explanation,
      evidence: {
        sourceUrl: doc.finalUrl,
        sourceTitle: doc.title,
        quote,
        fragmentUrl: quote ? fragmentUrl(doc.finalUrl, quote) : doc.finalUrl,
        verbatim: usedMode === "heuristic" ? true : verbatim,
      },
      sources,
      mode: usedMode,
      trace,
    };
  }
}
