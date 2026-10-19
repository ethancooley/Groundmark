"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { VERDICT_META, type VerdictKey } from "@/lib/site";
import { VerdictIcon } from "./VerdictIcon";
// The same checker code the extension runs.
import { extractFromText } from "../../extension/lib/extract.js";
import { buildPassages, rankPassages } from "../../extension/lib/passages.js";
import { verifyQuote } from "../../extension/lib/quote.js";
import { coverage } from "../../extension/lib/text.js";
import { LANGUAGE_OPTIONS, confidenceFor, createNanoJudge, judgeHeuristic, nanoStatus } from "../../extension/lib/judge.js";

type ModelState = "checking" | "unsupported" | "unavailable" | "downloadable" | "downloading" | "available";
type Result = {
  verdict: VerdictKey;
  partial: boolean;
  explanation: string;
  quote: string;
  verbatim: boolean;
  confidence: number;
  mode: "model" | "heuristic";
};

// Example source text written for this demo, not quoted from any real page.
const PRESETS = [
  {
    label: "A wrong number",
    claim: "400 milligrams of caffeine is about the amount in eight cups of brewed coffee.",
    source:
      "Most healthy adults can have up to 400 milligrams of caffeine a day without harmful effects. That is roughly the amount in four cups of brewed coffee. People who are pregnant are usually advised to keep their intake lower.",
  },
  {
    label: "A missing detail",
    claim: "Teenagers should have no more than 100 milligrams of caffeine a day.",
    source:
      "Caffeine affects children and teenagers more strongly than adults. Energy drinks are a common source of large doses for teens, and many pediatricians discourage them. Sleep problems are one of the most common side effects.",
  },
  {
    label: "Backed up",
    claim: "The bridge opened to traffic in 1937.",
    source:
      "Construction began in January 1933. The bridge opened to pedestrians on May 27, 1937, and to vehicle traffic the following day. At the time it was the longest suspension bridge main span in the world.",
  },
];

function useModel() {
  const [state, setState] = useState<ModelState>("checking");
  useEffect(() => {
    nanoStatus((globalThis as { LanguageModel?: unknown }).LanguageModel).then((s: ModelState) => setState(s));
  }, []);
  return [state, setState] as const;
}

function ResultCard({ result }: { result: Result }) {
  const meta = VERDICT_META[result.verdict];
  const level = result.confidence >= 0.75 ? "High" : result.confidence >= 0.5 ? "Medium" : "Low";
  return (
    <div className="rounded-[22px] border border-line bg-surface p-6 shadow-[0_30px_80px_-30px_rgba(15,34,64,0.35)]">
      <div className="flex flex-wrap items-center gap-3">
        <VerdictIcon verdict={result.verdict} size={30} />
        <p className="headline text-[26px]">{meta.label}</p>
        {result.partial && result.verdict === "not_found" && (
          <span className="rounded-full bg-paper px-3 py-1 text-[13px] font-semibold">Partly supported</span>
        )}
      </div>
      <p className="mt-3 text-[17px] leading-relaxed">{result.explanation}</p>
      <figure className="mt-5 rounded-[16px] bg-paper p-5">
        <blockquote className="text-[17px] leading-[1.65]">
          <span className="mark">{result.quote}</span>
        </blockquote>
        {!result.verbatim && (
          <figcaption className="mt-2 text-[13.5px] text-slate">
            The model&rsquo;s quote didn&rsquo;t match the source exactly, so this is the closest real sentence.
          </figcaption>
        )}
      </figure>
      <p className="mt-4 text-[14px] text-slate">
        {result.mode === "model" ? "Checked in your browser by Gemini Nano." : "Lite check: matched words and figures."} Confidence:{" "}
        {level.toLowerCase()}.
      </p>
    </div>
  );
}

