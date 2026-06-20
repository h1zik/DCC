"use client";

import type { ReviewIntelSourceStatus } from "@prisma/client";
import { ExternalLink, Loader2, MessageSquareText } from "lucide-react";
import { ProductDiscoveryProductThumb } from "@/components/research-hub/product-discovery-product-thumb";
import { formatRp, SOURCE_STATUS_LABELS } from "@/lib/research/labels";
import { hub } from "@/components/research-hub/research-hub-primitives";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type CompetitorSkuRow = {
  id: string;
  name: string;
  productUrl: string;
  imageUrl?: string | null;
  currentPrice: number | null;
  rating: number | null;
  reviewCount: number;
  isNew: boolean;
  hasPromo: boolean;
  promoText: string | null;
  priceDeltaPct: number | null;
  priceDirection: "up" | "down" | null;
  reviewIntelSourceId: string | null;
  reviewIntelStatus: ReviewIntelSourceStatus | null;
};

export function CompetitorSkuTable({
  rows,
  onReviewIntel,
  reviewSkuId,
  pending,
  showImages = false,
}: {
  rows: CompetitorSkuRow[];
  onReviewIntel?: (sku: CompetitorSkuRow) => void;
  reviewSkuId?: string | null;
  pending?: boolean;
  showImages?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">Belum ada SKU ditemukan.</p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {showImages ? <TableHead className="w-[56px]" /> : null}
          <TableHead>Produk</TableHead>
          <TableHead className="text-right">Harga</TableHead>
          <TableHead className="text-right">Rating</TableHead>
          <TableHead className="text-right">Review</TableHead>
          <TableHead>Promo</TableHead>
          <TableHead className="w-[140px]">Review Intel</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((sku) => (
          <TableRow
            key={sku.id}
            className="transition-colors duration-150 motion-reduce:transition-none hover:bg-muted/40"
          >
            {showImages ? (
              <TableCell className="py-2">
                <ProductDiscoveryProductThumb
                  imageUrl={sku.imageUrl ?? null}
                  name={sku.name}
                  className="size-10 rounded-lg"
                />
              </TableCell>
            ) : null}
            <TableCell className="max-w-[240px]">
              <a
                href={sku.productUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary line-clamp-2 font-medium"
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
                {sku.currentPrice != null ? formatRp(sku.currentPrice) : "—"}
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
                  {sku.priceDirection === "up" ? "▲" : "▼"} {sku.priceDeltaPct}%
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
            <TableCell>
              {onReviewIntel ? (
                <>
                  <Button
                    type="button"
                    variant={sku.reviewIntelSourceId ? "secondary" : "outline"}
                    size="sm"
                    className="h-8 w-full text-xs"
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
                  {sku.reviewIntelStatus ? (
                    <p className="text-muted-foreground mt-1 text-center text-[10px]">
                      {SOURCE_STATUS_LABELS[sku.reviewIntelStatus]}
                    </p>
                  ) : null}
                </>
              ) : null}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
