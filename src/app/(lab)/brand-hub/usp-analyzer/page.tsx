import { BarChart3 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { BrandHubListPage } from "@/components/brand-hub/brand-hub-list-page";
import { getAvailableContextModules } from "@/lib/brand-research/gather-context";
import {
  listBrandUspContextSourceOptions,
  parseStoredContextModules,
} from "@/lib/brand-research/list-context-sources";
import { ensureBrandHubPage } from "../layout";
import {
  BrandUspAnalyzerClient,
  type UspAnalysisRow,
} from "./brand-usp-analyzer-client";

export default async function BrandUspAnalyzerPage() {
  await ensureBrandHubPage();

  const [analyses, availableModules, sourceOptions] = await Promise.all([
    prisma.brandUspAnalysis.findMany({
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
    <BrandHubListPage
      icon={BarChart3}
      eyebrow="Market Intelligence"
      title="USP & Gap Analyzer"
      subtitle="Temukan celah pasar dan formulasi USP berbasis data dari modul riset."
    >
      <BrandUspAnalyzerClient
        analyses={rows}
        availableModules={availableModules}
        sourceOptions={sourceOptions}
      />
    </BrandHubListPage>
  );
}
