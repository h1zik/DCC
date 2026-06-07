import { aiAnalyzeRoomWorkload } from "@/lib/ai-api/extended-queries";
import { guardAiApiRequest } from "@/lib/ai-api/guard";
import { aiApiOk, aiApiError } from "@/lib/ai-api/response";

/** Analisis workload satu ruangan (read-only) untuk Odysseus/MCP. */
export async function GET(req: Request) {
  const guard = guardAiApiRequest(req);
  if (!guard.ok) return guard.response;

  const roomNameOrId = new URL(req.url).searchParams.get("roomNameOrId")?.trim();
  if (!roomNameOrId) {
    return aiApiError("Query roomNameOrId wajib diisi.", 400);
  }

  const data = await aiAnalyzeRoomWorkload(guard.ctx.role, roomNameOrId);
  return aiApiOk(data, guard.ctx.role);
}
