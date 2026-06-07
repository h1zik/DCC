import { aiGetFinanceSummary } from "@/lib/ai-api/extended-queries";
import { guardAiApiRequest } from "@/lib/ai-api/guard";
import { aiApiOk } from "@/lib/ai-api/response";

/** Ringkasan finance bulan berjalan (read-only) untuk Odysseus/MCP. */
export async function GET(req: Request) {
  const guard = guardAiApiRequest(req);
  if (!guard.ok) return guard.response;

  const params = new URL(req.url).searchParams;
  const yearRaw = params.get("year");
  const monthRaw = params.get("month");
  const year = yearRaw ? Number(yearRaw) : undefined;
  const month = monthRaw ? Number(monthRaw) : undefined;

  const data = await aiGetFinanceSummary(guard.ctx.role, {
    year: Number.isFinite(year) ? year : undefined,
    month: Number.isFinite(month) ? month : undefined,
  });

  return aiApiOk(data, guard.ctx.role);
}
