import { aiListResearchCompetitors } from "@/lib/ai-api/research-queries";
import { guardAiApiRequest, parseLimitParam } from "@/lib/ai-api/guard";
import { aiApiOk } from "@/lib/ai-api/response";

export async function GET(req: Request) {
  const guard = guardAiApiRequest(req);
  if (!guard.ok) return guard.response;
  const limit = parseLimitParam(
    new URL(req.url).searchParams.get("limit"),
    40,
    50,
  );
  return aiApiOk(
    await aiListResearchCompetitors(guard.ctx.role, limit),
    guard.ctx.role,
  );
}
