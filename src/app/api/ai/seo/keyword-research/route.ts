import { guardAiApiRequest, parseLimitParam } from "@/lib/ai-api/guard";
import { aiApiError, aiApiOk } from "@/lib/ai-api/response";
import { isDataForSeoConfigured } from "@/lib/seo/dataforseo/client";
import { collectKeywordIdeas } from "@/lib/seo/dataforseo/keywords";

/**
 * Riset keyword SEO (read-only, untuk MCP/Odysseus).
 * Auth: `Authorization: Bearer <AI_READ_API_TOKEN>`. Query: `seed`, `limit?`.
 */
export async function GET(req: Request) {
  const guard = guardAiApiRequest(req);
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const seed = url.searchParams.get("seed")?.trim();
  if (!seed) return aiApiError("Parameter 'seed' wajib.", 400);
  if (!isDataForSeoConfigured()) {
    return aiApiError("DataForSEO belum dikonfigurasi.", 503);
  }

  const limit = parseLimitParam(url.searchParams.get("limit"), 20, 50);

  try {
    const ideas = await collectKeywordIdeas(seed, { limit });
    const keywords = ideas
      .slice(0, limit)
      .map((k) => ({
        keyword: k.keyword,
        searchVolume: k.searchVolume,
        difficulty: k.difficulty,
        cpc: k.cpc,
        intent: k.intent,
      }));
    return aiApiOk({ seed, count: ideas.length, keywords }, guard.ctx.role);
  } catch (err) {
    return aiApiError(
      err instanceof Error ? err.message : "Gagal riset keyword.",
      502,
    );
  }
}
