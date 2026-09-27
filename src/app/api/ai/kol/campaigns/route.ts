import { aiGetKolCampaignPerformance } from "@/lib/ai-api/kol-queries";
import { guardAiApiRequest, parseLimitParam } from "@/lib/ai-api/guard";
import { aiApiOk } from "@/lib/ai-api/response";

/** Performa campaign KOL: biaya, views, FYP, CPM, pemakaian budget (read-only). */
export async function GET(req: Request) {
  const guard = guardAiApiRequest(req);
  if (!guard.ok) return guard.response;

  const params = new URL(req.url).searchParams;
  return aiApiOk(
    await aiGetKolCampaignPerformance(guard.ctx.role, {
      campaignId: params.get("campaignId"),
      brandId: params.get("brandId"),
      from: params.get("from"),
      to: params.get("to"),
      limit: parseLimitParam(params.get("limit"), 30, 100),
    }),
    guard.ctx.role,
  );
}
