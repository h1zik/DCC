import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { parseReportSections } from "@/lib/research/reports/types";
import {
  ReportDetailClient,
  type ReportDetailData,
} from "./report-detail-client";
import { parseResearchAiMetaClient } from "@/lib/research/research-module-models";

export default async function ResearchReportDetailPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const { reportId } = await params;

  const report = await prisma.researchReport.findUnique({
    where: { id: reportId },
  });
  if (!report) notFound();

  const data: ReportDetailData = {
    id: report.id,
    title: report.title,
    type: report.type,
    status: report.status,
    aiSummary: report.aiSummary,
    sections: parseReportSections(report.sections),
    actionItems: Array.isArray(report.actionItems)
      ? (report.actionItems as ReportDetailData["actionItems"])
      : [],
    feedbackLoop:
      report.feedbackLoop &&
      typeof report.feedbackLoop === "object" &&
      "nodes" in report.feedbackLoop
        ? (report.feedbackLoop as ReportDetailData["feedbackLoop"])
        : null,
    periodStart: report.periodStart?.toISOString() ?? null,
    periodEnd: report.periodEnd?.toISOString() ?? null,
    errorMessage: report.errorMessage,
    aiMeta: parseResearchAiMetaClient(report.aiMeta),
    sharePath: `/research-hub/research-reports/${report.id}`,
  };

  return (
    <div className="flex w-full flex-col gap-6 pb-6">
      <ReportDetailClient data={data} />
    </div>
  );
}
