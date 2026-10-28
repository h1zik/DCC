import { guardAiApiRequest } from "@/lib/ai-api/guard";
import { aiApiError, aiApiOk } from "@/lib/ai-api/response";
import { prisma } from "@/lib/prisma";
import { visibilityBreakdown } from "@/lib/seo/rank-tracker/visibility";
import { rankDistribution } from "@/lib/seo/rank-tracker/distribution";

/**
 * Visibility score + distribusi ranking per proyek rank tracker (read-only,
 * untuk MCP). Dihitung dari data lokal — nol biaya API.
 * `unknownVolumeCount` = keyword tanpa data volume (dibobot median volume
 * keyword lain di proyek yang sama).
 */
export async function GET(req: Request) {
  const guard = guardAiApiRequest(req);
  if (!guard.ok) return guard.response;

  try {
    const projects = await prisma.seoRankProject.findMany({
      where: { isActive: true },
      include: {
        keywords: {
          select: { lastPosition: true, searchVolume: true },
        },
      },
    });

    const rows = projects.map((p) => {
      const { score, unknownVolumeCount } = visibilityBreakdown(
        p.keywords.map((k) => ({
          position: k.lastPosition,
          searchVolume: k.searchVolume,
        })),
      );
      const ranked = p.keywords
        .map((k) => k.lastPosition)
        .filter((x): x is number => x != null);
      return {
        projectId: p.id,
        name: p.name,
        domain: p.domain,
        keywords: p.keywords.length,
        visibility: score,
        unknownVolumeCount,
        /** Posisi rata-rata keyword yang ranking saja. */
        avgPositionRanked: ranked.length
          ? Math.round((ranked.reduce((a, b) => a + b, 0) / ranked.length) * 10) / 10
          : null,
        distribution: rankDistribution(p.keywords.map((k) => k.lastPosition)),
      };
    });

    return aiApiOk({ count: rows.length, projects: rows }, guard.ctx.role);
  } catch (err) {
    return aiApiError(
      err instanceof Error ? err.message : "Gagal menghitung visibility.",
      502,
    );
  }
}
