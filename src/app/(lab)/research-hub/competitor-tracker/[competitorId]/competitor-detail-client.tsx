"use client";

import { useMemo, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  ExternalLink,
  LineChart,
  Package,
  RefreshCw,
  Sparkles,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import {
  markAllCompetitorAlertsRead,
  markCompetitorAlertRead,
  refreshResearchCompetitor,
} from "@/actions/research-competitor";
import { createReviewIntelFromCompetitorSku } from "@/actions/research-review-intelligence";
import { actionErrorMessage } from "@/lib/action-error-message";
import type { CompetitorInsights } from "@/lib/research/competitor-insights";
import { ActionPlanPanel } from "@/components/research-hub/action-plan-panel";
import { DataSourceProvenancePanel } from "@/components/research-hub/data-source-provenance-panel";
import { CompetitorInsightsPanel } from "@/components/research-hub/competitor-insights-panel";
import {
  CompetitorPriceBarChart,
  type PriceBarPoint,
} from "@/components/research-hub/competitor-price-bar-chart";
import { CompetitorPriceChart } from "@/components/research-hub/competitor-price-chart";
import { CompetitorSkuProductsView } from "@/components/research-hub/competitor-sku-products-view";
import type { CompetitorSkuRow } from "@/components/research-hub/competitor-sku-table";
import { ShareOfReviewChart } from "@/components/research-hub/share-of-review-chart";
import { JobProgressBar } from "@/components/research-hub/job-progress-bar";
import { useResearchJobProgress } from "../../use-research-job-progress";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MARKETPLACE_LABELS } from "@/lib/research/labels";
import { CompetitorShopMetricsPanel } from "@/components/research-hub/competitor-shop-metrics-panel";
import type { CompetitorShopMetrics } from "@/lib/research/competitor-shop-metrics";
import {
  formatCompactCount,
  formatRevenueIdr,
} from "@/lib/research/shop-product-metrics";
import { lab, LabSection } from "@/components/lab/lab-primitives";
import { ResearchHubDetailPage } from "@/components/research-hub/research-hub-module-page";
import { cn } from "@/lib/utils";
import type { ResearchAiMetaView } from "@/lib/research/research-module-models";
import type { DataProvenanceEntry } from "@/lib/research/scrape-data-provider";
import { ResearchModelBadgeGroup } from "@/components/research-hub/research-model-badge";

type PriceChartBundle = {
  data: Record<string, string | number | null>[];
  skuNames: string[];
  hasTrend: boolean;
};

type Alert = {
  id: string;
  type: string;
  message: string;
  severity: string;
  isRead: boolean;
  createdAt: string;
};

export type CompetitorDetail = {
  id: string;
  name: string;
  brand: string;
  category: string;
  marketplace: keyof typeof MARKETPLACE_LABELS;
  shopUrl: string;
  shopMetrics: CompetitorShopMetrics;
  skus: CompetitorSkuRow[];
  insights: CompetitorInsights;
  aiInsights: unknown;
  aiMeta: ResearchAiMetaView | null;
  isScraping: boolean;
  dataProvenance: DataProvenanceEntry[];
  currentPriceBar: PriceBarPoint[];
  alerts: Alert[];
  priceChart30: PriceChartBundle;
  priceChart60: PriceChartBundle;
  priceChart90: PriceChartBundle;
  shareOfReview: { name: string; value: number }[];
};

type CompetitorAiInsights = {
  summary?: string | null;
  discountDepthPct?: number | null;
  shareOfCategoryPct?: number | null;
  promoSkuCount?: number;
  actionPlan?: unknown;
};

const tabContentClass =
  "animate-in fade-in slide-in-from-bottom-1 flex flex-col gap-6 duration-200 motion-reduce:animate-none pt-4";

/** Pill severity alert — warning amber, critical rose, sisanya muted. */
function SeverityPill({ severity }: { severity: string }) {
  const s = severity.toLowerCase();
  const tone =
    s === "critical" || s === "high"
      ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
      : s === "warning"
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
        : "bg-muted text-muted-foreground";
  const label =
    s === "critical" || s === "high"
      ? "Kritis"
      : s === "warning"
        ? "Perhatian"
        : "Info";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold",
        tone,
      )}
    >
      {label}
    </span>
  );
}

