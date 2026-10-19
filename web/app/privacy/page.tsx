import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/site";
import { Mark } from "@/components/Nav";

export const metadata: Metadata = {
  title: `Privacy policy | ${SITE.name}`,
  description: "What Overview Check reads, what it sends, and what it stores.",
};

const UPDATED = "October 19, 2026";

export default function Privacy() {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface">
        <div className="wrap flex h-14 items-center gap-3">
          <Link href="/" className="flex items-center gap-2 text-[15px] font-semibold">
            <Mark size={22} />
            {SITE.name}
          </Link>
        </div>
      </header>
      <main className="wrap-narrow py-16 sm:py-24">
        <h1 className="display text-[clamp(40px,6vw,64px)]">Privacy policy</h1>
        <p className="mt-4 text-[15px] text-slate">Last updated {UPDATED}</p>

        <div className="mt-10 space-y-10 text-[17px] leading-relaxed text-ink-soft [&_h2]:headline [&_h2]:mb-3 [&_h2]:text-[26px] [&_h2]:text-ink">
          <section>
            <h2>The short version</h2>
            <p>
              Overview Check has no server and no account. It does its work on your computer. We don&rsquo;t collect,
              receive, store, sell, or share any information about you or what you search.
            </p>
          </section>

          <section>
            <h2>What the extension reads</h2>
            <p>
              On Google search results pages only, the extension reads the text of the AI Overview and the links Google
              attached to it. It doesn&rsquo;t run on any other site, and it doesn&rsquo;t read your search history,
              other tabs, or anything you type.
            </p>
          </section>

          <section>
            <h2>What leaves your computer</h2>
            <p>
              To check a sentence, the extension opens the pages Google cited for it, the same request your browser makes
              when you click a link. These requests are sent without your cookies, so the sites can&rsquo;t connect them
              to your accounts. Like any web request, they reveal your IP address to the site being opened. Nothing is
              sent to us or to any other service.
            </p>
          </section>

          <section>
            <h2>The on-device AI</h2>
            <p>
              Verdicts come from Gemini Nano, the language model built into Chrome, which runs on your computer. Chrome
              downloads the model once, from Google, when you turn it on during setup. The text being checked is
              processed locally and isn&rsquo;t sent to Google or anyone else by Overview Check.
            </p>
          </section>

          <section>
            <h2>What&rsquo;s stored</h2>
            <p>
              The extension saves your settings (such as whether to check automatically) in Chrome&rsquo;s sync storage,
              and a count of verdicts for each open tab, which is deleted when the tab closes. Fetched pages and verdicts
              are kept in memory for up to 30 minutes so repeat searches are fast, and are discarded when Chrome closes
              the extension&rsquo;s background page.
            </p>
          </section>

          <section>
            <h2>Permissions</h2>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                <strong className="text-ink">Storage:</strong> saves your settings and per-tab counts.
              </li>
              <li>
                <strong className="text-ink">Offscreen document:</strong> reads cited pages and runs the on-device model
                in the background.
              </li>
              <li>
                <strong className="text-ink">Access to websites (optional, asked once):</strong> opens the pages Google
                cites. The extension never opens addresses on your local network.
              </li>
            </ul>
          </section>

          <section>
            <h2>This website</h2>
            <p>
              This site doesn&rsquo;t use cookies or analytics. The &ldquo;Check a claim&rdquo; box runs in your browser,
              and what you type into it isn&rsquo;t sent anywhere. The site is hosted on Vercel, which keeps standard
              server logs, such as IP addresses, as part of serving web pages.
            </p>
          </section>

          <section>
            <h2>Contact</h2>
            <p>
              Questions about this policy: open an issue on{" "}
              <a href={SITE.github} className="text-link underline-offset-4 hover:underline">
                GitHub
              </a>
              .
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
