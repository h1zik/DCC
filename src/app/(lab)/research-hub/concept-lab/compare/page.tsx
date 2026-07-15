import { GitCompare } from "lucide-react";
import { compareConcepts } from "@/actions/research-concept-lab";
import { LabEmptyState, LabPageShell } from "@/components/lab/lab-primitives";
import {
  ConceptCompareClient,
  type ComparePageData,
} from "./concept-compare-client";
import { parseResearchAiMetaClient } from "@/lib/research/research-module-models";

export default async function ConceptComparePage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const { ids: idsParam } = await searchParams;
  const conceptIds = idsParam?.split(",").filter(Boolean) ?? [];

  if (conceptIds.length < 2) {
    return (
      <LabPageShell>
        <LabEmptyState
          icon={GitCompare}
          title="Belum ada konsep untuk dibandingkan"
          description="Pilih minimal 2 konsep dari halaman detail Concept Lab untuk melihat papan perbandingan head-to-head."
        />
      </LabPageShell>
    );
  }

  const result = await compareConcepts(conceptIds.slice(0, 3));

  const data: ComparePageData = {
    ...result,
    conceptIds: conceptIds.slice(0, 3),
    aiMeta: parseResearchAiMetaClient(result.aiMeta),
  };

  // ConceptCompareClient merender ResearchHubDetailPage (sudah termasuk shell).
  return <ConceptCompareClient data={data} />;
}
