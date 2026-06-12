import { compareConcepts } from "@/actions/research-concept-lab";
import {
  ConceptCompareClient,
  type ComparePageData,
} from "./concept-compare-client";

export default async function ConceptComparePage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const { ids: idsParam } = await searchParams;
  const conceptIds = idsParam?.split(",").filter(Boolean) ?? [];

  if (conceptIds.length < 2) {
    return (
      <div className="text-muted-foreground py-10 text-center text-sm">
        Pilih minimal 2 konsep dari halaman detail untuk dibandingkan.
      </div>
    );
  }

  const result = await compareConcepts(conceptIds.slice(0, 3));

  const data: ComparePageData = {
    ...result,
    conceptIds: conceptIds.slice(0, 3),
  };

  return (
    <div className="flex w-full flex-col gap-6 pb-6">
      <ConceptCompareClient data={data} />
    </div>
  );
}
