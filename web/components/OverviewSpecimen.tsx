"use client";

import { AnimatePresence, motion } from "motion/react";
import { EXAMPLE, VERDICT_META, type VerdictKey } from "@/lib/site";
import { VerdictIcon } from "./VerdictIcon";

export function EvidenceCard({
  index,
  sweep = 1,
  className = "",
}: {
  index: number;
  sweep?: number;
  className?: string;
}) {
  const s = EXAMPLE.sentences[index];
  return (
    <div
      className={`rounded-[18px] border border-line bg-surface p-4 text-left shadow-[0_24px_60px_-20px_rgba(15,34,64,0.35),0_2px_8px_rgba(15,34,64,0.06)] ${className}`}
    >
      <div className="flex items-center gap-2">
        <VerdictIcon verdict={s.verdict} size={22} />
        <span className="text-[15px] font-semibold tracking-[-0.01em]">{VERDICT_META[s.verdict].label}</span>
      </div>
      <p className="mt-2 text-[14.5px] leading-snug text-ink-soft">{s.explanation}</p>
      {s.quote && (
        <figure className="mt-3">
          <blockquote className="text-[14.5px] leading-[1.6]">
            <span className="mark mark-sweep" style={{ ["--sweep" as string]: `${Math.round(sweep * 100)}%` }}>
              {s.quote}
            </span>
          </blockquote>
          <figcaption className="mt-2 flex items-baseline gap-2 text-[12.5px]">
            <span className="font-semibold">{s.site}</span>
            <span className="text-slate">{s.host}</span>
          </figcaption>
        </figure>
      )}
      <p className="mt-3 text-[13px] font-semibold text-link">Open the source at this passage</p>
    </div>
  );
}

function Sparkle() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
      <path d="M10 1.5c.6 4.4 2.6 6.9 8.5 8.5-5.9 1.6-7.9 4.1-8.5 8.5-.6-4.4-2.6-6.9-8.5-8.5 5.9-1.6 7.9-4.1 8.5-8.5Z" fill="currentColor" />
    </svg>
  );
}

/**
 * A stylized AI Overview with Overview Check running on it. Purely
 * illustrative; it doesn't copy any search engine's branding.
 */
export function OverviewSpecimen({
  resolved,
  focus = null,
  sweep = 1,
  showCard = false,
  compact = false,
}: {
  resolved: number;
  focus?: number | null;
  sweep?: number;
  showCard?: boolean;
  compact?: boolean;
}) {
  const sentences = EXAMPLE.sentences;
  const done = resolved >= sentences.length;
  const supported = sentences.slice(0, resolved).filter((s) => s.verdict === "supported").length;
  const tally = sentences.slice(0, resolved).reduce<Record<string, number>>((acc, s) => {
    acc[s.verdict] = (acc[s.verdict] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="relative rounded-[28px] border border-line bg-surface p-5 shadow-[0_40px_120px_-40px_rgba(15,34,64,0.45),0_2px_6px_rgba(15,34,64,0.05)] sm:p-7">
      <div className="flex items-center gap-3 rounded-full border border-line bg-paper px-4 py-2.5 text-[15px] text-ink-soft">
        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" className="text-slate">
          <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="m13 13 4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span className="truncate">{EXAMPLE.query}</span>
      </div>

      <div className={`mt-5 grid gap-6 ${compact ? "" : "md:grid-cols-[1fr_200px]"}`}>
        <div>
          <div className="flex items-center gap-2 text-[15px] font-semibold">
            <span className="text-[#4f6bed]">
              <Sparkle />
            </span>
            AI Overview
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[14px] bg-paper px-3 py-2 text-[13px]">
            <span className="flex items-center gap-2 font-semibold">
              <span className="inline-block h-[18px] w-[18px] rounded-[5px] bg-ink" aria-hidden="true">
                <svg viewBox="0 0 16 16" width="18" height="18">
                  <rect x="3" y="9" width="10" height="2.6" rx="1" fill="#ffe14d" />
                  <path d="M4.6 8 7 10.4 11.6 5" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              Overview Check
            </span>
            <span className="text-slate">
              {done ? `${supported} of ${sentences.length} sentences supported by their sources` : `Checking ${sentences.length} sentences…`}
            </span>
            <span className="ml-auto flex flex-wrap gap-1.5">
              {(["supported", "not_found", "contradicted", "unverifiable"] as VerdictKey[]).map((v) =>
                tally[v] ? (
                  <span key={v} className="flex items-center gap-1 rounded-full border border-line bg-surface py-0.5 pl-0.5 pr-2 text-[12px] font-semibold">
                    <VerdictIcon verdict={v} size={15} />
                    {tally[v]} {VERDICT_META[v].short.toLowerCase()}
                  </span>
                ) : null,
              )}
            </span>
          </div>

          <p className="mt-4 text-[17px] leading-[1.75] sm:text-[18px]">
            {sentences.map((s, i) => {
              const isResolved = i < resolved;
              const isFocus = focus === i;
              return (
                <span key={i}>
                  <span
                    className="rounded-[3px] transition-[background-color] duration-300"
                    style={{
                      backgroundColor: isFocus ? "rgba(255,225,77,0.55)" : "transparent",
                      textDecoration:
                        isResolved && s.verdict === "contradicted"
                          ? "underline wavy var(--v-contradicted)"
                          : isResolved && s.verdict === "not_found"
                            ? "underline dotted var(--v-not-found)"
                            : "none",
                      textDecorationThickness: s.verdict === "not_found" ? 2 : 1.5,
                      textUnderlineOffset: 4,
                    }}
                  >
                    {s.text}
                  </span>
                  <span className="relative mx-1 inline-block align-[-3px]">
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span
                        key={isResolved ? s.verdict : "pending"}
                        className="inline-block"
                        initial={{ scale: 0.4, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.4, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 500, damping: 26 }}
                      >
                        <VerdictIcon verdict={isResolved ? s.verdict : "pending"} spin={!isResolved} />
                      </motion.span>
                    </AnimatePresence>
                  </span>{" "}
                </span>
              );
            })}
          </p>
        </div>

        {!compact && (
          <aside className="hidden flex-col gap-2 md:flex" aria-label="Sources in this example">
            {[
              { site: "U.S. Food and Drug Administration", host: "fda.gov" },
              { site: "Mayo Clinic", host: "mayoclinic.org" },
              { site: "Linked report (PDF)", host: "PDF" },
            ].map((src) => (
              <div key={src.site} className="rounded-[14px] border border-line p-3">
                <p className="text-[13px] font-semibold leading-tight">{src.site}</p>
                <p className="mt-1 text-[12px] text-slate">{src.host}</p>
                <div className="mt-2 space-y-1.5" aria-hidden="true">
                  <div className="h-1.5 w-full rounded-full bg-paper" />
                  <div className="h-1.5 w-4/5 rounded-full bg-paper" />
                </div>
              </div>
            ))}
          </aside>
        )}
      </div>

      <AnimatePresence>
        {showCard && focus !== null && (
          <motion.div
            className="relative z-10 mt-4 max-w-[400px] md:absolute md:-bottom-16 md:-right-8 md:mt-0 md:w-[380px]"
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
          >
            <EvidenceCard index={focus} sweep={sweep} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
