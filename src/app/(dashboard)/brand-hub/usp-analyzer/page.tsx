import { BarChart3 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHero } from "@/components/page-hero";
import { ensureBrandHubPage } from "../layout";
import { getAvailableContextModules } from "@/lib/brand-research/gather-context";
import {
  listBrandUspContextSourceOptions,
  parseStoredContextModules,
} from "@/lib/brand-research/list-context-sources";
import {
  BrandUspAnalyzerClient,
  type UspAnalysisRow,
} from "./brand-usp-analyzer-client";

export default async function BrandUspAnalyzerPage() {
  const session = await ensureBrandHubPage();

  const [analyses, availableModules, sourceOptions] = await Promise.all([
    prisma.brandUspAnalysis.findMany({
      where: { createdById: session.user.id },
      orderBy: { createdAt: "desc" },
      include: { result: true },
    }),
    getAvailableContextModules(),
    listBrandUspContextSourceOptions(),
  ]);

  const rows: UspAnalysisRow[] = analyses.map((a) => {
    const uspCandidates = Array.isArray(a.result?.uspCandidates)
      ? a.result!.uspCandidates
      : [];
    const ctx = parseStoredContextModules(a.contextModules);

    return {
      id: a.id,
      category: a.category,
      status: a.status,
      differentiationScore: a.result?.differentiationScore ?? null,
      uspCount: uspCandidates.length,
      createdAt: a.createdAt.toISOString(),
      errorMessage: a.errorMessage,
      contextModules: ctx,
    };
  });

  return (
    <div className="flex w-full flex-col gap-6 pb-6">
      <PageHero
        icon={BarChart3}
        title="USP Analyzer"
        subtitle="Identifikasi unique selling points yang underutilized berbasis data brand hub."
      />
      <BrandUspAnalyzerClient
        analyses={rows}
        availableModules={availableModules}
        sourceOptions={sourceOptions}
      />
    </div>
  );
}
