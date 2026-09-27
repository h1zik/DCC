import { aiListKolSchedules } from "@/lib/ai-api/kol-queries";
import { guardAiApiRequest, parseLimitParam } from "@/lib/ai-api/guard";
import { aiApiOk } from "@/lib/ai-api/response";

/** Jadwal/slot konten KOL + biaya, views, CPM, status bayar (read-only). */
export async function GET(req: Request) {
  const guard = guardAiApiRequest(req);
  if (!guard.ok) return guard.response;

  const params = new URL(req.url).searchParams;
  return aiApiOk(
    await aiListKolSchedules(guard.ctx.role, {
      status: params.get("status"),
      brandId: params.get("brandId"),
      campaignId: params.get("campaignId"),
      kolId: params.get("kolId"),
      from: params.get("from"),
      to: params.get("to"),
      limit: parseLimitParam(params.get("limit"), 50, 200),
    }),
    guard.ctx.role,
  );
}
