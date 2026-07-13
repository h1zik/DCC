import "server-only";

import { Prisma, SeoAnalysisStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  DataForSeoError,
  isDataForSeoConfigured,
} from "@/lib/seo/dataforseo/client";
import { fetchRankedKeywordsWithMeta } from "@/lib/seo/dataforseo/labs-domain";
import {
  mergeGapRows,
  type GapCoverage,
  type GapDomainRow,
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
    const perDomainLimit = 1000;
    const opts = {
      locationCode: gap.locationCode,
      languageCode: gap.languageCode,
      limit: perDomainLimit,
    };

    // Ambil ranked keywords setiap domain agar union tidak bergantung pada
    // arah target1/target2. Berurutan untuk menjaga concurrency akun.
    const domains = [gap.target, ...gap.competitors];
    const sources: Record<string, GapDomainRow[]> = {};
    const coverage: GapCoverage = {
      fetchedByDomain: {},
      totalByDomain: {},
      truncatedDomains: [],
      perDomainLimit,
    };
    const notices: string[] = [];
    for (const domain of domains) {
      const result = await fetchRankedKeywordsWithMeta(domain, opts);
      sources[domain] = result.rows.map((row) => ({
        keyword: row.keyword,
        searchVolume: row.searchVolume,
        difficulty: row.difficulty,
        position: row.position,
      }));
      coverage.fetchedByDomain[domain] = result.rows.length;
      coverage.totalByDomain[domain] = result.totalCount;
      if (result.truncated) coverage.truncatedDomains.push(domain);
      if (result.rows.length === 0) {
        notices.push(`Tidak ada keyword organik terdeteksi untuk ${domain}.`);
      }
    }

    await prisma.seoKeywordGap.update({
      where: { id: gapId },
      data: { status: SeoAnalysisStatus.ANALYZING },
    });

    const { rows, summary, truncated } = mergeGapRows(gap.target, sources, {
      cap: domains.length * perDomainLimit,
      coverage,
    });
    if (coverage.truncatedDomains.length > 0) {
      notices.push(
        `Analisis memakai maksimal ${perDomainLimit.toLocaleString("id-ID")} keyword organik teratas per domain; data dipotong untuk ${coverage.truncatedDomains.join(", ")}.`,
      );
    }
    if (truncated) {
      notices.push(
        `Menyimpan ${rows.length} dari ${summary.totalKeywords} keyword dalam union sampel.`,
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
