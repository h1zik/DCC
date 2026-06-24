"use client";

import { useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { ProductDiscoveryProductThumb } from "@/components/research-hub/product-discovery-product-thumb";
import { ShopProductMetricsStrip } from "@/components/research-hub/shop-product-metrics";
import { hub } from "@/components/research-hub/research-hub-primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MARKETPLACE_LABELS, formatRp } from "@/lib/research/labels";
import type { ShopProductMetrics } from "@/lib/research/shop-product-metrics";
import { formatCompactCount } from "@/lib/research/shop-product-metrics";
import { cn } from "@/lib/utils";

export type ShopProductAttribute = { name: string; value: string };
export type ShopProductVariation = { name: string; options: string[] };
export type ShopProductModel = {
  modelId: string | null;
  name: string | null;
  price: number | null;
  priceBeforeDiscount: number | null;
  stock: number | null;
  sold: number | null;
};

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
  // Detail kaya (opsional) — terisi dari scraper VPS shopee-product.
  brand?: string | null;
  categoryName?: string | null;
  categoryPath?: string[] | null;
  description?: string | null;
  attributes?: ShopProductAttribute[] | null;
  variations?: ShopProductVariation[] | null;
  models?: ShopProductModel[] | null;
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

  const [descExpanded, setDescExpanded] = useState(false);

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
              {product.brand ? (
                <Badge variant="outline" className="text-[10px]">
                  {product.brand}
                </Badge>
              ) : null}
            </div>
            <h1 className="text-xl font-semibold leading-snug">{product.name}</h1>
            <p className="text-muted-foreground text-sm">
              {product.shopName ?? "—"}
              {product.shopLocation ? ` · ${product.shopLocation}` : ""}
            </p>
            {product.categoryPath && product.categoryPath.length > 0 ? (
              <p className="text-muted-foreground text-xs">
                {product.categoryPath.join(" › ")}
              </p>
            ) : product.categoryName ? (
              <p className="text-muted-foreground text-xs">{product.categoryName}</p>
            ) : null}
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

      {product.attributes && product.attributes.length > 0 ? (
        <div className={cn(hub.panel, "flex flex-col gap-3")}>
          <h2 className="text-sm font-semibold">Spesifikasi</h2>
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {product.attributes.map((attr) => (
              <div
                key={attr.name}
                className="flex flex-col gap-0.5 border-b border-border/40 pb-2"
              >
                <dt className="text-muted-foreground text-xs">{attr.name}</dt>
                <dd className="text-sm">{attr.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      {(product.variations && product.variations.length > 0) ||
      (product.models && product.models.length > 0) ? (
        <div className={cn(hub.panel, "flex flex-col gap-4")}>
          <h2 className="text-sm font-semibold">Varian</h2>
          {product.variations?.map((variation) => (
            <div key={variation.name} className="flex flex-col gap-1.5">
              <p className="text-muted-foreground text-xs">{variation.name}</p>
              <div className="flex flex-wrap gap-1.5">
                {variation.options.map((option) => (
                  <Badge key={option} variant="secondary" className="text-[11px]">
                    {option}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
          {product.models && product.models.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-border/50">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground text-xs">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Varian</th>
                    <th className="px-3 py-2 text-right font-medium">Harga</th>
                    <th className="px-3 py-2 text-right font-medium">Stok</th>
                  </tr>
                </thead>
                <tbody>
                  {product.models.map((model, i) => (
                    <tr
                      key={model.modelId ?? `${model.name ?? "model"}-${i}`}
                      className="border-t border-border/40"
                    >
                      <td className="px-3 py-2">{model.name ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {model.price != null ? formatRp(model.price) : "—"}
                        {model.priceBeforeDiscount != null &&
                        model.price != null &&
                        model.priceBeforeDiscount > model.price ? (
                          <span className="text-muted-foreground ml-1 text-xs line-through">
                            {formatRp(model.priceBeforeDiscount)}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatCompactCount(model.stock)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}

      {product.description ? (
        <div className={cn(hub.panel, "flex flex-col gap-2")}>
          <h2 className="text-sm font-semibold">Deskripsi</h2>
          <p
            className={cn(
              "text-muted-foreground text-sm leading-relaxed whitespace-pre-line",
              !descExpanded && "line-clamp-6",
            )}
          >
            {product.description}
          </p>
          {product.description.length > 280 ? (
            <button
              type="button"
              onClick={() => setDescExpanded((s) => !s)}
              className="text-primary inline-flex w-fit items-center gap-1 text-xs font-medium hover:underline"
            >
              {descExpanded ? "Tutup" : "Selengkapnya"}
              <ChevronDown
                className={cn(
                  "size-3.5 transition-transform",
                  descExpanded && "rotate-180",
                )}
              />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
