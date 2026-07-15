"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ReviewIntelSourceStatus } from "@prisma/client";
import {
  ExternalLink,
  LayoutGrid,
  LineChart,
  List,
  Loader2,
  MessageSquareText,
  Search,
} from "lucide-react";
import { ProductDiscoveryProductThumb } from "@/components/research-hub/product-discovery-product-thumb";
import {
  CompetitorSkuTable,
  type CompetitorSkuRow,
} from "@/components/research-hub/competitor-sku-table";
import { CompetitorSkuTrackerDialog } from "@/components/research-hub/competitor-sku-tracker-dialog";
import {
  ShopProductDetailLink,
  ShopProductMetricsStrip,
} from "@/components/research-hub/shop-product-metrics";
import { formatRp, SOURCE_STATUS_LABELS } from "@/lib/research/labels";
import { hub } from "@/components/research-hub/research-hub-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type SkuViewMode = "card" | "list";

const VIEW_STORAGE_KEY = "research-hub:competitor-sku-view";

function CompetitorSkuCard({
  sku,
  competitorId,
  onReviewIntel,
  reviewSkuId,
  pending,
  trackerCategoryName,
}: {
  sku: CompetitorSkuRow;
  competitorId?: string;
  onReviewIntel?: (sku: CompetitorSkuRow) => void;
  reviewSkuId?: string | null;
  pending?: boolean;
  /** Bila diisi, tampilkan tombol "Tracker" untuk menambah SKU ke Competitor — Products. */
  trackerCategoryName?: string;
}) {
  const detailHref = competitorId
    ? `/research-hub/competitor-tracker/${competitorId}/skus/${sku.id}`
    : null;

  return (
    <article
      className={cn(
        hub.card,
        hub.cardHover,
        "flex flex-col overflow-hidden p-0",
      )}
    >
      {detailHref ? (
        <Link
          href={detailHref}
          className="border-border/40 relative block aspect-[4/3] w-full overflow-hidden border-b"
        >
          <ProductDiscoveryProductThumb
            imageUrl={sku.imageUrl ?? null}
            name={sku.name}
            className="size-full"
          />
          {sku.isNew ? (
            <span className="absolute top-2 left-2 inline-flex items-center rounded-full bg-emerald-500 px-2.5 py-1 text-[10px] font-semibold uppercase text-white">
              Baru
            </span>
          ) : null}
          {sku.hasPromo && sku.promoText ? (
            <span className="absolute top-2 right-2 inline-flex max-w-[70%] items-center truncate rounded-full bg-amber-500 px-2.5 py-1 text-[10px] font-semibold text-amber-950">
              {sku.promoText}
            </span>
          ) : null}
        </Link>
      ) : (
        <div className="border-border/40 relative aspect-[4/3] w-full overflow-hidden border-b">
          <ProductDiscoveryProductThumb
            imageUrl={sku.imageUrl ?? null}
            name={sku.name}
            className="size-full"
          />
        </div>
      )}

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0 flex-1 space-y-1">
          {detailHref ? (
            <ShopProductDetailLink href={detailHref}>{sku.name}</ShopProductDetailLink>
          ) : (
            <h3 className="line-clamp-2 text-sm leading-snug font-medium">{sku.name}</h3>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="min-w-0">
            <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
              Harga
            </p>
            <p className="text-foreground mt-0.5 truncate text-sm font-extrabold tabular-nums tracking-tight">
              {sku.currentPrice != null ? formatRp(sku.currentPrice) : "—"}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
              Rating
            </p>
            <p className="text-foreground mt-0.5 truncate text-sm font-extrabold tabular-nums tracking-tight">
              {sku.rating != null ? sku.rating.toFixed(1) : "—"}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
              Δ Harga
            </p>
            <p
              className={cn(
                "mt-0.5 truncate text-sm font-extrabold tabular-nums tracking-tight",
                sku.priceDeltaPct != null && sku.priceDirection
                  ? sku.priceDirection === "up"
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-emerald-600 dark:text-emerald-400"
                  : "text-foreground",
              )}
            >
              {sku.priceDeltaPct != null && sku.priceDirection
                ? `${sku.priceDirection === "up" ? "▲" : "▼"} ${sku.priceDeltaPct}%`
                : "—"}
            </p>
          </div>
        </div>

        <ShopProductMetricsStrip metrics={sku} compact />

        <div className="border-border/40 mt-auto flex flex-col gap-2 border-t pt-3">
          <div className="flex gap-2">
            {detailHref ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="flex-1 text-xs"
                render={<Link href={detailHref} />}
              >
                <LineChart className="size-3.5" aria-hidden />
                Detail
              </Button>
            ) : null}
            {onReviewIntel ? (
              <Button
                type="button"
                variant={sku.reviewIntelSourceId ? "secondary" : "outline"}
                size="sm"
                className="flex-1 text-xs"
                disabled={pending && reviewSkuId === sku.id}
                onClick={() => onReviewIntel(sku)}
              >
                {pending && reviewSkuId === sku.id ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <MessageSquareText className="size-3.5" aria-hidden />
                )}
                {sku.reviewIntelSourceId ? "Lihat Intel" : "Analisis"}
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="shrink-0"
              render={
                <a
                  href={sku.productUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Buka ${sku.name}`}
                />
              }
            >
              <ExternalLink className="size-3.5" aria-hidden />
            </Button>
          </div>
          {trackerCategoryName ? (
            <CompetitorSkuTrackerDialog
              skuId={sku.id}
              productName={sku.name}
              defaultCategoryName={trackerCategoryName}
              className="w-full text-xs"
            />
          ) : null}
        </div>
        {sku.reviewIntelStatus ? (
          <p className="text-muted-foreground text-center text-[10px]">
            {SOURCE_STATUS_LABELS[sku.reviewIntelStatus as ReviewIntelSourceStatus]}
          </p>
        ) : null}
      </div>
    </article>
  );
}

export function CompetitorSkuProductsView({
  rows,
  competitorId,
  onReviewIntel,
  reviewSkuId,
  pending,
  trackerCategoryName,
  defaultView = "card",
}: {
  rows: CompetitorSkuRow[];
  competitorId?: string;
  onReviewIntel?: (sku: CompetitorSkuRow) => void;
  reviewSkuId?: string | null;
  pending?: boolean;
  /** Bila diisi, tampilkan tombol "Tracker" pada tiap SKU (card & list). */
  trackerCategoryName?: string;
  defaultView?: SkuViewMode;
}) {
  const [view, setView] = useState<SkuViewMode>(defaultView);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = localStorage.getItem(VIEW_STORAGE_KEY);
        if (stored === "card" || stored === "list") setView(stored);
      } catch {
        /* ignore */
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function changeView(next: SkuViewMode) {
    setView(next);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((sku) => sku.name.toLowerCase().includes(q));
  }, [rows, query]);

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Belum ada SKU — refresh atau tunggu scrape selesai.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar: hitung + cari + toggle tampilan */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm tabular-nums">
          {visibleRows.length === rows.length
            ? `${rows.length} SKU`
            : `${visibleRows.length} dari ${rows.length} SKU`}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari SKU…"
              className="h-8 w-44 pl-8 text-xs"
            />
          </div>
          <div className="bg-muted inline-flex rounded-lg p-0.5">
            <Button
              type="button"
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
              type="button"
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
      </div>

      {visibleRows.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Tidak ada SKU yang cocok dengan pencarian.
        </p>
      ) : view === "card" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {visibleRows.map((sku, index) => (
            <div
              key={sku.id}
              className={hub.entrance}
              style={
                index > 0 && index < 12
                  ? { animationDelay: `${Math.min(index * 30, 300)}ms` }
                  : undefined
              }
            >
              <CompetitorSkuCard
                sku={sku}
                competitorId={competitorId}
                onReviewIntel={onReviewIntel}
                reviewSkuId={reviewSkuId}
                pending={pending}
                trackerCategoryName={trackerCategoryName}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className={cn(hub.card, "p-0", hub.entrance)}>
          <div className="overflow-x-auto">
            <CompetitorSkuTable
              rows={visibleRows}
              competitorId={competitorId}
              onReviewIntel={onReviewIntel}
              reviewSkuId={reviewSkuId}
              pending={pending}
              trackerCategoryName={trackerCategoryName}
              showImages
            />
          </div>
        </div>
      )}
    </div>
  );
}
