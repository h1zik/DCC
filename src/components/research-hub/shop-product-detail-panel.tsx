"use client";

import { useState } from "react";
import { ChevronDown, ExternalLink, Star } from "lucide-react";
import { ProductDiscoveryProductThumb } from "@/components/research-hub/product-discovery-product-thumb";
import { ShopProductMetricsStrip } from "@/components/research-hub/shop-product-metrics";
import { hub } from "@/components/research-hub/research-hub-primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MarketplaceLogo } from "@/components/research-hub/marketplace-logo";
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
  imageUrls?: string[] | null;
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
  ratingDistribution?: Record<string, number> | null;
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

  // Galeri gambar: gabungkan imageUrl utama + image_urls, dedupe, urutan stabil.
  const gallery = Array.from(
    new Set(
      [product.imageUrl, ...(product.imageUrls ?? [])].filter(
        (u): u is string => !!u,
      ),
    ),
  );
  const [activeImage, setActiveImage] = useState(0);
  const mainImage = gallery[activeImage] ?? product.imageUrl;

  return (
    <div className={cn("flex flex-col gap-6", hub.entrance)}>
      {breadcrumbs}

      <div className={cn(hub.panel, "grid gap-6 lg:grid-cols-[280px_1fr]")}>
        <div className="flex flex-col gap-2">
          <div className="relative aspect-square overflow-hidden rounded-xl border border-border/50 bg-muted/20">
            <ProductDiscoveryProductThumb
              imageUrl={mainImage}
              name={product.name}
              className="size-full"
            />
            {product.hasPromo && product.promoText ? (
              <span className="bg-primary text-primary-foreground absolute top-3 left-3 rounded-md px-2 py-0.5 text-xs font-semibold">
                {product.promoText}
              </span>
            ) : null}
          </div>
          {gallery.length > 1 ? (
            <div className="flex flex-wrap gap-1.5">
              {gallery.slice(0, 8).map((url, i) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => setActiveImage(i)}
                  className={cn(
                    "relative size-12 overflow-hidden rounded-md border bg-muted/20 transition",
                    i === activeImage
                      ? "border-primary ring-1 ring-primary"
                      : "border-border/50 hover:border-primary/50",
                  )}
                  aria-label={`Gambar ${i + 1}`}
                >
                  <ProductDiscoveryProductThumb
                    imageUrl={url}
                    name={product.name}
                    className="size-full"
                  />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="secondary"
                className="gap-1.5 text-[10px] uppercase"
              >
                <MarketplaceLogo
                  marketplace={product.marketplace}
                  className="size-3.5"
                />
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

          {/* Stok disembunyikan saat null — scraper guest Shopee tidak menyediakan stok. */}
          <div
            className={cn(
              "grid gap-3",
              product.stock != null ? "sm:grid-cols-3" : "sm:grid-cols-2",
            )}
          >
            <div className={hub.nestedPanel}>
              <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
                Harga
              </p>
              <p className="mt-0.5 text-lg font-extrabold tabular-nums tracking-tight">
                {product.price != null ? formatRp(product.price) : "—"}
              </p>
            </div>
            <div className={hub.nestedPanel}>
              <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
                Rating
              </p>
              <p className="mt-0.5 text-lg font-extrabold tabular-nums tracking-tight">
                {product.rating != null ? product.rating.toFixed(1) : "—"}
                {product.reviewCount > 0 ? (
                  <span className="text-muted-foreground ml-1 text-sm font-normal">
                    ({product.reviewCount.toLocaleString("id-ID")})
                  </span>
                ) : null}
              </p>
            </div>
            {product.stock != null ? (
              <div className={hub.nestedPanel}>
                <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
                  Stok
                </p>
                <p className="mt-0.5 text-lg font-extrabold tabular-nums tracking-tight">
                  {formatCompactCount(product.stock)}
                </p>
              </div>
            ) : null}
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

      {product.ratingDistribution &&
      Object.values(product.ratingDistribution).some((n) => n > 0) ? (
        <div className={cn(hub.panel, "flex flex-col gap-3")}>
          <h2 className="text-sm font-semibold">Distribusi Rating</h2>
          {(() => {
            const dist = product.ratingDistribution!;
            const total = Object.values(dist).reduce((s, n) => s + n, 0);
            return (
              <div className="flex flex-col gap-1.5">
                {["5", "4", "3", "2", "1"].map((star) => {
                  const count = dist[star] ?? 0;
                  const pct = total > 0 ? (count / total) * 100 : 0;
                  return (
                    <div key={star} className="flex items-center gap-3">
                      <span className="text-muted-foreground flex w-8 items-center gap-0.5 text-xs tabular-nums">
                        {star}
                        <Star className="size-3 fill-amber-400 text-amber-400" />
                      </span>
                      <div className="bg-muted/40 h-2 flex-1 overflow-hidden rounded-full">
                        <div
                          className="h-full rounded-full bg-amber-400"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-muted-foreground w-12 text-right text-xs tabular-nums">
                        {count.toLocaleString("id-ID")}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      ) : null}

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
          {product.models && product.models.length > 0
            ? (() => {
                const showModelStock = product.models.some(
                  (m) => m.stock != null,
                );
                return (
                  <div className="overflow-hidden rounded-lg border border-border/50">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 text-muted-foreground text-xs">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Varian</th>
                          <th className="px-3 py-2 text-right font-medium">Harga</th>
                          {showModelStock ? (
                            <th className="px-3 py-2 text-right font-medium">Stok</th>
                          ) : null}
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
                            {showModelStock ? (
                              <td className="px-3 py-2 text-right tabular-nums">
                                {formatCompactCount(model.stock)}
                              </td>
                            ) : null}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()
            : null}
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
