import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/site";
import { Mark } from "@/components/Nav";
// The real prompt and limits, imported from the extension so this page can't drift from what runs.
import { EXAMPLES, SCHEMA, SYSTEM, formatPrompt } from "../../../extension/lib/judge.js";
import { LIMITS } from "../../../extension/lib/checker.js";

export const metadata: Metadata = {
  title: `Methodology | ${SITE.name}`,
  description: "How Groundmark finds claims, reads sources, prompts the on-device model, and decides each verdict.",
};

const EXAMPLE_PROMPT = formatPrompt("Up to 400 milligrams of caffeine a day is considered safe for most adults.", [
  {
    id: "S1-P2",
    sourceUrl: "https://www.fda.gov/",
    text: "In a recent review, the FDA confirmed the safety of the 400 milligrams a day level for most adults.",
  },
  {
    id: "S1-P5",
    sourceUrl: "https://www.fda.gov/",
    text: "Under the Dietary Guidelines, drinks containing caffeine should be avoided for children younger than age 2.",
  },
]);

const TOC = [
  ["claims", "Finding the claims"],
  ["sources", "Reading the sources"],
  ["passages", "Choosing passages"],
  ["prompt", "The prompt"],
  ["checks", "Checking the answer"],
  ["confidence", "Confidence"],
  ["lite", "Lite mode"],
  ["evaluation", "Evaluation"],
  ["inspect", "Inspecting a single verdict"],
] as const;

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-4 overflow-x-auto rounded-[14px] border border-line bg-surface p-5 font-mono text-[13px] leading-[1.6] whitespace-pre-wrap break-words text-ink">
      {children}
    </pre>
  );
}

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="headline mt-20 scroll-mt-24 text-[clamp(26px,3vw,34px)]">
      {children}
    </h2>
  );
}

