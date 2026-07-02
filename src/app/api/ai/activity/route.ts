import { aiGetRecentActivity } from "@/lib/ai-api/strategic-queries";
import { guardAiApiRequest, parseLimitParam } from "@/lib/ai-api/guard";
import { aiApiOk } from "@/lib/ai-api/response";

/**
 * Change feed lintas modul (read-only) untuk integrasi MCP.
 * Query: `?days=7&limit=40`
 */
export async function GET(req: Request) {
  const guard = guardAiApiRequest(req);
  if (!guard.ok) return guard.response;

  const params = new URL(req.url).searchParams;
  const days = parseLimitParam(params.get("days"), 7, 30);
  const limit = parseLimitParam(params.get("limit"), 40, 80);

  return aiApiOk(
    await aiGetRecentActivity(guard.ctx.role, { days, limit }),
    guard.ctx.role,
  );
}
