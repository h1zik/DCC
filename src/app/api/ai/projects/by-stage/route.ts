import { aiListProjectsByPipelineStage } from "@/lib/ai-api/strategic-queries";
import { guardAiApiRequest } from "@/lib/ai-api/guard";
import { aiApiOk } from "@/lib/ai-api/response";

export async function GET(req: Request) {
  const guard = guardAiApiRequest(req);
  if (!guard.ok) return guard.response;
  return aiApiOk(
    await aiListProjectsByPipelineStage(guard.ctx.role),
    guard.ctx.role,
  );
}
