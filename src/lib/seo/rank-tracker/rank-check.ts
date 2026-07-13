import "server-only";

import { NotificationType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify";
import {
  fetchSerpLive,
  findAllDomainMatches,
  findDomainRank,
  findDomainRanks,
} from "@/lib/seo/dataforseo/serp";
import {
  describeRankChange,
  isSignificantRankChange,
} from "@/lib/seo/rank-tracker/rank-change";

export type RankCheckResult = {
  position: number | null;
  foundUrl: string | null;
  changed: boolean;
};

/**
 * Cek posisi SERP untuk satu tracked keyword, simpan snapshot time-series
 * (termasuk posisi kompetitor & semua URL sendiri dari SERP yang SAMA — tanpa
 * biaya tambahan), update posisi terakhir, dan kirim notifikasi (in-app + push)
 * bila perubahan signifikan.
 *
 * Memakai metode SERP live (di-cache 24 jam) — lihat catatan biaya di serp.ts.
 */
export async function runRankCheck(
  trackedKeywordId: string,
): Promise<RankCheckResult> {
  const tk = await prisma.seoTrackedKeyword.findUnique({
    where: { id: trackedKeywordId },
    include: { project: true },
  });
  if (!tk) throw new Error("Tracked keyword tidak ditemukan.");

  const { project } = tk;
  const isFirstCheck = tk.lastCheckedAt == null;
  const prev = tk.lastPosition;

  const lookup = await fetchSerpLive(tk.keyword, {
    locationCode: project.locationCode,
    languageCode: project.languageCode,
    device: project.device,
  });
  const match = findDomainRank(lookup.items, project.domain, tk.targetUrl);
  const position = match?.position ?? null;
  const foundUrl = match?.foundUrl ?? null;

  // Data gratis dari SERP yang sama: posisi kompetitor + semua URL sendiri.
  const competitorPositions =
    project.competitors.length > 0
      ? findDomainRanks(lookup.items, project.competitors)
      : null;
  const ownMatches = findAllDomainMatches(lookup.items, project.domain);

  await prisma.seoRankSnapshot.create({
    data: {
      trackedKeywordId,
      position,
      foundUrl,
      serpFeatures: lookup.serpFeatures.length
        ? (lookup.serpFeatures as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      competitorPositions: competitorPositions
        ? (competitorPositions as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      ownMatches: ownMatches.length
        ? (ownMatches as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    },
  });

  await prisma.seoTrackedKeyword.update({
    where: { id: trackedKeywordId },
    data: {
      previousPosition: prev,
      lastPosition: position,
      lastFoundUrl: foundUrl,
      lastCheckedAt: new Date(),
    },
  });

  const changed = !isFirstCheck && isSignificantRankChange(prev, position);
  if (changed) {
    try {
      await notifyUser(
        project.createdById,
        describeRankChange(tk.keyword, prev, position),
        NotificationType.SEO_ALERT,
      );
    } catch (err) {
      console.error("[seo/rank-check] notifikasi gagal", err);
    }
  }

  return { position, foundUrl, changed };
}
