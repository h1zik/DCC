"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
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
import {
  ProductDiscoveryTable,
  type ProductDiscoveryRow,
} from "@/components/research-hub/product-discovery-table";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  MARKETPLACE_LABELS,
  PRODUCT_DISCOVERY_STATUS_LABELS,
} from "@/lib/research/labels";
import { cn } from "@/lib/utils";
import { useProductDiscoveryPolling } from "../use-product-discovery-polling";

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
  errorMessage: string | null;
  shopCount: number;
  insights: unknown;
  actionPlan: unknown;
  products: ProductDiscoveryRow[];
};

function statusTone(status: ProductDiscoveryStatus) {
  switch (status) {
    case "READY":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "FAILED":
      return "bg-rose-500/15 text-rose-700 dark:text-rose-300";
    case "SCRAPING":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    default:
      return "bg-muted text-muted-foreground";
  }
}

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
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/research-hub/product-discovery"
            className="text-muted-foreground hover:text-foreground mb-2 inline-flex items-center gap-1 text-xs"
          >
            <ArrowLeft className="size-3" /> Kembali
          </Link>
          <h1 className="text-xl font-semibold">&quot;{data.keyword}&quot;</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {data.marketplaces
              .map((mp) => MARKETPLACE_LABELS[mp])
              .join(", ")}{" "}
            · target {data.productLimit} produk
          </p>
          <span
            className={cn(
              "mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
              statusTone(data.status),
            )}
          >
            {PRODUCT_DISCOVERY_STATUS_LABELS[data.status]}
          </span>
        </div>
        <Button size="sm" onClick={handleRefresh} disabled={pending || inProgress}>
          <RefreshCw className="mr-1.5 size-3.5" />
          Refresh
        </Button>
      </div>

      {inProgress ? (
        <JobProgressBar
          title="Scraping & menganalisis produk"
          percent={40}
          stepLabel="Menarik produk dari marketplace lalu menganalisis price band & velocity — refresh otomatis."
        />
      ) : null}

      {data.errorMessage ? (
        <p className="text-amber-700 dark:text-amber-300 text-sm">
          {data.errorMessage}
        </p>
      ) : null}

      {data.actionPlan ? (
        <ActionPlanPanel
          plan={data.actionPlan}
          title="Rencana Aksi Pasar (AI)"
          subtitle={insights?.summary ?? undefined}
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-xs font-medium">
              Produk ditemukan
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {data.productCount}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-xs font-medium">
              Brand / toko unik
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {data.shopCount}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-xs font-medium">
              Per marketplace
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {marketplaceSummary
              .map(({ mp, count }) => `${MARKETPLACE_LABELS[mp]} ${count}`)
              .join(" · ")}
          </CardContent>
        </Card>
      </div>

      {brandBreakdown.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Brand / Toko dalam Hasil</CardTitle>
          </CardHeader>
          <CardContent>
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
                  <TableRow key={b.shopName}>
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
                        .map((mp) => MARKETPLACE_LABELS[mp as ResearchMarketplace] ?? mp)
                        .join(", ")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {insights?.bubble && insights.bubble.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Peta Harga × Rating × Volume
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DiscoveryBubbleChart points={insights.bubble} />
            <p className="text-muted-foreground mt-2 text-xs">
              Ukuran gelembung = jumlah terjual. Klaster kanan-atas = premium
              dengan rating tinggi; kiri-atas = value champion; area kosong =
              white space.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {insights?.priceBands && insights.priceBands.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Price Bands</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {insights.priceBands.map((b) => (
                <div
                  key={b.label}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="font-medium tabular-nums">{b.label}</span>
                  <span className="text-muted-foreground text-xs">
                    {b.count} produk · rating {b.avgRating.toFixed(1)} · ~
                    {Math.round(b.avgSold).toLocaleString("id-ID")} terjual
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Value Leaders (rating × velocity ÷ harga)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(insights.valueLeaders ?? []).map((v) => (
                <div key={v.name} className="text-sm">
                  <p className="line-clamp-1 font-medium">{v.name}</p>
                  <p className="text-muted-foreground text-xs tabular-nums">
                    Rating {v.rating.toFixed(1)} · Rp
                    {v.price.toLocaleString("id-ID")}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daftar Produk</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductDiscoveryTable
            rows={data.products}
            onAnalyze={handleAnalyze}
            analyzingId={analyzingId}
          />
        </CardContent>
      </Card>
    </div>
  );
}
