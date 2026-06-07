import { aiSummarizeWorkspaces } from "@/lib/ai-api/extended-queries";
import { guardAiApiRequest } from "@/lib/ai-api/guard";
import { aiApiOk } from "@/lib/ai-api/response";

/** Ringkasan workload semua ruangan (read-only) untuk Odysseus/MCP. */
export async function GET(req: Request) {
  const guard = guardAiApiRequest(req);
  if (!guard.ok) return guard.response;

  const data = await aiSummarizeWorkspaces(guard.ctx.role);
  return aiApiOk(data, guard.ctx.role);
}
