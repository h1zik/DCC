"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { RefreshCw, Sparkles, Store, Tags } from "lucide-react";
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
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ProductDiscoveryProductsView } from "@/components/research-hub/product-discovery-products-view";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MARKETPLACE_LABELS,
  PRODUCT_DISCOVERY_STATUS_LABELS,
} from "@/lib/research/labels";
import { lab } from "@/components/lab/lab-primitives";
import { MarketplaceLogo } from "@/components/research-hub/marketplace-logo";
import { ResearchHubDetailPage } from "@/components/research-hub/research-hub-module-page";
import { RunStatusBadge, runToneFromStatus } from "@/components/research-hub/kit/run-status";
import { cn } from "@/lib/utils";
import { useProductDiscoveryPolling } from "../use-product-discovery-polling";
import type { ResearchAiMetaView } from "@/lib/research/research-module-models";
import { ResearchModelBadgeGroup } from "@/components/research-hub/research-model-badge";
import { DataSourceProvenancePanel } from "@/components/research-hub/data-source-provenance-panel";
import type { DataProvenanceEntry } from "@/lib/research/scrape-data-provider";
import type { ProductDiscoveryRow } from "@/components/research-hub/product-discovery-table";
import { DiscoveryMetrics } from "./_components/discovery-metrics";
import { DiscoverySummaryTab } from "./_components/discovery-summary-tab";
import { DiscoveryBrandTab } from "./_components/discovery-brand-tab";
import type {
  DiscoveryBrandRow,
  DiscoveryInsights,
} from "./_components/discovery-types";

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

const tabContentClass =
  "motion-safe:animate-in motion-safe:fade-in flex flex-col gap-8 pt-5 duration-200";

