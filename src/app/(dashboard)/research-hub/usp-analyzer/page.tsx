import { BarChart3 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getAvailableContextModules } from "@/lib/research/usp-gap/gather-context";
import { PageHero } from "@/components/page-hero";
import {
  UspAnalyzerClient,
  type UspAnalysisRow,
} from "./usp-analyzer-client";

export default async function UspAnalyzerPage() {
  const [analyses, availableModules] = await Promise.all([
    prisma.uspGapAnalysis.findMany({
      orderBy: { createdAt: "desc" },
      include: { result: true },
    }),
    getAvailableContextModules(),
  ]);

  const rows: UspAnalysisRow[] = analyses.map((a) => {
    const uspCandidates = Array.isArray(a.result?.uspCandidates)
      ? a.result!.uspCandidates
      : [];
    const ctx =
      a.contextModules && typeof a.contextModules === "object"
        ? (a.contextModules as UspAnalysisRow["contextModules"])
        : {};

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
        title="USP & Gap Analyzer"
        subtitle="Temukan celah pasar dan formulasi USP berbasis data dari modul riset."
      />
      <UspAnalyzerClient analyses={rows} availableModules={availableModules} />
    </div>
  );
}
