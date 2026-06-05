import { getKpiOverview } from "@/lib/ai-api/queries";
import { guardAiApiRequest } from "@/lib/ai-api/guard";
import { aiApiOk } from "@/lib/ai-api/response";

/**
 * Ringkasan KPI operasional DCC (read-only) untuk integrasi Odysseus/MCP.
 * Auth: `Authorization: Bearer <AI_READ_API_TOKEN>`
 * Role opsional: `x-dcc-role: CEO|LOGISTICS|FINANCE|STUDIO|ADMINISTRATOR|ALL`
 */
export async function GET(req: Request) {
  const guard = guardAiApiRequest(req);
  if (!guard.ok) return guard.response;

  const data = await getKpiOverview(guard.ctx.role);
  return aiApiOk(data, guard.ctx.role);
}
