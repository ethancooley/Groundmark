"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { EXAMPLE } from "@/lib/site";
import { VerdictIcon } from "./VerdictIcon";
import { EvidenceCard } from "./OverviewSpecimen";

const STEPS = [
  {
    title: "It finds every sentence.",
    body: "When an AI Overview finishes loading, the extension splits it into individual claims and notes which links Google attached to each one.",
  },
  {
    title: "It opens the page Google cited.",
    body: "The extension opens each cited page itself, without your cookies, and pulls out the readable article text, skipping menus, ads, and scripts.",
  },
  {
    title: "It finds the passages that matter.",
    body: "Each page is broken into short passages and ranked against the claim, with extra weight on matching numbers, where errors tend to hide.",
  },
  {
    title: "It shows you the receipt.",
    body: "Gemini Nano, the AI model built into Chrome, weighs the claim against the best passages on your own computer. The quote you see is checked word for word against the page, and links straight to it.",
  },
];

const FOCUS = EXAMPLE.sentences.findIndex((s) => s.verdict === "contradicted");
const FOCUS_SENTENCE = EXAMPLE.sentences[FOCUS];

// Passages on the mock source page. One is the real quote; the rest are placeholders.
const PASSAGES = [
  { w: [92, 70], score: 0.18 },
  { w: [88, 95, 40], score: 0.31 },
  { real: true, score: 0.94 },
  { w: [96, 60], score: 0.42 },
  { w: [80, 90, 52], score: 0.12 },
];

