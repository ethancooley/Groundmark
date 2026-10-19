"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { SITE, EXAMPLE } from "@/lib/site";
import { OverviewSpecimen } from "./OverviewSpecimen";

const CONTRADICTED = EXAMPLE.sentences.findIndex((s) => s.verdict === "contradicted");

export function Hero() {
  const reduce = useReducedMotion();
  const [resolved, setResolved] = useState(0);
  const [sweep, setSweep] = useState(0);
  const total = EXAMPLE.sentences.length;

  // The page's one orchestrated moment: verdicts land one by one, then the evidence is highlighted.
  useEffect(() => {
    if (reduce) return; // reduced motion: render the finished state below instead
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i <= total; i++) timers.push(setTimeout(() => setResolved(i), 900 + i * 520));
    const start = 900 + total * 520 + 450;
    let raf = 0;
    timers.push(
      setTimeout(() => {
        const t0 = performance.now();
        const tick = (t: number) => {
          const p = Math.min(1, (t - t0) / 900);
          setSweep(1 - Math.pow(1 - p, 3));
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      }, start),
    );
    return () => {
      timers.forEach(clearTimeout);
      cancelAnimationFrame(raf);
    };
  }, [reduce, total]);

  const shownResolved = reduce ? total : resolved;
  const shownSweep = reduce ? 1 : sweep;
  const cardShown = shownResolved >= total;

  return (
    <section className="relative overflow-hidden pt-36 pb-32 sm:pt-44 sm:pb-44">
      <div className="wrap text-center">
        <motion.h1
          className="display mx-auto max-w-[14ch] text-[clamp(48px,8.4vw,118px)]"
          initial={reduce ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          Google&rsquo;s AI cites its sources. We read them.
        </motion.h1>
        <motion.p
          className="lede mx-auto mt-7 max-w-[40ch]"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
        >
          {SITE.name} is a Chrome extension that checks every sentence of an AI Overview against the page it cites, and
          shows you the exact passage behind each verdict.
        </motion.p>
        <motion.div
          className="mt-10 flex flex-wrap items-center justify-center gap-3"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          <a
            href="#install"
            className="rounded-full bg-ink px-7 py-3.5 text-[16px] font-semibold text-white transition-transform hover:scale-[1.03]"
          >
            Get the extension
          </a>
          <a href="#try" className="rounded-full px-6 py-3.5 text-[16px] font-semibold text-link hover:underline">
            Check a claim now
          </a>
        </motion.div>
      </div>

      <motion.div
        className="wrap mt-20 sm:mt-24"
        initial={reduce ? false : { opacity: 0, y: 60, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 1.2, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="mx-auto max-w-[980px]">
          <OverviewSpecimen
            resolved={shownResolved}
            focus={cardShown ? CONTRADICTED : null}
            sweep={shownSweep}
            showCard={cardShown}
          />
          <p className="mt-8 text-center text-[13px] text-slate md:mt-28">
            Illustrative example. The quotes are verbatim from the cited pages.
          </p>
        </div>
      </motion.div>
    </section>
  );
}
