import { extractFromHtml, extractFromText } from "./extract.js";
import { buildPassages, rankPassages } from "./passages.js";
import { fragmentUrl, verifyQuote } from "./quote.js";
import { coverage } from "./text.js";
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
};

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
      explanation = "The cited source is a file type Overview Check can't read yet, such as a PDF.";
    else if (statuses.size === 1 && statuses.has("blocked"))
      explanation = "The cited link points somewhere Overview Check won't open, such as a local address.";
    return {
      id: claim.id,
      claim: claim.text,
      verdict: "unverifiable",
      confidence: 1,
      partial: false,
      explanation,
      sources: claimDocs.map((d) => ({ url: d.url, status: d.status, title: d.title })),
      mode,
    };
  }

  return {
    /** "model" when Gemini Nano is ready on this computer, otherwise "heuristic". */
    async mode() {
      return (await nanoStatus(env.LanguageModel)) === "available" ? "model" : "heuristic";
    },

    /**
     * Checks claims and reports progress through emit(), using the same event
     * shapes as the original server: start, source, result, done.
     */
    async run(claims, emit) {
      const started = Date.now();
      const mode = await this.mode();
      const cleaned = claims.slice(0, LIMITS.maxClaims).map((c) => ({
        id: String(c.id),
        text: String(c.text).slice(0, 1200),
        sources: Array.from(new Set((c.sources || []).map(cleanSourceUrl).filter(Boolean))).slice(0, LIMITS.maxSourcesPerClaim),
      }));

      const unique = [];
      for (const c of cleaned) for (const s of c.sources) if (!unique.includes(s) && unique.length < LIMITS.maxUniqueSources) unique.push(s);
      emit({ type: "start", claims: cleaned.length, sources: unique.length, mode });

      const byUrl = new Map();
      await pool(unique, 4, async (url, i) => {
        const doc = await loadDoc(url, i);
        byUrl.set(url, doc);
        emit({ type: "source", url, status: doc.status, title: doc.title });
      });

      const summary = { supported: 0, not_found: 0, contradicted: 0, unverifiable: 0 };
      // One model, so claims run one at a time.
      for (const claim of cleaned) {
        const claimDocs = claim.sources.map((u) => byUrl.get(u)).filter(Boolean);
        const key = `${mode}|${claim.text}|${claim.sources.join("|")}`;
        let result = results.get(key);
        if (!result) {
          const readable = claimDocs.filter((d) => d.status === "ok");
          if (readable.length === 0) {
            result = unverifiable(claim, claimDocs, mode);
          } else {
            let candidates = [];
            for (const d of readable) candidates.push(...rankPassages(claim.text, d.passages, LIMITS.passagesPerSource));
            if (candidates.length === 0) for (const d of readable) candidates.push(...d.passages.slice(0, 2));
            candidates = candidates.slice(0, mode === "model" ? LIMITS.maxPassagesModel : LIMITS.maxPassagesLite);

            let judgment;
            let usedMode = mode;
            if (mode === "model") {
              try {
                judgment = await (await getJudge()).judge(claim.text, candidates);
              } catch (e) {
                console.warn("On-device model failed; using lite check", e);
                judgment = judgeHeuristic(claim.text, candidates);
                usedMode = "heuristic";
              }
            } else {
              judgment = judgeHeuristic(claim.text, candidates);
            }

            const passage = candidates.find((p) => p.id === judgment.passageId) || candidates[0];
            const doc = readable.find((d) => d.url === passage.sourceUrl);
            const { quote, verbatim } = verifyQuote(judgment.quote, passage.text, claim.text);
            result = {
              id: claim.id,
              claim: claim.text,
              verdict: judgment.verdict,
              confidence: confidenceFor(usedMode, judgment.verdict, { verbatim, overlap: coverage(claim.text, passage.text) }),
              partial: judgment.partial,
              explanation: judgment.explanation,
              evidence: {
                sourceUrl: doc.finalUrl,
                sourceTitle: doc.title,
                quote,
                fragmentUrl: fragmentUrl(doc.finalUrl, quote),
                verbatim: usedMode === "heuristic" ? true : verbatim,
              },
              sources: claimDocs.map((d) => ({ url: d.url, status: d.status, title: d.title })),
              mode: usedMode,
            };
            if (usedMode === mode) results.set(key, result);
          }
        }
        result = { ...result, id: claim.id };
        summary[result.verdict]++;
        emit({ type: "result", result });
      }
      emit({ type: "done", summary, ms: Date.now() - started });
    },
  };
}
