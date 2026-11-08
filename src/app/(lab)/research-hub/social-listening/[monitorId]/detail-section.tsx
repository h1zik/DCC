"use client";

import {
  ResearchFacts,
  type ResearchFact,
} from "@/components/research-hub/kit/research-section";

// Dipindah ke kit bersama; nama lama dipertahankan untuk pemanggil modul ini.
export { ResearchSection as DetailSection } from "@/components/research-hub/kit/research-section";

export function MetricList({
  items,
  className,
}: {
  items: ResearchFact[];
  className?: string;
}) {
  return <ResearchFacts facts={items} className={className} />;
}
