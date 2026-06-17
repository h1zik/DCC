import { aiGetResearchReport } from "@/lib/ai-api/research-queries";
import { guardAiApiRequest } from "@/lib/ai-api/guard";
import { aiApiOk } from "@/lib/ai-api/response";

type Params = { reportId: string };

export async function GET(req: Request, ctx: { params: Promise<Params> }) {
  const guard = guardAiApiRequest(req);
  if (!guard.ok) return guard.response;
  const { reportId } = await ctx.params;
  return aiApiOk(await aiGetResearchReport(guard.ctx.role, reportId), guard.ctx.role);
}
