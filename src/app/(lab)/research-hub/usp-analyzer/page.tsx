import { BarChart3 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getAvailableContextModules } from "@/lib/research/usp-gap/gather-context";
import { listUspContextSourceOptions, parseStoredContextModules } from "@/lib/research/usp-gap/list-context-sources";
import { ResearchHubModulePage } from "@/components/research-hub/research-hub-module-page";
import {
  UspAnalyzerClient,
  type UspAnalysisRow,
} from "./usp-analyzer-client";

export default async function UspAnalyzerPage() {
  const [analyses, availableModules, sourceOptions] = await Promise.all([
    prisma.uspGapAnalysis.findMany({
      orderBy: { createdAt: "desc" },
      include: { result: true },
    }),
    getAvailableContextModules(),
    listUspContextSourceOptions(),
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
    <ResearchHubModulePage
      icon={BarChart3}
      title="USP & Gap Analyzer"
      description="Temukan celah pasar dan formulasi USP berbasis data dari modul riset."
    >
      <UspAnalyzerClient
        analyses={rows}
        availableModules={availableModules}
        sourceOptions={sourceOptions}
      />
    </ResearchHubModulePage>
  );
}
