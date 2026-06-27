import { SeoRankDevice } from "@prisma/client";
import { guardAiApiRequest } from "@/lib/ai-api/guard";
import { aiApiError, aiApiOk } from "@/lib/ai-api/response";
import { isDataForSeoConfigured } from "@/lib/seo/dataforseo/client";
import { fetchSerpLive, findDomainRank } from "@/lib/seo/dataforseo/serp";

/**
 * Cek posisi SERP Google Indonesia untuk satu keyword (read-only, untuk MCP).
 * Query: `keyword`, `domain`, `device?` (desktop|mobile).
 */
export async function GET(req: Request) {
  const guard = guardAiApiRequest(req);
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const keyword = url.searchParams.get("keyword")?.trim();
  const domain = url.searchParams.get("domain")?.trim();
  if (!keyword || !domain) {
    return aiApiError("Parameter 'keyword' dan 'domain' wajib.", 400);
  }
  if (!isDataForSeoConfigured()) {
    return aiApiError("DataForSEO belum dikonfigurasi.", 503);
  }

  const device =
    url.searchParams.get("device") === "desktop"
      ? SeoRankDevice.DESKTOP
      : SeoRankDevice.MOBILE;

  try {
    const lookup = await fetchSerpLive(keyword, { device });
    const rank = findDomainRank(lookup.items, domain);
    return aiApiOk(
      {
        keyword,
        domain,
        position: rank?.position ?? null,
        foundUrl: rank?.foundUrl ?? null,
        serpFeatures: lookup.serpFeatures,
      },
      guard.ctx.role,
    );
  } catch (err) {
    return aiApiError(
      err instanceof Error ? err.message : "Gagal cek ranking.",
      502,
    );
  }
}
