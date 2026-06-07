import { aiListPendingFinanceSpend } from "@/lib/ai-api/extended-queries";
import { guardAiApiRequest, parseLimitParam } from "@/lib/ai-api/guard";
import { aiApiOk } from "@/lib/ai-api/response";

/** Pengeluaran menunggu persetujuan finance (read-only) untuk Odysseus/MCP. */
export async function GET(req: Request) {
  const guard = guardAiApiRequest(req);
  if (!guard.ok) return guard.response;

  const limit = parseLimitParam(
    new URL(req.url).searchParams.get("limit"),
    20,
    50,
  );
  const data = await aiListPendingFinanceSpend(guard.ctx.role, limit);
  return aiApiOk(data, guard.ctx.role);
}
