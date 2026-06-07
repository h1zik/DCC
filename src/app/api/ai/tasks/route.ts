import { TaskStatus } from "@prisma/client";
import { aiListTasks } from "@/lib/ai-api/extended-queries";
import { guardAiApiRequest, parseLimitParam } from "@/lib/ai-api/guard";
import { aiApiOk } from "@/lib/ai-api/response";

/** Daftar tugas dengan filter (read-only) untuk Odysseus/MCP. */
export async function GET(req: Request) {
  const guard = guardAiApiRequest(req);
  if (!guard.ok) return guard.response;

  const params = new URL(req.url).searchParams;
  const statusRaw = params.get("status")?.trim();
  const status =
    statusRaw && statusRaw in TaskStatus
      ? (statusRaw as TaskStatus)
      : undefined;

  const data = await aiListTasks(guard.ctx.role, {
    roomNameOrId: params.get("roomNameOrId") ?? undefined,
    status,
    search: params.get("search") ?? undefined,
    assigneeNameOrEmailOrId:
      params.get("assigneeNameOrEmailOrId") ??
      params.get("assignee") ??
      undefined,
    limit: parseLimitParam(params.get("limit"), 30, 50),
  });

  return aiApiOk(data, guard.ctx.role);
}
