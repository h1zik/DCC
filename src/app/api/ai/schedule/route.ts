import { aiGetSchedule } from "@/lib/ai-api/extended-queries";
import { guardAiApiRequest, parseLimitParam } from "@/lib/ai-api/guard";
import { aiApiOk } from "@/lib/ai-api/response";

/** Jadwal umum mendatang (read-only) untuk Odysseus/MCP. */
export async function GET(req: Request) {
  const guard = guardAiApiRequest(req);
  if (!guard.ok) return guard.response;

  const params = new URL(req.url).searchParams;
  const daysRaw = params.get("daysAhead");
  const daysAhead = daysRaw ? Number(daysRaw) : undefined;

  const data = await aiGetSchedule(guard.ctx.role, {
    daysAhead: Number.isFinite(daysAhead) ? daysAhead : undefined,
    limit: parseLimitParam(params.get("limit"), 30, 50),
  });

  return aiApiOk(data, guard.ctx.role);
}
