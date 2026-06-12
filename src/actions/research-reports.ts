"use server";

import { revalidatePath } from "next/cache";
import { ResearchReportType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireMarketAnalyst } from "@/lib/research/auth";
import {
  createAndGenerateReport,
  generateResearchReport,
} from "@/lib/research/reports/report-generator";
import { buildReportPdfHtml } from "@/lib/research/reports/report-pdf-html";
import { parseReportSections } from "@/lib/research/reports/types";

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

  const { id } = await createAndGenerateReport({
    type: data.type,
    title: data.title,
    config: data.config,
    createdById: session.user.id,
  });

  revalidatePath("/research-hub/research-reports");
  return { id };
}

export async function refreshResearchReport(reportId: string) {
  await requireMarketAnalyst();
  z.string().min(1).parse(reportId);

  await generateResearchReport(reportId);
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

export async function getReportPdfHtml(reportId: string) {
  await requireMarketAnalyst();
  const report = await prisma.researchReport.findUnique({
    where: { id: reportId },
  });
  if (!report) throw new Error("Laporan tidak ditemukan.");

  return buildReportPdfHtml({
    title: report.title,
    aiSummary: report.aiSummary,
    sections: parseReportSections(report.sections),
    periodStart: report.periodStart?.toISOString().slice(0, 10) ?? null,
    periodEnd: report.periodEnd?.toISOString().slice(0, 10) ?? null,
  });
}
