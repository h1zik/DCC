import "server-only";

import { Prisma, SeoAnalysisStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DataForSeoError, isDataForSeoConfigured } from "@/lib/seo/dataforseo/client";
import {
  fetchBacklinkAnchors,
  fetchBacklinkHistory,
  fetchBacklinkSummary,
  fetchReferringDomains,
} from "@/lib/seo/dataforseo/backlinks";
import { computeBacklinkGap } from "@/lib/seo/backlinks/gap";

function failMessage(err: unknown): string {
  if (err instanceof DataForSeoError) {
    return err.balanceExhausted
      ? "Saldo DataForSEO habis — top up untuk melanjutkan analisis backlink."
      : err.message;
  }
  return err instanceof Error ? err.message : "Analisis backlink gagal.";
}

export async function runBacklinkAnalysis(profileId: string): Promise<void> {
  const profile = await prisma.seoBacklinkProfile.findUnique({
    where: { id: profileId },
  });
  if (!profile) throw new Error("Profil backlink tidak ditemukan.");

  if (!isDataForSeoConfigured()) {
    await prisma.seoBacklinkProfile.update({
      where: { id: profileId },
      data: {
        status: SeoAnalysisStatus.FAILED,
        errorMessage:
          "DataForSEO belum dikonfigurasi (set DATAFORSEO_LOGIN & DATAFORSEO_PASSWORD).",
      },
    });
    return;
  }

  await prisma.seoBacklinkProfile.update({
    where: { id: profileId },
    data: { status: SeoAnalysisStatus.COLLECTING, errorMessage: null, dataNotice: null },
  });

  try {
    const [summary, referringDomains, anchors, history] = await Promise.all([
      fetchBacklinkSummary(profile.target),
      fetchReferringDomains(profile.target, 50),
      fetchBacklinkAnchors(profile.target, 30),
      fetchBacklinkHistory(profile.target),
    ]);

    await prisma.seoBacklinkProfile.update({
      where: { id: profileId },
      data: { status: SeoAnalysisStatus.ANALYZING },
    });

    const referringCount =
      summary?.referringDomains ?? referringDomains.length;
    const backlinkCount = summary?.backlinks ?? 0;

    await prisma.seoBacklinkSnapshot.create({
      data: {
        profileId,
        referringDomains: referringCount,
        backlinks: backlinkCount,
        rank: summary?.rank ?? null,
      },
    });

    const noData = !summary && referringDomains.length === 0;

    await prisma.seoBacklinkProfile.update({
      where: { id: profileId },
      data: {
        status: SeoAnalysisStatus.READY,
        summary: summary
          ? (summary as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        topReferringDomains: referringDomains as unknown as Prisma.InputJsonValue,
        topAnchors: anchors as unknown as Prisma.InputJsonValue,
        history: history as unknown as Prisma.InputJsonValue,
        dataNotice: noData
          ? "Belum ada data backlink untuk target ini (atau di luar index DataForSEO)."
          : null,
        errorMessage: null,
      },
    });
  } catch (err) {
    await prisma.seoBacklinkProfile.update({
      where: { id: profileId },
      data: { status: SeoAnalysisStatus.FAILED, errorMessage: failMessage(err) },
    });
    throw err;
  }
}

export async function enqueueBacklinkAnalysis(profileId: string): Promise<void> {
  await runBacklinkAnalysis(profileId);
}

/** Hitung & simpan backlink gap vs satu kompetitor. */
export async function runBacklinkGap(gapId: string): Promise<void> {
  const gap = await prisma.seoBacklinkGap.findUnique({
    where: { id: gapId },
    include: { profile: { select: { target: true } } },
  });
  if (!gap) throw new Error("Gap tidak ditemukan.");

  if (!isDataForSeoConfigured()) {
    await prisma.seoBacklinkGap.update({
      where: { id: gapId },
      data: {
        status: SeoAnalysisStatus.FAILED,
        errorMessage: "DataForSEO belum dikonfigurasi.",
      },
    });
    return;
  }

  await prisma.seoBacklinkGap.update({
    where: { id: gapId },
    data: { status: SeoAnalysisStatus.ANALYZING, errorMessage: null },
  });

  try {
    const [targetDomains, competitorDomains] = await Promise.all([
      fetchReferringDomains(gap.profile.target, 1000),
      fetchReferringDomains(gap.competitor, 1000),
    ]);

    const gapDomains = computeBacklinkGap(targetDomains, competitorDomains).slice(
      0,
      200,
    );

    await prisma.seoBacklinkGap.update({
      where: { id: gapId },
      data: {
        status: SeoAnalysisStatus.READY,
        gapDomains: gapDomains as unknown as Prisma.InputJsonValue,
        gapCount: gapDomains.length,
        errorMessage: null,
      },
    });
  } catch (err) {
    await prisma.seoBacklinkGap.update({
      where: { id: gapId },
      data: { status: SeoAnalysisStatus.FAILED, errorMessage: failMessage(err) },
    });
    throw err;
  }
}
