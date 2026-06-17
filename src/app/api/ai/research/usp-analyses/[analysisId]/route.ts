import { aiGetUspAnalysis } from "@/lib/ai-api/research-queries";
import { guardAiApiRequest } from "@/lib/ai-api/guard";
import { aiApiOk } from "@/lib/ai-api/response";

type Params = { analysisId: string };

export async function GET(req: Request, ctx: { params: Promise<Params> }) {
  const guard = guardAiApiRequest(req);
  if (!guard.ok) return guard.response;
  const { analysisId } = await ctx.params;
  return aiApiOk(await aiGetUspAnalysis(guard.ctx.role, analysisId), guard.ctx.role);
}
