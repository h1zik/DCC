import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  KeywordResearchDetailClient,
  type KeywordRow,
} from "./keyword-research-detail-client";

type MonthlyTrend = { direction?: "up" | "down" | "flat" } | null;

export default async function SeoKeywordResearchDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = await prisma.seoKeywordProject.findUnique({
    where: { id: projectId },
    include: {
      keywords: {
        orderBy: [{ searchVolume: "desc" }, { keyword: "asc" }],
      },
    },
  });
  if (!project) notFound();

  const keywords: KeywordRow[] = project.keywords.map((k) => ({
    keyword: k.keyword,
    searchVolume: k.searchVolume,
    cpc: k.cpc,
    competition: k.competition,
    difficulty: k.difficulty,
    intent: k.intent,
    clusterLabel: k.clusterLabel,
    trend: (k.monthlyTrend as MonthlyTrend)?.direction ?? null,
    source: k.source,
  }));

  return (
    <KeywordResearchDetailClient
      project={{
        id: project.id,
        name: project.name,
        seedKeyword: project.seedKeyword,
        status: project.status,
        aiSummary: project.aiSummary,
        dataNotice: project.dataNotice,
        errorMessage: project.errorMessage,
      }}
      keywords={keywords}
    />
  );
}
