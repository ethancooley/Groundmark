import { runCheck } from "@/lib/check/pipeline";
import { parseCheckRequest } from "@/lib/check/request";
import { clientIp, corsHeaders, rateLimit } from "@/lib/check/guard";
import type { StreamEvent } from "@/lib/check/types";

export const maxDuration = 60;

const MAX_BODY_BYTES = 64_000;

function json(req: Request, status: number, body: unknown, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders(req), ...extra },
  });
}

export function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

/**
 * POST { claims: [{ id, text, sources: [url] }] }
 * Streams newline-delimited JSON events (see StreamEvent) so results appear
 * one claim at a time instead of after the slowest page loads.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json(req, 413, { error: "That request is too large." });

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(req, 400, { error: "The request body isn't valid JSON." });
  }
  const parsed = parseCheckRequest(body);
  if (!parsed.ok) return json(req, 400, { error: parsed.error });

  const limit = rateLimit(clientIp(req), parsed.value.claims.length);
  if (!limit.ok) return json(req, 429, { error: limit.error }, { "retry-after": String(limit.retryAfter) });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (e: StreamEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        await runCheck(parsed.value, emit);
      } catch (e) {
        console.error(e);
        emit({ type: "error", message: "The checker hit an unexpected error. Try again." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...corsHeaders(req),
    },
  });
}
