import type { VerdictKey } from "@/lib/site";

const PATHS: Record<VerdictKey | "pending", React.ReactNode> = {
  pending: <circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="20 12" />,
  supported: (
    <path d="M4.5 8.4 7 10.8l4.6-5.3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  ),
  not_found: (
    <>
      <path d="M6.2 6.2a1.9 1.9 0 1 1 2.6 1.8c-.5.2-.8.6-.8 1.1v.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="8" cy="11.6" r="1" fill="currentColor" />
    </>
  ),
  contradicted: <path d="m5.3 5.3 5.4 5.4m0-5.4-5.4 5.4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
  unverifiable: <path d="M5 8h6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
};

export const VERDICT_BG: Record<VerdictKey | "pending", string> = {
  pending: "var(--v-unverifiable)",
  supported: "var(--v-supported)",
  not_found: "var(--v-not-found)",
  contradicted: "var(--v-contradicted)",
  unverifiable: "var(--v-unverifiable)",
};

export function VerdictIcon({
  verdict,
  size = 18,
  className = "",
  spin = false,
}: {
  verdict: VerdictKey | "pending";
  size?: number;
  className?: string;
  spin?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-grid shrink-0 place-items-center rounded-full text-white ${className}`}
      style={{ width: size, height: size, background: VERDICT_BG[verdict] }}
    >
      <svg viewBox="0 0 16 16" width={size * 0.78} height={size * 0.78} className={spin ? "animate-spin" : undefined}>
        {PATHS[verdict]}
      </svg>
    </span>
  );
}
