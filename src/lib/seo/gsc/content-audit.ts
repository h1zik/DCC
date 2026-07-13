import "server-only";

import { Prisma, SeoAnalysisStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  GscError,
  getGscSiteUrl,
  gscDate,
  gscSearchAnalytics,
  isGscConfigured,
} from "@/lib/seo/gsc/client";
import { buildAuditRows } from "@/lib/seo/gsc/content-audit-rules";

/**
 * Content Audit: tarik data GSC 28 hari vs 28 hari sebelumnya (agregat per
 * halaman + query per halaman) → klasifikasi decay/rising/stable/fresh.
 */
export async function runContentAudit(auditId: string): Promise<void> {
  const audit = await prisma.seoContentAudit.findUnique({
    where: { id: auditId },
  });
  if (!audit) throw new Error("Content audit tidak ditemukan.");

  if (!isGscConfigured()) {
    await prisma.seoContentAudit.update({
      where: { id: auditId },
      data: {
        status: SeoAnalysisStatus.FAILED,
        errorMessage:
          "Google Search Console belum dikonfigurasi (set GSC_SERVICE_ACCOUNT_EMAIL, GSC_PRIVATE_KEY, GSC_SITE_URL).",
      },
    });
    return;
  }

  await prisma.seoContentAudit.update({
    where: { id: auditId },
    data: { status: SeoAnalysisStatus.COLLECTING, errorMessage: null, dataNotice: null },
  });

  try {
    const siteUrl = audit.siteUrl || getGscSiteUrl()!;
    const days = audit.windowDays;
    // GSC lag ~2 hari: jendela kini = [2+days-1 .. 2] hari lalu.
    const curEnd = gscDate(2);
    const curStart = gscDate(2 + days - 1);
    const prevEnd = gscDate(2 + days);
    const prevStart = gscDate(2 + days * 2 - 1);

    const [currentRows, previousRows, pageQueryRows] = await Promise.all([
      gscSearchAnalytics({
        siteUrl,
        startDate: curStart,
        endDate: curEnd,
        dimensions: ["page"],
        rowLimit: 1000,
      }),
      gscSearchAnalytics({
        siteUrl,
        startDate: prevStart,
        endDate: prevEnd,
        dimensions: ["page"],
        rowLimit: 1000,
      }),
      gscSearchAnalytics({
        siteUrl,
        startDate: curStart,
        endDate: curEnd,
        dimensions: ["page", "query"],
        rowLimit: 5000,
      }),
    ]);

    await prisma.seoContentAudit.update({
      where: { id: auditId },
      data: { status: SeoAnalysisStatus.ANALYZING },
    });

    const { rows, summary } = buildAuditRows({
      current: currentRows.map((r) => ({
        page: r.keys[0] ?? "",
        clicks: r.clicks,
        impressions: r.impressions,
      })),
      previous: previousRows.map((r) => ({
        page: r.keys[0] ?? "",
        clicks: r.clicks,
      })),
      pageQueries: pageQueryRows.map((r) => ({
        page: r.keys[0] ?? "",
        query: r.keys[1] ?? "",
        clicks: r.clicks,
      })),
    });

    const notice =
      rows.length === 0
        ? "GSC tidak mengembalikan data — pastikan service account sudah ditambahkan ke properti Search Console dan situs punya trafik."
        : null;

    await prisma.seoContentAudit.update({
      where: { id: auditId },
      data: {
        status: SeoAnalysisStatus.READY,
        siteUrl,
        rows: rows as unknown as Prisma.InputJsonValue,
        summary: summary as unknown as Prisma.InputJsonValue,
        dataNotice: notice,
        errorMessage: null,
      },
    });
  } catch (err) {
    await prisma.seoContentAudit.update({
      where: { id: auditId },
      data: {
        status: SeoAnalysisStatus.FAILED,
        errorMessage:
          err instanceof GscError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Content audit gagal.",
      },
    });
    throw err;
  }
}
