"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Bell,
  ExternalLink,
  ImageIcon,
  LineChart,
  Package,
  Sparkles,
  Target,
} from "lucide-react";
import { harvestCompetitorVisualsAction } from "@/actions/brand-visual-research";
import { toast } from "sonner";
import { actionErrorMessage } from "@/lib/action-error-message";
import { brandHubHref, useBrandHubBrandId } from "@/hooks/use-brand-hub-brand-id";
import type { CompetitorInsights } from "@/lib/research/competitor-insights";
import { formatRp } from "@/lib/research/labels";
import { ActionPlanPanel } from "@/components/research-hub/action-plan-panel";
import { DataSourceProvenancePanel } from "@/components/research-hub/data-source-provenance-panel";
import { JobProgressBar } from "@/components/research-hub/job-progress-bar";
import { useResearchJobProgress } from "@/app/(dashboard)/research-hub/use-research-job-progress";
import { CompetitorInsightsPanel } from "@/components/research-hub/competitor-insights-panel";
import {
  CompetitorPriceBarChart,
  type PriceBarPoint,
} from "@/components/research-hub/competitor-price-bar-chart";
import { CompetitorPriceChart } from "@/components/research-hub/competitor-price-chart";
import { ShareOfReviewChart } from "@/components/research-hub/share-of-review-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MARKETPLACE_LABELS } from "@/lib/research/labels";
import {
  BrandHubPageHeader,
  BrandHubSection,
  BrandHubStatChip,
  hub,
} from "@/components/brand-hub/brand-hub-primitives";
import type { DataProvenanceEntry } from "@/lib/research/scrape-data-provider";
import { cn } from "@/lib/utils";
import type { ResearchAiMetaView } from "@/lib/research/research-module-models";
import { ResearchModelBadgeGroup } from "@/components/research-hub/research-model-badge";

type Sku = {
  id: string;
  name: string;
  productUrl: string;
  currentPrice: number | null;
  rating: number | null;
  reviewCount: number;
  isNew: boolean;
  hasPromo: boolean;
  promoText: string | null;
  priceDeltaPct: number | null;
  priceDirection: "up" | "down" | null;
};

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
  skus: Sku[];
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
  harvestableImageCount: number;
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

