"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  ExternalLink,
  ImageIcon,
  LineChart,
  Package,
  Search,
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
import { useResearchJobProgress } from "@/app/(lab)/research-hub/use-research-job-progress";
import { CompetitorInsightsPanel } from "@/components/research-hub/competitor-insights-panel";
import {
  CompetitorPriceBarChart,
  type PriceBarPoint,
} from "@/components/research-hub/competitor-price-bar-chart";
import { CompetitorPriceChart } from "@/components/research-hub/competitor-price-chart";
import { ShareOfReviewChart } from "@/components/research-hub/share-of-review-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { lab, LabSection } from "@/components/lab/lab-primitives";
import { BrandHubDetailPage } from "@/components/brand-hub/brand-hub-list-page";
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

export function BrandCompetitorDetailClient({
  competitor,
}: {
  competitor: CompetitorDetail;
}) {
  const router = useRouter();
  const brandId = useBrandHubBrandId();
  const [pending, startTransition] = useTransition();
  const [priceDays, setPriceDays] = useState<30 | 60 | 90>(30);
  const [skuQuery, setSkuQuery] = useState("");

  useResearchJobProgress({ inProgress: competitor.isScraping });

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

  /* ----------------------- Agregat murah dari SKU ter-fetch ----------------------- */
  const skuStats = useMemo(() => {
    const ratings = competitor.skus
      .map((s) => s.rating)
      .filter((r): r is number => r != null);
    return {
      avgRating: ratings.length
        ? ratings.reduce((a, b) => a + b, 0) / ratings.length
        : null,
      totalReviews: competitor.skus.reduce((sum, s) => sum + s.reviewCount, 0),
    };
  }, [competitor.skus]);

  const filteredSkus = useMemo(() => {
    const q = skuQuery.trim().toLowerCase();
    if (!q) return competitor.skus;
    return competitor.skus.filter((s) => s.name.toLowerCase().includes(q));
  }, [competitor.skus, skuQuery]);

  const priceChart =
    priceDays === 30
      ? competitor.priceChart30
      : priceDays === 60
        ? competitor.priceChart60
        : competitor.priceChart90;

  return (
    <BrandHubDetailPage
      icon={Target}
      backHref={brandHubHref("/brand-hub/competitor-tracker", brandId)}
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
    >
      {competitor.isScraping ? (
        <div className={lab.entrance}>
          <JobProgressBar
            title="Mengambil & menganalisis data kompetitor"
            percent={45}
            stepLabel="Scrape toko berjalan di Research Hub — halaman refresh otomatis."
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
        {/* SKU dipantau — hero pink */}
        <div className="bento-tile col-span-2 row-span-2 border-transparent bg-pink-600 shadow-md shadow-pink-600/20 lg:col-span-1 dark:bg-pink-500">
          <span className="text-[11.5px] font-semibold text-pink-100 dark:text-pink-950/70">
            SKU dipantau
          </span>
          <span className="bento-value text-5xl text-white dark:text-pink-950">
            {competitor.skus.length.toLocaleString("id-ID")}
          </span>
          <span className="text-[11px] font-medium leading-snug text-pink-100/90 dark:text-pink-900/80">
            hasil scrape Research Hub — siap dipakai tim brand & creative
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

        {/* Visual siap harvest */}
        <div className="bento-tile">
          <span className="bento-label">Visual siap harvest</span>
          <span className="bento-value">
            {competitor.harvestableImageCount.toLocaleString("id-ID")}
          </span>
        </div>

        {/* Rating rata-rata */}
        <div className="bento-tile">
          <span className="bento-label">Rating rata-rata</span>
          <span className="bento-value">
            {skuStats.avgRating != null ? skuStats.avgRating.toFixed(1) : "—"}
            {skuStats.avgRating != null ? (
              <span className="text-muted-foreground/60 text-lg font-bold">
                /5
              </span>
            ) : null}
          </span>
        </div>

        {/* SKU promo — pastel pink */}
        <div className="bento-tile border-transparent bg-[#fde7f1] dark:bg-pink-400/10">
          <span className="text-[11.5px] font-semibold text-pink-700/70 dark:text-pink-300/70">
            SKU promo
          </span>
          <span className="bento-value text-pink-900 dark:text-pink-300">
            {(ai?.promoSkuCount ?? competitor.insights.promoCount).toLocaleString(
              "id-ID",
            )}
            {competitor.insights.skuCount > 0 ? (
              <span className="text-lg font-bold text-pink-800/50 dark:text-pink-300/50">
                {" "}
                · {competitor.insights.promoPct}%
              </span>
            ) : null}
          </span>
          {ai?.discountDepthPct != null ? (
            <span className="text-[11px] font-medium text-pink-700/60 dark:text-pink-300/60">
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

        {/* Total review */}
        <div className="bento-tile">
          <span className="bento-label">Total review</span>
          <span className="bento-value">
            {skuStats.totalReviews.toLocaleString("id-ID")}
          </span>
        </div>

        {/* Share kategori — lavender */}
        <div className="bento-tile border-transparent bg-[#e9e3f9] dark:bg-violet-400/10">
          <span className="text-[11.5px] font-semibold text-violet-700/70 dark:text-violet-300/70">
            Share kategori
          </span>
          <span className="bento-value text-violet-900 dark:text-violet-300">
            {ai?.shareOfCategoryPct != null
              ? `${ai.shareOfCategoryPct.toFixed(1)}%`
              : "—"}
          </span>
          <span className="text-[11px] font-medium text-violet-700/60 dark:text-violet-300/60">
            estimasi AI dari data scrape
          </span>
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
          {competitor.skus.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Belum ada SKU — tunggu scrape selesai.
            </p>
          ) : (
            <div className={cn(lab.entrance, "bento-tile justify-start gap-3")}>
              {/* Toolbar tabel: count + search */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="bento-label">SKU Tracker</span>
                  <p className="text-muted-foreground text-[11px] tabular-nums">
                    {filteredSkus.length.toLocaleString("id-ID")} dari{" "}
                    {competitor.skus.length.toLocaleString("id-ID")} SKU
                  </p>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search
                    className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2"
                    aria-hidden
                  />
                  <Input
                    value={skuQuery}
                    onChange={(e) => setSkuQuery(e.target.value)}
                    placeholder="Cari nama SKU…"
                    className="h-8 pl-8 text-sm"
                  />
                </div>
              </div>

              {filteredSkus.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center text-sm">
                  Tidak ada SKU yang cocok dengan “{skuQuery}”.
                </p>
              ) : (
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
                    {filteredSkus.map((sku) => (
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
                            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700 dark:text-emerald-300">
                              <span
                                className="size-1.5 rounded-full bg-emerald-500"
                                aria-hidden
                              />
                              Baru
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          <span className="font-semibold">
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
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                              <span
                                className="size-1.5 rounded-full bg-amber-500"
                                aria-hidden
                              />
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
              )}
            </div>
          )}
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
                    <span className="text-muted-foreground text-[10px]">
                      {new Date(alert.createdAt).toLocaleString("id-ID")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </LabSection>
        </TabsContent>
      </Tabs>
    </BrandHubDetailPage>
  );
}
