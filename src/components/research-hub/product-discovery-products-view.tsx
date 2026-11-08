"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ExternalLink,
  LayoutGrid,
  LineChart,
  List,
  MessageSquareText,
  PackageSearch,
  Star,
} from "lucide-react";
import { ProductDiscoveryProductThumb } from "@/components/research-hub/product-discovery-product-thumb";
import {
  ProductDiscoveryTable,
  type ProductDiscoveryRow,
} from "@/components/research-hub/product-discovery-table";
import {
  ShopProductDetailLink,
  ShopProductMetricsStrip,
} from "@/components/research-hub/shop-product-metrics";
import { DiscoveryCompetitorTrackerDialog } from "@/components/research-hub/discovery-competitor-tracker-dialog";
import { ResearchPanelEmpty } from "@/components/research-hub/kit/research-states";
import { Button } from "@/components/ui/button";
import { MarketplaceLogo } from "@/components/research-hub/marketplace-logo";
import { MARKETPLACE_LABELS } from "@/lib/research/labels";
import { formatRp } from "@/lib/research/labels";

export type ProductViewMode = "card" | "list";

const VIEW_STORAGE_KEY = "research-hub:product-discovery-view";

const COMMUNITY_MARKETPLACES = new Set(["FEMALEDAILY", "SOCIOLLA"]);

function isCommunityMarketplace(marketplace: string): boolean {
  return COMMUNITY_MARKETPLACES.has(marketplace);
}

