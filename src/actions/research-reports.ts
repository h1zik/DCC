"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { ResearchReportType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireMarketAnalyst } from "@/lib/research/auth";
import {
  createReportRecord,
  generateResearchReport,
} from "@/lib/research/reports/report-generator";
import { buildReportPdfHtml } from "@/lib/research/reports/report-pdf-html";
import { parseReportSections } from "@/lib/research/reports/types";
import { renderHtmlToPdfBuffer } from "@/lib/pdf/render-html-to-pdf";

const configSchema = z.object({
  notify: z.boolean().optional(),
  modules: z
    .object({
      reviewIntel: z.boolean().optional(),
      competitor: z.boolean().optional(),
      trendRadar: z.boolean().optional(),
      keywordIntel: z.boolean().optional(),
      socialListening: z.boolean().optional(),
      conceptLab: z.boolean().optional(),
      uspAnalyzer: z.boolean().optional(),
    })
    .optional(),
  category: z.string().optional(),
  competitorId: z.string().optional(),
  digestId: z.string().optional(),
  sources: z
    .object({
      reviewSourceId: z.string().optional(),
      competitorId: z.string().optional(),
      digestId: z.string().optional(),
      keywordQueryId: z.string().optional(),
      socialMonitorId: z.string().optional(),
      uspAnalysisId: z.string().optional(),
      conceptId: z.string().optional(),
      productDiscoveryQueryId: z.string().optional(),
    })
    .optional(),
});

const createSchema = z.object({
  type: z.nativeEnum(ResearchReportType),
  title: z.string().max(200).optional(),
  config: configSchema.optional(),
});

export async function createResearchReport(
  input: z.infer<typeof createSchema>,
) {
  const session = await requireMarketAnalyst();
  const data = createSchema.parse(input);

  const { id } = await createReportRecord({
    type: data.type,
    title: data.title,
    config: data.config,
    createdById: session.user.id,
  });

  after(async () => {
    try {
      await generateResearchReport(id);
    } catch (err) {
      console.error("[createResearchReport] generate gagal", err);
    }
  });

  revalidatePath("/research-hub/research-reports");
  return { id };
}

export async function refreshResearchReport(reportId: string) {
  await requireMarketAnalyst();
  z.string().min(1).parse(reportId);

  await prisma.researchReport.update({
    where: { id: reportId },
    data: { status: "GENERATING", errorMessage: null },
  });

  after(async () => {
    try {
      await generateResearchReport(reportId);
    } catch (err) {
      console.error("[refreshResearchReport] generate gagal", err);
    }
  });

  revalidatePath("/research-hub/research-reports");
  revalidatePath(`/research-hub/research-reports/${reportId}`);
}

export async function deleteResearchReport(reportId: string) {
  await requireMarketAnalyst();
  await prisma.researchReport.delete({ where: { id: reportId } });
  revalidatePath("/research-hub/research-reports");
}

export async function getReportShareUrl(reportId: string) {
  await requireMarketAnalyst();
  z.string().min(1).parse(reportId);
  return {
    path: `/research-hub/research-reports/${reportId}`,
  };
}

/** Render laporan jadi PDF vektor (headless Chromium) & kembalikan sebagai base64. */
export async function getReportPdfBase64(reportId: string): Promise<string> {
  await requireMarketAnalyst();
  const report = await prisma.researchReport.findUnique({
    where: { id: reportId },
  });
  if (!report) throw new Error("Laporan tidak ditemukan.");

  const actionItems = Array.isArray(report.actionItems)
    ? (report.actionItems as {
        priority: string;
        owner: string;
        action: string;
        rationale: string;
        sourceLabel: string | null;
      }[])
    : [];
  const metrics =
    report.metrics && typeof report.metrics === "object"
      ? (report.metrics as Record<string, number>)
      : undefined;

  const html = buildReportPdfHtml({
    title: report.title,
    aiSummary: report.aiSummary,
    sections: parseReportSections(report.sections),
    actionItems,
    metrics,
    periodStart: report.periodStart?.toISOString().slice(0, 10) ?? null,
    periodEnd: report.periodEnd?.toISOString().slice(0, 10) ?? null,
  });
  const buffer = await renderHtmlToPdfBuffer(html);
  return buffer.toString("base64");
}
