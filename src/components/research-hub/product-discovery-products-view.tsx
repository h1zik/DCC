"use client";

import { useEffect, useState } from "react";
import { ExternalLink, LayoutGrid, List, MessageSquareText } from "lucide-react";
import { ProductDiscoveryProductThumb } from "@/components/research-hub/product-discovery-product-thumb";
import {
  ProductDiscoveryTable,
  type ProductDiscoveryRow,
} from "@/components/research-hub/product-discovery-table";
import { hub } from "@/components/research-hub/research-hub-primitives";
import { Button } from "@/components/ui/button";
import { MARKETPLACE_LABELS } from "@/lib/research/labels";
import { cn } from "@/lib/utils";

export type ProductViewMode = "card" | "list";

const VIEW_STORAGE_KEY = "research-hub:product-discovery-view";

function ProductDiscoveryCard({
  row,
  onAnalyze,
  analyzingId,
}: {
  row: ProductDiscoveryRow;
  onAnalyze?: (productId: string) => void;
  analyzingId?: string | null;
}) {
  const marketplaceLabel =
    MARKETPLACE_LABELS[row.marketplace as keyof typeof MARKETPLACE_LABELS] ??
    row.marketplace;

  return (
    <article
      className={cn(
        hub.panel,
        hub.cardHover,
        "flex flex-col overflow-hidden p-0",
      )}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden border-b border-border/40">
        <ProductDiscoveryProductThumb
          imageUrl={row.imageUrl ?? null}
          name={row.name}
          className="size-full"
        />
        {row.hasPromo && row.promoText ? (
          <span className="bg-primary text-primary-foreground absolute top-2 left-2 rounded-md px-2 py-0.5 text-[10px] font-semibold">
            {row.promoText}
          </span>
        ) : null}
        {row.categoryRank != null ? (
          <span className="bg-background/90 text-foreground absolute top-2 right-2 rounded-md px-2 py-0.5 text-[10px] font-semibold tabular-nums backdrop-blur-sm">
            #{row.categoryRank}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="line-clamp-2 text-sm leading-snug font-medium">
            {row.name}
          </h3>
          <p className="text-muted-foreground line-clamp-1 text-xs">
            {row.shopName ?? "—"} · {marketplaceLabel}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className={hub.nestedPanel}>
            <p className="text-muted-foreground text-[10px]">Harga</p>
            <p className="mt-0.5 text-xs font-semibold tabular-nums">
              {row.price != null
                ? `Rp ${row.price.toLocaleString("id-ID")}`
                : "—"}
            </p>
          </div>
          <div className={hub.nestedPanel}>
            <p className="text-muted-foreground text-[10px]">Rating</p>
            <p className="mt-0.5 text-xs font-semibold tabular-nums">
              {row.rating != null ? row.rating.toFixed(1) : "—"}
            </p>
          </div>
          <div className={hub.nestedPanel}>
            <p className="text-muted-foreground text-[10px]">Terjual</p>
            <p className="mt-0.5 text-xs font-semibold tabular-nums">
              {row.soldCount != null
                ? row.soldCount.toLocaleString("id-ID")
                : "—"}
            </p>
          </div>
        </div>

        <div className="flex gap-2 border-t border-border/40 pt-3">
          {onAnalyze ? (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-xs"
              disabled={analyzingId === row.id}
              onClick={() => onAnalyze(row.id)}
            >
              <MessageSquareText className="size-3.5" aria-hidden />
              {analyzingId === row.id ? "..." : "Review"}
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
                aria-label={`Buka ${row.name}`}
              />
            }
          >
            <ExternalLink className="size-3.5" aria-hidden />
          </Button>
        </div>
      </div>
    </article>
  );
}

export function ProductDiscoveryProductsView({
  rows,
  onAnalyze,
  analyzingId,
  defaultView = "card",
}: {
  rows: ProductDiscoveryRow[];
  onAnalyze?: (productId: string) => void;
  analyzingId?: string | null;
  defaultView?: ProductViewMode;
}) {
  const [view, setView] = useState<ProductViewMode>(defaultView);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(VIEW_STORAGE_KEY);
      if (stored === "card" || stored === "list") setView(stored);
    } catch {
      /* ignore */
    }
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
      <p className="text-muted-foreground text-sm">Belum ada produk ditemukan.</p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm tabular-nums">
          {rows.length} produk
        </p>
        <div className="bg-muted inline-flex rounded-lg p-0.5">
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
          {rows.map((row, index) => (
            <div
              key={row.id}
              className={hub.entrance}
              style={
                index > 0 && index < 12
                  ? { animationDelay: `${Math.min(index * 30, 300)}ms` }
                  : undefined
              }
            >
              <ProductDiscoveryCard
                row={row}
                onAnalyze={onAnalyze}
                analyzingId={analyzingId}
              />
            </div>
          ))}
        </div>
      ) : (
        <div
          className={cn(hub.panel, "p-0 sm:p-1", hub.entrance)}
        >
          <ProductDiscoveryTable
            rows={rows}
            onAnalyze={onAnalyze}
            analyzingId={analyzingId}
            showImages
          />
        </div>
      )}
    </div>
  );
}