function SourcePage({ step, sweep }: { step: number; sweep: number }) {
  return (
    <div className="rounded-[22px] border border-line bg-surface p-5 shadow-[0_30px_80px_-30px_rgba(15,34,64,0.4)]">
      <div className="flex items-center gap-2 border-b border-line pb-3">
        <span className="h-2.5 w-2.5 rounded-full bg-line" />
        <span className="h-2.5 w-2.5 rounded-full bg-line" />
        <span className="h-2.5 w-2.5 rounded-full bg-line" />
        <span className="ml-2 truncate rounded-full bg-paper px-3 py-1 text-[12px] text-slate">mayoclinic.org</span>
      </div>
      <p className="headline mt-4 text-[22px]">Caffeine: How much is too much?</p>
      <div className="mt-4 space-y-3">
        {PASSAGES.map((p, i) => {
          const ranked = step >= 2;
          const isReal = Boolean(p.real);
          const dim = ranked && !isReal;
          return (
            <motion.div
              key={i}
              className="relative rounded-[10px] py-2 pl-2 pr-16"
              animate={{
                opacity: dim ? 0.35 : 1,
                backgroundColor: ranked && isReal ? "rgba(26,86,219,0.06)" : "rgba(0,0,0,0)",
              }}
              transition={{ duration: 0.5 }}
            >
              {isReal && step >= 2 ? (
                <p className="text-[15px] leading-[1.6]">
                  <span className="mark mark-sweep" style={{ ["--sweep" as string]: `${Math.round(sweep * 100)}%` }}>
                    {FOCUS_SENTENCE.quote}
                  </span>
                </p>
              ) : (
                <div className="space-y-1.5" aria-hidden="true">
                  {(p.w ?? [94, 76]).map((w, j) => (
                    <div key={j} className="h-2 rounded-full bg-paper" style={{ width: `${w}%` }} />
                  ))}
                </div>
              )}
              {ranked && (
                <motion.span
                  className="absolute right-2 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-link"
                  initial={{ width: 0 }}
                  animate={{ width: p.score * 44 }}
                  transition={{ duration: 0.6, delay: i * 0.05 }}
                  aria-hidden="true"
                />
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function OverviewColumn({ step }: { step: number }) {
  return (
    <div className="rounded-[22px] border border-line bg-surface p-5 shadow-[0_30px_80px_-30px_rgba(15,34,64,0.3)]">
      <p className="text-[14px] font-semibold">AI Overview</p>
      <ol className="mt-3 space-y-2.5">
        {EXAMPLE.sentences.map((s, i) => {
          const isFocus = i === FOCUS && step >= 1;
          const resolved = step >= 3 && i === FOCUS;
          return (
            <motion.li
              key={i}
              className="flex items-start gap-2 rounded-[10px] p-2 text-[15px] leading-snug"
              animate={{
                outlineColor: step === 0 ? "rgba(26,86,219,0.45)" : "rgba(26,86,219,0)",
                backgroundColor: isFocus ? "rgba(255,225,77,0.45)" : "rgba(255,255,255,0)",
                opacity: step >= 1 && !isFocus ? 0.4 : 1,
              }}
              style={{ outlineWidth: 1.5, outlineStyle: "dashed", outlineOffset: 0 }}
              transition={{ duration: 0.45, delay: step === 0 ? i * 0.08 : 0 }}
            >
              <span className="min-w-0 flex-1">{s.text}</span>
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={resolved ? "done" : "wait"}
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.4, opacity: 0 }}
                  className="mt-0.5"
                >
                  <VerdictIcon verdict={resolved ? s.verdict : "pending"} size={18} />
                </motion.span>
              </AnimatePresence>
            </motion.li>
          );
        })}
      </ol>
      <p className="mt-3 text-[12.5px] text-slate">{EXAMPLE.sentences.length} sentences found, each with its own sources</p>
    </div>
  );
}

function Stage({ step, sweep }: { step: number; sweep: number }) {
  return (
    <div className="relative grid items-start gap-5 lg:grid-cols-2">
      <OverviewColumn step={step} />
      <motion.div
        animate={{ opacity: step >= 1 ? 1 : 0, x: step >= 1 ? 0 : 40 }}
        transition={{ type: "spring", stiffness: 140, damping: 22 }}
        aria-hidden={step < 1}
      >
        <SourcePage step={step} sweep={sweep} />
      </motion.div>
      <AnimatePresence>
        {step >= 3 && (
          <motion.div
            className="lg:absolute lg:-bottom-28 lg:left-[8%] lg:w-[380px]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ type: "spring", stiffness: 220, damping: 24 }}
          >
            <EvidenceCard index={FOCUS} sweep={sweep} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ScrollStory() {
  const ref = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [sweep, setSweep] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  useMotionValueEvent(scrollYProgress, "change", (p) => {
    setStep(Math.min(3, Math.floor(p * 4.2)));
    setSweep(Math.max(0, Math.min(1, (p - 0.5) / 0.25)));
  });

  return (
    <section id="how" aria-labelledby="how-title" className="relative overflow-x-clip">
      <div className="wrap pt-28 pb-10 text-center sm:pt-36">
        <h2 id="how-title" className="display mx-auto max-w-[16ch] text-[clamp(40px,6vw,84px)]">
          From sentence to source in seconds.
        </h2>
        <p className="lede mx-auto mt-6 max-w-[42ch]">
          Most people never click through to check an AI answer. Groundmark does the clicking, the reading, and the
          comparing for you.
        </p>
      </div>

      {/* Desktop: a sticky stage that advances as you scroll. */}
      <div ref={ref} className="relative hidden h-[400vh] lg:block">
        <div className="sticky top-0 flex h-dvh items-center">
          <div className="wrap grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-center gap-16">
            <ol className="relative">
              {STEPS.map((s, i) => (
                <li
                  key={s.title}
                  className="border-l-2 py-5 pl-6 transition-all duration-500"
                  style={{
                    borderColor: i === step ? "var(--ink)" : "var(--line)",
                    opacity: i === step ? 1 : 0.32,
                  }}
                  aria-current={i === step ? "step" : undefined}
                >
                  <p className="text-[13px] font-semibold text-slate">Step {i + 1}</p>
                  <h3 className="headline mt-1 text-[26px]">{s.title}</h3>
                  <p
                    className="mt-2 text-[16px] leading-relaxed text-ink-soft transition-all duration-500"
                    style={{ maxHeight: i === step ? 160 : 0, opacity: i === step ? 1 : 0, overflow: "hidden" }}
                  >
                    {s.body}
                  </p>
                </li>
              ))}
            </ol>
            <Stage step={step} sweep={sweep} />
          </div>
        </div>
      </div>

      {/* Small screens and no-scroll fallback: the same story as static frames. */}
      <div className="wrap space-y-20 pb-10 lg:hidden">
        {STEPS.map((s, i) => (
          <div key={s.title}>
            <p className="text-[13px] font-semibold text-slate">Step {i + 1}</p>
            <h3 className="headline mt-1 text-[28px]">{s.title}</h3>
            <p className="mt-2 text-[16px] leading-relaxed text-ink-soft">{s.body}</p>
            <div className="mt-6">
              <Stage step={i} sweep={i >= 2 ? 1 : 0} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
