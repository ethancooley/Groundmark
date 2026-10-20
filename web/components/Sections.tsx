import { EXAMPLE, SITE, STATS, VERDICT_META, type VerdictKey } from "@/lib/site";
import { VerdictIcon } from "./VerdictIcon";
import { Mark } from "./Nav";

export function Evidence() {
  return (
    <section id="evidence" aria-labelledby="evidence-title" className="bg-ink text-white">
      <div className="wrap py-32 sm:py-44">
        <h2 id="evidence-title" className="display max-w-[15ch] text-[clamp(40px,6.2vw,88px)]">
          A citation isn&rsquo;t the same as support.
        </h2>
        <p className="mt-6 max-w-[48ch] text-[clamp(19px,1.6vw,23px)] leading-[1.45] text-white/70">
          AI Overviews sit above every result and link to sources that look like proof. Independent studies keep finding
          that the sources often don&rsquo;t say what the summary claims.
        </p>

        <div className="mt-20 grid gap-x-12 gap-y-16 md:grid-cols-3">
          {STATS.map((s) => (
            <figure key={s.figure} className="border-t border-white/15 pt-8">
              <p className="display text-[clamp(64px,7vw,104px)] text-highlighter">{s.figure}</p>
              <p className="mt-4 text-[20px] font-medium leading-snug tracking-[-0.01em]">{s.claim}</p>
              <p className="mt-3 text-[15.5px] leading-relaxed text-white/65">{s.detail}</p>
              <figcaption className="mt-5 text-[13px] text-white/50">
                <a href={s.url} className="underline decoration-white/30 underline-offset-4 hover:text-white" target="_blank" rel="noreferrer">
                  {s.source}
                </a>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Verdicts() {
  const order: VerdictKey[] = ["supported", "not_found", "contradicted", "unverifiable"];
  return (
    <section aria-labelledby="verdicts-title" className="wrap py-32 sm:py-40">
      <div className="grid gap-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div>
          <h2 id="verdicts-title" className="display text-[clamp(40px,5.2vw,72px)]">
            Four verdicts. No guessing.
          </h2>
          <p className="lede mt-6 max-w-[34ch]">
            Groundmark judges one thing: whether the page Google cited backs the sentence. It doesn&rsquo;t decide
            what&rsquo;s true in the world, and it says so when it can&rsquo;t tell.
          </p>
        </div>
        <dl className="divide-y divide-line border-y border-line">
          {order.map((v) => {
            const example = EXAMPLE.sentences.find((s) => s.verdict === v)!;
            return (
              <div key={v} className="grid gap-3 py-7 sm:grid-cols-[220px_1fr] sm:gap-8">
                <dt className="flex items-center gap-3 text-[18px] font-semibold tracking-[-0.01em]">
                  <VerdictIcon verdict={v} size={26} />
                  {VERDICT_META[v].label}
                </dt>
                <dd>
                  <p className="text-[17px] leading-relaxed">{VERDICT_META[v].meaning}</p>
                  <p className="mt-2 text-[15px] leading-relaxed text-slate">
                    For example: &ldquo;{example.text}&rdquo; {example.explanation}
                  </p>
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
    </section>
  );
}

const SENT = [
  "A normal request to open each page Google cited, the same as clicking the link",
  "Sent without your cookies, so sites never see your logged-in accounts",
];
const KEPT = [
  "Your search query and the AI Overview's text",
  "Every verdict, quote, and explanation",
  "Your Google account, cookies, and history",
];

const PRACTICES = [
  {
    title: "Receipts are real text.",
    body: "The model must quote the source word for word. Every quote is checked against the page, and if it doesn't match, the closest real sentence is shown instead and the confidence is lowered.",
  },
  {
    title: "Pages can't give orders.",
    body: "Web pages can hide instructions meant for AI. Source text is passed to the model as quoted data with an explicit rule to ignore anything inside it that reads like a command.",
  },
  {
    title: "No server, no account, no bill.",
    body: "Checking runs on Gemini Nano, the model built into Chrome, on your own computer. There's nothing to sign up for, and nobody, including us, sees what you search or what gets checked.",
  },
  {
    title: "Access only when you allow it.",
    body: "Reading cited pages needs permission to open websites, so the extension asks once, with an explanation, and still runs only on Google search pages. It never opens local-network addresses.",
  },
  {
    title: "Honest about uncertainty.",
    body: "\"Not found\" is not \"false.\" PDFs, paywalls, and blocked pages get \"Couldn't check,\" never a guess. Confidence comes from checks on the evidence, not from the model grading itself.",
  },
  {
    title: "Works on more computers, honestly labeled.",
    body: "Where Chrome's on-device model isn't available, a lite mode matches words and figures instead. It never claims a contradiction, and every lite result says so.",
  },
];

export function Responsible() {
  return (
    <section id="responsible" aria-labelledby="responsible-title" className="border-t border-line bg-surface">
      <div className="wrap py-32 sm:py-40">
        <h2 id="responsible-title" className="display max-w-[16ch] text-[clamp(40px,5.6vw,80px)]">
          A fact-checker should be checkable too.
        </h2>
        <p className="lede mt-6 max-w-[46ch]">
          A tool that grades AI has to hold itself to the same standard. These are the design choices that make
          Groundmark trustworthy, and the places where it isn&rsquo;t.{" "}
          <a href="/methodology" className="text-link hover:underline">
            Read the full methodology, including the exact prompt.
          </a>
        </p>

        <div className="mt-16 grid gap-px overflow-hidden rounded-[24px] border border-line bg-line md:grid-cols-2">
          <div className="bg-surface p-8 sm:p-10">
            <h3 className="headline text-[24px]">The only thing that goes out</h3>
            <ul className="mt-5 space-y-3 text-[17px]">
              {SENT.map((s) => (
                <li key={s} className="flex gap-3">
                  <VerdictIcon verdict="supported" size={22} className="mt-0.5" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-surface p-8 sm:p-10">
            <h3 className="headline text-[24px]">Stays on your computer</h3>
            <ul className="mt-5 space-y-3 text-[17px]">
              {KEPT.map((s) => (
                <li key={s} className="flex gap-3">
                  <span aria-hidden="true" className="mt-0.5 inline-grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full bg-ink text-white">
                    <svg viewBox="0 0 16 16" width="13" height="13">
                      <rect x="4" y="7" width="8" height="6" rx="1.5" fill="currentColor" />
                      <path d="M5.8 7V5.6a2.2 2.2 0 0 1 4.4 0V7" fill="none" stroke="currentColor" strokeWidth="1.6" />
                    </svg>
                  </span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-20 grid gap-x-12 gap-y-12 md:grid-cols-2">
          {PRACTICES.map((p) => (
            <div key={p.title}>
              <h3 className="headline text-[24px]">{p.title}</h3>
              <p className="mt-3 max-w-[48ch] text-[17px] leading-relaxed text-ink-soft">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Install() {
  const steps = [
    { title: "Add it to Chrome", body: "Install Groundmark from the Chrome Web Store. A setup page opens automatically." },
    { title: "Finish setup", body: "Allow it to read the pages Google cites, and download Chrome's on-device AI if your computer supports it." },
    { title: "Search as usual", body: "When an AI Overview appears, each sentence gets a verdict. Hover one to see the evidence." },
  ];
  const manual = [
    "Download the zip below and unzip it somewhere you'll keep it.",
    "Go to chrome://extensions and turn on Developer mode in the top right.",
    "Click Load unpacked and choose the unzipped folder.",
  ];
  return (
    <section id="install" aria-labelledby="install-title" className="wrap py-32 sm:py-44">
      <div className="text-center">
        <span className="inline-block">
          <Mark size={84} />
        </span>
        <h2 id="install-title" className="display mx-auto mt-8 max-w-[14ch] text-[clamp(44px,6.4vw,92px)]">
          Read past the summary.
        </h2>
        <p className="lede mx-auto mt-6 max-w-[40ch]">
          Free and open source, with nothing to sign up for. Requires Chrome 138 or later.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <a
            href={SITE.chromeStore}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-ink px-8 py-4 text-[17px] font-semibold text-white transition-transform hover:scale-[1.03]"
          >
            Add to Chrome
          </a>
          <a href="/lab" className="rounded-full px-6 py-4 text-[17px] font-semibold text-link hover:underline">
            Try it on the test page
          </a>
        </div>
      </div>
      <ol className="mx-auto mt-20 grid max-w-[900px] gap-8 sm:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title} className="border-t border-line pt-5">
            <p className="text-[13px] font-semibold text-slate">Step {i + 1}</p>
            <h3 className="mt-1 text-[18px] font-semibold tracking-[-0.01em]">{s.title}</h3>
            <p className="mt-2 text-[15.5px] leading-relaxed text-ink-soft">{s.body}</p>
          </li>
        ))}
      </ol>
      <details className="mx-auto mt-14 max-w-[640px] rounded-[18px] border border-line bg-surface p-5 text-[15px] text-ink-soft">
        <summary className="cursor-pointer font-semibold text-ink">Install without the Chrome Web Store</summary>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5">
          {manual.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ol>
        <p className="mt-4">
          <a href={SITE.download} download className="font-semibold text-link underline-offset-4 hover:underline">
            Download the extension zip
          </a>
        </p>
      </details>
      <p className="mx-auto mt-8 max-w-[60ch] text-center text-[14px] text-slate">
        The full source code is on{" "}
        <a href={SITE.github} className="text-link underline-offset-4 hover:underline">
          GitHub
        </a>
        .
      </p>
    </section>
  );
}

const LIMITS = [
  "It checks whether the cited page supports a sentence, not whether the sentence is true. A sentence can be correct and still not be backed by its citation.",
  "Verdicts come from a small on-device model reading short passages. It is less accurate than large cloud models, can miss context elsewhere on a page, and can be wrong. Treat a verdict as a reason to look, not a final answer.",
  "The on-device model needs a recent computer: about 22 GB of free disk space and either a GPU with more than 4 GB of memory or 16 GB of RAM. Other computers get lite mode, which is much less capable.",
  "It reads English Overviews on Google search only, and can't yet read PDFs, videos, or pages behind logins or paywalls.",
  "Google changes its page layout often. When the layout shifts, the extension may miss sentences or attach them to the wrong links until it's updated.",
];

export function Limitations() {
  return (
    <section aria-labelledby="limits-title" className="border-t border-line">
      <div className="wrap-narrow py-28 sm:py-36">
        <h2 id="limits-title" className="headline text-[clamp(32px,3.6vw,48px)]">
          What it can&rsquo;t do
        </h2>
        <ul className="mt-8 space-y-5">
          {LIMITS.map((l) => (
            <li key={l} className="flex gap-4 text-[17px] leading-relaxed text-ink-soft">
              <span aria-hidden="true" className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-ink" />
              {l}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="wrap flex flex-col gap-6 py-12 text-[14px] text-slate md:flex-row md:items-start md:justify-between">
        <div className="max-w-[46ch]">
          <p className="flex items-center gap-2 font-semibold text-ink">
            <Mark size={20} />
            {SITE.name}
          </p>
          <p className="mt-3">
            Built by{" "}
            <a href={SITE.authorUrl} className="text-ink underline-offset-4 hover:underline">
              {SITE.author}
            </a>
            . Not affiliated with Google.
          </p>
          <p className="mt-2">
            The name comes from grounding, the AI term for whether an answer is actually backed by its sources.
          </p>
        </div>
        <div className="flex gap-8">
          <a href={SITE.github} target="_blank" rel="noreferrer" className="hover:text-ink">
            Source code
          </a>
          <a href="/lab" target="_blank" rel="noreferrer" className="hover:text-ink">
            Test page
          </a>
          <a href="/methodology" className="hover:text-ink">
            Methodology
          </a>
          <a href="/privacy" target="_blank" rel="noreferrer" className="hover:text-ink">
            Privacy policy
          </a>
        </div>
      </div>
    </footer>
  );
}
