// The link preview image (Open Graph / Twitter card) shown when a Groundmark
// page is shared in iMessage, Slack, X, LinkedIn, and so on. Rendered once at
// build time by next/og, which supports flexbox and a subset of CSS.
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const OG_SIZE = { width: 1200, height: 630 };

const fonts = join(process.cwd(), "node_modules/@fontsource");
const [display, text, textMedium, icon] = await Promise.all([
  readFile(join(fonts, "inter-tight/files/inter-tight-latin-700-normal.woff")),
  readFile(join(fonts, "inter/files/inter-latin-400-normal.woff")),
  readFile(join(fonts, "inter/files/inter-latin-500-normal.woff")),
  readFile(join(process.cwd(), "app/icon.png")),
]);
const iconSrc = `data:image/png;base64,${icon.toString("base64")}`;

const C = {
  paper: "#f5f7fa",
  ink: "#0f2240",
  slate: "#5b6b85",
  line: "rgba(15, 34, 64, 0.1)",
  highlighter: "#ffe14d",
  supported: "#12a150",
  notFound: "#e8590c",
  contradicted: "#e5383b",
};

const GLYPHS = {
  supported: <path d="m4.6 8.3 2.2 2.2 4.6-5" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  not_found: (
    <>
      <path d="M6.2 6.2a1.9 1.9 0 1 1 2.6 1.8c-.5.2-.8.6-.8 1.1v.4" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="8" cy="11.6" r="1" fill="#fff" />
    </>
  ),
  contradicted: <path d="m5.3 5.3 5.4 5.4m0-5.4-5.4 5.4" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />,
};
const COLORS = { supported: C.supported, not_found: C.notFound, contradicted: C.contradicted };

function Badge({ verdict }: { verdict: keyof typeof GLYPHS }) {
  return (
    <div
      style={{
        display: "flex",
        width: 30,
        height: 30,
        borderRadius: 15,
        background: COLORS[verdict],
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        boxShadow: "0 0 0 3px #fff",
      }}
    >
      <svg width="20" height="20" viewBox="0 0 16 16">
        {GLYPHS[verdict]}
      </svg>
    </div>
  );
}

function Sentence({ text, verdict }: { text: string; verdict: keyof typeof GLYPHS }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
      <div
        style={{
          display: "flex",
          flex: 1,
          fontSize: 23,
          lineHeight: 1.4,
          color: C.ink,
          paddingBottom: 6,
          borderBottom: `3px dashed ${COLORS[verdict]}`,
        }}
      >
        {text}
      </div>
      <Badge verdict={verdict} />
    </div>
  );
}

/** A small AI Overview with one sentence of each verdict: the product, at a glance. */
function OverviewCard() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: 450,
        padding: "30px 32px 34px",
        gap: 22,
        background: "#fff",
        borderRadius: 30,
        border: `1px solid ${C.line}`,
        boxShadow: "0 30px 60px -20px rgba(15, 34, 64, 0.25)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 20, color: C.ink, fontWeight: 500 }}>
        <svg width="22" height="22" viewBox="0 0 20 20">
          <path d="M10 1.5c.6 4.4 2.6 6.9 8.5 8.5-5.9 1.6-7.9 4.1-8.5 8.5-.6-4.4-2.6-6.9-8.5-8.5 5.9-1.6 7.9-4.1 8.5-8.5Z" fill="#4285f4" />
        </svg>
        AI Overview
      </div>
      <Sentence text="Up to 400 mg of caffeine a day is safe for most adults." verdict="supported" />
      <Sentence text="That’s about eight cups of brewed coffee." verdict="contradicted" />
      <Sentence text="Teens should keep it under 100 mg a day." verdict="not_found" />
    </div>
  );
}

/**
 * @param kicker small label above the headline (e.g. "Methodology"); omit on the home page
 * @param headline the big line; the part after "|" gets the highlighter
 */
export function ogImage({
  kicker,
  headline,
  sub,
  headlineSize = 58,
}: {
  kicker?: string;
  headline: string;
  sub: string;
  headlineSize?: number;
}) {
  const [plain, marked] = headline.split("|");
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: C.paper,
          padding: "60px 64px 56px 72px",
          fontFamily: "Inter",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", width: 580, height: "100%", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
            <img src={iconSrc} width={56} height={56} />
            <div style={{ display: "flex", fontFamily: "Inter Tight", fontSize: 34, color: C.ink, letterSpacing: -0.8 }}>Groundmark</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {kicker && (
              <div style={{ display: "flex", fontSize: 24, fontWeight: 500, color: C.slate, textTransform: "uppercase", letterSpacing: 2 }}>
                {kicker}
              </div>
            )}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                fontFamily: "Inter Tight",
                fontSize: headlineSize,
                lineHeight: 1.12,
                letterSpacing: -1.8,
                color: C.ink,
              }}
            >
              {/* Word by word, so wrapping works and the marked words each get a highlighter stroke. */}
              {plain
                .trim()
                .split(" ")
                .map((w, i) => (
                  <span key={`p${i}`} style={{ marginRight: Math.round(headlineSize * 0.26) }}>
                    {w}
                  </span>
                ))}
              {/* The highlighted phrase starts on its own line. */}
              {marked && <div style={{ display: "flex", flexBasis: "100%", height: 0 }} />}
              {(marked || "")
                .trim()
                .split(" ")
                .filter(Boolean)
                .map((w, i, all) => (
                  <span
                    key={`m${i}`}
                    style={{
                      // Padding, not margin, so the highlighter runs through the space between words.
                      paddingRight: i < all.length - 1 ? Math.round(headlineSize * 0.26) : 0,
                      backgroundImage: `linear-gradient(to bottom, transparent 52%, ${C.highlighter} 52%, ${C.highlighter} 92%, transparent 92%)`,
                    }}
                  >
                    {w}
                  </span>
                ))}
            </div>
            <div style={{ display: "flex", fontSize: 25, lineHeight: 1.4, color: C.slate, maxWidth: 520 }}>{sub}</div>
          </div>
          <div style={{ display: "flex", fontSize: 22, fontWeight: 500, color: C.slate }}>groundmark.dev</div>
        </div>
        <OverviewCard />
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: "Inter Tight", data: display, weight: 700, style: "normal" },
        { name: "Inter", data: text, weight: 400, style: "normal" },
        { name: "Inter", data: textMedium, weight: 500, style: "normal" },
      ],
    },
  );
}
