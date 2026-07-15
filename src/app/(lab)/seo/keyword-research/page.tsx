import { Search } from "lucide-react";
import { SeoAnalysisStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SeoModulePage } from "@/components/seo/seo-module-page";
import { isSeoStatusBusy } from "@/lib/seo/labels";
import {
  KeywordResearchClient,
  type KeywordPortfolioSummary,
  type KeywordProjectRow,
} from "./keyword-research-client";

export default async function SeoKeywordResearchPage() {
  const projects = await prisma.seoKeywordProject.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { keywords: true } } },
  });

  const rows: KeywordProjectRow[] = projects.map((p) => ({
    id: p.id,
    name: p.name,
    seedKeyword: p.seedKeyword,
    status: p.status,
    keywordCount: p._count.keywords,
    dataNotice: p.dataNotice,
    errorMessage: p.errorMessage,
    createdAt: p.createdAt.toISOString(),
  }));

  // Agregat ringkasan — dihitung dari data yang sudah diambil, tanpa query baru.
  const summary: KeywordPortfolioSummary = {
    totalProjects: rows.length,
    readyProjects: rows.filter((r) => r.status === SeoAnalysisStatus.READY)
      .length,
    busyProjects: rows.filter((r) => isSeoStatusBusy(r.status)).length,
    totalKeywords: rows.reduce((s, r) => s + r.keywordCount, 0),
  };

  return (
    <SeoModulePage
      icon={Search}
      title="Keyword Research & Clustering"
      description="Riset keyword Indonesia (volume, difficulty, CPC, intent) dari DataForSEO Labs, lalu kelompokkan per intent & tema. Simpan sebagai proyek yang bisa dipakai ulang."
    >
      <KeywordResearchClient projects={rows} summary={summary} />
    </SeoModulePage>
  );
}
