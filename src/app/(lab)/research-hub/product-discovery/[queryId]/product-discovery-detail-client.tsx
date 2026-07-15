"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  PackageSearch,
  RefreshCw,
  Search,
  Sparkles,
  Store,
  Tags,
} from "lucide-react";
import {
  ProductDiscoveryStatus,
  ResearchMarketplace,
} from "@prisma/client";
import { toast } from "sonner";
import {
  refreshProductDiscoveryQuery,
  sendDiscoveryProductToReviewIntel,
} from "@/actions/research-product-discovery";
import { actionErrorMessage } from "@/lib/action-error-message";
import { ProductDiscoveryProductsView } from "@/components/research-hub/product-discovery-products-view";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ActionPlanPanel } from "@/components/research-hub/action-plan-panel";
import { DiscoveryBubbleChart } from "@/components/research-hub/discovery-bubble-chart";
import { JobProgressBar } from "@/components/research-hub/job-progress-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MARKETPLACE_LABELS,
  PRODUCT_DISCOVERY_STATUS_LABELS,
  formatRp,
} from "@/lib/research/labels";
import { lab } from "@/components/lab/lab-primitives";
import { ResearchHubDetailPage } from "@/components/research-hub/research-hub-module-page";
import { cn } from "@/lib/utils";
import { useProductDiscoveryPolling } from "../use-product-discovery-polling";
import type { ResearchAiMetaView } from "@/lib/research/research-module-models";
import { ResearchModelBadgeGroup } from "@/components/research-hub/research-model-badge";
import { DataSourceProvenancePanel } from "@/components/research-hub/data-source-provenance-panel";
import type { DataProvenanceEntry } from "@/lib/research/scrape-data-provider";
import type { ProductDiscoveryRow } from "@/components/research-hub/product-discovery-table";

type DiscoveryInsights = {
  summary?: string | null;
  priceStats?: { min: number; max: number; avg: number; median: number } | null;
  priceBands?: {
    label: string;
    count: number;
    avgRating: number;
    avgSold: number;
  }[];
  valueLeaders?: { name: string; rating: number; price: number }[];
  promoShare?: number;
  bubble?: {
    name: string;
    price: number;
    rating: number;
    sold: number;
    marketplace: string;
  }[];
  brandBreakdown?: {
    shopName: string;
    productCount: number;
    avgRating: number;
    totalSold: number;
    marketplaces: string[];
  }[];
};

export type ProductDiscoveryDetailData = {
  id: string;
  keyword: string;
  marketplaces: ResearchMarketplace[];
  productLimit: number;
  status: ProductDiscoveryStatus;
  productCount: number;
  shopCount: number;
  insights: unknown;
  actionPlan: unknown;
  aiMeta: ResearchAiMetaView | null;
  dataProvenance: DataProvenanceEntry[];
  products: ProductDiscoveryRow[];
};

/** Warna segmen distribusi marketplace (di-cycle berurutan). */
const MP_DOTS = [
  "bg-violet-500",
  "bg-teal-500",
  "bg-amber-400",
  "bg-rose-400",
  "bg-sky-500",
  "bg-emerald-500",
] as const;

function isInProgress(status: ProductDiscoveryStatus) {
  return status === "SCRAPING" || status === "PENDING";
}

function StatusPill({ status }: { status: ProductDiscoveryStatus }) {
  const tone =
    status === "READY"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
      : status === "FAILED"
        ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
        : isInProgress(status)
          ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
          : "bg-muted text-muted-foreground";
  const dot =
    status === "READY"
      ? "bg-emerald-500"
      : status === "FAILED"
        ? "bg-rose-500"
        : isInProgress(status)
          ? "bg-amber-500"
          : "bg-muted-foreground/50";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
        tone,
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          dot,
          isInProgress(status) && "animate-pulse",
        )}
      />
      {PRODUCT_DISCOVERY_STATUS_LABELS[status]}
    </span>
  );
}

const tabContentClass =
  "animate-in fade-in slide-in-from-bottom-1 flex flex-col gap-6 duration-200 motion-reduce:animate-none pt-4";

