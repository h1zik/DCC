import { aiGetKeywordQuery } from "@/lib/ai-api/research-queries";
import { guardAiApiRequest } from "@/lib/ai-api/guard";
import { aiApiOk } from "@/lib/ai-api/response";

type Params = { queryId: string };

export async function GET(req: Request, ctx: { params: Promise<Params> }) {
  const guard = guardAiApiRequest(req);
  if (!guard.ok) return guard.response;
  const { queryId } = await ctx.params;
  return aiApiOk(await aiGetKeywordQuery(guard.ctx.role, queryId), guard.ctx.role);
}
