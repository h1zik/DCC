"use client";

import Link from "next/link";
import { GitCompare, Trophy } from "lucide-react";
import { ConceptCompareTable } from "@/components/research-hub/concept-compare-table";
import {
  hub,
  ResearchHubPageHeader,
  ResearchHubSection,
  ResearchHubStatChip,
} from "@/components/research-hub/research-hub-primitives";
import { cn } from "@/lib/utils";
import type { ResearchAiMetaView } from "@/lib/research/research-module-models";
import { ResearchModelBadgeGroup } from "@/components/research-hub/research-model-badge";

export type ComparePageData = {
  summary: string;
  dimensions: {
    label: string;
    scores: {
      conceptId: string;
      conceptTitle: string;
      score: number;
      note: string;
    }[];
  }[];
  winnerId: string | null;
  recommendation: string;
  conceptIds: string[];
  aiMeta: ResearchAiMetaView | null;
};

export function ConceptCompareClient({ data }: { data: ComparePageData }) {
  const winnerTitle = data.dimensions[0]?.scores.find(
    (s) => s.conceptId === data.winnerId,
  )?.conceptTitle;

  return (
    <div className="flex flex-col gap-6 pb-6">
      <Link
        href="/research-hub/concept-lab"
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-xs transition-colors duration-150 motion-reduce:transition-none"
      >
        <GitCompare className="size-3" aria-hidden />
        Kembali ke Concept Lab
      </Link>

      <ResearchHubPageHeader
        variant="detail"
        icon={GitCompare}
        eyebrow="Concept Lab"
        title="Perbandingan Konsep"
        description={`${data.conceptIds.length} konsep dibandingkan head-to-head`}
        right={<ResearchModelBadgeGroup meta={data.aiMeta} />}
        footer={
          <div className="flex flex-wrap gap-2">
            <ResearchHubStatChip
              label="Konsep"
              value={data.conceptIds.length.toLocaleString("id-ID")}
              tone="primary"
            />
            {winnerTitle ? (
              <ResearchHubStatChip
                label="Pemenang"
                value={winnerTitle.slice(0, 24)}
                tone="success"
              />
            ) : null}
          </div>
        }
      />

      <ResearchHubSection title="Ringkasan AI" delayMs={0}>
        <div className={cn(hub.panel, "space-y-3 text-sm leading-relaxed")}>
          <p>{data.summary}</p>
          {data.recommendation ? (
            <p
              className={cn(
                hub.nestedPanel,
                "border-emerald-500/30 font-medium",
              )}
            >
              <Trophy className="mr-1.5 inline size-4 text-emerald-600" aria-hidden />
              {data.recommendation}
            </p>
          ) : null}
        </div>
      </ResearchHubSection>

      <ResearchHubSection
        title="Matrix Perbandingan"
        description="Skor per dimensi validasi untuk setiap konsep."
        delayMs={50}
      >
        <div className={hub.panel}>
          <ConceptCompareTable dimensions={data.dimensions} />
        </div>
      </ResearchHubSection>
    </div>
  );
}
