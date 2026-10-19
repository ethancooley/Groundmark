import type { CheckRequest } from "./types";
import { LIMITS } from "./pipeline";

/** Unwraps Google redirect links and drops links back to Google itself. */
export function cleanSourceUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const isGoogle = /(^|\.)google\.[a-z.]+$/i.test(url.hostname);
  if (isGoogle && url.pathname === "/url") {
    const target = url.searchParams.get("q") || url.searchParams.get("url");
    return target ? cleanSourceUrl(target) : null;
  }
  if (isGoogle) return null;
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  // Text fragments and anchors don't change the page, so drop them for caching.
  url.hash = "";
  return url.toString();
}

export function parseCheckRequest(body: unknown): { ok: true; value: CheckRequest } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || !Array.isArray((body as { claims?: unknown }).claims)) {
    return { ok: false, error: "Send a JSON body with a claims array." };
  }
  const rawClaims = (body as { claims: unknown[] }).claims;
  if (rawClaims.length === 0) return { ok: false, error: "Add at least one claim to check." };
  if (rawClaims.length > LIMITS.maxClaims) {
    return { ok: false, error: `Check up to ${LIMITS.maxClaims} claims at a time.` };
  }
  const claims: CheckRequest["claims"] = [];
  for (const [i, c] of rawClaims.entries()) {
    if (!c || typeof c !== "object") return { ok: false, error: `Claim ${i + 1} isn't an object.` };
    const { id, text, sources } = c as Record<string, unknown>;
    if (typeof text !== "string" || text.trim().length < 8) {
      return { ok: false, error: `Claim ${i + 1} needs at least a few words of text.` };
    }
    if (!Array.isArray(sources)) return { ok: false, error: `Claim ${i + 1} needs a sources array.` };
    const cleaned = Array.from(
      new Set(
        sources
          .filter((s): s is string => typeof s === "string" && s.length <= 2048)
          .map(cleanSourceUrl)
          .filter((s): s is string => s !== null),
      ),
    );
    claims.push({
      id: typeof id === "string" && id.length <= 64 ? id : `c${i + 1}`,
      text: text.trim().slice(0, LIMITS.maxClaimChars),
      sources: cleaned.slice(0, LIMITS.maxSourcesPerClaim),
    });
  }
  return { ok: true, value: { claims } };
}
