import { aiGetSalesOutgoingByBrand } from "@/lib/ai-api/strategic-queries";
import { guardAiApiRequest } from "@/lib/ai-api/guard";
import { aiApiOk } from "@/lib/ai-api/response";

export async function GET(req: Request) {
  const guard = guardAiApiRequest(req);
  if (!guard.ok) return guard.response;
  const daysRaw = new URL(req.url).searchParams.get("days");
  const days = daysRaw ? Number(daysRaw) : 90;
  return aiApiOk(
    await aiGetSalesOutgoingByBrand(
      guard.ctx.role,
      Number.isFinite(days) ? days : 90,
    ),
    guard.ctx.role,
  );
}
