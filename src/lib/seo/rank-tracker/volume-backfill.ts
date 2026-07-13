import "server-only";

import { prisma } from "@/lib/prisma";
import { isDataForSeoConfigured } from "@/lib/seo/dataforseo/client";
import { fetchBulkSearchVolume } from "@/lib/seo/dataforseo/keywords";

/**
 * Backfill volume pencarian tracked keyword (untuk bobot visibility score).
 * Satu panggilan bulk per proyek; best-effort — kegagalan tidak mengganggu
 * rank check.
 */
export async function backfillTrackedKeywordVolumes(
  projectId: string,
): Promise<{ updated: number }> {
  if (!isDataForSeoConfigured()) return { updated: 0 };

  const project = await prisma.seoRankProject.findUnique({
    where: { id: projectId },
    select: { locationCode: true, languageCode: true },
  });
  if (!project) return { updated: 0 };

  const missing = await prisma.seoTrackedKeyword.findMany({
    where: { projectId, searchVolume: null },
    select: { id: true, keyword: true },
  });
  if (missing.length === 0) return { updated: 0 };

  const volumes = await fetchBulkSearchVolume(
    missing.map((m) => m.keyword),
    {
      locationCode: project.locationCode,
      languageCode: project.languageCode,
    },
  );

  let updated = 0;
  for (const tk of missing) {
    const vol = volumes.get(tk.keyword.trim().toLowerCase());
    if (vol == null) continue;
    await prisma.seoTrackedKeyword.update({
      where: { id: tk.id },
      data: { searchVolume: vol },
    });
    updated += 1;
  }
  return { updated };
}