function ProductDiscoveryCard({
  row,
  queryId,
  defaultCategoryName,
  onReview,
  reviewLoadingId,
  actionsDisabled,
}: {
  row: ProductDiscoveryRow;
  queryId?: string;
  defaultCategoryName: string;
  onReview?: (productId: string) => void;
  reviewLoadingId?: string | null;
  actionsDisabled?: boolean;
}) {
  const marketplaceLabel =
    MARKETPLACE_LABELS[row.marketplace as keyof typeof MARKETPLACE_LABELS] ??
    row.marketplace;
  const detailHref = queryId
    ? `/research-hub/product-discovery/${queryId}/products/${row.id}`
    : null;
  const hideMetrics = isCommunityMarketplace(row.marketplace);

  return (
    <article className="border-border bg-card flex flex-col overflow-hidden rounded-xl border">
      <Link
        href={detailHref ?? row.productUrl}
        className="focus-visible:ring-ring relative block aspect-[4/3] w-full overflow-hidden border-b border-border/40 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
        aria-label={
          detailHref ? `Detail ${row.name}` : `Buka ${row.name} di ${marketplaceLabel}`
        }
        {...(detailHref ? {} : { target: "_blank", rel: "noopener noreferrer" })}
      >
        <ProductDiscoveryProductThumb
          imageUrl={row.imageUrl ?? null}
          name={row.name}
          className="size-full"
        />
        {row.hasPromo && row.promoText ? (
          <span className="bg-primary text-primary-foreground absolute top-2 left-2 rounded-md px-2 py-0.5 text-xs font-semibold">
            {row.promoText}
          </span>
        ) : null}
        {row.categoryRank != null ? (
          <span className="bg-background/90 text-foreground absolute top-2 right-2 rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums backdrop-blur-sm">
            #{row.categoryRank}
          </span>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0 flex-1 space-y-1">
          {detailHref ? (
            <ShopProductDetailLink href={detailHref}>{row.name}</ShopProductDetailLink>
          ) : (
            <h3 className="line-clamp-2 text-sm leading-snug font-medium">{row.name}</h3>
          )}
          <p className="text-muted-foreground truncate text-xs">
            {row.shopName ?? "Toko tidak diketahui"}
          </p>
          <p className="text-muted-foreground flex min-w-0 items-center gap-x-3 text-xs">
            <span className="inline-flex min-w-0 items-center gap-1">
              <MarketplaceLogo marketplace={row.marketplace} className="size-3.5" />
              <span className="truncate">{marketplaceLabel}</span>
            </span>
            {row.shopLocation ? (
              <span className="truncate">{row.shopLocation}</span>
            ) : null}
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-3">
          <div>
            <dt className="text-muted-foreground text-xs">Harga</dt>
            <dd className="text-sm font-semibold tabular-nums">
              {row.price != null ? formatRp(row.price) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Rating</dt>
            <dd className="flex items-center gap-1 text-sm font-semibold tabular-nums">
              {row.rating != null ? (
                <>
                  <Star className="size-3 fill-amber-400 text-amber-400" aria-hidden />
                  {row.rating.toFixed(1)}
                  {row.reviewCount > 0 ? (
                    <span className="text-muted-foreground text-xs font-normal">
                      ({row.reviewCount.toLocaleString("id-ID")})
                    </span>
                  ) : null}
                </>
              ) : (
                "—"
              )}
            </dd>
          </div>
        </dl>

        <ShopProductMetricsStrip metrics={row} compact hidden={hideMetrics} />

        <div className="flex flex-col gap-2 border-t border-border/40 pt-3">
          <div className="flex gap-2">
            {detailHref ? (
              <Button
                size="sm"
                variant="secondary"
                className="min-w-0 flex-1 text-xs"
                render={<Link href={detailHref} />}
              >
                <LineChart className="size-3.5" aria-hidden />
                Detail
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              className="shrink-0"
              render={
                <a
                  href={row.productUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Buka ${row.name} di ${marketplaceLabel}`}
                />
              }
            >
              <ExternalLink className="size-3.5" aria-hidden />
            </Button>
          </div>
          <div className="flex gap-2">
            {onReview ? (
              <Button
                size="sm"
                variant="outline"
                className="min-w-0 flex-1 text-xs"
                disabled={reviewLoadingId === row.id || actionsDisabled}
                onClick={() => onReview(row.id)}
                aria-label={`Kirim "${row.name}" ke Review Intelligence`}
              >
                <MessageSquareText className="size-3.5" aria-hidden />
                {reviewLoadingId === row.id ? "Mengirim…" : "Review Intel"}
              </Button>
            ) : null}
            <DiscoveryCompetitorTrackerDialog
              productId={row.id}
              productName={row.name}
              defaultCategoryName={defaultCategoryName}
              disabled={actionsDisabled}
              className="min-w-0 flex-1 text-xs"
            />
          </div>
        </div>
      </div>
    </article>
  );
}

export function ProductDiscoveryProductsView({
  rows,
  queryId,
  defaultCategoryName,
  onReview,
  reviewLoadingId,
  actionsDisabled,
  defaultView = "card",
  emptyDescription,
}: {
  rows: ProductDiscoveryRow[];
  queryId?: string;
  defaultCategoryName: string;
  onReview?: (productId: string) => void;
  reviewLoadingId?: string | null;
  actionsDisabled?: boolean;
  defaultView?: ProductViewMode;
  /** Kalimat state kosong: kenapa belum ada produk & apa yang bisa dilakukan. */
  emptyDescription?: string;
}) {
  const [view, setView] = useState<ProductViewMode>(defaultView);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(VIEW_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    if (stored !== "card" && stored !== "list") return;
    const next = stored;
    // Defer agar tidak memicu cascading render sinkron di dalam effect.
    const id = requestAnimationFrame(() => setView(next));
    return () => cancelAnimationFrame(id);
  }, []);

  function changeView(next: ProductViewMode) {
    setView(next);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }

  if (rows.length === 0) {
    return (
      <ResearchPanelEmpty
        icon={PackageSearch}
        title="Belum ada produk"
        description={
          emptyDescription ??
          "Belum ada produk untuk pencarian ini. Ambil ulang produk atau coba keyword lain."
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm tabular-nums">
          {rows.length} produk
        </p>
        <div
          className="bg-muted inline-flex rounded-lg p-0.5"
          role="group"
          aria-label="Tampilan produk"
        >
          <Button
            size="sm"
            variant={view === "card" ? "secondary" : "ghost"}
            className="h-7 gap-1 px-2.5 text-xs"
            onClick={() => changeView("card")}
            aria-pressed={view === "card"}
          >
            <LayoutGrid className="size-3.5" aria-hidden />
            Kartu
          </Button>
          <Button
            size="sm"
            variant={view === "list" ? "secondary" : "ghost"}
            className="h-7 gap-1 px-2.5 text-xs"
            onClick={() => changeView("list")}
            aria-pressed={view === "list"}
          >
            <List className="size-3.5" aria-hidden />
            Daftar
          </Button>
        </div>
      </div>

      {view === "card" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {rows.map((row) => (
            <ProductDiscoveryCard
              key={row.id}
              row={row}
              queryId={queryId}
              defaultCategoryName={defaultCategoryName}
              onReview={onReview}
              reviewLoadingId={reviewLoadingId}
              actionsDisabled={actionsDisabled}
            />
          ))}
        </div>
      ) : (
        <ProductDiscoveryTable
          rows={rows}
          queryId={queryId}
          defaultCategoryName={defaultCategoryName}
          onReview={onReview}
          reviewLoadingId={reviewLoadingId}
          actionsDisabled={actionsDisabled}
          showImages
        />
      )}
    </div>
  );
}
