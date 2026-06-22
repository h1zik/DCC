"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  PackageSearch,
  RefreshCw,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MARKETPLACE_LABELS,
  PRODUCT_DISCOVERY_STATUS_LABELS,
} from "@/lib/research/labels";
import {
  hub,
  ResearchHubPageHeader,
  ResearchHubSection,
  ResearchHubStatChip,
} from "@/components/research-hub/research-hub-primitives";
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

function statusChipTone(
  status: ProductDiscoveryStatus,
): "neutral" | "success" | "warning" | "primary" {
  switch (status) {
    case "READY":
      return "success";
    case "FAILED":
      return "warning";
    case "SCRAPING":
    case "PENDING":
      return "warning";
    default:
      return "neutral";
  }
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
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
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
  }, [data.products, insights?.brandBreakdown]);

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

  function handleAnalyze(productId: string) {
    setAnalyzingId(productId);
    startTransition(async () => {
      try {
        const result = await sendDiscoveryProductToReviewIntel({ productId });
        toast.success("Dikirim ke Review Intelligence.");
        router.push(`/research-hub/review-intelligence/${result.id}`);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal kirim ke Review Intel."));
        setAnalyzingId(null);
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/research-hub/product-discovery"
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-xs transition-colors duration-150 motion-reduce:transition-none"
      >
        <PackageSearch className="size-3" aria-hidden />
        Kembali ke Product Discovery
      </Link>

      <ResearchHubPageHeader
        variant="detail"
        icon={PackageSearch}
        eyebrow="Product Discovery"
        title={data.keyword}
        description={`${data.marketplaces.map((mp) => MARKETPLACE_LABELS[mp]).join(", ")} · target ${data.productLimit} produk`}
        right={
          <>
            <ResearchModelBadgeGroup meta={data.aiMeta} />
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
        footer={
          <div className="flex flex-wrap items-center gap-2">
            <ResearchHubStatChip
              label="Status"
              value={PRODUCT_DISCOVERY_STATUS_LABELS[data.status]}
              tone={statusChipTone(data.status)}
            />
            <ResearchHubStatChip
              label="Produk"
              value={data.productCount.toLocaleString("id-ID")}
              tone="primary"
            />
            <ResearchHubStatChip
              label="Brand / toko"
              value={data.shopCount.toLocaleString("id-ID")}
            />
            {marketplaceSummary.map(({ mp, count }) => (
              <ResearchHubStatChip
                key={mp}
                label={MARKETPLACE_LABELS[mp]}
                value={count.toLocaleString("id-ID")}
              />
            ))}
          </div>
        }
      />

      {inProgress ? (
        <div className={hub.entrance}>
          <JobProgressBar
            title="Scraping & menganalisis produk"
            percent={40}
            stepLabel="Menarik produk dari marketplace lalu menganalisis price band & velocity — refresh otomatis."
          />
        </div>
      ) : null}

      <DataSourceProvenancePanel entries={data.dataProvenance} />

      <Tabs defaultValue="ringkasan" className="gap-0">
        <div className={cn(hub.stickyToolbar, "pb-0")}>
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
            <ResearchHubSection
              title="Rencana Aksi Pasar"
              description={insights?.summary ?? "Rekomendasi langkah dari analisis AI."}
              delayMs={0}
            >
              <ActionPlanPanel
                plan={data.actionPlan}
                title="Rencana Aksi Pasar (AI)"
                subtitle={insights?.summary ?? undefined}
              />
            </ResearchHubSection>
          ) : null}

          {insights?.bubble && insights.bubble.length > 0 ? (
            <ResearchHubSection
              title="Peta Harga × Rating × Volume"
              description="Ukuran gelembung = jumlah terjual. Area kosong = white space."
              delayMs={50}
            >
              <div className={hub.panel}>
                <DiscoveryBubbleChart points={insights.bubble} />
              </div>
            </ResearchHubSection>
          ) : null}

          {insights?.priceBands && insights.priceBands.length > 0 ? (
            <ResearchHubSection
              title="Price Bands & Value Leaders"
              delayMs={100}
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <div className={hub.panel}>
                  <p className="mb-3 text-sm font-medium">Price Bands</p>
                  <div className="space-y-2">
                    {insights.priceBands.map((b) => (
                      <div
                        key={b.label}
                        className={cn(
                          hub.nestedPanel,
                          "flex items-center justify-between gap-3 text-sm",
                        )}
                      >
                        <span className="font-medium tabular-nums">{b.label}</span>
                        <span className="text-muted-foreground text-xs">
                          {b.count} produk · rating {b.avgRating.toFixed(1)} · ~
                          {Math.round(b.avgSold).toLocaleString("id-ID")} terjual
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className={hub.panel}>
                  <p className="mb-3 text-sm font-medium">
                    Value Leaders (rating × velocity ÷ harga)
                  </p>
                  <div className="space-y-2">
                    {(insights.valueLeaders ?? []).map((v) => (
                      <div key={v.name} className={hub.nestedPanel}>
                        <p className="line-clamp-1 text-sm font-medium">{v.name}</p>
                        <p className="text-muted-foreground text-xs tabular-nums">
                          Rating {v.rating.toFixed(1)} · Rp
                          {v.price.toLocaleString("id-ID")}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </ResearchHubSection>
          ) : null}
        </TabsContent>

        <TabsContent value="produk" className={tabContentClass}>
          <ResearchHubSection
            title="Daftar Produk"
            description="Tampilkan sebagai kartu atau daftar. Klik Review untuk kirim ke Review Intelligence."
          >
            <ProductDiscoveryProductsView
              rows={data.products}
              onAnalyze={handleAnalyze}
              analyzingId={analyzingId}
            />
          </ResearchHubSection>
        </TabsContent>

        <TabsContent value="brand" className={tabContentClass}>
          <ResearchHubSection
            title="Brand / Toko dalam Hasil"
            description="Distribusi produk per toko dan performa agregat."
          >
            {brandBreakdown.length > 0 ? (
              <div className={hub.panel}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Brand / Toko</TableHead>
                      <TableHead className="text-right">Produk</TableHead>
                      <TableHead className="text-right">Avg Rating</TableHead>
                      <TableHead className="text-right">Total Terjual</TableHead>
                      <TableHead>Marketplace</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {brandBreakdown.map((b) => (
                      <TableRow
                        key={b.shopName}
                        className="transition-colors duration-150 motion-reduce:transition-none hover:bg-muted/40"
                      >
                        <TableCell className="font-medium">{b.shopName}</TableCell>
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
                                MARKETPLACE_LABELS[mp as ResearchMarketplace] ??
                                mp,
                            )
                            .join(", ")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                Belum ada data brand/toko.
              </p>
            )}
          </ResearchHubSection>
        </TabsContent>
      </Tabs>
    </div>
  );
}
