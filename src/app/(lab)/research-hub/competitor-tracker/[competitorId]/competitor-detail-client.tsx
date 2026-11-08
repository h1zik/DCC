"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  ExternalLink,
  LineChart,
  Package,
  RefreshCw,
  Sparkles,
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
import { MarketplaceLogo } from "@/components/research-hub/marketplace-logo";
import { RunStatusBadge } from "@/components/research-hub/kit/run-status";
import { ResearchPanelEmpty } from "@/components/research-hub/kit/research-states";
import { useResearchJobProgress } from "../../use-research-job-progress";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MARKETPLACE_LABELS } from "@/lib/research/labels";
import type { CompetitorShopMetrics } from "@/lib/research/competitor-shop-metrics";
import { lab } from "@/components/lab/lab-primitives";
import { ResearchHubDetailPage } from "@/components/research-hub/research-hub-module-page";
import { cn } from "@/lib/utils";
import type { ResearchAiMetaView } from "@/lib/research/research-module-models";
import type { DataProvenanceEntry } from "@/lib/research/scrape-data-provider";
import { ResearchModelBadgeGroup } from "@/components/research-hub/research-model-badge";
import { DetailSection } from "../_components/detail-section";
import { CompetitorAlertList } from "../_components/competitor-alert-list";
import { CompetitorDetailOverview } from "./competitor-detail-overview";

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
  "animate-in fade-in flex flex-col gap-8 pt-5 duration-200 motion-reduce:animate-none";

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
  const scraping = competitor.isScraping || awaitingScrape;
  const hasSkus = competitor.skus.length > 0;

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
      toast.error(actionErrorMessage(err, "Review Intelligence gagal dibuka. Coba lagi."));
      setReviewSkuId(null);
      return;
    }
    toast.success(
      result.created
        ? "Scrape review dimulai. Membuka Review Intelligence."
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
        toast.success("Toko ditarik ulang di background.");
        router.refresh();
      } catch (err) {
        setAwaitingScrape(false);
        toast.error(actionErrorMessage(err, "Toko gagal ditarik ulang. Coba lagi sebentar."));
      }
    });
  }

  function handleMarkAllRead() {
    startTransition(async () => {
      try {
        await markAllCompetitorAlertsRead(competitor.id);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Alert gagal ditandai dibaca."));
      }
    });
  }

  function handleMarkRead(alert: { id: string }) {
    startTransition(async () => {
      try {
        await markCompetitorAlertRead(alert.id);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Alert gagal ditandai dibaca."));
      }
    });
  }

  const refreshButton = (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={handleRefresh}
      disabled={pending || scraping}
    >
      <RefreshCw aria-hidden />
      Tarik ulang toko
    </Button>
  );

  return (
    <ResearchHubDetailPage
      backHref="/research-hub/competitor-tracker"
      backLabel="Competitor shops"
      title={competitor.name}
      meta={
        <>
          <span>{competitor.brand}</span>
          <span>{competitor.category}</span>
          <span className="inline-flex items-center gap-1.5">
            <MarketplaceLogo marketplace={competitor.marketplace} className="size-3.5" />
            {MARKETPLACE_LABELS[competitor.marketplace]}
          </span>
          {scraping ? <RunStatusBadge tone="running" label="Menarik data" /> : null}
        </>
      }
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
            <ExternalLink aria-hidden />
            Buka toko
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleRefresh}
            disabled={pending || scraping}
          >
            <RefreshCw aria-hidden />
            Tarik ulang
          </Button>
        </>
      }
    >
      <div role="status" aria-live="polite">
        {scraping ? (
          <p className="rh-meta border-border bg-muted/40 rounded-xl border px-4 py-3 text-[13px]">
            Scrape toko dan analisis rencana respons AI sedang berjalan di
            background. Halaman ini diperbarui otomatis setiap beberapa detik.
          </p>
        ) : null}
      </div>

      <CompetitorDetailOverview
        skus={competitor.skus}
        shopMetrics={competitor.shopMetrics}
        insights={competitor.insights}
        promoSkuCount={ai?.promoSkuCount ?? competitor.insights.promoCount}
        discountDepthPct={ai?.discountDepthPct ?? null}
        shareOfCategoryPct={ai?.shareOfCategoryPct ?? null}
        unreadAlerts={unreadAlerts}
      />

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
              {hasSkus ? (
                <span className="rh-num text-muted-foreground ml-1 text-xs">
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
                <span className="rh-num text-muted-foreground ml-1 text-xs">
                  {unreadAlerts}
                </span>
              ) : null}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="ringkasan" className={tabContentClass}>
          {ai?.actionPlan ? (
            <ActionPlanPanel
              plan={ai.actionPlan}
              title="Rencana respons"
              subtitle={ai.summary ?? "Rekomendasi respons kompetitif dari AI."}
            />
          ) : (
            <ResearchPanelEmpty
              icon={Sparkles}
              title="Rencana respons belum tersedia"
              description={
                scraping
                  ? "AI menyusun rencana respons setelah scrape toko selesai."
                  : "AI menyusun rencana respons dari data SKU terbaru. Tarik ulang toko untuk membuatnya."
              }
              action={scraping ? undefined : refreshButton}
            />
          )}

          <DetailSection
            id="ct-insights"
            title="Ringkasan dan kesimpulan"
            description="Dihitung dari SKU dan riwayat harga yang sudah ditarik."
          >
            <CompetitorInsightsPanel insights={competitor.insights} bare />
          </DetailSection>

          <DetailSection
            id="ct-current-price"
            title="Harga saat ini"
            description="Snapshot terakhir untuk SKU teratas."
          >
            {competitor.currentPriceBar.length > 0 ? (
              <CompetitorPriceBarChart data={competitor.currentPriceBar} />
            ) : (
              <ResearchPanelEmpty
                title="Belum ada data harga"
                description="Harga muncul setelah katalog toko berhasil ditarik."
              />
            )}
          </DetailSection>
        </TabsContent>

        <TabsContent value="sku" className={tabContentClass}>
          <DetailSection
            id="ct-skus"
            title="SKU"
            description="Tampilkan sebagai kartu atau daftar. Pilih Analisis untuk mengirim SKU ke Review Intelligence."
          >
            {hasSkus ? (
              <CompetitorSkuProductsView
                rows={competitor.skus}
                competitorId={competitor.id}
                onReviewIntel={handleSkuReviewIntel}
                reviewSkuId={reviewSkuId}
                pending={pending}
                trackerCategoryName={competitor.category || competitor.name}
              />
            ) : (
              <ResearchPanelEmpty
                icon={Package}
                title="Belum ada SKU"
                description={
                  scraping
                    ? "Katalog toko sedang ditarik. SKU muncul di sini begitu scrape selesai."
                    : "Scrape terakhir tidak menghasilkan SKU. Pastikan URL mengarah ke halaman toko, lalu tarik ulang."
                }
                action={scraping ? undefined : refreshButton}
              />
            )}
          </DetailSection>
        </TabsContent>

        <TabsContent value="analitik" className={tabContentClass}>
          <DetailSection
            id="ct-price-trend"
            title="Tren harga"
            description="Pergerakan harga per hari. Tren terbentuk dari refresh harian otomatis."
            action={
              <Tabs
                value={String(priceDays)}
                onValueChange={(v) => v && setPriceDays(Number(v) as 30 | 60 | 90)}
              >
                <TabsList className="h-8" aria-label="Rentang tren harga">
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
            {priceChart.data.length > 0 ? (
              <CompetitorPriceChart
                data={priceChart.data}
                skuNames={priceChart.skuNames}
                hasTrend={priceChart.hasTrend}
              />
            ) : (
              <ResearchPanelEmpty
                icon={LineChart}
                title={`Belum ada riwayat harga ${priceDays} hari terakhir`}
                description="Setiap refresh menyimpan satu snapshot harga. Tren muncul setelah ada beberapa snapshot."
              />
            )}
          </DetailSection>

          <DetailSection
            id="ct-share-review"
            title="Share of review"
            description="Proporsi review antar SKU teratas."
          >
            {competitor.shareOfReview.length > 0 ? (
              <ShareOfReviewChart data={competitor.shareOfReview} />
            ) : (
              <ResearchPanelEmpty
                title="Belum ada data review"
                description="Proporsi review dihitung dari jumlah review tiap SKU setelah katalog ditarik."
              />
            )}
          </DetailSection>
        </TabsContent>

        <TabsContent value="alert" className={tabContentClass}>
          <DetailSection
            id="ct-alerts"
            title="Alert"
            description="Perubahan harga, SKU baru, dan promo dari toko ini."
            action={
              unreadAlerts > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={handleMarkAllRead}
                >
                  Tandai semua dibaca
                </Button>
              ) : null
            }
          >
            {competitor.alerts.length === 0 ? (
              <ResearchPanelEmpty
                icon={Bell}
                title="Belum ada alert"
                description="Alert muncul saat refresh harian menemukan perubahan harga, SKU baru, atau promo."
              />
            ) : (
              <CompetitorAlertList
                alerts={competitor.alerts}
                pending={pending}
                onMarkRead={handleMarkRead}
              />
            )}
          </DetailSection>
        </TabsContent>
      </Tabs>
    </ResearchHubDetailPage>
  );
}
