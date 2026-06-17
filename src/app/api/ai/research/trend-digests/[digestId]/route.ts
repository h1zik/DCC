import { aiGetTrendDigest } from "@/lib/ai-api/research-queries";
import { guardAiApiRequest } from "@/lib/ai-api/guard";
import { aiApiOk } from "@/lib/ai-api/response";

type Params = { digestId: string };

export async function GET(req: Request, ctx: { params: Promise<Params> }) {
  const guard = guardAiApiRequest(req);
  if (!guard.ok) return guard.response;
  const { digestId } = await ctx.params;
  return aiApiOk(await aiGetTrendDigest(guard.ctx.role, digestId), guard.ctx.role);
}