export default function Methodology() {
  const mb = Math.round(LIMITS.maxBytes / 1_000_000);
  const seconds = Math.round(LIMITS.timeoutMs / 1000);
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface">
        <div className="wrap flex h-14 items-center gap-3">
          <Link href="/" className="flex items-center gap-2 text-[15px] font-semibold">
            <Mark size={22} />
            {SITE.name}
          </Link>
          <span className="text-[14px] text-slate">Methodology</span>
        </div>
      </header>

      <main className="wrap-narrow py-16 sm:py-24 [&_p]:text-[17px] [&_p]:leading-relaxed [&_p]:text-ink-soft">
        <h1 className="display text-[clamp(40px,6vw,68px)]">How Groundmark decides</h1>
        <p className="lede mt-6 max-w-[48ch] !text-slate">
          Every step between an AI Overview and a verdict, including the exact instructions given to the model. The
          prompt and limits on this page are read directly from the extension&rsquo;s code, so they always match what
          runs.
        </p>

        <nav aria-label="On this page" className="mt-10 rounded-[18px] border border-line bg-surface p-5">
          <p className="!text-[14px] font-semibold !text-ink">On this page</p>
          <ol className="mt-2 grid list-decimal gap-x-8 gap-y-1 pl-5 text-[15px] sm:grid-cols-2">
            {TOC.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`} className="text-link hover:underline">
                  {label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <p className="mt-10">
          Groundmark answers one question per sentence: <strong className="text-ink">does the page Google cited back it up?</strong>{" "}
          It doesn&rsquo;t judge whether the sentence is true in the world. A sentence can be correct and still not be
          supported by its citation, and that gap is what Groundmark is built to show.
        </p>

        <H2 id="claims">1. Finding the claims</H2>
        <p className="mt-4">
          The extension runs only on Google search pages. It finds the AI Overview by its visible &ldquo;AI
          Overview&rdquo; label rather than Google&rsquo;s class names, which change often, and waits until the Overview
          stops streaming before reading it.
        </p>
        <p className="mt-4">
          It splits the text into sentences, skipping headings, button labels, and fragments under five words. It
          also skips sentences that aren&rsquo;t claims: follow-up questions, offers to help (&ldquo;tell me what you
          drink and I can help you calculate&hellip;&rdquo;), and Google&rsquo;s own notices such as &ldquo;AI responses
          may include mistakes.&rdquo; A short list item is checked together with the heading above its list, so
          &ldquo;Headache&rdquo; under &ldquo;Signs of too much caffeine&rdquo; is checked as &ldquo;Signs of too much
          caffeine: Headache,&rdquo; and the evidence card shows the sentence that was checked. Each sentence is paired
          with the links Google attached to it, in this order of preference: the link that follows the sentence, the
          links in the same paragraph or list item, the links Google put at the end of its list (which often cover the
          whole list), and finally the Overview&rsquo;s full source list. The evidence card says which was used. Up to {LIMITS.maxClaims} sentences are checked per Overview, with
          at most {LIMITS.maxSourcesPerClaim} sources each.
        </p>

        <H2 id="sources">2. Reading the sources</H2>
        <p className="mt-4">
          Each cited page is opened from your browser, without your cookies, so sites never see your logged-in session.
          Groundmark refuses local and private-network addresses, non-standard ports, and links containing passwords,
          both before the request and after any redirect. Pages are capped at about {mb} MB and {seconds} seconds.
        </p>
        <p className="mt-4">
          Groundmark reads the whole page, not just what looks like the main article. Event pages, product pages,
          and FAQs often keep the cited fact in a side section that article extractors throw away, so only page
          furniture is removed: scripts, menus, buttons, and cookie banners. Descriptive image text, the page&rsquo;s
          summary, and its structured data (such as an event&rsquo;s date and place) are read too. Dates and times are
          compared in one shape, so &ldquo;November 13th, 10am&rdquo; on the page matches &ldquo;November 13, 10:00
          AM&rdquo; in the Overview. PDFs, images, and pages with no readable text are marked &ldquo;Couldn&rsquo;t
          check&rdquo; instead of being guessed at.
        </p>

        <H2 id="passages">3. Choosing passages</H2>
        <p className="mt-4">
          A small on-device model can&rsquo;t read a whole web page at once, so each page is split into overlapping
          passages of about three sentences. Passages are ranked against the sentence with BM25, a standard search
          ranking method, plus a bonus for every number the passage shares with the sentence, since dates, doses, and
          counts are where errors tend to hide. Spelled-out numbers count too, so &ldquo;four&rdquo; matches
          &ldquo;4.&rdquo;
        </p>
        <p className="mt-4">
          The top {LIMITS.passagesPerSource} passages from each source are kept, up to {LIMITS.maxPassagesModel} in total
          for the model ({LIMITS.maxPassagesLite} in lite mode).
        </p>

        <H2 id="prompt">4. The prompt</H2>
        <p className="mt-4">
          Verdicts come from Gemini Nano, the language model built into Chrome, running on your computer. Each check
          starts from a session primed with the same instructions and two worked examples, and each sentence runs in a
          fresh copy of that session so sentences can&rsquo;t influence each other.
        </p>
        <h3 className="mt-8 text-[18px] font-semibold">Instructions</h3>
        <Code>{SYSTEM}</Code>

        <h3 className="mt-8 text-[18px] font-semibold">Worked examples</h3>
        <p className="mt-2">
          One supported and one contradicted example, to show the expected answer format and how strictly figures must
          match.
        </p>
        {EXAMPLES.map((m: { role: string; content: string }, i: number) => (
          <div key={i}>
            <p className="mt-5 !text-[14px] font-semibold !text-slate">{m.role === "user" ? "Example input" : "Example answer"}</p>
            <Code>{m.content}</Code>
          </div>
        ))}

        <h3 className="mt-8 text-[18px] font-semibold">Each sentence&rsquo;s prompt</h3>
        <p className="mt-2">
          The sentence, then the chosen passages, each labeled with an ID so the model can say which one it used. For
          example:
        </p>
        <Code>{EXAMPLE_PROMPT}</Code>

        <h3 className="mt-8 text-[18px] font-semibold">Required answer format</h3>
        <p className="mt-2">
          Chrome constrains the model&rsquo;s output to this JSON schema, so every answer can be parsed.
        </p>
        <Code>{JSON.stringify(SCHEMA, null, 2)}</Code>
        <p className="mt-4">
          If a prompt doesn&rsquo;t fit in the model&rsquo;s context window, it&rsquo;s sent once more with only the
          two strongest passages. If the model fails entirely, that sentence falls back to lite mode and is labeled as
          such.
        </p>

        <H2 id="checks">5. Checking the answer</H2>
        <p className="mt-4">The model&rsquo;s answer is never shown as-is:</p>
        <ul className="mt-4 list-disc space-y-2 pl-6 text-[17px] text-ink-soft">
          <li>
            <strong className="text-ink">Passage check.</strong> If the model names a passage it wasn&rsquo;t sent, the
            top-ranked passage is used instead.
          </li>
          <li>
            <strong className="text-ink">Quote check.</strong> The quote must appear word for word in that passage.
            If it doesn&rsquo;t, it&rsquo;s replaced with the passage&rsquo;s closest real sentence, favoring
            sentences that contain the claim&rsquo;s figures, and confidence is lowered. If no sentence is close, no
            quote is shown rather than an unrelated one. Every quote you see is text that exists on the page.
          </li>
          <li>
            <strong className="text-ink">Contradiction check.</strong> &ldquo;Contradicted&rdquo; is the most serious
            verdict, so the model&rsquo;s is accepted only with real evidence: its quote must be on the page, and the
            quoted figure must actually conflict. A figure inside a range the sentence gives (37 mg for
            &ldquo;30&ndash;50 mg&rdquo;) agrees with it. When either check fails, the lite check decides instead, and
            the evidence card and inspector say the model was overruled.
          </li>
          <li>
            <strong className="text-ink">Prompt injection.</strong> Pages can hide instructions meant for AI.
            Passages reach the model only as labeled data under an instruction to ignore anything inside them that
            reads like a command, and all page and model text is displayed as plain text, never as HTML.
          </li>
        </ul>

        <H2 id="confidence">6. Confidence</H2>
        <p className="mt-4">
          Small models are poor judges of their own certainty, so Groundmark doesn&rsquo;t ask. Confidence is computed
          from evidence it can check:
        </p>
        <div className="mt-4 overflow-x-auto rounded-[14px] border border-line bg-surface">
          <table className="w-full text-left text-[15px]">
            <thead className="border-b border-line text-[13px] text-slate">
              <tr>
                <th className="px-4 py-3 font-semibold">Condition</th>
                <th className="px-4 py-3 font-semibold">Effect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              <tr><td className="px-4 py-3">Quote found word for word</td><td className="px-4 py-3">Start at 75%</td></tr>
              <tr><td className="px-4 py-3">Quote had to be replaced</td><td className="px-4 py-3">Start at 45%</td></tr>
              <tr><td className="px-4 py-3">&ldquo;Supported,&rdquo; but under 35% of the sentence&rsquo;s key words are in the passage</td><td className="px-4 py-3">&minus;25 points</td></tr>
              <tr><td className="px-4 py-3">&ldquo;Supported,&rdquo; with 70% or more of the key words in the passage</td><td className="px-4 py-3">+10 points</td></tr>
              <tr><td className="px-4 py-3">The model&rsquo;s &ldquo;contradicted&rdquo; was overruled</td><td className="px-4 py-3">Lite-check confidence, at most 60%</td></tr>
            </tbody>
          </table>
        </div>
        <p className="mt-4">
          The result is kept between 15% and 90%, and shown as high (75% or more), medium (50% or more), or low.
        </p>

        <H2 id="lite">7. Lite mode</H2>
        <p className="mt-4">
          Gemini Nano needs a recent computer: about 22 GB of free disk space and either a GPU with more than 4 GB of
          memory or 16 GB of RAM. Elsewhere, Groundmark uses lite mode, which marks a sentence supported only when at
          least 70% of its key words appear in one passage and every figure in the sentence appears there too.
          Otherwise it&rsquo;s &ldquo;not found.&rdquo; Lite mode can&rsquo;t understand meaning, so it never says
          &ldquo;contradicted,&rdquo; its confidence never exceeds 60%, and every lite result is labeled &ldquo;Lite
          check.&rdquo;
        </p>
        <p className="mt-4">
          Lite mode also keeps Groundmark usable on slower computers. The model can run on a computer that meets the
          requirements and still be slow, for example without a capable GPU. In the default Automatic setting,
          Groundmark times each sentence. If two sentences each take longer than {LIMITS.slowSentenceMs / 1000}{" "}
          seconds, or one takes longer than {LIMITS.verySlowSentenceMs / 1000}, the rest of that Overview gets lite
          verdicts. Before timing anything, Groundmark loads the model and sends it one throwaway prompt, because a
          model&rsquo;s first answer includes one-time setup that would make a fast computer look slow. That warm-up
          isn&rsquo;t counted against the sentences, but in Automatic it&rsquo;s capped at{" "}
          {LIMITS.readyMs / 1000} seconds, so a slow computer isn&rsquo;t left waiting either. Groundmark doesn&rsquo;t
          switch to the weaker checker on its own after that: the bar asks whether to use lite mode on this computer,
          and the answer applies to that computer only, not to the person&rsquo;s other computers. It can be changed
          back in settings.
        </p>

        <H2 id="evaluation">8. Evaluation</H2>
        <p className="mt-4">
          Groundmark&rsquo;s accuracy hasn&rsquo;t yet been measured on a large labeled set, so this page makes no
          accuracy claims. The extension includes an evaluation tool that runs hand-labeled sentence and source pairs
          through the same checker on your computer and reports accuracy, a confusion matrix, and precision for
          &ldquo;contradicted,&rdquo; the costliest mistake, since a false alarm accuses a source of saying something
          it didn&rsquo;t. The labeled cases and instructions are in the{" "}
          <a href={SITE.github} className="text-link hover:underline">
            source code
          </a>
          .
        </p>

        <H2 id="inspect">9. Inspecting a single verdict</H2>
        <p className="mt-4">
          Every evidence card links to a page showing exactly how that sentence was checked: the sources and whether
          each could be read, the passages that were compared, the exact text sent to the model, its raw answer, and
          each check above. That page is built on your computer and cleared when Chrome closes.
        </p>

        <p className="mt-16 border-t border-line pt-8 !text-[15px]">
          See also <Link href="/#responsible" className="text-link hover:underline">privacy and design choices</Link> and{" "}
          <Link href="/privacy" className="text-link hover:underline">the privacy policy</Link>.
        </p>
      </main>
    </div>
  );
}
