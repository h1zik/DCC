import { Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHero } from "@/components/page-hero";
import {
  KeywordIntelClient,
  type KeywordQueryRow,
} from "./keyword-intel-client";

export default async function KeywordIntelPage() {
  const queries = await prisma.keywordIntelQuery.findMany({
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
        title="Keyword & Search Intel"
        subtitle="Eksplorasi keyword marketplace dan Google — volume, gap, naming, dan copywriting."
      />
      <KeywordIntelClient queries={rows} />
    </div>
  );
}
