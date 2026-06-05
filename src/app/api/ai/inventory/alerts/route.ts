import { getInventoryAlerts } from "@/lib/ai-api/queries";
import { guardAiApiRequest, parseLimitParam } from "@/lib/ai-api/guard";
import { aiApiOk, aiApiError } from "@/lib/ai-api/response";

const SEVERITIES = new Set(["all", "critical", "low"]);

/**
 * SKU stok rendah/kritis (read-only) untuk integrasi Odysseus/MCP.
 * Query: `?severity=critical|low|all` (default all), `?limit=30` (maks 50)
 */
export async function GET(req: Request) {
  const guard = guardAiApiRequest(req);
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(req.url);
  const severityRaw = (searchParams.get("severity") ?? "all").toLowerCase();
  if (!SEVERITIES.has(severityRaw)) {
    return aiApiError("severity harus all, critical, atau low", 400);
  }

  const limit = parseLimitParam(searchParams.get("limit"), 30, 50);
  const severity = severityRaw as "all" | "critical" | "low";
  const data = await getInventoryAlerts(guard.ctx.role, severity, limit);

  return aiApiOk(
    { items: data, count: data.length, severity, limit },
    guard.ctx.role,
  );
}
