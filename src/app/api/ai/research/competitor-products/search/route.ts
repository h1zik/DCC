import { aiSearchCompetitorProducts } from "@/lib/ai-api/research-queries";
import { guardAiApiRequest, parseLimitParam } from "@/lib/ai-api/guard";
import { aiApiOk } from "@/lib/ai-api/response";

export async function GET(req: Request) {
  const guard = guardAiApiRequest(req);
  if (!guard.ok) return guard.response;
  const params = new URL(req.url).searchParams;
  const limit = parseLimitParam(params.get("limit"), 30, 50);
  return aiApiOk(
    await aiSearchCompetitorProducts(
      guard.ctx.role,
      params.get("query") ?? "",
      limit,
    ),
    guard.ctx.role,
  );
}
