import { aiListKolProfiles } from "@/lib/ai-api/kol-queries";
import { guardAiApiRequest, parseLimitParam } from "@/lib/ai-api/guard";
import { aiApiOk } from "@/lib/ai-api/response";

/** Daftar KOL (read-only) — tanpa data kontak/rekening. */
export async function GET(req: Request) {
  const guard = guardAiApiRequest(req);
  if (!guard.ok) return guard.response;

  const params = new URL(req.url).searchParams;
  return aiApiOk(
    await aiListKolProfiles(guard.ctx.role, {
      status: params.get("status"),
      platform: params.get("platform"),
      categoryName: params.get("categoryName"),
      q: params.get("q"),
      limit: parseLimitParam(params.get("limit"), 30, 100),
    }),
    guard.ctx.role,
  );
}