export function ProductDiscoveryDetailClient({
  data,
}: {
  data: ProductDiscoveryDetailData;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reviewLoadingId, setReviewLoadingId] = useState<string | null>(null);
  const [brandQuery, setBrandQuery] = useState("");
  const inProgress = data.status === "SCRAPING";

  useProductDiscoveryPolling(inProgress);

  useEffect(() => {
    if (!inProgress) return;
    const id = window.setInterval(() => router.refresh(), 8_000);
    return () => window.clearInterval(id);
  }, [inProgress, router]);

  const insights = (data.insights as DiscoveryInsights | null) ?? null;

  const marketplaceSummary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of data.products) {
      counts.set(p.marketplace, (counts.get(p.marketplace) ?? 0) + 1);
    }
    return data.marketplaces.map((mp) => ({
      mp,
      count: counts.get(mp) ?? 0,
    }));
  }, [data.products, data.marketplaces]);

  const brandBreakdown = useMemo(() => {
    if (insights?.brandBreakdown && insights.brandBreakdown.length > 0) {
      return insights.brandBreakdown;
    }
    const map = new Map<
      string,
      {
        shopName: string;
        productCount: number;
        ratings: number[];
        totalSold: number;
        marketplaces: Set<string>;
      }
    >();
    for (const p of data.products) {
      if (!p.shopName?.trim()) continue;
      const key = p.shopName.trim().toLowerCase();
      const row = map.get(key) ?? {
        shopName: p.shopName.trim(),
        productCount: 0,
        ratings: [],
        totalSold: 0,
        marketplaces: new Set<string>(),
      };
      row.productCount += 1;
      if (typeof p.rating === "number") row.ratings.push(p.rating);
      if (typeof p.soldCount === "number") row.totalSold += p.soldCount;
      row.marketplaces.add(p.marketplace);
      map.set(key, row);
    }
    return [...map.values()]
      .map((b) => ({
        shopName: b.shopName,
        productCount: b.productCount,
        avgRating: b.ratings.length
          ? b.ratings.reduce((a, c) => a + c, 0) / b.ratings.length
          : 0,
        totalSold: b.totalSold,
        marketplaces: [...b.marketplaces],
      }))
      .sort((a, b) => b.productCount - a.productCount)
      .slice(0, 20);
  }, [data.products, insights]);

  const visibleBrands = useMemo(() => {
    const q = brandQuery.trim().toLowerCase();
    if (!q) return brandBreakdown;
    return brandBreakdown.filter((b) =>
      b.shopName.toLowerCase().includes(q),
    );
  }, [brandBreakdown, brandQuery]);

  const promoSharePct =
    typeof insights?.promoShare === "number"
      ? Math.round(
          insights.promoShare <= 1
            ? insights.promoShare * 100
            : insights.promoShare,
        )
      : null;

  const distTotal = data.products.length || 1;

  function handleRefresh() {
    startTransition(async () => {
      try {
        await refreshProductDiscoveryQuery(data.id);
        toast.success("Refresh dimulai.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal refresh."));
      }
    });
  }

  function handleReview(productId: string) {
    setReviewLoadingId(productId);
    startTransition(async () => {
      try {
        const result = await sendDiscoveryProductToReviewIntel({ productId });
        toast.success(
          result.existing
            ? "Review Intelligence sudah ada — membuka sumber."
            : "Dikirim ke Review Intelligence.",
        );
        router.push(`/research-hub/review-intelligence/${result.id}`);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal kirim ke Review Intel."));
        setReviewLoadingId(null);
      }
    });
  }

  return (
    <ResearchHubDetailPage
      icon={PackageSearch}
      backHref="/research-hub/product-discovery"
      title={data.keyword}
      description={`${data.marketplaces.map((mp) => MARKETPLACE_LABELS[mp]).join(", ")} · target ${data.productLimit} produk`}
      right={
        <>
          <ResearchModelBadgeGroup meta={data.aiMeta} />
          <StatusPill status={data.status} />
          <Button
            size="sm"
            onClick={handleRefresh}
            disabled={pending || inProgress}
          >
            <RefreshCw className="mr-1.5 size-3.5" />
            Refresh
          </Button>
        </>
      }
    >
      {inProgress ? (
        <div className={lab.entrance}>
          <JobProgressBar
            title="Scraping & menganalisis produk"
            percent={40}
            stepLabel="Menarik produk dari marketplace lalu menganalisis price band & velocity — refresh otomatis."
          />
        </div>
      ) : null}

      {/* Papan hero bento */}
      {data.products.length > 0 ? (
        <div
          className={cn(
            lab.entrance,
            "grid grid-flow-row-dense auto-rows-[6.75rem] grid-cols-2 gap-3 lg:grid-cols-4",
          )}
        >
          {/* Produk — tile hero violet */}
          <div className="bento-tile col-span-2 row-span-2 border-transparent bg-violet-600 shadow-md shadow-violet-600/20 lg:col-span-1 dark:bg-violet-500">
            <span className="text-[11.5px] font-semibold text-violet-100 dark:text-violet-950/70">
              Produk ditemukan
            </span>
            <span className="bento-value text-5xl text-white dark:text-violet-950">
              {data.productCount.toLocaleString("id-ID")}
            </span>
            <span className="text-xs font-medium leading-snug text-violet-100/90 dark:text-violet-900/80">
              target {data.productLimit} produk · {data.marketplaces.length}{" "}
              marketplace
            </span>
          </div>

          {/* Distribusi marketplace — stacked bar */}
          <div className="bento-tile col-span-2 row-span-2 justify-start gap-3">
            <div className="flex items-center justify-between">
              <span className="bento-label">Distribusi marketplace</span>
              <span className="text-muted-foreground text-[11px] tabular-nums">
                {data.products.length} produk
              </span>
            </div>
            <div className="bg-muted flex h-2.5 overflow-hidden rounded-full">
              {marketplaceSummary.map(({ mp, count }, index) => {
                if (count === 0) return null;
                return (
                  <div
                    key={mp}
                    className={MP_DOTS[index % MP_DOTS.length]}
                    style={{ width: `${(count / distTotal) * 100}%` }}
                    title={`${MARKETPLACE_LABELS[mp]}: ${count}`}
                  />
                );
              })}
            </div>
            <div className="flex flex-col gap-1.5">
              {marketplaceSummary.map(({ mp, count }, index) => (
                <div key={mp} className="flex items-center gap-2 text-xs">
                  <span
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      MP_DOTS[index % MP_DOTS.length],
                    )}
                    aria-hidden
                  />
                  <span className="text-muted-foreground flex-1">
                    {MARKETPLACE_LABELS[mp]}
                  </span>
                  <span className="font-semibold tabular-nums">{count}</span>
                  <span className="text-muted-foreground w-10 text-right text-[11px] tabular-nums">
                    {Math.round((count / distTotal) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Brand / toko */}
          <div className="bento-tile">
            <span className="bento-label">Brand / toko</span>
            <span className="bento-value">
              {data.shopCount.toLocaleString("id-ID")}
            </span>
          </div>

          {/* Harga median — amber pastel */}
          <div className="bento-tile border-transparent bg-[#ffedcd] dark:bg-amber-400/10">
            <span className="text-[11.5px] font-semibold text-amber-800/70 dark:text-amber-200/60">
              Harga median
            </span>
            <span className="bento-value text-2xl text-amber-900 dark:text-amber-300">
              {insights?.priceStats
                ? formatRp(Math.round(insights.priceStats.median))
                : "—"}
            </span>
            {insights?.priceStats ? (
              <span className="text-[11px] font-medium text-amber-800/70 dark:text-amber-300/70">
                rentang {formatRp(Math.round(insights.priceStats.min))} –{" "}
                {formatRp(Math.round(insights.priceStats.max))}
              </span>
            ) : null}
          </div>

          {/* Promo share — lavender pastel */}
          <div className="bento-tile border-transparent bg-[#e9e3f9] dark:bg-violet-400/10">
            <span className="text-[11.5px] font-semibold text-violet-700/70 dark:text-violet-300/70">
              Produk berpromo
            </span>
            <span className="bento-value text-violet-900 dark:text-violet-300">
              {promoSharePct != null ? (
                <>
                  {promoSharePct}
                  <span className="text-lg font-bold text-violet-800/50 dark:text-violet-300/50">
                    %
                  </span>
                </>
              ) : (
                "—"
              )}
            </span>
          </div>

          {/* Harga rata-rata */}
          <div className="bento-tile">
            <span className="bento-label">Harga rata-rata</span>
            <span className="bento-value text-2xl">
              {insights?.priceStats
                ? formatRp(Math.round(insights.priceStats.avg))
                : "—"}
            </span>
          </div>
        </div>
      ) : null}

      <DataSourceProvenancePanel entries={data.dataProvenance} />

      <Tabs defaultValue="ringkasan" className="gap-0">
        <div className={cn(lab.stickyToolbar, "pb-0")}>
          <TabsList variant="line" className="h-9 w-full justify-start gap-4">
            <TabsTrigger value="ringkasan" className="px-1">
              <Sparkles className="size-3.5" aria-hidden />
              Ringkasan
            </TabsTrigger>
            <TabsTrigger value="produk" className="px-1">
              <Tags className="size-3.5" aria-hidden />
              Produk
              {data.products.length > 0 ? (
                <span className="text-muted-foreground ml-1 text-[10px] tabular-nums">
                  {data.products.length}
                </span>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="brand" className="px-1">
              <Store className="size-3.5" aria-hidden />
              Brand
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="ringkasan" className={tabContentClass}>
          {data.actionPlan ? (
            <ActionPlanPanel
              plan={data.actionPlan}
              title="Rencana Aksi Pasar (AI)"
              subtitle={insights?.summary ?? undefined}
            />
          ) : null}

          {insights?.bubble && insights.bubble.length > 0 ? (
            <div className="bento-tile justify-start gap-3">
              <div className="flex items-center justify-between">
                <span className="bento-label">
                  Peta harga × rating × volume
                </span>
                <span className="text-muted-foreground text-[11px]">
                  ukuran gelembung = jumlah terjual · area kosong = white space
                </span>
              </div>
              <DiscoveryBubbleChart points={insights.bubble} />
            </div>
          ) : null}

          {insights?.priceBands && insights.priceBands.length > 0 ? (
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="bento-tile justify-start gap-3">
                <span className="bento-label">Price bands</span>
                <div className="flex flex-col gap-2">
                  {insights.priceBands.map((b) => (
                    <div
                      key={b.label}
                      className={cn(
                        lab.nestedPanel,
                        "flex items-center justify-between gap-3 text-sm",
                      )}
                    >
                      <span className="font-semibold tabular-nums">
                        {b.label}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {b.count} produk · rating {b.avgRating.toFixed(1)} · ~
                        {Math.round(b.avgSold).toLocaleString("id-ID")} terjual
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bento-tile justify-start gap-3">
                <span className="bento-label">
                  Value leaders (rating × velocity ÷ harga)
                </span>
                <div className="flex flex-col gap-2">
                  {(insights.valueLeaders ?? []).map((v) => (
                    <div key={v.name} className={lab.nestedPanel}>
                      <p className="line-clamp-1 text-sm font-medium">
                        {v.name}
                      </p>
                      <p className="text-muted-foreground text-xs tabular-nums">
                        Rating {v.rating.toFixed(1)} ·{" "}
                        {formatRp(v.price)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="produk" className={tabContentClass}>
          <ProductDiscoveryProductsView
            rows={data.products}
            queryId={data.id}
            defaultCategoryName={data.keyword}
            onReview={handleReview}
            reviewLoadingId={reviewLoadingId}
            actionsDisabled={pending}
          />
        </TabsContent>

        <TabsContent value="brand" className={tabContentClass}>
          {brandBreakdown.length > 0 ? (
            <div className={cn(lab.card, "p-0")}>
              <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-foreground font-bold tracking-tight">
                    Brand / toko dalam hasil
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {visibleBrands.length === brandBreakdown.length
                      ? `${brandBreakdown.length} brand/toko`
                      : `${visibleBrands.length} dari ${brandBreakdown.length} brand/toko`}
                  </p>
                </div>
                <div className="relative">
                  <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2" />
                  <Input
                    value={brandQuery}
                    onChange={(e) => setBrandQuery(e.target.value)}
                    placeholder="Cari brand/toko…"
                    className="h-9 w-48 pl-8 text-xs"
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Brand / Toko</TableHead>
                      <TableHead className="text-right">Produk</TableHead>
                      <TableHead className="text-right">Avg Rating</TableHead>
                      <TableHead className="text-right">
                        Total Terjual
                      </TableHead>
                      <TableHead>Marketplace</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleBrands.map((b) => (
                      <TableRow
                        key={b.shopName}
                        className="transition-colors duration-150 motion-reduce:transition-none hover:bg-muted/40"
                      >
                        <TableCell className="font-medium">
                          {b.shopName}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {b.productCount}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {b.avgRating > 0 ? b.avgRating.toFixed(1) : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {b.totalSold.toLocaleString("id-ID")}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {b.marketplaces
                            .map(
                              (mp) =>
                                MARKETPLACE_LABELS[
                                  mp as ResearchMarketplace
                                ] ?? mp,
                            )
                            .join(", ")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Belum ada data brand/toko.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </ResearchHubDetailPage>
  );
}
