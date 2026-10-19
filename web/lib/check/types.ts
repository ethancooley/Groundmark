export type Verdict = "supported" | "not_found" | "contradicted" | "unverifiable";

export type SourceStatus =
  | "ok"
  | "blocked" // refused by our safety rules (private address, bad scheme, etc.)
  | "failed" // network error, timeout, non-2xx
  | "unsupported_type" // PDF, image, etc.
  | "empty"; // fetched but no readable text

export interface ClaimInput {
  id: string;
  text: string;
  sources: string[];
}

export interface CheckRequest {
  claims: ClaimInput[];
}

export interface SourceDoc {
  url: string;
  finalUrl: string;
  status: SourceStatus;
  title?: string;
  passages: Passage[];
  detail?: string;
}

export interface Passage {
  id: string; // e.g. "S2-P5"
  sourceUrl: string;
  text: string;
}

export interface Evidence {
  sourceUrl: string;
  sourceTitle?: string;
  quote: string;
  /** Link that opens the source scrolled to the quote (text fragment). */
  fragmentUrl: string;
  /** False when the judge's quote didn't match the source and we substituted the closest real sentence. */
  verbatim: boolean;
}

export interface ClaimResult {
  id: string;
  claim: string;
  verdict: Verdict;
  /** 0–1. How sure the checker is about the verdict. */
  confidence: number;
  /** True when the source backs part, but not all, of the claim. */
  partial: boolean;
  explanation: string;
  evidence?: Evidence;
  sources: { url: string; status: SourceStatus; title?: string }[];
  mode: "model" | "heuristic";
}

export type StreamEvent =
  | { type: "start"; claims: number; sources: number; mode: "model" | "heuristic" }
  | { type: "source"; url: string; status: SourceStatus; title?: string }
  | { type: "result"; result: ClaimResult }
  | { type: "done"; summary: Record<Verdict, number>; ms: number }
  | { type: "error"; message: string };
