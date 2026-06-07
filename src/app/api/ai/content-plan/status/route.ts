import { aiGetContentPlanStatus } from "@/lib/ai-api/strategic-queries";
import { guardAiApiRequest } from "@/lib/ai-api/guard";
import { aiApiOk } from "@/lib/ai-api/response";

export async function GET(req: Request) {
  const guard = guardAiApiRequest(req);
  if (!guard.ok) return guard.response;
  const roomNameOrId =
    new URL(req.url).searchParams.get("roomNameOrId") ?? undefined;
  return aiApiOk(
    await aiGetContentPlanStatus(guard.ctx.role, roomNameOrId),
    guard.ctx.role,
  );
}
