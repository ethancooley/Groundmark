import { createHash } from "node:crypto";
import type { CheckRequest, ClaimResult, Passage, SourceDoc, StreamEvent, Verdict } from "./types";
import { BlockedUrlError, safeFetch } from "./safeFetch";
import { extractFromHtml, extractFromText } from "./extract";
import { buildPassages, rankPassages } from "./passages";
import { judgeHeuristic, judgeMode, judgeWithModel, modelName, type Judgment } from "./judge";
import { fragmentUrl, verifyQuote } from "./quote";

export const LIMITS = {
  maxClaims: 24,
  maxSourcesPerClaim: 5,
  maxUniqueSources: 12,
  maxClaimChars: 1200,
  passagesPerSource: 3,
  maxPassagesPerClaim: 10,
};

const DOC_TTL = 30 * 60 * 1000;
const RESULT_TTL = 24 * 60 * 60 * 1000;
const docCache = new Map<string, { at: number; doc: Promise<SourceDoc> }>();
const resultCache = new Map<string, { at: number; result: ClaimResult }>();

function prune<T extends { at: number }>(m: Map<string, T>, ttl: number, max: number) {
  const now = Date.now();
  for (const [k, v] of m) if (now - v.at > ttl) m.delete(k);
  while (m.size > max) m.delete(m.keys().next().value as string);
}

async function pool<T>(items: T[], size: number, fn: (item: T, i: number) => Promise<void>) {
  let next = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      await fn(items[i], i);
    }
  });
  await Promise.all(workers);
}

async function fetchDoc(url: string, index: number): Promise<SourceDoc> {
  try {
    const page = await safeFetch(url);
    const extracted = /text\/plain/.test(page.contentType)
      ? extractFromText(page.body)
      : extractFromHtml(page.body, page.finalUrl);
    const passages = buildPassages(extracted.blocks, url, index);
    return {
      url,
      finalUrl: page.finalUrl,
      title: extracted.title,
      status: passages.length > 0 ? "ok" : "empty",
      passages,
      detail: passages.length > 0 ? undefined : "No readable text on the page",
    };
  } catch (e) {
    const err = e as Error;
    const status =
      e instanceof BlockedUrlError || (err as NodeJS.ErrnoException).code === "EBLOCKED"
        ? "blocked"
        : err.name === "UnsupportedType"
          ? "unsupported_type"
          : "failed";
    return { url, finalUrl: url, status, passages: [], detail: err.message };
  }
}

function loadDoc(url: string, index: number): Promise<SourceDoc> {
  prune(docCache, DOC_TTL, 200);
  const hit = docCache.get(url);
  if (hit) {
    // Passage IDs embed the source index, so re-label for this request.
    return hit.doc.then((d) => ({
      ...d,
      passages: d.passages.map((p, i) => ({ ...p, id: `S${index + 1}-P${i + 1}` })),
    }));
  }
  const doc = fetchDoc(url, index);
  docCache.set(url, { at: Date.now(), doc });
  doc.then((d) => {
    if (d.status === "failed") docCache.delete(url); // don't cache transient failures
  });
  return doc;
}

function resultKey(claim: string, sources: string[]): string {
  return createHash("sha256")
    .update(`${modelName()}|${judgeMode()}|${claim}|${[...sources].sort().join("|")}`)
    .digest("hex");
}

function unverifiable(id: string, claim: string, sources: SourceDoc[], mode: ClaimResult["mode"]): ClaimResult {
  const reasons = new Set(sources.map((s) => s.status));
  let explanation = "None of the cited pages could be read, so this sentence couldn't be checked.";
  if (sources.length === 0) explanation = "Google didn't attach a source to this sentence.";
  else if (reasons.size === 1 && reasons.has("unsupported_type"))
    explanation = "The cited source is a file type Overview Check can't read yet, such as a PDF.";
  else if (reasons.size === 1 && reasons.has("blocked"))
    explanation = "The cited link points somewhere Overview Check won't fetch for safety reasons.";
  return {
    id,
    claim,
    verdict: "unverifiable",
    confidence: 1,
    partial: false,
    explanation,
    sources: sources.map((s) => ({ url: s.url, status: s.status, title: s.title })),
    mode,
  };
}

