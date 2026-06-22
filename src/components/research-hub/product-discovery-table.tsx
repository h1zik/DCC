"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { ProductDiscoveryProductThumb } from "@/components/research-hub/product-discovery-product-thumb";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { MARKETPLACE_LABELS } from "@/lib/research/labels";
import { formatCompactCount, formatRevenueIdr, resolveShopProductMetrics } from "@/lib/research/shop-product-metrics";
import { cn } from "@/lib/utils";

import type { ShopProductMetrics } from "@/lib/research/shop-product-metrics";

export type ProductDiscoveryRow = {
  id: string;
  name: string;
  shopName: string | null;
  shopLocation?: string | null;
  isOfficialShop?: boolean;
  marketplace: string;
  price: number | null;
  rating: number | null;
  reviewCount: number;
  soldCount: number | null;
  hasPromo: boolean;
  promoText: string | null;
  productUrl: string;
  categoryRank?: number | null;
  imageUrl?: string | null;
} & ShopProductMetrics;

export function ProductDiscoveryTable({
  rows,
  queryId,
  onAnalyze,
  analyzingId,
  showImages = false,
}: {
  rows: ProductDiscoveryRow[];
  queryId?: string;
  onAnalyze?: (productId: string) => void;
  analyzingId?: string | null;
  showImages?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">Belum ada produk ditemukan.</p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {showImages ? <TableHead className="w-[56px]" /> : null}
          <TableHead>Produk</TableHead>
          <TableHead>Brand / Toko</TableHead>
          <TableHead>Marketplace</TableHead>
          <TableHead className="text-right">Harga</TableHead>
          <TableHead className="text-right">Rating</TableHead>
          <TableHead className="text-right">Total terjual</TableHead>
          <TableHead className="text-right">Bulan ini</TableHead>
          <TableHead className="text-right">Revenue</TableHead>
          <TableHead className="text-right">Rank</TableHead>
          <TableHead className="w-[120px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const m = resolveShopProductMetrics(row);
          return (
          <TableRow
            key={row.id}
            className="transition-colors duration-150 motion-reduce:transition-none hover:bg-muted/40"
          >
            {showImages ? (
              <TableCell className="py-2">
                <ProductDiscoveryProductThumb
                  imageUrl={row.imageUrl ?? null}
                  name={row.name}
                  className="size-10 rounded-lg"
                />
              </TableCell>
            ) : null}
            <TableCell className="max-w-[240px]">
              <p className="line-clamp-2 font-medium">{row.name}</p>
              {row.hasPromo && row.promoText ? (
                <span className="text-primary mt-0.5 inline-block text-[10px] font-medium">
                  {row.promoText}
                </span>
              ) : null}
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {row.shopName ?? "—"}
            </TableCell>
            <TableCell>
              <span className="text-xs font-medium uppercase">
                {MARKETPLACE_LABELS[row.marketplace as keyof typeof MARKETPLACE_LABELS] ??
                  row.marketplace}
              </span>
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {row.price != null
                ? `Rp ${row.price.toLocaleString("id-ID")}`
                : "—"}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {row.rating != null ? row.rating.toFixed(1) : "—"}
              {row.reviewCount > 0 ? (
                <span className="text-muted-foreground block text-[10px]">
                  ({row.reviewCount.toLocaleString("id-ID")})
                </span>
              ) : null}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatCompactCount(m.historicalSold)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatCompactCount(m.monthlySold)}
            </TableCell>
            <TableCell className="text-right tabular-nums text-xs">
              {formatRevenueIdr(m.estimatedRevenue)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {row.categoryRank != null ? `#${row.categoryRank}` : "—"}
            </TableCell>
            <TableCell>
              <div className="flex justify-end gap-1">
                {queryId ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 text-xs"
                    render={
                      <Link
                        href={`/research-hub/product-discovery/${queryId}/products/${row.id}`}
                      />
                    }
                  >
                    Detail
                  </Button>
                ) : null}
                {onAnalyze ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled={analyzingId === row.id}
                    onClick={() => onAnalyze(row.id)}
                  >
                    {analyzingId === row.id ? "..." : "Review"}
                  </Button>
                ) : null}
                <a
                  href={row.productUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "inline-flex h-7 w-7 items-center justify-center rounded-md",
                    "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                  aria-label="Buka produk"
                >
                  <ExternalLink className="size-3.5" />
                </a>
              </div>
            </TableCell>
          </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
