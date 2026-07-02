import { aiGetBrandOverview } from "@/lib/ai-api/strategic-queries";
import { guardAiApiRequest } from "@/lib/ai-api/guard";
import { aiApiOk, aiApiError } from "@/lib/ai-api/response";

/**
 * Dossier 360 satu brand (read-only) untuk integrasi MCP.
 * Query: `?brandNameOrId=Nama%20Brand`
 */
export async function GET(req: Request) {
  const guard = guardAiApiRequest(req);
  if (!guard.ok) return guard.response;

  const brandNameOrId = new URL(req.url).searchParams
    .get("brandNameOrId")
    ?.trim();
  if (!brandNameOrId) {
    return aiApiError("Parameter brandNameOrId wajib diisi.", 400);
  }

  return aiApiOk(
    await aiGetBrandOverview(guard.ctx.role, brandNameOrId),
    guard.ctx.role,
  );
}
