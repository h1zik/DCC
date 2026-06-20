import { compareConcepts } from "@/actions/research-concept-lab";
import { ResearchHubPageShell } from "@/components/research-hub/research-hub-primitives";
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
      <ResearchHubPageShell>
        <div className="text-muted-foreground py-10 text-center text-sm">
          Pilih minimal 2 konsep dari halaman detail untuk dibandingkan.
        </div>
      </ResearchHubPageShell>
    );
  }

  const result = await compareConcepts(conceptIds.slice(0, 3));

  const data: ComparePageData = {
    ...result,
    conceptIds: conceptIds.slice(0, 3),
    aiMeta: parseResearchAiMetaClient(result.aiMeta),
  };

  return (
    <ResearchHubPageShell>
      <ConceptCompareClient data={data} />
    </ResearchHubPageShell>
  );
}