/** Brand/toko dari insight AI; fallback agregasi dari produk mentah. */
function buildBrandBreakdown(
  products: ProductDiscoveryRow[],
  insights: DiscoveryInsights | null,
): DiscoveryBrandRow[] {
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
  for (const p of products) {
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
}

/** Status penarikan yang sedang jalan: angka nyata (produk terkumpul), tanpa persen karangan. */
function ScrapeInProgressNotice({
  productCount,
  productLimit,
}: {
  productCount: number;
  productLimit: number;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="border-border flex flex-col gap-2.5 rounded-xl border px-4 py-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="text-foreground text-sm font-medium">
          Menarik produk dari marketplace
        </p>
        <span className="rh-meta rh-num">
          {productCount.toLocaleString("id-ID")} produk terkumpul, target{" "}
          {productLimit.toLocaleString("id-ID")}
        </span>
      </div>
      <div className="rh-ledger-bar" aria-hidden>
        <div className="rh-ledger-seg rh-tone-running" style={{ flexGrow: 1 }} />
      </div>
      <p className="rh-meta">
        Setelah semua produk masuk, AI menganalisis rentang harga dan
        kecepatan terjual. Halaman diperbarui otomatis.
      </p>
    </div>
  );
}

export function ProductDiscoveryDetailClient({
  data,
}: {
  data: ProductDiscoveryDetailData;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reviewLoadingId, setReviewLoadingId] = useState<string | null>(null);
  const [confirmRefresh, setConfirmRefresh] = useState(false);
  const inProgress = data.status === "SCRAPING";

  useProductDiscoveryPolling(inProgress);

  useEffect(() => {
    if (!inProgress) return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "hidden") router.refresh();
    }, 8_000);
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

  const brandBreakdown = useMemo(
    () => buildBrandBreakdown(data.products, insights),
    [data.products, insights],
  );

  function handleRefresh() {
    startTransition(async () => {
      try {
        await refreshProductDiscoveryQuery(data.id);
        toast.success("Pengambilan ulang produk dimulai.");
        setConfirmRefresh(false);
        router.refresh();
      } catch (err) {
        toast.error(
          actionErrorMessage(
            err,
            "Gagal mengambil ulang produk. Coba lagi beberapa saat.",
          ),
        );
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
            ? "Produk ini sudah ada di Review Intelligence. Membuka sumbernya."
            : "Produk dikirim ke Review Intelligence.",
        );
        router.push(`/research-hub/review-intelligence/${result.id}`);
      } catch (err) {
        toast.error(
          actionErrorMessage(
            err,
            "Gagal mengirim ke Review Intelligence. Coba lagi.",
          ),
        );
        setReviewLoadingId(null);
      }
    });
  }

  return (
    <ResearchHubDetailPage
      backHref="/research-hub/product-discovery"
      title={data.keyword}
      meta={
        <>
          <RunStatusBadge
            tone={runToneFromStatus(data.status)}
            label={PRODUCT_DISCOVERY_STATUS_LABELS[data.status]}
          />
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {data.marketplaces.map((mp) => (
              <span key={mp} className="inline-flex items-center gap-1">
                <MarketplaceLogo marketplace={mp} className="size-3.5" />
                {MARKETPLACE_LABELS[mp]}
              </span>
            ))}
          </span>
          <span className="rh-num">
            Target {data.productLimit.toLocaleString("id-ID")} produk
          </span>
        </>
      }
      right={
        <>
          <ResearchModelBadgeGroup meta={data.aiMeta} />
          <Button
            size="sm"
            variant="outline"
            onClick={() => setConfirmRefresh(true)}
            disabled={pending || inProgress}
          >
            <RefreshCw
              className={cn("size-3.5", inProgress && "motion-safe:animate-spin")}
              aria-hidden
            />
            Ambil ulang produk
          </Button>
        </>
      }
    >
      {inProgress ? (
        <ScrapeInProgressNotice
          productCount={data.productCount}
          productLimit={data.productLimit}
        />
      ) : null}

      {data.products.length > 0 ? (
        <DiscoveryMetrics
          productCount={data.productCount}
          productLimit={data.productLimit}
          shopCount={data.shopCount}
          insights={insights}
          marketplaceSummary={marketplaceSummary}
        />
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
                <span className="rh-num text-muted-foreground ml-1 text-xs">
                  {data.products.length}
                </span>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="brand" className="px-1">
              <Store className="size-3.5" aria-hidden />
              Brand
              {brandBreakdown.length > 0 ? (
                <span className="rh-num text-muted-foreground ml-1 text-xs">
                  {brandBreakdown.length}
                </span>
              ) : null}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="ringkasan" className={tabContentClass}>
          <DiscoverySummaryTab
            insights={insights}
            actionPlan={data.actionPlan}
            inProgress={inProgress}
          />
        </TabsContent>

        <TabsContent value="produk" className={tabContentClass}>
          <ProductDiscoveryProductsView
            rows={data.products}
            queryId={data.id}
            defaultCategoryName={data.keyword}
            onReview={handleReview}
            reviewLoadingId={reviewLoadingId}
            actionsDisabled={pending}
            emptyDescription={
              inProgress
                ? "Produk muncul di sini begitu penarikan dari marketplace selesai."
                : "Pencarian ini belum menemukan produk. Ambil ulang produk atau coba keyword yang lebih umum."
            }
          />
        </TabsContent>

        <TabsContent value="brand" className={tabContentClass}>
          <DiscoveryBrandTab brands={brandBreakdown} inProgress={inProgress} />
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={confirmRefresh}
        onOpenChange={(open) => {
          if (!pending) setConfirmRefresh(open);
        }}
        title={`Ambil ulang produk "${data.keyword}"?`}
        description={`${data.productCount.toLocaleString("id-ID")} produk saat ini dihapus, lalu produk ditarik ulang dari marketplace dan dianalisis ulang. Proses ini butuh beberapa menit.`}
        confirmLabel="Ambil ulang produk"
        pending={pending}
        onConfirm={handleRefresh}
      />
    </ResearchHubDetailPage>
  );
}
