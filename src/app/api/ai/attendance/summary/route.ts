import { aiGetAttendanceSummary } from "@/lib/ai-api/extended-queries";
import { guardAiApiRequest } from "@/lib/ai-api/guard";
import { aiApiOk } from "@/lib/ai-api/response";

/** Rekap absensi harian (read-only) untuk Odysseus/MCP. */
export async function GET(req: Request) {
  const guard = guardAiApiRequest(req);
  if (!guard.ok) return guard.response;

  const date = new URL(req.url).searchParams.get("date") ?? undefined;
  const data = await aiGetAttendanceSummary(guard.ctx.role, date);
  return aiApiOk(data, guard.ctx.role);
}
