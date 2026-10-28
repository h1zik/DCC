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
import { startOfWibDay } from "@/lib/seo/rank-tracker/day-key";

export type RankCheckResult = {
  position: number | null;
  foundUrl: string | null;
  changed: boolean;
  /** True bila posisi berasal dari featured snippet (bukan hasil organik). */
  viaFeaturedSnippet: boolean;
  /** True bila snapshot hari ini (WIB) diperbarui di tempat, bukan dibuat baru. */
  updatedToday: boolean;
};

/**
 * Cek posisi SERP untuk satu tracked keyword, simpan snapshot time-series
 * (termasuk posisi kompetitor & semua URL sendiri dari SERP yang SAMA — tanpa
 * biaya tambahan), update posisi terakhir, dan kirim notifikasi (in-app + push)
 * bila perubahan signifikan.
 *
 * Selalu memakai SERP SEGAR (lewati cache baca 24 jam) — snapshot harian dan
 * "Cek sekarang" tidak boleh memakai SERP kemarin.
 *
 * Satu snapshot per hari kalender WIB: cek ulang pada hari yang sama
 * MEMPERBARUI snapshot hari itu (dan tidak menyentuh `previousPosition`),
 * sehingga riwayat perubahan tidak hancur oleh cek manual berulang.
 * `previousPosition` selalu diturunkan dari snapshot hari sebelumnya.
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
  const now = new Date();
  const dayStart = startOfWibDay(now);

  const [todaySnap, prevDaySnap] = await Promise.all([
    prisma.seoRankSnapshot.findFirst({
      where: { trackedKeywordId, capturedAt: { gte: dayStart } },
      orderBy: { capturedAt: "desc" },
      select: { id: true, position: true },
    }),
    prisma.seoRankSnapshot.findFirst({
      where: { trackedKeywordId, capturedAt: { lt: dayStart } },
      orderBy: { capturedAt: "desc" },
      select: { position: true },
    }),
  ]);

  // Pembanding = posisi pada hari (WIB) sebelumnya. Tidak ada → cek pertama.
  const isFirstCheck = prevDaySnap == null;
  const prev = prevDaySnap?.position ?? null;

  const lookup = await fetchSerpLive(tk.keyword, {
    locationCode: project.locationCode,
    languageCode: project.languageCode,
    device: project.device,
    fresh: true,
  });
  const match = findDomainRank(lookup.items, project.domain, tk.targetUrl);
  const position = match?.position ?? null;
  const foundUrl = match?.foundUrl ?? null;
  const viaFeaturedSnippet = match?.viaFeaturedSnippet ?? false;

  // Data gratis dari SERP yang sama: posisi kompetitor + semua URL sendiri.
  const competitorPositions =
    project.competitors.length > 0
      ? findDomainRanks(lookup.items, project.competitors)
      : null;
  const ownMatches = findAllDomainMatches(lookup.items, project.domain);

  const snapshotData = {
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
    capturedAt: now,
  };

  if (todaySnap) {
    // Cek ulang di hari WIB yang sama: perbarui snapshot hari ini di tempat,
    // biarkan previousPosition apa adanya.
    await prisma.seoRankSnapshot.update({
      where: { id: todaySnap.id },
      data: snapshotData,
    });
    await prisma.seoTrackedKeyword.update({
      where: { id: trackedKeywordId },
      data: {
        lastPosition: position,
        lastFoundUrl: foundUrl,
        lastCheckedAt: now,
      },
    });
  } else {
    await prisma.seoRankSnapshot.create({
      data: { trackedKeywordId, ...snapshotData },
    });
    await prisma.seoTrackedKeyword.update({
      where: { id: trackedKeywordId },
      data: {
        previousPosition: prev,
        lastPosition: position,
        lastFoundUrl: foundUrl,
        lastCheckedAt: now,
      },
    });
  }

  // Notifikasi: bandingkan dengan posisi hari sebelumnya; ditekan pada cek
  // pertama, dan pada cek ulang hari yang sama hanya bila posisinya berubah
  // dibanding cek sebelumnya hari ini (agar tidak dobel).
  const changed =
    !isFirstCheck &&
    isSignificantRankChange(prev, position) &&
    (todaySnap == null || todaySnap.position !== position);
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

  return {
    position,
    foundUrl,
    changed,
    viaFeaturedSnippet,
    updatedToday: todaySnap != null,
  };
}
