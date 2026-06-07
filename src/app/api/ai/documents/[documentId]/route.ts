import { aiGetRoomDocumentContent } from "@/lib/ai-api/room-documents";
import { guardAiApiRequest } from "@/lib/ai-api/guard";
import { aiApiOk } from "@/lib/ai-api/response";

/** Baca isi teks dokumen ruangan (PDF, DOCX, TXT, dll.) — read-only untuk Odysseus/MCP. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ documentId: string }> },
) {
  const guard = guardAiApiRequest(_req);
  if (!guard.ok) return guard.response;

  const { documentId } = await ctx.params;
  return aiApiOk(
    await aiGetRoomDocumentContent(guard.ctx.role, documentId),
    guard.ctx.role,
  );
}
