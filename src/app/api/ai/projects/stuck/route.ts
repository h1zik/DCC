import { aiListStuckProjects } from "@/lib/ai-api/strategic-queries";
import { guardAiApiRequest } from "@/lib/ai-api/guard";
import { aiApiOk } from "@/lib/ai-api/response";

export async function GET(req: Request) {
  const guard = guardAiApiRequest(req);
  if (!guard.ok) return guard.response;
  const minDaysRaw = new URL(req.url).searchParams.get("minDaysInStage");
  const minDays = minDaysRaw ? Number(minDaysRaw) : 45;
  return aiApiOk(
    await aiListStuckProjects(
      guard.ctx.role,
      Number.isFinite(minDays) ? minDays : 45,
    ),
    guard.ctx.role,
  );
}
