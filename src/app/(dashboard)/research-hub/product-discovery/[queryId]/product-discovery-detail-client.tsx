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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  MARKETPLACE_LABELS,
  PRODUCT_DISCOVERY_STATUS_LABELS,
} from "@/lib/research/labels";
import { cn } from "@/lib/utils";
import { useProductDiscoveryPolling } from "../use-product-discovery-polling";

export type ProductDiscoveryDetailData = {
  id: string;
  keyword: string;
  marketplaces: ResearchMarketplace[];
  productLimit: number;
  status: ProductDiscoveryStatus;
  productCount: number;
  errorMessage: string | null;
  shopCount: number;
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

      {data.errorMessage ? (
        <p className="text-amber-700 dark:text-amber-300 text-sm">
          {data.errorMessage}
        </p>
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
