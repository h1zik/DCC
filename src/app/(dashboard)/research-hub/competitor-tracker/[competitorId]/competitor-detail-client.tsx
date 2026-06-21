"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
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
import {
  hub,
  ResearchHubPageHeader,
  ResearchHubSection,
  ResearchHubStatChip,
} from "@/components/research-hub/research-hub-primitives";
import { cn } from "@/lib/utils";
import type { ResearchAiMetaView } from "@/lib/research/research-module-models";
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
  skus: CompetitorSkuRow[];
  insights: CompetitorInsights;
  aiInsights: unknown;
  aiMeta: ResearchAiMetaView | null;
  isScraping: boolean;
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
    if (competitor.skus.length > 0) {
      setAwaitingScrape(false);
    }
  }, [awaitingScrape, competitor.isScraping, competitor.skus.length]);

  useEffect(() => {
    if (!awaitingScrape) return;
    const timer = window.setTimeout(() => setAwaitingScrape(false), 120_000);
    return () => window.clearTimeout(timer);
  }, [awaitingScrape]);

  const ai = (competitor.aiInsights as CompetitorAiInsights | null) ?? null;
  const unreadAlerts = competitor.alerts.filter((a) => !a.isRead).length;

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
    <div className="flex flex-col gap-6">
      <Link
        href="/research-hub/competitor-tracker"
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-xs transition-colors duration-150 motion-reduce:transition-none"
      >
        <Target className="size-3" aria-hidden />
        Kembali ke Competitor Tracker
      </Link>

      <ResearchHubPageHeader
        variant="detail"
        icon={Target}
        eyebrow="Competitor Tracker"
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
        footer={
          <div className="flex flex-wrap items-center gap-2">
            <ResearchHubStatChip
              label="SKU"
              value={competitor.skus.length.toLocaleString("id-ID")}
              tone="primary"
            />
            <ResearchHubStatChip
              label="Alert"
              value={unreadAlerts.toLocaleString("id-ID")}
              tone={unreadAlerts > 0 ? "warning" : "neutral"}
            />
            {ai?.shareOfCategoryPct != null ? (
              <ResearchHubStatChip
                label="Share kategori"
                value={`${ai.shareOfCategoryPct.toFixed(1)}%`}
              />
            ) : null}
            {ai?.discountDepthPct != null ? (
              <ResearchHubStatChip
                label="Kedalaman diskon"
                value={`~${ai.discountDepthPct.toFixed(0)}%`}
              />
            ) : null}
            {ai?.promoSkuCount != null ? (
              <ResearchHubStatChip
                label="SKU promo"
                value={ai.promoSkuCount.toLocaleString("id-ID")}
              />
            ) : null}
          </div>
        }
      />

      {competitor.isScraping || awaitingScrape ? (
        <div className={hub.entrance}>
          <JobProgressBar
            title="Mengambil & menganalisis data kompetitor"
            percent={45}
            stepLabel="Scrape toko + analisis playbook AI berjalan di background — halaman refresh otomatis."
          />
        </div>
      ) : null}

      <Tabs defaultValue="ringkasan" className="gap-0">
        <div className={cn(hub.stickyToolbar, "pb-0")}>
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
            <ResearchHubSection
              title="Response Playbook"
              description={ai.summary ?? "Rekomendasi respons kompetitif dari AI."}
              delayMs={0}
            >
              <ActionPlanPanel
                plan={ai.actionPlan}
                title="Response Playbook (AI)"
                subtitle={ai.summary ?? undefined}
              />
            </ResearchHubSection>
          ) : null}

          <ResearchHubSection
            title="Ringkasan & Kesimpulan"
            delayMs={50}
          >
            <CompetitorInsightsPanel insights={competitor.insights} bare />
          </ResearchHubSection>

          <ResearchHubSection
            title="Harga Saat Ini (Top SKU)"
            description="Perbandingan harga hero SKU berdasarkan snapshot terakhir."
            delayMs={100}
          >
            <div className={hub.panel}>
              <CompetitorPriceBarChart data={competitor.currentPriceBar} />
            </div>
          </ResearchHubSection>
        </TabsContent>

        <TabsContent value="sku" className={tabContentClass}>
          <ResearchHubSection
            title="SKU Tracker"
            description="Tampilkan sebagai kartu atau daftar. Klik Analisis untuk kirim ke Review Intelligence."
          >
            <CompetitorSkuProductsView
              rows={competitor.skus}
              onReviewIntel={handleSkuReviewIntel}
              reviewSkuId={reviewSkuId}
              pending={pending}
            />
          </ResearchHubSection>
        </TabsContent>

        <TabsContent value="analitik" className={tabContentClass}>
          <ResearchHubSection
            title="Trend Harga"
            description="Pergerakan harga per hari (butuh refresh harian / cron)."
            action={
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
            }
          >
            <div className={hub.panel}>
              <CompetitorPriceChart
                data={priceChart.data}
                skuNames={priceChart.skuNames}
                hasTrend={priceChart.hasTrend}
              />
            </div>
          </ResearchHubSection>

          <ResearchHubSection title="Share of Review">
            <div className={hub.panel}>
              <ShareOfReviewChart data={competitor.shareOfReview} />
            </div>
          </ResearchHubSection>
        </TabsContent>

        <TabsContent value="alert" className={tabContentClass}>
          <ResearchHubSection
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
                      hub.nestedPanel,
                      hub.entrance,
                      "text-sm",
                      alert.isRead
                        ? "opacity-60"
                        : "border-primary/20 bg-primary/5",
                    )}
                    style={
                      index > 0 && index < 8
                        ? { animationDelay: `${index * 30}ms` }
                        : undefined
                    }
                  >
                    <p>{alert.message}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
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
          </ResearchHubSection>
        </TabsContent>
      </Tabs>
    </div>
  );
}
