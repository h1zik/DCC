import { Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { SeoModulePage } from "@/components/seo/seo-module-page";
import {
  KeywordResearchClient,
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

  return (
    <SeoModulePage
      icon={Search}
      title="Keyword Research & Clustering"
      description="Riset keyword Indonesia (volume, difficulty, CPC, intent) dari DataForSEO Labs, lalu kelompokkan per intent & tema. Simpan sebagai proyek yang bisa dipakai ulang."
    >
      <KeywordResearchClient projects={rows} />
    </SeoModulePage>
  );
}
