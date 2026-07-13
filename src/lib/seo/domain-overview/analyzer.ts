import "server-only";

import { Prisma, SeoAnalysisStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  DataForSeoError,
  isDataForSeoConfigured,
} from "@/lib/seo/dataforseo/client";
import {
  fetchCompetitorsDomain,
  fetchDomainRankOverview,
  fetchHistoricalRankOverview,
  fetchRankedKeywords,
} from "@/lib/seo/dataforseo/labs-domain";

function failMessage(err: unknown): string {
  if (err instanceof DataForSeoError) {
    return err.balanceExhausted
      ? "Saldo DataForSEO habis — top up untuk melanjutkan analisis domain."
      : err.message;
  }
  return err instanceof Error ? err.message : "Analisis domain gagal.";
}

export async function runDomainOverview(overviewId: string): Promise<void> {
  const row = await prisma.seoDomainOverview.findUnique({
    where: { id: overviewId },
  });
  if (!row) throw new Error("Domain overview tidak ditemukan.");

  if (!isDataForSeoConfigured()) {
    await prisma.seoDomainOverview.update({
      where: { id: overviewId },
      data: {
        status: SeoAnalysisStatus.FAILED,
        errorMessage:
          "DataForSEO belum dikonfigurasi (set DATAFORSEO_LOGIN & DATAFORSEO_PASSWORD).",
      },
    });
    return;
  }

  await prisma.seoDomainOverview.update({
    where: { id: overviewId },
    data: {
      status: SeoAnalysisStatus.COLLECTING,
      errorMessage: null,
      dataNotice: null,
    },
  });

  try {
    const opts = {
      locationCode: row.locationCode,
      languageCode: row.languageCode,
    };
    const [overview, topKeywords, competitors, historyRes] = await Promise.all([
      fetchDomainRankOverview(row.target, opts),
      fetchRankedKeywords(row.target, { ...opts, limit: 100 }),
      fetchCompetitorsDomain(row.target, { ...opts, limit: 10 }),
      // Historis best-effort — domain kecil sering tak punya data bulanan.
      fetchHistoricalRankOverview(row.target, opts).catch((err) => {
        console.warn("[seo/domain-overview] historis gagal (dilewati)", err);
        return [];
      }),
    ]);
    const history = historyRes;

    const notices: string[] = [];
    if (!overview) {
      notices.push(
        "Data Labs untuk domain ini sangat terbatas — kemungkinan trafik organiknya kecil atau domain baru.",
      );
    }
    if (topKeywords.length === 0) {
      notices.push("Tidak ada keyword organik yang terdeteksi di Google ID.");
    }

    await prisma.seoDomainOverview.update({
      where: { id: overviewId },
      data: {
        status: SeoAnalysisStatus.READY,
        overview: overview
          ? (overview as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        topKeywords: topKeywords as unknown as Prisma.InputJsonValue,
        competitors: competitors as unknown as Prisma.InputJsonValue,
        history: history as unknown as Prisma.InputJsonValue,
        dataNotice: notices.length ? notices.join(" ") : null,
        errorMessage: null,
      },
    });
  } catch (err) {
    await prisma.seoDomainOverview.update({
      where: { id: overviewId },
      data: { status: SeoAnalysisStatus.FAILED, errorMessage: failMessage(err) },
    });
    throw err;
  }
}
