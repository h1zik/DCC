import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ResearchHubPageShell, ResearchHubSection } from "@/components/research-hub/research-hub-primitives";
import {
  ShopProductDetailPanel,
  type ShopProductAttribute,
  type ShopProductDetailData,
  type ShopProductModel,
  type ShopProductVariation,
} from "@/components/research-hub/shop-product-detail-panel";
import { SkuSoldHistoryChart } from "@/components/research-hub/sku-sold-history-chart";
import { CompetitorPriceChart } from "@/components/research-hub/competitor-price-chart";
import { buildSkuSoldHistory } from "@/lib/research/shop-product-mappers";
import { hub } from "@/components/research-hub/research-hub-primitives";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((v): v is Record<string, unknown> => !!v && typeof v === "object")
    : [];
}

function parseAttributes(value: unknown): ShopProductAttribute[] {
  return asArray(value)
    .map((o) => ({ name: String(o.name ?? ""), value: String(o.value ?? "") }))
    .filter((a) => a.name && a.value);
}

function parseVariations(value: unknown): ShopProductVariation[] {
  return asArray(value)
    .map((o) => ({
      name: String(o.name ?? ""),
      options: Array.isArray(o.options)
        ? o.options.map((x) => String(x)).filter(Boolean)
        : [],
    }))
    .filter((v) => v.name && v.options.length > 0);
}

function parseRatingDistribution(
  value: unknown,
): Record<string, number> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const out: Record<string, number> = {};
  for (const star of ["5", "4", "3", "2", "1"]) {
    const raw = (value as Record<string, unknown>)[star];
    if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) {
      out[star] = Math.round(raw);
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

function parseModels(value: unknown): ShopProductModel[] {
  const num = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  return asArray(value).map((o) => ({
    modelId: o.modelId != null ? String(o.modelId) : null,
    name: o.name != null ? String(o.name) : null,
    price: num(o.price),
    priceBeforeDiscount: num(o.priceBeforeDiscount),
    stock: num(o.stock),
    sold: num(o.sold),
  }));
}

export default async function CompetitorProductTrackDetailPage({
  params,
}: {
  params: Promise<{ categoryId: string; trackId: string }>;
}) {
  const { categoryId, trackId } = await params;

  const track = await prisma.competitorProductTrack.findFirst({
    where: { id: trackId, categoryId },
    include: {
      category: { select: { name: true } },
      snapshots: { orderBy: { capturedAt: "asc" } },
    },
  });
  if (!track) notFound();

  const product: ShopProductDetailData = {
    id: track.id,
    name: track.name,
    productUrl: track.productUrl,
    imageUrl: track.imageUrl,
    marketplace: track.marketplace,
    shopName: track.shopName,
    shopLocation: null,
    isOfficialShop: false,
    price: track.currentPrice,
    rating: track.rating,
    reviewCount: track.reviewCount,
    soldCount: track.historicalSold ?? track.exactSold,
    hasPromo: track.hasPromo,
    promoText: track.promoText,
    categoryRank: null,
    exactSold: track.exactSold,
    historicalSold: track.historicalSold,
    monthlySold: track.monthlySold,
    estimatedRevenue: track.estimatedRevenue,
    stock: track.stock,
    brand: track.brand,
    categoryName: track.categoryName,
    categoryPath: track.categoryPath,
    description: track.description,
    attributes: parseAttributes(track.attributes),
    variations: parseVariations(track.variations),
    models: parseModels(track.models),
    ratingDistribution: parseRatingDistribution(track.ratingDistribution),
  };

  const soldHistory = buildSkuSoldHistory(
    track.snapshots.map((s) => ({
      capturedAt: s.capturedAt,
      price: s.price,
      exactSold: s.exactSold,
      historicalSold: s.historicalSold,
      monthlySold: s.monthlySold,
      estimatedRevenue: s.estimatedRevenue,
      stock: s.stock,
    })),
  );

  const priceHistory = soldHistory.map((p) => ({
    date: p.date,
    Harga: p.price,
  }));

  return (
    <ResearchHubPageShell>
      <div className="flex flex-col gap-8">
        <ShopProductDetailPanel
          product={product}
          breadcrumbs={
            <Button
              size="sm"
              variant="ghost"
              className="w-fit gap-1 px-0"
              render={
                <Link
                  href={`/research-hub/competitor-tracker/products/${categoryId}`}
                />
              }
            >
              <ChevronLeft className="size-4" />
              Kembali ke {track.category.name}
            </Button>
          }
        />

        {soldHistory.length > 0 ? (
          <ResearchHubSection
            title="Riwayat Penjualan"
            description="Snapshot per refresh — total terjual dan estimasi revenue."
          >
            <div className={cn(hub.panel)}>
              <SkuSoldHistoryChart data={soldHistory} />
            </div>
          </ResearchHubSection>
        ) : null}

        {priceHistory.some((p) => p.Harga != null) ? (
          <ResearchHubSection title="Riwayat Harga" description="Pergerakan harga dari snapshot.">
            <div className={cn(hub.panel)}>
              <CompetitorPriceChart
                data={priceHistory}
                skuNames={["Harga"]}
                hasTrend={priceHistory.length >= 2}
              />
            </div>
          </ResearchHubSection>
        ) : null}
      </div>
    </ResearchHubPageShell>
  );
}
