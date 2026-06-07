import { aiSearchDocuments } from "@/lib/ai-api/extended-queries";
import { guardAiApiRequest, parseLimitParam } from "@/lib/ai-api/guard";
import { aiApiOk, aiApiError } from "@/lib/ai-api/response";

/** Cari dokumen ruangan (read-only) untuk Odysseus/MCP. */
export async function GET(req: Request) {
  const guard = guardAiApiRequest(req);
  if (!guard.ok) return guard.response;

  const params = new URL(req.url).searchParams;
  const q = params.get("q")?.trim();
  if (!q) {
    return aiApiError("Query q wajib diisi.", 400);
  }

  const data = await aiSearchDocuments(guard.ctx.role, {
    q,
    roomNameOrId: params.get("roomNameOrId") ?? undefined,
    limit: parseLimitParam(params.get("limit"), 20, 40),
  });

  return aiApiOk(data, guard.ctx.role);
}
