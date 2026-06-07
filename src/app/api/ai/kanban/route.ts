import { aiGetKanbanBoard } from "@/lib/ai-api/extended-queries";
import { guardAiApiRequest } from "@/lib/ai-api/guard";
import { aiApiOk, aiApiError } from "@/lib/ai-api/response";

/** Papan Kanban ruangan (read-only) untuk Odysseus/MCP. */
export async function GET(req: Request) {
  const guard = guardAiApiRequest(req);
  if (!guard.ok) return guard.response;

  const params = new URL(req.url).searchParams;
  const roomNameOrId = params.get("roomNameOrId")?.trim();
  if (!roomNameOrId) {
    return aiApiError("Query roomNameOrId wajib diisi.", 400);
  }

  const data = await aiGetKanbanBoard(
    guard.ctx.role,
    roomNameOrId,
    params.get("processPhaseNameOrId"),
  );
  return aiApiOk(data, guard.ctx.role);
}
