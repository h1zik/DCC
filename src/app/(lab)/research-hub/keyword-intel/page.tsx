import { Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ResearchHubModulePage } from "@/components/research-hub/research-hub-module-page";
import { getDefaultKeywordSourceConfig } from "@/lib/research/keyword-intel/keyword-source-config";
import type { KeywordSignalStats } from "@/lib/research/keyword-intel/keyword-signal-types";
import {
  KeywordIntelClient,
  type KeywordQueryRow,
} from "./keyword-intel-client";

function parseSignalStats(raw: unknown): KeywordSignalStats | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as KeywordSignalStats;
  if (typeof s.total !== "number") return null;
  return s;
}

export default async function KeywordIntelPage() {
  const queries = await prisma.keywordIntelQuery.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      result: { select: { keywordMatrix: true, gapKeywords: true } },
    },
  });

  const rows: KeywordQueryRow[] = queries.map((q) => {
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
    <ResearchHubModulePage
      icon={Search}
      title="Keyword & Search Intel"
      description="Eksplorasi keyword marketplace dan Google — volume, gap, naming, dan copywriting berbasis sinyal terverifikasi."
    >
      <KeywordIntelClient
        queries={rows}
        defaultSourceConfig={getDefaultKeywordSourceConfig()}
      />
    </ResearchHubModulePage>
  );
}
