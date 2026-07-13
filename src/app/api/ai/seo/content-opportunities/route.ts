import { guardAiApiRequest, parseLimitParam } from "@/lib/ai-api/guard";
import { aiApiError, aiApiOk } from "@/lib/ai-api/response";
import { prisma } from "@/lib/prisma";

/**
 * Feed Content Opportunities (read-only, untuk MCP). Query: `stage?`, `type?`,
 * `limit?`.
 */
export async function GET(req: Request) {
  const guard = guardAiApiRequest(req);
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const stage = url.searchParams.get("stage")?.trim().toUpperCase();
  const type = url.searchParams.get("type")?.trim().toUpperCase();
  const limit = parseLimitParam(url.searchParams.get("limit"), 30, 100);

  try {
    const rows = await prisma.seoContentOpportunity.findMany({
      where: {
        ...(stage ? { stage: stage as never } : { stage: { not: "DISMISSED" } }),
        ...(type ? { type: type as never } : {}),
      },
      orderBy: { opportunityScore: "desc" },
      take: limit,
      select: {
        keyword: true,
        type: true,
        stage: true,
        searchVolume: true,
        difficulty: true,
        intent: true,
        opportunityScore: true,
        clusterLabel: true,
        currentPosition: true,
        targetUrl: true,
        suggestedTitle: true,
        angle: true,
        lastRefreshedAt: true,
      },
    });

    return aiApiOk({ count: rows.length, opportunities: rows }, guard.ctx.role);
  } catch (err) {
    return aiApiError(
      err instanceof Error ? err.message : "Gagal mengambil opportunities.",
      502,
    );
  }
}
