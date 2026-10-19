export const SITE = {
  name: "Overview Check",
  tagline: "Google's AI cites its sources. Overview Check reads them.",
  description:
    "A Chrome extension that checks each sentence of a Google AI Overview against the pages it cites, and shows you the evidence.",
  author: "Ethan Cooley",
  authorUrl: "https://ethancooley.com",
  course: "Responsible AI, Duke University AI for Product Innovation (AIPI)",
  github: "https://github.com/ethancooley/overview-check",
  download: "/overview-check-extension.zip",
};

export type VerdictKey = "supported" | "not_found" | "contradicted" | "unverifiable";

export const VERDICT_META: Record<VerdictKey, { label: string; short: string; color: string; meaning: string }> = {
  supported: {
    label: "Supported",
    short: "Supported",
    color: "var(--v-supported)",
    meaning: "The cited page says it, or it follows directly. Every number, name, and qualifier matches.",
  },
  not_found: {
    label: "Not found in its source",
    short: "Not in source",
    color: "var(--v-not-found)",
    meaning: "The cited page doesn't back the specifics. It may be true, but Google's own citation doesn't show it.",
  },
  contradicted: {
    label: "Contradicted by its source",
    short: "Contradicted",
    color: "var(--v-contradicted)",
    meaning: "The cited page says something that conflicts with the sentence.",
  },
  unverifiable: {
    label: "Couldn't check",
    short: "Couldn't check",
    color: "var(--v-unverifiable)",
    meaning: "The page was a PDF, blocked, paywalled, or missing, so no verdict is given.",
  },
};

/** Published research behind the problem statement. Keep numbers exactly as reported. */
export const STATS = [
  {
    figure: "52%",
    claim: "of AI Overviews had at least one claim their cited sources didn't support.",
    detail: "Only 39% were both correct and fully supported by the pages they linked.",
    source: "Oumi analysis of 1,609 Gemini 3 AI Overviews, April 2026",
    url: "https://oumi.ai/blog/oumis-study-finds-50-of-ai-overviews",
  },
  {
    figure: "1 in 9",
    claim: "claims in AI Overviews weren't backed by the source Google attributed them to.",
    detail: "11% of 98,020 claims across 7,583 Overviews; 4.1% were directly contradicted by their source.",
    source: "Washington University in St. Louis study (arXiv:2605.14021), as summarized by Something Inc.",
    url: "https://somethinginc.com/blog/ai-citation-doesnt-mean-what-you-think/",
  },
  {
    figure: "8%",
    claim: "of visits with an AI summary ended in a click on a search result.",
    detail: "Without a summary, people clicked a result in 15% of visits. Fewer clicks means fewer people checking.",
    source: "Pew Research Center, browsing data from 900 U.S. adults, July 2025",
    url: "https://www.pewresearch.org/short-reads/2025/07/22/google-users-are-less-likely-to-click-on-links-when-an-ai-summary-appears-in-the-results/",
  },
];

/**
 * An illustrative Overview used on the landing page. The sentences are written
 * for the demo; the evidence quotes are verbatim from the real cited pages.
 */
export const EXAMPLE = {
  query: "how much caffeine is safe per day",
  sentences: [
    {
      text: "Up to 400 milligrams of caffeine a day is considered safe for most adults.",
      verdict: "supported" as VerdictKey,
      explanation: "The FDA page states the 400 mg daily level is safe for most adults.",
      quote: "confirmed the safety of the 400 milligrams a day level for most adults.",
      site: "U.S. Food and Drug Administration",
      host: "fda.gov",
    },
    {
      text: "That's about the amount in eight cups of brewed coffee.",
      verdict: "contradicted" as VerdictKey,
      explanation: "The page says 400 mg is about four cups of brewed coffee, not eight.",
      quote:
        "That's about the amount of caffeine in four cups of brewed coffee, 10 cans of cola or two \"energy shot\" drinks.",
      site: "Mayo Clinic",
      host: "mayoclinic.org",
    },
    {
      text: "Children and teens should keep caffeine under 100 milligrams a day.",
      verdict: "not_found" as VerdictKey,
      explanation: "The page discusses caffeine and children but never gives a 100 mg limit.",
      quote: "drinks containing caffeine should be avoided for children younger than age 2",
      site: "U.S. Food and Drug Administration",
      host: "fda.gov",
    },
    {
      text: "Energy drinks often pack more caffeine than their labels suggest.",
      verdict: "unverifiable" as VerdictKey,
      explanation: "The cited source is a PDF, which Overview Check can't read yet.",
      quote: "",
      site: "Linked report (PDF)",
      host: "",
    },
  ],
};
