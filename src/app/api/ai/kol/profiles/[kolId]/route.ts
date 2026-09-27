import { aiGetKolProfile } from "@/lib/ai-api/kol-queries";
import { guardAiApiRequest } from "@/lib/ai-api/guard";
import { aiApiOk } from "@/lib/ai-api/response";

/** Detail satu KOL + jadwal terbaru (read-only) — tanpa data kontak/rekening. */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ kolId: string }> },
) {
  const guard = guardAiApiRequest(req);
  if (!guard.ok) return guard.response;

  const { kolId } = await ctx.params;
  return aiApiOk(await aiGetKolProfile(guard.ctx.role, kolId), guard.ctx.role);
}
