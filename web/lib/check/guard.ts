// Request guards: CORS and best-effort rate limiting.
//
// The limiter is in memory, so on serverless it applies per instance. That is
// enough to stop casual abuse of a class-project API; for real traffic, swap
// in a shared store (e.g. Upstash Redis) behind the same function.

const WINDOW_MS = 5 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = Number(process.env.RATE_LIMIT_PER_5MIN || 20);
const DAILY_CLAIM_LIMIT = Number(process.env.DAILY_CLAIM_LIMIT || 3000);

const hits = new Map<string, number[]>();
let day = new Date().toISOString().slice(0, 10);
let claimsToday = 0;

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] || req.headers.get("x-real-ip") || "unknown").trim();
}

export function rateLimit(ip: string, claimCount: number): { ok: true } | { ok: false; error: string; retryAfter: number } {
  const now = Date.now();
  const today = new Date(now).toISOString().slice(0, 10);
  if (today !== day) {
    day = today;
    claimsToday = 0;
  }
  if (claimsToday + claimCount > DAILY_CLAIM_LIMIT) {
    return { ok: false, error: "The checker has hit its daily limit. Try again tomorrow.", retryAfter: 3600 };
  }
  const list = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfter = Math.ceil((WINDOW_MS - (now - list[0])) / 1000);
    return { ok: false, error: "Too many checks in a short time. Wait a few minutes and try again.", retryAfter };
  }
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.delete(hits.keys().next().value as string);
  claimsToday += claimCount;
  return { ok: true };
}

/** Allows the extension, the site itself, and any origins listed in ALLOWED_ORIGINS. */
export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (!origin) return headers;
  const allowed = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  let sameOrigin = false;
  try {
    sameOrigin = new URL(origin).host === new URL(req.url).host;
  } catch {}
  if (origin.startsWith("chrome-extension://") || sameOrigin || allowed.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}
