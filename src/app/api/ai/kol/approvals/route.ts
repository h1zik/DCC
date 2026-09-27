import { aiGetKolPendingApprovals } from "@/lib/ai-api/kol-queries";
import { guardAiApiRequest, parseLimitParam } from "@/lib/ai-api/guard";
import { aiApiOk } from "@/lib/ai-api/response";

/** Antrean approval KOL Hub: perubahan profil + jadwal per order (read-only). */
export async function GET(req: Request) {
  const guard = guardAiApiRequest(req);
  if (!guard.ok) return guard.response;

  const limit = parseLimitParam(
    new URL(req.url).searchParams.get("limit"),
    50,
    200,
  );
  return aiApiOk(
    await aiGetKolPendingApprovals(guard.ctx.role, limit),
    guard.ctx.role,
  );
}
