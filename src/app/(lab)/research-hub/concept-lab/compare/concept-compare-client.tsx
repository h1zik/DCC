"use client";

import { GitCompare, Trophy } from "lucide-react";
import { ConceptCompareTable } from "@/components/research-hub/concept-compare-table";
import { ResearchHubDetailPage } from "@/components/research-hub/research-hub-module-page";
import { lab } from "@/components/lab/lab-primitives";
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

/** Rata-rata skor per konsep lintas semua dimensi (dari data yang sudah ada). */
function averageScores(
  data: ComparePageData,
): { conceptId: string; conceptTitle: string; avg: number }[] {
  const totals = new Map<string, { title: string; total: number; n: number }>();
  for (const dim of data.dimensions) {
    for (const s of dim.scores) {
      const cur = totals.get(s.conceptId) ?? {
        title: s.conceptTitle,
        total: 0,
        n: 0,
      };
      cur.total += s.score;
      cur.n += 1;
      totals.set(s.conceptId, cur);
    }
  }
  return [...totals.entries()]
    .map(([conceptId, { title, total, n }]) => ({
      conceptId,
      conceptTitle: title,
      avg: n > 0 ? Math.round((total / n) * 10) / 10 : 0,
    }))
    .sort((a, b) => b.avg - a.avg);
}

export function ConceptCompareClient({ data }: { data: ComparePageData }) {
  const averages = averageScores(data);
  const winner = averages.find((a) => a.conceptId === data.winnerId) ?? null;
  const maxAvg = averages[0]?.avg || 1;

  return (
    <ResearchHubDetailPage
      icon={GitCompare}
      backHref="/research-hub/concept-lab"
      title="Perbandingan Konsep"
      description={`${data.conceptIds.length} konsep dibandingkan head-to-head per dimensi validasi`}
      right={<ResearchModelBadgeGroup meta={data.aiMeta} />}
    >
      {/* Papan hero bento */}
      <div
        className={cn(
          lab.entrance,
          "grid grid-flow-row-dense auto-rows-[6.75rem] grid-cols-2 gap-3 lg:grid-cols-4",
        )}
      >
        <div className="bento-tile row-span-2 border-transparent bg-violet-600 shadow-md shadow-violet-600/20 dark:bg-violet-500">
          <span className="text-[11.5px] font-semibold text-violet-100 dark:text-violet-950/70">
            {winner ? "Skor pemenang" : "Skor tertinggi"}
          </span>
          <span className="bento-value text-5xl text-white dark:text-violet-950">
            {Math.round(winner?.avg ?? maxAvg)}
          </span>
          <span className="text-xs font-medium leading-snug text-violet-100/90 dark:text-violet-900/80">
            {winner
              ? winner.conceptTitle
              : "rata-rata semua dimensi validasi"}
          </span>
        </div>

        {/* Skor rata-rata per konsep — tile lebar */}
        <div className="bento-tile col-span-2 row-span-2 justify-start gap-3">
          <div className="flex items-center justify-between">
            <span className="bento-label">Skor rata-rata per konsep</span>
            <span className="text-muted-foreground text-[11px] tabular-nums">
              {data.dimensions.length} dimensi
            </span>
          </div>
          <div className="flex flex-col gap-2.5">
            {averages.map((a) => {
              const isWinner = a.conceptId === data.winnerId;
              return (
                <div key={a.conceptId} className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "w-40 shrink-0 truncate text-xs",
                      isWinner
                        ? "text-foreground font-semibold"
                        : "text-muted-foreground",
                    )}
                    title={a.conceptTitle}
                  >
                    {isWinner ? (
                      <Trophy
                        className="mr-1 inline size-3 text-amber-500"
                        aria-hidden
                      />
                    ) : null}
                    {a.conceptTitle}
                  </span>
                  <div className="bg-muted h-2.5 flex-1 overflow-hidden rounded-full">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        isWinner
                          ? "bg-violet-600 dark:bg-violet-400"
                          : "bg-muted-foreground/40",
                      )}
                      style={{ width: `${(a.avg / maxAvg) * 100}%` }}
                    />
                  </div>
                  <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums">
                    {a.avg}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bento-tile">
          <span className="bento-label">Konsep dibandingkan</span>
          <span className="bento-value">{data.conceptIds.length}</span>
        </div>

        <div className="bento-tile border-transparent bg-[#e9e3f9] dark:bg-violet-400/10">
          <span className="text-[11.5px] font-semibold text-violet-700/70 dark:text-violet-300/70">
            Dimensi dinilai
          </span>
          <span className="bento-value text-violet-900 dark:text-violet-300">
            {data.dimensions.length}
          </span>
        </div>
      </div>

      {/* Ringkasan AI */}
      <div className={cn(lab.entrance, "bento-tile justify-start gap-3")}>
        <span className="bento-label">Ringkasan AI</span>
        <p className="text-sm leading-relaxed">{data.summary}</p>
        {data.recommendation ? (
          <p className="flex items-start gap-2.5 rounded-xl bg-emerald-500/10 p-3 text-sm font-medium text-emerald-800 dark:text-emerald-200">
            <Trophy
              className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
              aria-hidden
            />
            {data.recommendation}
          </p>
        ) : null}
      </div>

      {/* Matrix perbandingan */}
      <div className={cn(lab.entrance, "bento-tile justify-start gap-3")}>
        <div className="flex items-center justify-between">
          <span className="bento-label">Matrix perbandingan</span>
          <span className="text-muted-foreground text-[11px]">
            skor per dimensi validasi untuk setiap konsep
          </span>
        </div>
        <ConceptCompareTable dimensions={data.dimensions} />
      </div>
    </ResearchHubDetailPage>
  );
}
