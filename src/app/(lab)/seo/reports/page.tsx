import { FileText } from "lucide-react";
import { SeoAnalysisStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SeoModulePage } from "@/components/seo/seo-module-page";
import { isSeoStatusBusy } from "@/lib/seo/labels";
import {
  ReportsClient,
  type ReportRow,
  type ReportsSummary,
} from "./reports-client";

export default async function SeoReportsPage() {
  const reports = await prisma.seoReport.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      errorMessage: true,
      createdAt: true,
    },
  });

  const rows: ReportRow[] = reports.map((r) => ({
    id: r.id,
    title: r.title,
    type: r.type,
    status: r.status,
    errorMessage: r.errorMessage,
    createdAt: r.createdAt.toISOString(),
  }));

  // Agregat ringkasan — dihitung dari data yang sudah diambil (tanpa query baru).
  const summary: ReportsSummary = {
    total: rows.length,
    ready: rows.filter((r) => r.status === SeoAnalysisStatus.READY).length,
    busy: rows.filter((r) => isSeoStatusBusy(r.status)).length,
    failed: rows.filter((r) => r.status === SeoAnalysisStatus.FAILED).length,
    lastCreatedAt: rows[0]?.createdAt ?? null,
  };

  return (
    <SeoModulePage
      icon={FileText}
      title="SEO Reports"
      description="Laporan SEO terdokumentasi — agregasi ranking, audit teknis, dan backlink. Ekspor PDF/DOCX lewat pipeline Research Reports."
    >
      <ReportsClient reports={rows} summary={summary} />
    </SeoModulePage>
  );
}
