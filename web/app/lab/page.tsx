import type { Metadata } from "next";
import { SITE } from "@/lib/site";
import { Mark } from "@/components/Nav";

export const metadata: Metadata = {
  title: `Test page | ${SITE.name}`,
  description: "A test page with the structure of an AI Overview, for trying the Overview Check extension.",
};

const FDA = "https://www.fda.gov/consumers/consumer-updates/spilling-beans-how-much-caffeine-too-much";
const MAYO = "https://www.mayoclinic.org/healthy-lifestyle/adult-health/in-depth/caffeine/art-20045678";
const PDF = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";

function Cite({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={`Source: ${label}`}
      className="mx-0.5 inline-grid h-[22px] w-[22px] place-items-center rounded-full bg-paper align-[-4px] text-slate hover:text-ink"
    >
      <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
        <path
          d="M6.5 9.5 9.5 6.5M7 4.5l.9-.9a2.5 2.5 0 0 1 3.5 3.5l-.9.9M9 11.5l-.9.9a2.5 2.5 0 0 1-3.5-3.5l.9-.9"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    </a>
  );
}

/**
 * A stand-in for a search results page. The extension runs here exactly as it
 * does on Google, so the demo doesn't depend on Google's markup on a given day.
 * It deliberately uses Overview Check's own look, not Google's.
 */
export default function Lab() {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface">
        <div className="wrap flex h-14 items-center gap-3">
          <a href="/" className="flex items-center gap-2 text-[15px] font-semibold">
            <Mark size={22} />
            {SITE.name}
          </a>
          <span className="text-[14px] text-slate">Test page</span>
        </div>
      </header>

      <main className="wrap-narrow py-12">
        <p className="rounded-[14px] border border-line bg-surface p-4 text-[14.5px] leading-relaxed text-ink-soft">
          This page copies the structure of an AI Overview, with real cited pages, so you can watch the extension work
          without depending on Google&rsquo;s layout. Install the extension, then reload this page. Some sentences here
          are wrong on purpose.
        </p>

        <div className="mt-8 flex items-center gap-3 rounded-full border border-line bg-surface px-5 py-3 text-[16px]">
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" className="text-slate">
            <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="m13 13 4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          how much caffeine is safe per day
        </div>

        <section className="mt-8 rounded-[22px] border border-line bg-surface p-6" aria-label="Example AI Overview">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" className="text-[#4f6bed]">
              <path d="M10 1.5c.6 4.4 2.6 6.9 8.5 8.5-5.9 1.6-7.9 4.1-8.5 8.5-.6-4.4-2.6-6.9-8.5-8.5 5.9-1.6 7.9-4.1 8.5-8.5Z" fill="currentColor" />
            </svg>
            <h2 className="text-[16px] font-semibold">AI Overview</h2>
          </div>

          <div className="mt-4 grid gap-6 md:grid-cols-[1fr_210px]">
            <div className="space-y-4 text-[17px] leading-[1.75]">
              <p>
                Up to 400 milligrams of caffeine a day is considered safe for most adults.
                <Cite href={FDA} label="FDA" /> That&rsquo;s about the amount in eight cups of brewed coffee.
                <Cite href={MAYO} label="Mayo Clinic" />
              </p>
              <p>
                Children and teens should keep caffeine under 100 milligrams a day.
                <Cite href={FDA} label="FDA" />
              </p>
              <ul className="list-disc space-y-2 pl-6">
                <li>
                  <strong>Pregnancy:</strong> People who are pregnant should talk with their healthcare professional
                  about limiting caffeine. <Cite href={MAYO} label="Mayo Clinic" />
                </li>
                <li>
                  <strong>Energy drinks:</strong> Energy drinks often pack more caffeine than their labels suggest.
                  <Cite href={PDF} label="Linked report (PDF)" />
                </li>
              </ul>
              <p>Caffeine is a stimulant that is naturally found in coffee, tea, and cacao beans.</p>
            </div>

            <aside aria-label="Sources" className="flex flex-col gap-2">
              {[
                { href: FDA, title: "Spilling the Beans: How Much Caffeine is Too Much?", host: "fda.gov" },
                { href: MAYO, title: "Caffeine: How much is too much?", host: "mayoclinic.org" },
                { href: PDF, title: "Linked report (PDF)", host: "w3.org" },
              ].map((s) => (
                <a key={s.href} href={s.href} target="_blank" rel="noreferrer" className="block rounded-[14px] border border-line p-3 hover:border-ink/30">
                  <span className="block text-[13px] font-semibold leading-snug">{s.title}</span>
                  <span className="mt-1 block text-[12px] text-slate">{s.host}</span>
                </a>
              ))}
            </aside>
          </div>
        </section>

        <p className="mt-8 text-[14px] text-slate">
          No verdicts showing? Make sure the extension is installed and enabled, then reload. The extension popup shows
          which checking server it&rsquo;s using.
        </p>
      </main>
    </div>
  );
}
