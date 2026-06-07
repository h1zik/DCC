import { TaskStatus } from "@prisma/client";
import { aiGetUserTasks } from "@/lib/ai-api/user-tasks";
import { guardAiApiRequest } from "@/lib/ai-api/guard";
import { aiApiOk } from "@/lib/ai-api/response";

/** Tugas milik satu user (PIC) — untuk Odysseus/MCP. */
export async function GET(req: Request) {
  const guard = guardAiApiRequest(req);
  if (!guard.ok) return guard.response;

  const params = new URL(req.url).searchParams;
  const userNameOrEmailOrId = params.get("userNameOrEmailOrId")?.trim() ?? "";
  const statusRaw = params.get("status")?.trim();
  const status =
    statusRaw && statusRaw in TaskStatus
      ? (statusRaw as TaskStatus)
      : undefined;

  const limitRaw = Number(params.get("limit"));
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(Math.floor(limitRaw), 100)
      : 50;

  return aiApiOk(
    await aiGetUserTasks(guard.ctx.role, {
      userNameOrEmailOrId,
      status,
      includeDone: params.get("includeDone") === "true",
      limit,
    }),
    guard.ctx.role,
  );
}
