"use client";

import { GitCompare, Trophy } from "lucide-react";
import { ConceptCompareTable } from "@/components/research-hub/concept-compare-table";
import { ResearchHubDetailPage } from "@/components/research-hub/research-hub-module-page";
import { ResearchPanelEmpty } from "@/components/research-hub/kit/research-states";
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
      const cur = totals.get(s.conceptId) ?? { title: s.conceptTitle, total: 0, n: 0 };
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

function Section({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="space-y-0.5">
        <h2 className="rh-section-title">{title}</h2>
        {meta ? <p className="rh-meta">{meta}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function ConceptCompareClient({ data }: { data: ComparePageData }) {
  const averages = averageScores(data);
  const winner = averages.find((a) => a.conceptId === data.winnerId) ?? null;
  const maxAvg = averages[0]?.avg || 1;

  return (
    <ResearchHubDetailPage
      icon={GitCompare}
      backHref="/research-hub/concept-lab"
      title="Perbandingan konsep"
      description="Konsep diadu langsung per dimensi validasi."
      meta={
        <>
          <span>{data.conceptIds.length} konsep</span>
          <span>{data.dimensions.length} dimensi dinilai</span>
          <ResearchModelBadgeGroup meta={data.aiMeta} />
        </>
      }
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <section aria-labelledby="compare-winner-title" className="flex flex-col gap-1">
          <h2 id="compare-winner-title" className="rh-meta">
            {winner ? "Pemenang" : "Skor rata-rata tertinggi"}
          </h2>
          {winner ? (
            <p className="text-foreground flex items-center gap-2 text-lg font-semibold">
              <Trophy className="size-4 shrink-0 text-amber-500" aria-hidden />
              {winner.conceptTitle}
            </p>
          ) : null}
          <p className="rh-num text-foreground text-4xl font-semibold tracking-tight">
            {winner?.avg ?? averages[0]?.avg ?? "—"}
          </p>
          <p className="rh-meta">Rata-rata skor semua dimensi validasi.</p>
        </section>

        <Section title="Skor rata-rata per konsep">
          <ol className="flex flex-col gap-2.5">
            {averages.map((a) => {
              const isWinner = a.conceptId === data.winnerId;
              return (
                <li key={a.conceptId} className="flex items-center gap-3">
                  <span
                    className={cn(
                      "w-44 shrink-0 truncate text-sm",
                      isWinner ? "text-foreground font-medium" : "text-muted-foreground",
                    )}
                    title={a.conceptTitle}
                  >
                    {a.conceptTitle}
                    {isWinner ? <span className="sr-only"> (pemenang)</span> : null}
                  </span>
                  <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full" aria-hidden>
                    <div
                      className={cn(
                        "h-full rounded-full",
                        isWinner ? "bg-primary" : "bg-muted-foreground/40",
                      )}
                      style={{ width: `${(a.avg / maxAvg) * 100}%` }}
                    />
                  </div>
                  <span className="rh-num w-10 shrink-0 text-right text-sm font-medium">{a.avg}</span>
                </li>
              );
            })}
          </ol>
        </Section>
      </div>

      <Section title="Ringkasan AI">
        {data.summary ? (
          <p className="max-w-[68ch] text-sm leading-relaxed">{data.summary}</p>
        ) : (
          <ResearchPanelEmpty
            title="Ringkasan belum tersedia"
            description="AI tidak mengembalikan ringkasan untuk perbandingan ini. Muat ulang halaman untuk membandingkan lagi."
          />
        )}
        {data.recommendation ? (
          <div className="max-w-[68ch] rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">Rekomendasi</p>
            <p className="mt-0.5 text-sm leading-relaxed">{data.recommendation}</p>
          </div>
        ) : null}
      </Section>

      <Section title="Matrix perbandingan" meta="Skor tiap dimensi validasi untuk setiap konsep.">
        {data.dimensions.length === 0 ? (
          <ResearchPanelEmpty
            icon={GitCompare}
            title="Belum ada dimensi yang dinilai"
            description="Validasi tiap konsep dulu agar skornya bisa dibandingkan."
          />
        ) : (
          <div className="border-border bg-card overflow-hidden rounded-xl border">
            <ConceptCompareTable dimensions={data.dimensions} />
          </div>
        )}
      </Section>
    </ResearchHubDetailPage>
  );
}
