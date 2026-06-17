import { aiGetSocialMonitor } from "@/lib/ai-api/research-queries";
import { guardAiApiRequest } from "@/lib/ai-api/guard";
import { aiApiOk } from "@/lib/ai-api/response";

type Params = { monitorId: string };

export async function GET(req: Request, ctx: { params: Promise<Params> }) {
  const guard = guardAiApiRequest(req);
  if (!guard.ok) return guard.response;
  const { monitorId } = await ctx.params;
  return aiApiOk(await aiGetSocialMonitor(guard.ctx.role, monitorId), guard.ctx.role);
}
