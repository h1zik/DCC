import { Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHero } from "@/components/page-hero";
import { getDefaultKeywordSourceConfig } from "@/lib/research/keyword-intel/keyword-source-config";
import type { KeywordSignalStats } from "@/lib/research/keyword-intel/keyword-signal-types";
import { ensureBrandHubPage } from "../layout";
import {
  BrandKeywordIntelClient,
  type BrandKeywordQueryRow,
} from "./brand-keyword-intel-client";

function parseSignalStats(raw: unknown): KeywordSignalStats | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as KeywordSignalStats;
  if (typeof s.total !== "number") return null;
  return s;
}

export default async function BrandKeywordIntelPage() {
  await ensureBrandHubPage();

  const queries = await prisma.brandKeywordQuery.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      result: { select: { keywordMatrix: true, gapKeywords: true } },
    },
  });

  const rows: BrandKeywordQueryRow[] = queries.map((q) => {
    const matrix = Array.isArray(q.result?.keywordMatrix)
      ? q.result.keywordMatrix
      : [];
    const gaps = Array.isArray(q.result?.gapKeywords)
      ? q.result.gapKeywords
      : [];
    return {
      id: q.id,
      category: q.category,
      seedKeyword: q.seedKeyword,
      marketplace: q.marketplace,
      status: q.status,
      dataNotice: q.dataNotice,
      signalStats: parseSignalStats(q.signalStats),
      keywordCount: matrix.length,
      gapCount: gaps.length,
      createdAt: q.createdAt.toISOString(),
      errorMessage: q.errorMessage,
    };
  });

  return (
    <div className="flex w-full flex-col gap-6 pb-6">
      <PageHero
        icon={Search}
        title="Keyword & Search Intel"
        subtitle="Eksplorasi keyword marketplace dan Google untuk brand Anda."
      />
      <BrandKeywordIntelClient
        queries={rows}
        defaultSourceConfig={getDefaultKeywordSourceConfig()}
      />
    </div>
  );
}
