"use client";

import Link from "next/link";
import { ExternalLink, MessageSquareText, PackageSearch } from "lucide-react";
import { ProductDiscoveryProductThumb } from "@/components/research-hub/product-discovery-product-thumb";
import { DiscoveryCompetitorTrackerDialog } from "@/components/research-hub/discovery-competitor-tracker-dialog";
import { ResearchPanelEmpty } from "@/components/research-hub/kit/research-states";
import { ResearchTable } from "@/components/research-hub/kit/research-table";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { MarketplaceLogo } from "@/components/research-hub/marketplace-logo";
import { MARKETPLACE_LABELS } from "@/lib/research/labels";
import { formatCompactCount, formatRevenueIdr, resolveShopProductMetrics } from "@/lib/research/shop-product-metrics";

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

const COMMUNITY_MARKETPLACES = new Set(["FEMALEDAILY", "SOCIOLLA"]);
const isCommunity = (marketplace: string) => COMMUNITY_MARKETPLACES.has(marketplace);

export function ProductDiscoveryTable({
  rows,
  queryId,
  defaultCategoryName,
  onReview,
  reviewLoadingId,
  actionsDisabled,
  showImages = false,
}: {
  rows: ProductDiscoveryRow[];
  queryId?: string;
  defaultCategoryName: string;
  onReview?: (productId: string) => void;
  reviewLoadingId?: string | null;
  actionsDisabled?: boolean;
  showImages?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <ResearchPanelEmpty
        icon={PackageSearch}
        title="Belum ada produk"
        description="Belum ada produk untuk pencarian ini. Ambil ulang produk atau coba keyword lain."
      />
    );
  }

  const allCommunity = rows.every((r) => isCommunity(r.marketplace));

  return (
    <ResearchTable maxHeight="75vh">
      <TableHeader sticky>
        <TableRow>
          {showImages ? (
            <TableHead className="w-[56px]">
              <span className="sr-only">Gambar</span>
            </TableHead>
          ) : null}
          <TableHead>Produk</TableHead>
          <TableHead>Toko</TableHead>
          <TableHead>Marketplace</TableHead>
          <TableHead className="text-right">Harga</TableHead>
          <TableHead className="text-right">Rating</TableHead>
          {allCommunity ? null : <TableHead className="text-right">Total terjual</TableHead>}
          {allCommunity ? null : <TableHead className="text-right">Bulan ini</TableHead>}
          {allCommunity ? null : <TableHead className="text-right">Revenue</TableHead>}
          <TableHead className="text-right">Rank</TableHead>
          <TableHead className="w-[200px]">
            <span className="sr-only">Aksi</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const m = resolveShopProductMetrics(row);
          const hideMetrics = isCommunity(row.marketplace);
          const marketplaceLabel =
            MARKETPLACE_LABELS[row.marketplace as keyof typeof MARKETPLACE_LABELS] ??
            row.marketplace;
          return (
            <TableRow key={row.id}>
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
                  <span className="mt-1 inline-flex items-center rounded-full bg-[color-mix(in_srgb,var(--lab-accent,var(--primary))_12%,transparent)] px-2 py-0.5 text-xs font-semibold text-[var(--lab-accent,var(--primary))]">
                    {row.promoText}
                  </span>
                ) : null}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {row.shopName ?? "—"}
              </TableCell>
              <TableCell>
                <span className="text-muted-foreground inline-flex items-center gap-1.5 whitespace-nowrap">
                  <MarketplaceLogo marketplace={row.marketplace} className="size-3.5" />
                  {marketplaceLabel}
                </span>
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {row.price != null
                  ? `Rp ${row.price.toLocaleString("id-ID")}`
                  : "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {row.rating != null ? row.rating.toFixed(1) : "—"}
                {row.reviewCount > 0 ? (
                  <span className="text-muted-foreground block text-xs">
                    ({row.reviewCount.toLocaleString("id-ID")})
                  </span>
                ) : null}
              </TableCell>
              {/* Kolom metrik penjualan ada bila ada baris non-komunitas;
                  baris komunitas (FD/Sociolla) mengisi "—" agar kolom tetap sejajar. */}
              {allCommunity ? null : (
                <TableCell className="text-right tabular-nums">
                  {hideMetrics ? "—" : formatCompactCount(m.historicalSold)}
                </TableCell>
              )}
              {allCommunity ? null : (
                <TableCell className="text-right tabular-nums">
                  {hideMetrics ? "—" : formatCompactCount(m.monthlySold)}
                </TableCell>
              )}
              {allCommunity ? null : (
                <TableCell className="text-right text-xs tabular-nums">
                  {hideMetrics ? "—" : formatRevenueIdr(m.estimatedRevenue)}
                </TableCell>
              )}
              <TableCell className="text-right tabular-nums">
                {row.categoryRank != null ? `#${row.categoryRank}` : "—"}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap justify-end gap-1">
                  {queryId ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-7 text-xs"
                      render={
                        <Link
                          href={`/research-hub/product-discovery/${queryId}/products/${row.id}`}
                          aria-label={`Detail ${row.name}`}
                        />
                      }
                    >
                      Detail
                    </Button>
                  ) : null}
                  {onReview ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
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
                    className="h-7 text-xs"
                  />
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="text-muted-foreground"
                    render={
                      <a
                        href={row.productUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Buka ${row.name} di ${marketplaceLabel}`}
                      />
                    }
                  >
                    <ExternalLink aria-hidden />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </ResearchTable>
  );
}