export async function runCheck(req: CheckRequest, emit: (e: StreamEvent) => void): Promise<void> {
  const started = Date.now();
  const mode = judgeMode();

  const uniqueSources: string[] = [];
  for (const c of req.claims) {
    for (const s of c.sources.slice(0, LIMITS.maxSourcesPerClaim)) {
      if (!uniqueSources.includes(s) && uniqueSources.length < LIMITS.maxUniqueSources) uniqueSources.push(s);
    }
  }

  emit({ type: "start", claims: req.claims.length, sources: uniqueSources.length, mode });

  const docs = new Map<string, SourceDoc>();
  await pool(uniqueSources, 6, async (url, i) => {
    const doc = await loadDoc(url, i);
    docs.set(url, doc);
    emit({ type: "source", url, status: doc.status, title: doc.title });
  });

  const summary: Record<Verdict, number> = { supported: 0, not_found: 0, contradicted: 0, unverifiable: 0 };
  const titles = new Map<string, string | undefined>();
  for (const d of docs.values()) titles.set(d.url, d.title);

  await pool(req.claims, 4, async (claim) => {
    const claimDocs = claim.sources
      .slice(0, LIMITS.maxSourcesPerClaim)
      .map((u) => docs.get(u))
      .filter((d): d is SourceDoc => Boolean(d));

    const key = resultKey(claim.text, claimDocs.map((d) => d.url));
    prune(resultCache, RESULT_TTL, 2000);
    const cached = resultCache.get(key);
    if (cached) {
      const result = { ...cached.result, id: claim.id };
      summary[result.verdict]++;
      emit({ type: "result", result });
      return;
    }

    const readable = claimDocs.filter((d) => d.status === "ok");
    let result: ClaimResult;
    if (readable.length === 0) {
      result = unverifiable(claim.id, claim.text, claimDocs, mode);
    } else {
      let candidates: Passage[] = [];
      for (const d of readable) candidates.push(...rankPassages(claim.text, d.passages, LIMITS.passagesPerSource));
      if (candidates.length === 0) {
        // Nothing lexically related: show the judge each page's opening so it can still rule.
        for (const d of readable) candidates.push(...d.passages.slice(0, 2));
      }
      candidates = candidates.slice(0, LIMITS.maxPassagesPerClaim);

      let judgment: Judgment;
      let usedMode: ClaimResult["mode"] = mode;
      if (mode === "model") {
        try {
          judgment = await judgeWithModel(claim.text, candidates, titles);
        } catch (e) {
          console.error("judge failed", e);
          judgment = judgeHeuristic(claim.text, candidates);
          usedMode = "heuristic";
        }
      } else {
        judgment = judgeHeuristic(claim.text, candidates);
      }

      const passage = candidates.find((p) => p.id === judgment.passageId) ?? candidates[0];
      const doc = readable.find((d) => d.url === passage.sourceUrl)!;
      const { quote, verbatim } = verifyQuote(judgment.quote, passage.text, claim.text);
      result = {
        id: claim.id,
        claim: claim.text,
        verdict: judgment.verdict,
        confidence: verbatim || usedMode === "heuristic" ? judgment.confidence : Math.min(judgment.confidence, 0.6),
        partial: judgment.partial,
        explanation: judgment.explanation,
        evidence: {
          sourceUrl: doc.finalUrl,
          sourceTitle: doc.title,
          quote,
          fragmentUrl: fragmentUrl(doc.finalUrl, quote),
          verbatim,
        },
        sources: claimDocs.map((s) => ({ url: s.url, status: s.status, title: s.title })),
        mode: usedMode,
      };
    }

    if (result.mode === mode) resultCache.set(key, { at: Date.now(), result });
    summary[result.verdict]++;
    emit({ type: "result", result });
  });

  emit({ type: "done", summary, ms: Date.now() - started });
}
