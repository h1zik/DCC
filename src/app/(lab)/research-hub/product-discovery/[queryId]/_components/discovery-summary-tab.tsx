"use client";

import { Sparkles } from "lucide-react";
import { ActionPlanPanel } from "@/components/research-hub/action-plan-panel";
import { DiscoveryBubbleChart } from "@/components/research-hub/discovery-bubble-chart";
import { ResearchPanelEmpty } from "@/components/research-hub/kit/research-states";
import { formatRp } from "@/lib/research/labels";
import type { DiscoveryInsights } from "./discovery-types";

function SectionHeading({
  id,
  title,
  meta,
}: {
  id: string;
  title: string;
  meta?: string;
}) {
  return (
    <div>
      <h2 id={id} className="rh-section-title">
        {title}
      </h2>
      {meta ? <p className="rh-meta">{meta}</p> : null}
    </div>
  );
}

export function DiscoverySummaryTab({
  insights,
  actionPlan,
  inProgress,
}: {
  insights: DiscoveryInsights | null;
  actionPlan: unknown;
  inProgress: boolean;
}) {
  const bubble = insights?.bubble ?? [];
  const priceBands = insights?.priceBands ?? [];
  const valueLeaders = insights?.valueLeaders ?? [];
  const hasAnything =
    Boolean(actionPlan) ||
    bubble.length > 0 ||
    priceBands.length > 0 ||
    valueLeaders.length > 0;

  if (!hasAnything) {
    return (
      <ResearchPanelEmpty
        icon={Sparkles}
        title="Analisis belum tersedia"
        description={
          inProgress
            ? "Analisis harga dan rencana aksi dibuat setelah semua produk selesai ditarik."
            : "Analisis dibuat dari produk yang ditarik. Ambil ulang produk untuk membuat analisis baru."
        }
      />
    );
  }

  return (
    <>
      {actionPlan ? (
        <ActionPlanPanel
          plan={actionPlan}
          title="Rencana aksi pasar (AI)"
          subtitle={insights?.summary ?? undefined}
        />
      ) : null}

      {bubble.length > 0 ? (
        <section aria-labelledby="pd-bubble" className="flex flex-col gap-3">
          <SectionHeading
            id="pd-bubble"
            title="Peta harga, rating, dan volume"
            meta="Ukuran gelembung menunjukkan jumlah terjual. Area kosong adalah celah pasar."
          />
          <div className="border-border rounded-xl border p-3">
            <DiscoveryBubbleChart points={bubble} />
          </div>
        </section>
      ) : null}

      {priceBands.length > 0 || valueLeaders.length > 0 ? (
        <div className="grid gap-8 lg:grid-cols-2">
          {priceBands.length > 0 ? (
            <section aria-labelledby="pd-bands" className="flex flex-col gap-3">
              <SectionHeading
                id="pd-bands"
                title="Rentang harga"
                meta="Jumlah produk, rating rata-rata, dan penjualan per rentang harga."
              />
              <ul className="divide-border/70 border-border/70 divide-y border-y">
                {priceBands.map((b) => (
                  <li
                    key={b.label}
                    className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-baseline gap-x-4 py-2.5 text-sm"
                  >
                    <span className="rh-num font-medium">{b.label}</span>
                    <span className="rh-num text-muted-foreground text-right">
                      {b.count} produk
                    </span>
                    <span className="rh-num text-muted-foreground text-right">
                      Rating {b.avgRating.toFixed(1)}
                    </span>
                    <span className="rh-num text-muted-foreground text-right">
                      ~{Math.round(b.avgSold).toLocaleString("id-ID")} terjual
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {valueLeaders.length > 0 ? (
            <section aria-labelledby="pd-leaders" className="flex flex-col gap-3">
              <SectionHeading
                id="pd-leaders"
                title="Produk paling bernilai"
                meta="Diurutkan dari rating dan kecepatan terjual dibanding harganya."
              />
              <ul className="divide-border/70 border-border/70 divide-y border-y">
                {valueLeaders.map((v) => (
                  <li
                    key={v.name}
                    className="flex items-baseline justify-between gap-4 py-2.5 text-sm"
                  >
                    <span className="line-clamp-1 min-w-0 font-medium">{v.name}</span>
                    <span className="rh-num text-muted-foreground flex shrink-0 gap-4">
                      <span>Rating {v.rating.toFixed(1)}</span>
                      <span>{formatRp(v.price)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
