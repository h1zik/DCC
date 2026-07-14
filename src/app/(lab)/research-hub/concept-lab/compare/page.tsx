import { compareConcepts } from "@/actions/research-concept-lab";
import { LabPageShell } from "@/components/lab/lab-primitives";
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
        <div className="text-muted-foreground py-10 text-center text-sm">
          Pilih minimal 2 konsep dari halaman detail untuk dibandingkan.
        </div>
      </LabPageShell>
    );
  }

  const result = await compareConcepts(conceptIds.slice(0, 3));

  const data: ComparePageData = {
    ...result,
    conceptIds: conceptIds.slice(0, 3),
    aiMeta: parseResearchAiMetaClient(result.aiMeta),
  };

  return (
    <LabPageShell>
      <ConceptCompareClient data={data} />
    </LabPageShell>
  );
}