export function BrandCompetitorDetailClient({
  competitor,
}: {
  competitor: CompetitorDetail;
}) {
  const router = useRouter();
  const brandId = useBrandHubBrandId();
  const [pending, startTransition] = useTransition();
  const [priceDays, setPriceDays] = useState<30 | 60 | 90>(30);

  useResearchJobProgress({ inProgress: competitor.isScraping });

  const ai = (competitor.aiInsights as CompetitorAiInsights | null) ?? null;
  const unreadAlerts = competitor.alerts.filter((a) => !a.isRead).length;

  const priceChart =
    priceDays === 30
      ? competitor.priceChart30
      : priceDays === 60
        ? competitor.priceChart60
        : competitor.priceChart90;

  return (
    <div className="flex flex-col gap-6 pb-6">
      <Link
        href={brandHubHref("/brand-hub/competitor-tracker", brandId)}
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-xs transition-colors duration-150 motion-reduce:transition-none"
      >
        <Target className="size-3" aria-hidden />
        Kembali ke Competitor Tracker
      </Link>

      <BrandHubPageHeader
        variant="detail"
        icon={Target}
        eyebrow="Competitor Tracker"
        title={competitor.name}
        description={`${competitor.brand} · ${competitor.category} · ${MARKETPLACE_LABELS[competitor.marketplace]}`}
        right={
          <>
            <ResearchModelBadgeGroup meta={competitor.aiMeta} />
            <Badge variant="secondary" className="text-[10px]">
              Dikelola Market Analyst
            </Badge>
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
              variant="outline"
              disabled={pending || competitor.harvestableImageCount === 0}
              onClick={() =>
                startTransition(async () => {
                  try {
                    const result = await harvestCompetitorVisualsAction(
                      competitor.id,
                      brandId,
                    );
                    toast.success(
                      `${result.harvested} gambar ditambahkan ke Visual Library.`,
                    );
                    router.refresh();
                  } catch (err) {
                    toast.error(actionErrorMessage(err, "Gagal harvest visual."));
                  }
                })
              }
            >
              <ImageIcon className="mr-1.5 size-3.5" />
              Harvest Visuals ({competitor.harvestableImageCount})
            </Button>
          </>
        }
        footer={
          <div className="flex flex-wrap items-center gap-2">
            <BrandHubStatChip
              label="SKU"
              value={competitor.skus.length.toLocaleString("id-ID")}
              tone="primary"
            />
            <BrandHubStatChip
              label="Alert"
              value={unreadAlerts.toLocaleString("id-ID")}
              tone={unreadAlerts > 0 ? "warning" : "neutral"}
            />
            {ai?.shareOfCategoryPct != null ? (
              <BrandHubStatChip
                label="Share kategori"
                value={`${ai.shareOfCategoryPct.toFixed(1)}%`}
              />
            ) : null}
            {ai?.discountDepthPct != null ? (
              <BrandHubStatChip
                label="Kedalaman diskon"
                value={`~${ai.discountDepthPct.toFixed(0)}%`}
              />
            ) : null}
            {ai?.promoSkuCount != null ? (
              <BrandHubStatChip
                label="SKU promo"
                value={ai.promoSkuCount.toLocaleString("id-ID")}
              />
            ) : null}
          </div>
        }
      />

      {competitor.isScraping ? (
        <div className={hub.entrance}>
          <JobProgressBar
            title="Mengambil & menganalisis data kompetitor"
            percent={45}
            stepLabel="Scrape toko berjalan di Research Hub — halaman refresh otomatis."
          />
        </div>
      ) : null}

      <DataSourceProvenancePanel entries={competitor.dataProvenance} />

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
            <BrandHubSection
              title="Response Playbook"
              description={ai.summary ?? "Rekomendasi respons kompetitif dari AI."}
              delayMs={0}
            >
              <ActionPlanPanel
                plan={ai.actionPlan}
                title="Response Playbook (AI)"
                subtitle={ai.summary ?? undefined}
              />
            </BrandHubSection>
          ) : null}

          <BrandHubSection title="Ringkasan & Kesimpulan" delayMs={50}>
            <CompetitorInsightsPanel insights={competitor.insights} bare />
          </BrandHubSection>

          <BrandHubSection
            title="Harga Saat Ini (Top SKU)"
            description="Perbandingan harga hero SKU berdasarkan snapshot terakhir."
            delayMs={100}
          >
            <div className={hub.panel}>
              <CompetitorPriceBarChart data={competitor.currentPriceBar} />
            </div>
          </BrandHubSection>
        </TabsContent>

        <TabsContent value="sku" className={tabContentClass}>
          <BrandHubSection
            title="SKU Tracker"
            description="Produk kompetitor dari scrape Research Hub."
          >
            {competitor.skus.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Belum ada SKU — tunggu scrape selesai.
              </p>
            ) : (
              <div className={hub.panel}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produk</TableHead>
                      <TableHead className="text-right">Harga</TableHead>
                      <TableHead className="text-right">Rating</TableHead>
                      <TableHead className="text-right">Review</TableHead>
                      <TableHead>Promo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {competitor.skus.map((sku) => (
                      <TableRow key={sku.id}>
                        <TableCell>
                          <a
                            href={sku.productUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-primary font-medium"
                          >
                            {sku.name}
                          </a>
                          {sku.isNew ? (
                            <span className="bg-primary/15 text-primary ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                              Baru
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          <span>
                            {sku.currentPrice != null
                              ? formatRp(sku.currentPrice)
                              : "—"}
                          </span>
                          {sku.priceDeltaPct != null && sku.priceDirection ? (
                            <span
                              className={cn(
                                "mt-0.5 block text-[10px] font-medium",
                                sku.priceDirection === "up"
                                  ? "text-rose-600 dark:text-rose-400"
                                  : "text-emerald-600 dark:text-emerald-400",
                              )}
                            >
                              {sku.priceDirection === "up" ? "▲" : "▼"}{" "}
                              {sku.priceDeltaPct}%
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {sku.rating?.toFixed(1) ?? "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {sku.reviewCount.toLocaleString("id-ID")}
                        </TableCell>
                        <TableCell>
                          {sku.hasPromo ? (
                            <span className="bg-amber-500/15 text-amber-700 dark:text-amber-300 rounded-full px-2 py-0.5 text-[10px] font-semibold">
                              {sku.promoText ?? "Promo"}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </BrandHubSection>
        </TabsContent>

        <TabsContent value="analitik" className={tabContentClass}>
          <BrandHubSection
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
          </BrandHubSection>

          <BrandHubSection title="Share of Review">
            <div className={hub.panel}>
              <ShareOfReviewChart data={competitor.shareOfReview} />
            </div>
          </BrandHubSection>
        </TabsContent>

        <TabsContent value="alert" className={tabContentClass}>
          <BrandHubSection
            title="Alert Feed"
            description="Perubahan harga, SKU baru, dan promo dari kompetitor."
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
                    <span className="text-muted-foreground mt-2 block text-[10px]">
                      {new Date(alert.createdAt).toLocaleString("id-ID")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </BrandHubSection>
        </TabsContent>
      </Tabs>
    </div>
  );
}
