import { aiGetProductConcept } from "@/lib/ai-api/research-queries";
import { guardAiApiRequest } from "@/lib/ai-api/guard";
import { aiApiOk } from "@/lib/ai-api/response";

type Params = { conceptId: string };

export async function GET(req: Request, ctx: { params: Promise<Params> }) {
  const guard = guardAiApiRequest(req);
  if (!guard.ok) return guard.response;
  const { conceptId } = await ctx.params;
  return aiApiOk(await aiGetProductConcept(guard.ctx.role, conceptId), guard.ctx.role);
}
