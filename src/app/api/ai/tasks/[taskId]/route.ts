import { aiGetTaskDetail } from "@/lib/ai-api/extended-queries";
import { guardAiApiRequest } from "@/lib/ai-api/guard";
import { aiApiOk } from "@/lib/ai-api/response";

type Params = { taskId: string };

/** Detail tugas (read-only) untuk Odysseus/MCP. */
export async function GET(req: Request, ctx: { params: Promise<Params> }) {
  const guard = guardAiApiRequest(req);
  if (!guard.ok) return guard.response;

  const { taskId } = await ctx.params;
  const data = await aiGetTaskDetail(guard.ctx.role, taskId);
  return aiApiOk(data, guard.ctx.role);
}
