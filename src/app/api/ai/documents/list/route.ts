import { aiListRoomDocuments } from "@/lib/ai-api/room-documents";
import { guardAiApiRequest, parseLimitParam } from "@/lib/ai-api/guard";
import { aiApiOk } from "@/lib/ai-api/response";

/** Daftar dokumen ruangan (tanpa keyword) — read-only untuk Odysseus/MCP. */
export async function GET(req: Request) {
  const guard = guardAiApiRequest(req);
  if (!guard.ok) return guard.response;

  const params = new URL(req.url).searchParams;
  return aiApiOk(
    await aiListRoomDocuments(guard.ctx.role, {
      roomNameOrId: params.get("roomNameOrId") ?? undefined,
      limit: parseLimitParam(params.get("limit"), 30, 60),
    }),
    guard.ctx.role,
  );
}
