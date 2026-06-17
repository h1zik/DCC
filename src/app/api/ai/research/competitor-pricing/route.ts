import { aiAnalyzeCompetitorPricing } from "@/lib/ai-api/research-queries";
import { guardAiApiRequest, parseLimitParam } from "@/lib/ai-api/guard";
import { aiApiOk } from "@/lib/ai-api/response";

export async function GET(req: Request) {
  const guard = guardAiApiRequest(req);
  if (!guard.ok) return guard.response;

  const params = new URL(req.url).searchParams;
  const productQuery = params.get("productQuery")?.trim() || undefined;
  const competitorId = params.get("competitorId")?.trim() || undefined;
  const activeOnly = params.get("activeOnly") !== "false";
  const limit = parseLimitParam(params.get("limit"), 50, 80);

  return aiApiOk(
    await aiAnalyzeCompetitorPricing(guard.ctx.role, {
      productQuery,
      competitorId,
      activeOnly,
      limit,
    }),
    guard.ctx.role,
  );
}