export function CompetitorDetailClient({
  competitor,
}: {
  competitor: CompetitorDetail;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reviewSkuId, setReviewSkuId] = useState<string | null>(null);
  const [priceDays, setPriceDays] = useState<30 | 60 | 90>(30);
  const [awaitingScrape, setAwaitingScrape] = useState(false);

  useResearchJobProgress({
    inProgress: competitor.isScraping || awaitingScrape,
    intervalMs: 5_000,
  });

  useEffect(() => {
    if (!awaitingScrape) return;
    if (competitor.isScraping) return;
    if (competitor.skus.length === 0) return;
    const timer = window.setTimeout(() => setAwaitingScrape(false), 0);
    return () => window.clearTimeout(timer);
  }, [awaitingScrape, competitor.isScraping, competitor.skus.length]);

  useEffect(() => {
    if (!awaitingScrape) return;
    const timer = window.setTimeout(() => setAwaitingScrape(false), 120_000);
    return () => window.clearTimeout(timer);
  }, [awaitingScrape]);

  const ai = (competitor.aiInsights as CompetitorAiInsights | null) ?? null;
  const unreadAlerts = competitor.alerts.filter((a) => !a.isRead).length;

  /* ------------------------ Distribusi pergerakan harga ------------------------ */
  const priceMove = useMemo(() => {
    let up = 0;
    let down = 0;
    for (const s of competitor.skus) {
      if (s.priceDirection === "up") up += 1;
      else if (s.priceDirection === "down") down += 1;
    }
    return { up, down, flat: competitor.skus.length - up - down };
  }, [competitor.skus]);

  const moveTotal = competitor.skus.length || 1;
  const moveSegments = [
    { key: "up", label: "Harga naik", count: priceMove.up, dot: "bg-rose-500" },
    {
      key: "down",
      label: "Harga turun",
      count: priceMove.down,
      dot: "bg-emerald-500",
    },
    {
      key: "flat",
      label: "Stabil / belum ada trend",
      count: priceMove.flat,
      dot: "bg-muted-foreground/25",
    },
  ] as const;

  const priceChart =
    priceDays === 30
      ? competitor.priceChart30
      : priceDays === 60
        ? competitor.priceChart60
        : competitor.priceChart90;

  async function handleSkuReviewIntel(sku: CompetitorSkuRow) {
    if (sku.reviewIntelSourceId) {
      router.push(
        `/research-hub/review-intelligence/${sku.reviewIntelSourceId}`,
      );
      return;
    }

    setReviewSkuId(sku.id);
    let result: { id: string; created: boolean };
    try {
      result = await new Promise<{ id: string; created: boolean }>(
        (resolve, reject) => {
          startTransition(async () => {
            try {
              resolve(await createReviewIntelFromCompetitorSku(sku.id));
            } catch (err) {
              reject(err);
            }
          });
        },
      );
    } catch (err) {
      toast.error(actionErrorMessage(err, "Gagal membuka Review Intelligence."));
      setReviewSkuId(null);
      return;
    }
    toast.success(
      result.created
        ? "Scrape review dimulai — membuka Review Intelligence."
        : "Membuka sumber Review Intelligence yang sudah ada.",
    );
    router.push(`/research-hub/review-intelligence/${result.id}`);
    setReviewSkuId(null);
  }

  function handleRefresh() {
    startTransition(async () => {
      try {
        setAwaitingScrape(true);
        await refreshResearchCompetitor(competitor.id);
        toast.success("Scrape kompetitor dimulai di background.");
        router.refresh();
      } catch (err) {
        setAwaitingScrape(false);
        toast.error(actionErrorMessage(err, "Gagal memproses permintaan."));
      }
    });
  }

  return (
    <ResearchHubDetailPage
      icon={Target}
      backHref="/research-hub/competitor-tracker"
      title={competitor.name}
      description={`${competitor.brand} · ${competitor.category} · ${MARKETPLACE_LABELS[competitor.marketplace]}`}
      right={
        <>
          <ResearchModelBadgeGroup meta={competitor.aiMeta} />
          <Button
            type="button"
            size="sm"
            variant="outline"
            render={
              <a
                href={competitor.shopUrl}
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            <ExternalLink className="mr-1.5 size-3.5" />
            Buka Toko
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleRefresh}
            disabled={pending || competitor.isScraping || awaitingScrape}
          >
            <RefreshCw className="mr-1.5 size-3.5" />
            Refresh
          </Button>
        </>
      }
    >
      {competitor.isScraping || awaitingScrape ? (
        <div className={lab.entrance}>
          <JobProgressBar
            title="Mengambil & menganalisis data kompetitor"
            percent={45}
            stepLabel="Scrape toko + analisis playbook AI berjalan di background — halaman refresh otomatis."
          />
        </div>
      ) : null}

      {/* Papan hero bento */}
      <div
        className={cn(
          lab.entrance,
          "grid grid-flow-row-dense auto-rows-[6.75rem] grid-cols-2 gap-3 lg:grid-cols-4",
        )}
      >
        {/* SKU dipantau — hero violet */}
        <div className="bento-tile col-span-2 row-span-2 border-transparent bg-violet-600 shadow-md shadow-violet-600/20 lg:col-span-1 dark:bg-violet-500">
          <span className="text-[11.5px] font-semibold text-violet-100 dark:text-violet-950/70">
            SKU dipantau
          </span>
          <span className="bento-value text-5xl text-white dark:text-violet-950">
            {competitor.skus.length.toLocaleString("id-ID")}
          </span>
          <span className="text-[11px] font-medium leading-snug text-violet-100/90 dark:text-violet-900/80">
            sampel ±100 SKU teratas sesuai urutan listing marketplace
          </span>
        </div>

        {/* Distribusi pergerakan harga */}
        <div className="bento-tile col-span-2 row-span-2 justify-start gap-3">
          <div className="flex items-center justify-between">
            <span className="bento-label">Pergerakan harga</span>
            <span className="text-muted-foreground text-[11px] tabular-nums">
              vs snapshot sebelumnya
            </span>
          </div>
          <div className="bg-muted flex h-2.5 overflow-hidden rounded-full">
            {moveSegments.map((s) => {
              if (s.count === 0) return null;
              return (
                <div
                  key={s.key}
                  className={s.dot}
                  style={{ width: `${(s.count / moveTotal) * 100}%` }}
                  title={`${s.label}: ${s.count}`}
                />
              );
            })}
          </div>
          <div className="flex flex-col gap-1.5">
            {moveSegments.map((s) => (
              <div key={s.key} className="flex items-center gap-2 text-xs">
                <span
                  className={cn("size-2 shrink-0 rounded-full", s.dot)}
                  aria-hidden
                />
                <span className="text-muted-foreground flex-1">{s.label}</span>
                <span className="font-semibold tabular-nums">{s.count}</span>
                <span className="text-muted-foreground w-10 text-right text-[11px] tabular-nums">
                  {Math.round((s.count / moveTotal) * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Total terjual */}
        <div className="bento-tile">
          <span className="bento-label">Total terjual</span>
          <span className="bento-value">
            {competitor.shopMetrics.totalHistoricalSold != null
              ? formatCompactCount(competitor.shopMetrics.totalHistoricalSold)
              : "—"}
          </span>
        </div>

        {/* Est. revenue */}
        <div className="bento-tile">
          <span className="bento-label">Est. revenue</span>
          <span className="bento-value text-2xl">
            {competitor.shopMetrics.totalEstimatedRevenue != null
              ? formatRevenueIdr(competitor.shopMetrics.totalEstimatedRevenue)
              : "—"}
          </span>
        </div>

        {/* Terjual bulan ini */}
        <div className="bento-tile">
          <span className="bento-label">Terjual bulan ini</span>
          <span className="bento-value">
            {competitor.shopMetrics.totalMonthlySold != null
              ? formatCompactCount(competitor.shopMetrics.totalMonthlySold)
              : "—"}
          </span>
        </div>

        {/* Total stok */}
        <div className="bento-tile">
          <span className="bento-label">Total stok</span>
          <span className="bento-value">
            {competitor.shopMetrics.totalStock != null
              ? formatCompactCount(competitor.shopMetrics.totalStock)
              : "—"}
          </span>
        </div>

        {/* SKU promo — lavender */}
        <div className="bento-tile border-transparent bg-[#e9e3f9] dark:bg-violet-400/10">
          <span className="text-[11.5px] font-semibold text-violet-700/70 dark:text-violet-300/70">
            SKU promo
          </span>
          <span className="bento-value text-violet-900 dark:text-violet-300">
            {(ai?.promoSkuCount ?? competitor.insights.promoCount).toLocaleString(
              "id-ID",
            )}
            {competitor.insights.skuCount > 0 ? (
              <span className="text-lg font-bold text-violet-800/50 dark:text-violet-300/50">
                {" "}
                · {competitor.insights.promoPct}%
              </span>
            ) : null}
          </span>
          {ai?.discountDepthPct != null ? (
            <span className="text-[11px] font-medium text-violet-700/60 dark:text-violet-300/60">
              kedalaman diskon ~{ai.discountDepthPct.toFixed(0)}%
            </span>
          ) : null}
        </div>

        {/* Alert — amber */}
        <div className="bento-tile border-transparent bg-[#ffedcd] dark:bg-amber-400/10">
          <span className="text-[11.5px] font-semibold text-amber-800/70 dark:text-amber-200/60">
            Alert belum dibaca
          </span>
          <span className="bento-value text-amber-900 dark:text-amber-300">
            {unreadAlerts.toLocaleString("id-ID")}
          </span>
          {ai?.shareOfCategoryPct != null ? (
            <span className="text-[11px] font-medium text-amber-800/60 dark:text-amber-300/60">
              share kategori {ai.shareOfCategoryPct.toFixed(1)}%
            </span>
          ) : null}
        </div>
      </div>

      <DataSourceProvenancePanel entries={competitor.dataProvenance} />

      <Tabs defaultValue="ringkasan" className="gap-0">
        <div className={cn(lab.stickyToolbar, "pb-0")}>
          <TabsList variant="line" className="h-9 w-full justify-start gap-4">
            <TabsTrigger value="ringkasan" className="px-1">
              <Sparkles className="size-3.5" aria-hidden />
              Ringkasan
            </TabsTrigger>
            <TabsTrigger value="sku" className="px-1">
              <Package className="size-3.5" aria-hidden />
              SKU
              {competitor.skus.length > 0 ? (
                <span className="text-muted-foreground ml-1 text-[10px] tabular-nums">
                  {competitor.skus.length}
                </span>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="analitik" className="px-1">
              <LineChart className="size-3.5" aria-hidden />
              Analitik
            </TabsTrigger>
            <TabsTrigger value="alert" className="px-1">
              <Bell className="size-3.5" aria-hidden />
              Alert
              {unreadAlerts > 0 ? (
                <span className="text-muted-foreground ml-1 text-[10px] tabular-nums">
                  {unreadAlerts}
                </span>
              ) : null}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="ringkasan" className={tabContentClass}>
          {ai?.actionPlan ? (
            <LabSection
              title="Response Playbook"
              description={ai.summary ?? "Rekomendasi respons kompetitif dari AI."}
              delayMs={0}
            >
              <ActionPlanPanel
                plan={ai.actionPlan}
                title="Response Playbook (AI)"
                subtitle={ai.summary ?? undefined}
              />
            </LabSection>
          ) : null}

          <div className={cn(lab.entrance, "bento-tile justify-start gap-3")}>
            <div className="flex items-center justify-between">
              <span className="bento-label">Performa penjualan toko</span>
              <span className="text-muted-foreground text-[11px]">
                agregat seluruh SKU kompetitor
              </span>
            </div>
            <CompetitorShopMetricsPanel
              metrics={competitor.shopMetrics}
              skuCount={competitor.skus.length}
            />
          </div>

          <LabSection title="Ringkasan & Kesimpulan" delayMs={50}>
            <CompetitorInsightsPanel insights={competitor.insights} bare />
          </LabSection>

          <div className={cn(lab.entrance, "bento-tile justify-start gap-3")}>
            <div className="flex items-center justify-between">
              <span className="bento-label">Harga saat ini (top SKU)</span>
              <span className="text-muted-foreground text-[11px]">
                snapshot terakhir per hero SKU
              </span>
            </div>
            <CompetitorPriceBarChart data={competitor.currentPriceBar} />
          </div>
        </TabsContent>

        <TabsContent value="sku" className={tabContentClass}>
          <LabSection
            title="SKU Tracker"
            description="Tampilkan sebagai kartu atau daftar. Klik Analisis untuk kirim ke Review Intelligence."
          >
            <CompetitorSkuProductsView
              rows={competitor.skus}
              competitorId={competitor.id}
              onReviewIntel={handleSkuReviewIntel}
              reviewSkuId={reviewSkuId}
              pending={pending}
              trackerCategoryName={competitor.category || competitor.name}
            />
          </LabSection>
        </TabsContent>

        <TabsContent value="analitik" className={tabContentClass}>
          <div className={cn(lab.entrance, "bento-tile justify-start gap-3")}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="bento-label">Trend harga</span>
                <p className="text-muted-foreground text-[11px]">
                  pergerakan harga per hari (butuh refresh harian / cron)
                </p>
              </div>
              <Tabs
                value={String(priceDays)}
                onValueChange={(v) => v && setPriceDays(Number(v) as 30 | 60 | 90)}
              >
                <TabsList className="h-8">
                  <TabsTrigger value="30" className="text-xs">
                    30 hari
                  </TabsTrigger>
                  <TabsTrigger value="60" className="text-xs">
                    60 hari
                  </TabsTrigger>
                  <TabsTrigger value="90" className="text-xs">
                    90 hari
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <CompetitorPriceChart
              data={priceChart.data}
              skuNames={priceChart.skuNames}
              hasTrend={priceChart.hasTrend}
            />
          </div>

          <div className={cn(lab.entrance, "bento-tile justify-start gap-3")}>
            <div className="flex items-center justify-between">
              <span className="bento-label">Share of review</span>
              <span className="text-muted-foreground text-[11px]">
                proporsi review antar SKU teratas
              </span>
            </div>
            <ShareOfReviewChart data={competitor.shareOfReview} />
          </div>
        </TabsContent>

        <TabsContent value="alert" className={tabContentClass}>
          <LabSection
            title="Alert Feed"
            description="Perubahan harga, SKU baru, dan promo dari kompetitor."
            action={
              competitor.alerts.some((a) => !a.isRead) ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      try {
                        await markAllCompetitorAlertsRead(competitor.id);
                        router.refresh();
                      } catch (err) {
                        toast.error(
                          actionErrorMessage(err, "Gagal memproses permintaan."),
                        );
                      }
                    })
                  }
                >
                  Tandai semua dibaca
                </Button>
              ) : null
            }
          >
            {competitor.alerts.length === 0 ? (
              <p className="text-muted-foreground text-sm">Tidak ada alert.</p>
            ) : (
              <ul className="max-h-[480px] space-y-2 overflow-y-auto">
                {competitor.alerts.map((alert, index) => (
                  <li
                    key={alert.id}
                    className={cn(
                      lab.card,
                      lab.entrance,
                      "flex flex-col gap-2 p-4 text-sm",
                      alert.isRead && "opacity-60",
                    )}
                    style={
                      index > 0 && index < 8
                        ? { animationDelay: `${index * 30}ms` }
                        : undefined
                    }
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 flex-1">{alert.message}</p>
                      <SeverityPill severity={alert.severity} />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground text-[10px]">
                        {new Date(alert.createdAt).toLocaleString("id-ID")}
                      </span>
                      {!alert.isRead ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px]"
                          onClick={() =>
                            startTransition(async () => {
                              try {
                                await markCompetitorAlertRead(alert.id);
                                router.refresh();
                              } catch (err) {
                                toast.error(
                                  actionErrorMessage(
                                    err,
                                    "Gagal memproses permintaan.",
                                  ),
                                );
                              }
                            })
                          }
                        >
                          Dibaca
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </LabSection>
        </TabsContent>
      </Tabs>
    </ResearchHubDetailPage>
  );
}
