"use client";

import { ExternalLink } from "lucide-react";
import { ProductDiscoveryProductThumb } from "@/components/research-hub/product-discovery-product-thumb";
import { ShopProductMetricsStrip } from "@/components/research-hub/shop-product-metrics";
import { hub } from "@/components/research-hub/research-hub-primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MARKETPLACE_LABELS, formatRp } from "@/lib/research/labels";
import type { ShopProductMetrics } from "@/lib/research/shop-product-metrics";
import { formatCompactCount } from "@/lib/research/shop-product-metrics";
import { cn } from "@/lib/utils";

export type ShopProductDetailData = {
  id: string;
  name: string;
  productUrl: string;
  imageUrl: string | null;
  marketplace: string;
  shopName: string | null;
  shopLocation: string | null;
  isOfficialShop: boolean;
  price: number | null;
  rating: number | null;
  reviewCount: number;
  hasPromo: boolean;
  promoText: string | null;
  categoryRank: number | null;
  soldCount: number | null;
} & ShopProductMetrics;

export function ShopProductDetailPanel({
  product,
  breadcrumbs,
  actions,
}: {
  product: ShopProductDetailData;
  breadcrumbs?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const marketplaceLabel =
    MARKETPLACE_LABELS[product.marketplace as keyof typeof MARKETPLACE_LABELS] ??
    product.marketplace;

  return (
    <div className={cn("flex flex-col gap-6", hub.entrance)}>
      {breadcrumbs}

      <div className={cn(hub.panel, "grid gap-6 lg:grid-cols-[280px_1fr]")}>
        <div className="relative aspect-square overflow-hidden rounded-xl border border-border/50 bg-muted/20">
          <ProductDiscoveryProductThumb
            imageUrl={product.imageUrl}
            name={product.name}
            className="size-full"
          />
          {product.hasPromo && product.promoText ? (
            <span className="bg-primary text-primary-foreground absolute top-3 left-3 rounded-md px-2 py-0.5 text-xs font-semibold">
              {product.promoText}
            </span>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="text-[10px] uppercase">
                {marketplaceLabel}
              </Badge>
              {product.isOfficialShop ? (
                <Badge className="text-[10px]">Official Store</Badge>
              ) : null}
              {product.categoryRank != null ? (
                <Badge variant="outline" className="text-[10px] tabular-nums">
                  Rank #{product.categoryRank}
                </Badge>
              ) : null}
            </div>
            <h1 className="text-xl font-semibold leading-snug">{product.name}</h1>
            <p className="text-muted-foreground text-sm">
              {product.shopName ?? "—"}
              {product.shopLocation ? ` · ${product.shopLocation}` : ""}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className={hub.nestedPanel}>
              <p className="text-muted-foreground text-xs">Harga</p>
              <p className="text-lg font-semibold tabular-nums">
                {product.price != null ? formatRp(product.price) : "—"}
              </p>
            </div>
            <div className={hub.nestedPanel}>
              <p className="text-muted-foreground text-xs">Rating</p>
              <p className="text-lg font-semibold tabular-nums">
                {product.rating != null ? product.rating.toFixed(1) : "—"}
                {product.reviewCount > 0 ? (
                  <span className="text-muted-foreground ml-1 text-sm font-normal">
                    ({product.reviewCount.toLocaleString("id-ID")})
                  </span>
                ) : null}
              </p>
            </div>
            <div className={hub.nestedPanel}>
              <p className="text-muted-foreground text-xs">Stok</p>
              <p className="text-lg font-semibold tabular-nums">
                {formatCompactCount(product.stock)}
              </p>
            </div>
          </div>

          <ShopProductMetricsStrip metrics={product} showStock={false} />

          <div className="flex flex-wrap gap-2">
            {actions}
            <Button
              size="sm"
              variant="outline"
              render={
                <a
                  href={product.productUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              <ExternalLink className="size-3.5" />
              Buka di marketplace
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
