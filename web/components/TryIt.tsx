"use client";

import { useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { VERDICT_META } from "@/lib/site";
import type { ClaimResult, StreamEvent } from "@/lib/check/types";
import { VerdictIcon } from "./VerdictIcon";

const PRESETS = [
  {
    label: "Caffeine limit",
    claim: "Up to 400 milligrams of caffeine a day is considered safe for most adults.",
    url: "https://www.fda.gov/consumers/consumer-updates/spilling-beans-how-much-caffeine-too-much",
  },
  {
    label: "Cups of coffee",
    claim: "400 milligrams of caffeine is about the amount in eight cups of brewed coffee.",
    url: "https://www.mayoclinic.org/healthy-lifestyle/adult-health/in-depth/caffeine/art-20045678",
  },
  {
    label: "Eiffel Tower",
    claim: "The Eiffel Tower was completed in 1889 for the World's Fair in Paris.",
    url: "https://en.wikipedia.org/wiki/Eiffel_Tower",
  },
];

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function ResultCard({ result }: { result: ClaimResult }) {
  const meta = VERDICT_META[result.verdict];
  return (
    <div className="rounded-[22px] border border-line bg-surface p-6 shadow-[0_30px_80px_-30px_rgba(15,34,64,0.35)]">
      <div className="flex flex-wrap items-center gap-3">
        <VerdictIcon verdict={result.verdict} size={30} />
        <p className="headline text-[26px]">{meta.label}</p>
        {result.partial && result.verdict === "not_found" && (
          <span className="rounded-full bg-paper px-3 py-1 text-[13px] font-semibold">Partly supported</span>
        )}
        {result.mode === "heuristic" && (
          <span className="rounded-full bg-paper px-3 py-1 text-[13px] font-semibold">Lite check</span>
        )}
      </div>
      <p className="mt-3 text-[17px] leading-relaxed">{result.explanation}</p>
      {result.evidence && (
        <figure className="mt-5 rounded-[16px] bg-paper p-5">
          <blockquote className="text-[17px] leading-[1.65]">
            <span className="mark">{result.evidence.quote}</span>
          </blockquote>
          <figcaption className="mt-3 flex flex-wrap items-baseline gap-x-2 text-[14px]">
            <span className="font-semibold">{result.evidence.sourceTitle || hostOf(result.evidence.sourceUrl)}</span>
            <span className="text-slate">{hostOf(result.evidence.sourceUrl)}</span>
          </figcaption>
          {!result.evidence.verbatim && (
            <p className="mt-2 text-[13.5px] text-slate">
              The model&rsquo;s quote didn&rsquo;t match the page exactly, so this is the closest real sentence.
            </p>
          )}
        </figure>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[14px]">
        {result.evidence && (
          <a href={result.evidence.fragmentUrl} target="_blank" rel="noreferrer" className="font-semibold text-link hover:underline">
            Open the source at this passage
          </a>
        )}
        <span className="text-slate">Confidence {Math.round(result.confidence * 100)}%</span>
      </div>
    </div>
  );
}

export function TryIt() {
  const claimId = useId();
  const urlId = useId();
  const [claim, setClaim] = useState(PRESETS[1].claim);
  const [url, setUrl] = useState(PRESETS[1].url);
  const [errors, setErrors] = useState<{ claim?: string; url?: string }>({});
  const [phase, setPhase] = useState<"idle" | "reading" | "judging" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<ClaimResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  function validate() {
    const next: typeof errors = {};
    if (claim.trim().split(/\s+/).length < 4) next.claim = "Enter a full sentence to check.";
    try {
      const u = new URL(url.trim());
      if (!/^https?:$/.test(u.protocol)) throw new Error();
    } catch {
      next.url = "Enter a link that starts with https://";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setResult(null);
    setPhase("reading");
    setMessage("Reading the page…");
    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ claims: [{ id: "try", text: claim.trim(), sources: [url.trim()] }] }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `The checker returned an error (${res.status}).`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const ev = JSON.parse(line) as StreamEvent;
          if (ev.type === "source") {
            setPhase("judging");
            setMessage(ev.status === "ok" ? `Read “${ev.title || hostOf(ev.url)}”. Weighing the evidence…` : "Couldn't read that page.");
          } else if (ev.type === "result") {
            setResult(ev.result);
            setPhase("done");
          } else if (ev.type === "error") {
            throw new Error(ev.message);
          }
        }
      }
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setPhase("error");
      setMessage((err as Error).message || "Something went wrong. Try again.");
    }
  }

  const busy = phase === "reading" || phase === "judging";

  return (
    <section id="try" aria-labelledby="try-title" className="border-t border-line">
      <div className="wrap grid gap-14 py-32 sm:py-40 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div>
          <h2 id="try-title" className="display text-[clamp(40px,5.2vw,72px)]">
            Check any claim against any page.
          </h2>
          <p className="lede mt-6 max-w-[34ch]">
            This is the same checker the extension uses. Paste a sentence and the link that&rsquo;s supposed to back it up.
          </p>
          <div className="mt-8 flex flex-wrap gap-2" role="group" aria-label="Example claims">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  setClaim(p.claim);
                  setUrl(p.url);
                  setErrors({});
                }}
                className="rounded-full border border-line bg-surface px-4 py-2 text-[14px] font-medium hover:border-ink/30"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <form onSubmit={onSubmit} noValidate className="rounded-[24px] border border-line bg-surface p-6 sm:p-8">
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
              rows={3}
              aria-invalid={Boolean(errors.claim)}
              aria-describedby={errors.claim ? `${claimId}-err` : undefined}
              className="mt-2 w-full resize-y rounded-[14px] border border-line bg-paper px-4 py-3 text-[17px] leading-relaxed outline-none focus:border-link"
            />
            {errors.claim && (
              <p id={`${claimId}-err`} className="mt-1.5 text-[13px] text-contradicted">
                {errors.claim}
              </p>
            )}

            <label htmlFor={urlId} className="mt-5 block text-[14px] font-semibold">
              Cited page
            </label>
            <input
              id={urlId}
              type="url"
              inputMode="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (errors.url) setErrors((x) => ({ ...x, url: undefined }));
              }}
              aria-invalid={Boolean(errors.url)}
              aria-describedby={errors.url ? `${urlId}-err` : undefined}
              className="mt-2 w-full rounded-[14px] border border-line bg-paper px-4 py-3 text-[16px] outline-none focus:border-link"
            />
            {errors.url && (
              <p id={`${urlId}-err`} className="mt-1.5 text-[13px] text-contradicted">
                {errors.url}
              </p>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-4">
              <button
                type="submit"
                disabled={busy}
                className="rounded-full bg-ink px-6 py-3 text-[16px] font-semibold text-white disabled:opacity-60"
              >
                {busy ? "Checking…" : "Check this claim"}
              </button>
              <p className="text-[14px] text-slate" role="status" aria-live="polite">
                {phase === "error" ? <span className="text-contradicted">{message}</span> : busy ? message : ""}
              </p>
            </div>
          </form>

          <AnimatePresence mode="wait">
            {result && (
              <motion.div
                key={result.claim + result.verdict}
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