export function TryIt() {
  const claimId = useId();
  const sourceId = useId();
  const [model, setModel] = useModel();
  const [claim, setClaim] = useState(PRESETS[0].claim);
  const [source, setSource] = useState(PRESETS[0].source);
  const [errors, setErrors] = useState<{ claim?: string; source?: string }>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const judgeRef = useRef<Promise<{ judge: (c: string, p: unknown[]) => Promise<Record<string, unknown>> }> | null>(null);

  const LM = () => (globalThis as { LanguageModel?: { create: (o: unknown) => Promise<{ destroy(): void }> } }).LanguageModel;

  async function download() {
    setProgress(0);
    setMessage("Downloading Chrome's on-device model. This happens once.");
    try {
      const s = await LM()!.create({
        ...LANGUAGE_OPTIONS,
        monitor(m: EventTarget) {
          m.addEventListener("downloadprogress", (e) => setProgress(Math.round((e as unknown as { loaded: number }).loaded * 100)));
        },
      });
      s.destroy();
      setModel("available");
      setMessage("");
    } catch (e) {
      setMessage(`The download didn't finish: ${(e as Error).message}`);
    } finally {
      setProgress(null);
    }
  }

  function validate() {
    const next: typeof errors = {};
    if (claim.trim().split(/\s+/).length < 4) next.claim = "Enter a full sentence to check.";
    if (source.trim().split(/\s+/).length < 8) next.source = "Paste at least a sentence or two from the source.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setBusy(true);
    setResult(null);
    setMessage(model === "available" ? "Reading the source on your device…" : "Matching words and figures…");
    try {
      const passages = buildPassages(extractFromText(source).blocks.length ? extractFromText(source).blocks : [source], "pasted", 0);
      let candidates = rankPassages(claim, passages, 6);
      if (candidates.length === 0) candidates = passages.slice(0, 2);
      let judgment: Record<string, unknown>;
      let mode: Result["mode"] = model === "available" ? "model" : "heuristic";
      if (mode === "model") {
        try {
          if (!judgeRef.current) judgeRef.current = createNanoJudge(LM());
          judgment = await (await judgeRef.current).judge(claim.trim(), candidates);
        } catch {
          judgeRef.current = null;
          judgment = judgeHeuristic(claim.trim(), candidates);
          mode = "heuristic";
        }
      } else {
        judgment = judgeHeuristic(claim.trim(), candidates);
      }
      const passage = candidates.find((p: { id: string }) => p.id === judgment.passageId) ?? candidates[0];
      const { quote, verbatim } = verifyQuote(judgment.quote, passage.text, claim);
      setResult({
        verdict: judgment.verdict as VerdictKey,
        partial: Boolean(judgment.partial),
        explanation: String(judgment.explanation),
        quote,
        verbatim: mode === "heuristic" ? true : verbatim,
        confidence: confidenceFor(mode, judgment.verdict, { verbatim, overlap: coverage(claim, passage.text) }),
        mode,
      });
      setMessage("");
    } catch (err) {
      setMessage(`Something went wrong: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  const engine =
    model === "checking"
      ? "Checking your browser…"
      : model === "available"
        ? "On-device AI ready. Nothing you type leaves this page."
        : model === "downloadable" || model === "downloading"
          ? "Your browser can run Chrome's on-device AI after a one-time download. Until then, this uses lite mode."
          : "Your browser doesn't have Chrome's on-device AI, so this uses lite mode: matching words and figures.";

  return (
    <section id="try" aria-labelledby="try-title" className="border-t border-line">
      <div className="wrap grid gap-14 py-32 sm:py-40 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div>
          <h2 id="try-title" className="display text-[clamp(40px,5.2vw,72px)]">
            Check a claim right here.
          </h2>
          <p className="lede mt-6 max-w-[34ch]">
            The same checker the extension uses, running in your browser. Paste a sentence and the source text that&rsquo;s
            supposed to back it up.
          </p>
          <div className="mt-8 flex flex-wrap gap-2" role="group" aria-label="Examples">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  setClaim(p.claim);
                  setSource(p.source);
                  setErrors({});
                  setResult(null);
                }}
                className="rounded-full border border-line bg-surface px-4 py-2 text-[14px] font-medium hover:border-ink/30"
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-[13px] text-slate">Example sources are written for this demo.</p>
        </div>

        <div>
          <form onSubmit={onSubmit} noValidate className="rounded-[24px] border border-line bg-surface p-6 sm:p-8">
            <div className="mb-5 flex flex-wrap items-center gap-3 rounded-[14px] bg-paper px-4 py-3 text-[14px]">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: model === "available" ? "var(--v-supported)" : "var(--v-unverifiable)" }}
              />
              <span className="flex-1 text-ink-soft">{engine}</span>
              {model === "downloadable" && progress === null && (
                <button type="button" onClick={download} className="rounded-full bg-ink px-4 py-1.5 text-[13px] font-semibold text-white">
                  Download on-device AI
                </button>
              )}
              {progress !== null && <span className="font-semibold">{progress}%</span>}
            </div>

            <label htmlFor={claimId} className="text-[14px] font-semibold">
              Sentence to check
            </label>
            <textarea
              id={claimId}
              value={claim}
              onChange={(e) => {
                setClaim(e.target.value);
                if (errors.claim) setErrors((x) => ({ ...x, claim: undefined }));
              }}
              rows={2}
              aria-invalid={Boolean(errors.claim)}
              aria-describedby={errors.claim ? `${claimId}-err` : undefined}
              className="mt-2 w-full resize-y rounded-[14px] border border-line bg-paper px-4 py-3 text-[17px] leading-relaxed outline-none focus:border-link"
            />
            {errors.claim && (
              <p id={`${claimId}-err`} className="mt-1.5 text-[13px] text-contradicted">
                {errors.claim}
              </p>
            )}

            <label htmlFor={sourceId} className="mt-5 block text-[14px] font-semibold">
              Source text
            </label>
            <textarea
              id={sourceId}
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
                if (errors.source) setErrors((x) => ({ ...x, source: undefined }));
              }}
              rows={5}
              aria-invalid={Boolean(errors.source)}
              aria-describedby={errors.source ? `${sourceId}-err` : undefined}
              className="mt-2 w-full resize-y rounded-[14px] border border-line bg-paper px-4 py-3 text-[16px] leading-relaxed outline-none focus:border-link"
            />
            {errors.source && (
              <p id={`${sourceId}-err`} className="mt-1.5 text-[13px] text-contradicted">
                {errors.source}
              </p>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-4">
              <button type="submit" disabled={busy} className="rounded-full bg-ink px-6 py-3 text-[16px] font-semibold text-white disabled:opacity-60">
                {busy ? "Checking…" : "Check this claim"}
              </button>
              <p className="text-[14px] text-slate" role="status" aria-live="polite">
                {message}
              </p>
            </div>
          </form>

          <AnimatePresence mode="wait">
            {result && (
              <motion.div
                key={result.verdict + result.quote}
                className="mt-6"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 220, damping: 26 }}
              >
                <ResultCard result={result} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
