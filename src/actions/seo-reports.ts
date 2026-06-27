"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { SeoReportType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSeoAccess } from "@/lib/seo/auth";
import { generateSeoReport } from "@/lib/seo/reports/generator";
import { buildReportPdfHtml } from "@/lib/research/reports/report-pdf-html";
import { parseReportSections } from "@/lib/research/reports/types";

const REPORT_TYPE_TITLES: Record<SeoReportType, string> = {
  OVERVIEW: "Ringkasan SEO",
  RANK_TRACKING: "Laporan Ranking SEO",
  TECHNICAL: "Laporan SEO Teknis",
  FULL: "Laporan SEO Lengkap",
};

const createSchema = z.object({
  type: z.nativeEnum(SeoReportType),
  title: z.string().max(200).optional(),
});

export async function createSeoReport(input: z.infer<typeof createSchema>) {
  const session = await requireSeoAccess();
  const data = createSchema.parse(input);

  const report = await prisma.seoReport.create({
    data: {
      type: data.type,
      title: data.title?.trim() || REPORT_TYPE_TITLES[data.type],
      createdById: session.user.id,
    },
  });

  after(async () => {
    try {
      await generateSeoReport(report.id);
    } catch (err) {
      console.error("[createSeoReport] gagal", err);
    }
  });

  revalidatePath("/seo/reports");
  return { id: report.id };
}

export async function deleteSeoReport(reportId: string) {
  await requireSeoAccess();
  z.string().min(1).parse(reportId);
  await prisma.seoReport.delete({ where: { id: reportId } });
  revalidatePath("/seo/reports");
}

/** Bangun HTML laporan untuk ekspor PDF (dipakai client downloadHtmlAsPdf). */
export async function getSeoReportPdfHtml(reportId: string): Promise<string> {
  await requireSeoAccess();
  z.string().min(1).parse(reportId);

  const report = await prisma.seoReport.findUnique({ where: { id: reportId } });
  if (!report) throw new Error("Laporan tidak ditemukan.");

  return buildReportPdfHtml({
    title: report.title,
    aiSummary: report.aiSummary,
    sections: parseReportSections(report.sections),
    metrics: (report.metrics as Record<string, number> | null) ?? undefined,
    periodStart: report.periodStart?.toLocaleDateString("id-ID") ?? null,
    periodEnd: report.periodEnd?.toLocaleDateString("id-ID") ?? null,
  });
}
