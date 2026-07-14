import { FileText } from "lucide-react";
import {
  getReportAvailableModules,
  listReportSourceOptions,
} from "@/lib/research/reports/list-report-source-options";
import { prisma } from "@/lib/prisma";
import { ResearchHubModulePage } from "@/components/research-hub/research-hub-module-page";
import {
  ResearchReportsClient,
  type ReportRow,
} from "./research-reports-client";

export default async function ResearchReportsPage() {
  const [reports, latestWeekly, sourceOptions, availableModules] =
    await Promise.all([
      prisma.researchReport.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.researchReport.findFirst({
        where: { type: "WEEKLY", status: "READY" },
        orderBy: { createdAt: "desc" },
      }),
      listReportSourceOptions(),
      getReportAvailableModules(),
    ]);

  const rows: ReportRow[] = reports.map((r) => ({
    id: r.id,
    title: r.title,
    type: r.type,
    status: r.status,
    periodStart: r.periodStart?.toISOString() ?? null,
    periodEnd: r.periodEnd?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    errorMessage: r.errorMessage,
  }));

  return (
    <ResearchHubModulePage
      icon={FileText}
      title="Research Reports"
      description="Laporan riset terdokumentasi — weekly digest, deep dive, battle card, dan export PDF."
    >
      <ResearchReportsClient
        reports={rows}
        latestWeeklyId={latestWeekly?.id ?? null}
        options={sourceOptions}
        availableModules={availableModules}
      />
    </ResearchHubModulePage>
  );
}
