import "server-only";

import { ResearchReportStatus, ResearchReportType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateResearchJson } from "@/lib/research/gemini-client";
import {
  buildResearchAiStep,
  mergeResearchAiMeta,
  researchAiMetaFromSteps,
} from "@/lib/research/llm";
import { aggregateReportData } from "@/lib/research/reports/aggregate-report-data";
import { buildReportPrompt } from "@/lib/research/reports/prompts/report-prompts";
import type { ReportConfig, ReportSection } from "@/lib/research/reports/types";

type GenerateResult = {
  aiSummary: string;
  sections: ReportSection[];
};

function parseConfig(raw: unknown): ReportConfig {
  if (!raw || typeof raw !== "object") return {};
  return raw as ReportConfig;
}

function defaultTitle(type: ResearchReportType, category?: string): string {
  const now = new Date();
  switch (type) {
    case "WEEKLY":
      return `Laporan Mingguan Research Hub — ${now.toLocaleDateString("id-ID")}`;
    case "CATEGORY_DEEP_DIVE":
      return `Deep Dive: ${category ?? "Kategori"}`;
    case "COMPETITOR_BATTLE":
      return "Competitor Battle Card";
    case "TREND_BRIEF":
      return "Trend Brief";
    default:
      return `Laporan Riset — ${now.toLocaleDateString("id-ID")}`;
  }
}

export async function generateResearchReport(reportId: string): Promise<void> {
  const report = await prisma.researchReport.findUnique({
    where: { id: reportId },
  });
  if (!report) throw new Error("Laporan tidak ditemukan.");

  const config = parseConfig(report.config);
  const periodEnd = report.periodEnd ?? new Date();
  const periodStart =
    report.periodStart ??
    new Date(periodEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

  await prisma.researchReport.update({
    where: { id: reportId },
    data: { status: ResearchReportStatus.GENERATING, errorMessage: null },
  });

  try {
    const data = await aggregateReportData({
      periodStart,
      periodEnd,
      category: config.category,
      competitorId: config.competitorId,
      digestId: config.digestId,
      modules: config.modules,
      sources: config.sources,
    });

    const prompt = buildReportPrompt({
      type: report.type,
      title: report.title,
      data,
      category: config.category,
    });

    let actualModel: string | undefined;
    const result = await generateResearchJson<GenerateResult>(prompt, {
      tier: "pro",
      onModelUsed: (m) => (actualModel = m),
    });

    // Regenerate = versi baru; konten lama diarsip ke revisions, bukan ditimpa.
    // Keputusan bisnis bisa saja mengutip versi lama — riwayat harus bisa diaudit.
    const hasPriorContent =
      Array.isArray(report.sections) && report.sections.length > 0;
    if (hasPriorContent) {
      await prisma.researchReportRevision.upsert({
        where: {
          reportId_version: { reportId, version: report.version },
        },
        create: {
          reportId,
          version: report.version,
          sections: report.sections ?? [],
          aiSummary: report.aiSummary,
          actionItems: report.actionItems ?? [],
          metrics: report.metrics ?? undefined,
          aiMeta: report.aiMeta ?? undefined,
          generatedAt: report.updatedAt,
        },
        update: {},
      });
    }

    await prisma.researchReport.update({
      where: { id: reportId },
      data: {
        status: ResearchReportStatus.READY,
        aiSummary: result.aiSummary ?? null,
        sections: result.sections ?? [],
        actionItems: data.actionItems,
        feedbackLoop: data.feedbackLoop,
        metrics: data.activity,
        periodStart,
        periodEnd,
        version: hasPriorContent ? report.version + 1 : report.version,
        aiMeta: researchAiMetaFromSteps([
          buildResearchAiStep("Laporan riset", "pro", { actualModel }),
        ]) as object,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generate gagal";
    await prisma.researchReport.update({
      where: { id: reportId },
      data: { status: ResearchReportStatus.FAILED, errorMessage: message },
    });
    throw err;
  }
}

/** Create the report row only (status PENDING) without running generation. */
export async function createReportRecord(input: {
  type: ResearchReportType;
  title?: string;
  config?: ReportConfig;
  createdById: string;
  periodStart?: Date;
  periodEnd?: Date;
}): Promise<{ id: string }> {
  const periodEnd = input.periodEnd ?? new Date();
  const periodStart =
    input.periodStart ??
    new Date(periodEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

  const report = await prisma.researchReport.create({
    data: {
      title: input.title ?? defaultTitle(input.type, input.config?.category),
      type: input.type,
      config: input.config ?? {},
      periodStart,
      periodEnd,
      createdById: input.createdById,
    },
  });

  return { id: report.id };
}

export async function createAndGenerateReport(input: {
  type: ResearchReportType;
  title?: string;
  config?: ReportConfig;
  createdById: string;
  periodStart?: Date;
  periodEnd?: Date;
}): Promise<{ id: string }> {
  const { id } = await createReportRecord(input);
  await generateResearchReport(id);
  return { id };
}
