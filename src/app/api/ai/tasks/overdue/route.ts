import { getOverdueTasks } from "@/lib/ai-api/queries";
import { guardAiApiRequest, parseLimitParam } from "@/lib/ai-api/guard";
import { aiApiOk } from "@/lib/ai-api/response";

/**
 * Daftar tugas overdue (read-only) untuk integrasi Odysseus/MCP.
 * Query: `?limit=20` (maks 50)
 */
export async function GET(req: Request) {
  const guard = guardAiApiRequest(req);
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(req.url);
  const limit = parseLimitParam(searchParams.get("limit"), 20, 50);
  const data = await getOverdueTasks(guard.ctx.role, limit);

  return aiApiOk({ items: data, count: data.length, limit }, guard.ctx.role);
}
