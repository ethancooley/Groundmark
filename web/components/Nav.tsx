import { SITE } from "@/lib/site";

export function Mark({ size = 26 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-grid shrink-0 place-items-center rounded-[28%] bg-ink"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 16 16" width={size * 0.86} height={size * 0.86}>
        <rect x="3" y="9" width="10" height="2.6" rx="1" fill="#ffe14d" />
        <path d="M4.6 8 7 10.4 11.6 5" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function Nav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-line/60 bg-paper/72 backdrop-blur-xl backdrop-saturate-150">
      <nav className="wrap flex h-14 items-center gap-6" aria-label="Main">
        <a href="#top" className="flex items-center gap-2.5 text-[15px] font-semibold tracking-[-0.01em]">
          <Mark />
          {SITE.name}
        </a>
        <div className="ml-auto hidden items-center gap-7 text-[14px] text-ink-soft md:flex">
          <a href="#how" className="hover:text-ink">
            How it works
          </a>
          <a href="#evidence" className="hover:text-ink">
            The problem
          </a>
          <a href="#try" className="hover:text-ink">
            Try it
          </a>
          <a href="#responsible" className="hover:text-ink">
            Privacy
          </a>
          <a href="/methodology" className="hover:text-ink">
            Methodology
          </a>
        </div>
        <a
          href="#install"
          className="ml-auto rounded-full bg-ink px-4 py-1.5 text-[13.5px] font-semibold text-white md:ml-0"
        >
          Install
        </a>
      </nav>
    </header>
  );
}
