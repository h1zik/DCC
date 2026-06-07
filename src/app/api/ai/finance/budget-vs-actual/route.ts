import { aiGetBudgetVsActual } from "@/lib/ai-api/strategic-queries";
import { guardAiApiRequest } from "@/lib/ai-api/guard";
import { aiApiOk } from "@/lib/ai-api/response";

export async function GET(req: Request) {
  const guard = guardAiApiRequest(req);
  if (!guard.ok) return guard.response;
  const params = new URL(req.url).searchParams;
  const yearRaw = params.get("year");
  const monthRaw = params.get("month");
  const year = yearRaw ? Number(yearRaw) : undefined;
  const month = monthRaw ? Number(monthRaw) : undefined;
  return aiApiOk(
    await aiGetBudgetVsActual(guard.ctx.role, {
      year: Number.isFinite(year) ? year : undefined,
      month: Number.isFinite(month) ? month : undefined,
    }),
    guard.ctx.role,
  );
}
