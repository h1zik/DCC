"use client";

import { ExternalLink } from "lucide-react";
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
import { cn } from "@/lib/utils";

export type ProductDiscoveryRow = {
  id: string;
  name: string;
  shopName: string | null;
  marketplace: string;
  price: number | null;
  rating: number | null;
  reviewCount: number;
  soldCount: number | null;
  hasPromo: boolean;
  promoText: string | null;
  productUrl: string;
};

export function ProductDiscoveryTable({
  rows,
  onAnalyze,
  analyzingId,
}: {
  rows: ProductDiscoveryRow[];
  onAnalyze?: (productId: string) => void;
  analyzingId?: string | null;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">Belum ada produk ditemukan.</p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Produk</TableHead>
            <TableHead>Brand / Toko</TableHead>
            <TableHead>Marketplace</TableHead>
            <TableHead className="text-right">Harga</TableHead>
            <TableHead className="text-right">Rating</TableHead>
            <TableHead className="text-right">Terjual</TableHead>
            <TableHead className="w-[120px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
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
                {row.soldCount != null
                  ? row.soldCount.toLocaleString("id-ID")
                  : "—"}
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
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
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
