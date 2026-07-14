import { FileText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { SeoModulePage } from "@/components/seo/seo-module-page";
import { ReportsClient, type ReportRow } from "./reports-client";

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

  return (
    <SeoModulePage
      icon={FileText}
      title="SEO Reports"
      description="Laporan SEO terdokumentasi — agregasi ranking, audit teknis, dan backlink. Ekspor PDF/DOCX lewat pipeline Research Reports."
    >
      <ReportsClient reports={rows} />
    </SeoModulePage>
  );
}
