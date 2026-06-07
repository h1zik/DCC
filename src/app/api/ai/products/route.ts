import { aiListProducts } from "@/lib/ai-api/strategic-queries";
import { guardAiApiRequest, parseLimitParam } from "@/lib/ai-api/guard";
import { aiApiOk } from "@/lib/ai-api/response";

export async function GET(req: Request) {
  const guard = guardAiApiRequest(req);
  if (!guard.ok) return guard.response;
  const limit = parseLimitParam(
    new URL(req.url).searchParams.get("limit"),
    50,
    100,
  );
  return aiApiOk(await aiListProducts(guard.ctx.role, limit), guard.ctx.role);
}
