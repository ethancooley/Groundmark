import { judgeMode, modelName } from "@/lib/check/judge";
import { corsHeaders } from "@/lib/check/guard";


export async function GET(req: Request) {
  const mode = judgeMode();
  return new Response(JSON.stringify({ ok: true, mode, model: mode === "model" ? modelName() : null }), {
    headers: { "content-type": "application/json", "cache-control": "no-store", ...corsHeaders(req) },
  });
}

export function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}
