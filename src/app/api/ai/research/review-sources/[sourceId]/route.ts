import { aiGetReviewIntelSource } from "@/lib/ai-api/research-queries";
import { guardAiApiRequest } from "@/lib/ai-api/guard";
import { aiApiOk } from "@/lib/ai-api/response";

type Params = { sourceId: string };

export async function GET(req: Request, ctx: { params: Promise<Params> }) {
  const guard = guardAiApiRequest(req);
  if (!guard.ok) return guard.response;
  const { sourceId } = await ctx.params;
  return aiApiOk(
    await aiGetReviewIntelSource(guard.ctx.role, sourceId),
    guard.ctx.role,
  );
}
