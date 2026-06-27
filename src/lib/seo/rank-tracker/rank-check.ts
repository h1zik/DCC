import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push-notify";
import { fetchSerpLive, findDomainRank } from "@/lib/seo/dataforseo/serp";
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
 * Cek posisi SERP untuk satu tracked keyword, simpan snapshot time-series,
 * update posisi terakhir, dan kirim web push bila perubahan signifikan.
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

  await prisma.seoRankSnapshot.create({
    data: {
      trackedKeywordId,
      position,
      foundUrl,
      serpFeatures: lookup.serpFeatures.length
        ? (lookup.serpFeatures as unknown as Prisma.InputJsonValue)
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
      await sendPushToUser(project.createdById, {
        title: "Perubahan Ranking SEO",
        body: describeRankChange(tk.keyword, prev, position),
        url: `/seo/rank-tracker/${project.id}`,
        tag: `seo-rank-${trackedKeywordId}`,
      });
    } catch (err) {
      console.error("[seo/rank-check] push gagal", err);
    }
  }

  return { position, foundUrl, changed };
}
