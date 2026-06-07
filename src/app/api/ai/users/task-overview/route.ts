import { aiGetUsersTaskOverview } from "@/lib/ai-api/user-tasks";
import { guardAiApiRequest, parseLimitParam } from "@/lib/ai-api/guard";
import { aiApiOk } from "@/lib/ai-api/response";

/** Ringkasan jumlah & judul tugas per user — untuk Odysseus/MCP. */
export async function GET(req: Request) {
  const guard = guardAiApiRequest(req);
  if (!guard.ok) return guard.response;

  const params = new URL(req.url).searchParams;

  return aiApiOk(
    await aiGetUsersTaskOverview(guard.ctx.role, {
      includeTaskTitles: params.get("includeTaskTitles") === "true",
      tasksPerUser: parseLimitParam(params.get("tasksPerUser"), 8, 20),
      limit: parseLimitParam(params.get("limit"), 50, 80),
      activeOnly: params.get("activeOnly") !== "false",
    }),
    guard.ctx.role,
  );
}
