import { GitCompare } from "lucide-react";
import { compareConcepts } from "@/actions/research-concept-lab";
import { LabEmptyState } from "@/components/lab/lab-primitives";
import { ResearchHubDetailPage } from "@/components/research-hub/research-hub-module-page";
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
      <ResearchHubDetailPage
        icon={GitCompare}
        backHref="/research-hub/concept-lab"
        title="Perbandingan konsep"
      >
        <LabEmptyState
          icon={GitCompare}
          title="Belum ada konsep untuk dibandingkan"
          description="Buka salah satu konsep, lalu pilih konsep pembanding di tab Bandingkan. Perbandingan butuh minimal dua konsep."
        />
      </ResearchHubDetailPage>
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
