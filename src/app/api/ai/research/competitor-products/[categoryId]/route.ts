import { aiGetCompetitorProductCategory } from "@/lib/ai-api/research-queries";
import { guardAiApiRequest } from "@/lib/ai-api/guard";
import { aiApiOk } from "@/lib/ai-api/response";

type Params = { categoryId: string };

export async function GET(req: Request, ctx: { params: Promise<Params> }) {
  const guard = guardAiApiRequest(req);
  if (!guard.ok) return guard.response;
  const { categoryId } = await ctx.params;
  return aiApiOk(
    await aiGetCompetitorProductCategory(guard.ctx.role, categoryId),
    guard.ctx.role,
  );
}
