import "server-only";

import { Prisma, SeoAnalysisStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  DataForSeoError,
  isDataForSeoConfigured,
} from "@/lib/seo/dataforseo/client";
import { fetchDomainIntersection } from "@/lib/seo/dataforseo/labs-domain";
import {
  mergeGapRows,
  type GapSourceRow,
} from "@/lib/seo/keyword-gap/gap-logic";

function failMessage(err: unknown): string {
  if (err instanceof DataForSeoError) {
    return err.balanceExhausted
      ? "Saldo DataForSEO habis — top up untuk melanjutkan analisis keyword gap."
      : err.message;
  }
  return err instanceof Error ? err.message : "Analisis keyword gap gagal.";
}

export async function runKeywordGap(gapId: string): Promise<void> {
  const gap = await prisma.seoKeywordGap.findUnique({ where: { id: gapId } });
  if (!gap) throw new Error("Keyword gap tidak ditemukan.");

  if (!isDataForSeoConfigured()) {
    await prisma.seoKeywordGap.update({
      where: { id: gapId },
      data: {
        status: SeoAnalysisStatus.FAILED,
        errorMessage:
          "DataForSEO belum dikonfigurasi (set DATAFORSEO_LOGIN & DATAFORSEO_PASSWORD).",
      },
    });
    return;
  }

  await prisma.seoKeywordGap.update({
    where: { id: gapId },
    data: {
      status: SeoAnalysisStatus.COLLECTING,
      errorMessage: null,
      dataNotice: null,
    },
  });

  try {
    const opts = {
      locationCode: gap.locationCode,
      languageCode: gap.languageCode,
      limit: 300,
    };

    // Satu call intersection per kompetitor (berurutan — hemat concurrent load).
    const sources: Record<string, GapSourceRow[]> = {};
    const notices: string[] = [];
    for (const competitor of gap.competitors) {
      const rows = await fetchDomainIntersection(gap.target, competitor, opts);
      sources[competitor] = rows.map((r) => ({
        keyword: r.keyword,
        searchVolume: r.searchVolume,
        difficulty: r.difficulty,
        targetPosition: r.targetPosition,
        competitorPosition: r.competitorPosition,
      }));
      if (rows.length === 0) {
        notices.push(`Tidak ada data intersection dengan ${competitor}.`);
      }
    }

    await prisma.seoKeywordGap.update({
      where: { id: gapId },
      data: { status: SeoAnalysisStatus.ANALYZING },
    });

    const { rows, summary, truncated } = mergeGapRows(sources);
    if (truncated) {
      notices.push(
        `Menampilkan ${rows.length} dari ${summary.totalKeywords} keyword (dipotong — persempit dengan kompetitor lebih sedikit bila perlu).`,
      );
    }
    if (summary.totalKeywords === 0) {
      notices.push(
        "Data Labs sangat terbatas untuk kombinasi domain ini — coba domain dengan trafik organik lebih besar.",
      );
    }

    await prisma.seoKeywordGap.update({
      where: { id: gapId },
      data: {
        status: SeoAnalysisStatus.READY,
        rows: rows as unknown as Prisma.InputJsonValue,
        summary: summary as unknown as Prisma.InputJsonValue,
        dataNotice: notices.length ? notices.join(" ") : null,
        errorMessage: null,
      },
    });
  } catch (err) {
    await prisma.seoKeywordGap.update({
      where: { id: gapId },
      data: { status: SeoAnalysisStatus.FAILED, errorMessage: failMessage(err) },
    });
    throw err;
  }
}
