import { aiGetWikiPage } from "@/lib/ai-api/extended-queries";
import { guardAiApiRequest } from "@/lib/ai-api/guard";
import { aiApiOk } from "@/lib/ai-api/response";

type Params = { pageId: string };

/** Baca satu halaman wiki ruangan (read-only) untuk Odysseus/MCP. */
export async function GET(req: Request, ctx: { params: Promise<Params> }) {
  const guard = guardAiApiRequest(req);
  if (!guard.ok) return guard.response;

  const { pageId } = await ctx.params;
  const data = await aiGetWikiPage(guard.ctx.role, pageId);
  return aiApiOk(data, guard.ctx.role);
}
