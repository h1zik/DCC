import { Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHero } from "@/components/page-hero";
import { ensureBrandHubPage } from "../layout";
import {
  BrandKeywordIntelClient,
  type KeywordQueryRow,
} from "./brand-keyword-intel-client";

export default async function BrandKeywordIntelPage() {
  const session = await ensureBrandHubPage();

  const queries = await prisma.brandKeywordQuery.findMany({
    where: { createdById: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      result: { select: { keywordMatrix: true } },
    },
  });

  const rows: KeywordQueryRow[] = queries.map((q) => {
    const matrix = Array.isArray(q.result?.keywordMatrix)
      ? q.result.keywordMatrix
      : [];
    return {
      id: q.id,
      category: q.category,
      seedKeyword: q.seedKeyword,
      marketplace: q.marketplace,
      status: q.status,
      keywordCount: matrix.length,
      createdAt: q.createdAt.toISOString(),
      errorMessage: q.errorMessage,
    };
  });

  return (
    <div className="flex w-full flex-col gap-6 pb-6">
      <PageHero
        icon={Search}
        title="Keyword Intel"
        subtitle="Riset kata kunci pencarian, volume, dan intent untuk strategi messaging."
      />
      <BrandKeywordIntelClient queries={rows} />
    </div>
  );
}
