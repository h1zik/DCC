import type { ProductDiscoveryItem, CompetitorSku, CompetitorSnapshot } from "@prisma/client";
import {
  resolveShopProductMetrics,
  type ShopProductMetrics,
} from "@/lib/research/shop-product-metrics";

type SnapshotMetrics = Pick<
  CompetitorSnapshot,
  | "exactSold"
  | "historicalSold"
  | "monthlySold"
  | "estimatedRevenue"
  | "stock"
>;

function snapshotAsMetrics(s: SnapshotMetrics | null | undefined): Partial<ShopProductMetrics> | null {
  if (!s) return null;
  return {
    exactSold: s.exactSold,
    historicalSold: s.historicalSold,
    monthlySold: s.monthlySold,
    estimatedRevenue: s.estimatedRevenue,
    stock: s.stock,
  };
}

export function mapDiscoveryProductFields(p: ProductDiscoveryItem) {
  return resolveShopProductMetrics({
    exactSold: p.exactSold,
    historicalSold: p.historicalSold,
    monthlySold: p.monthlySold,
    estimatedRevenue: p.estimatedRevenue,
    stock: p.stock,
    soldCount: p.soldCount,
    price: p.price,
    shopLocation: p.shopLocation,
    isOfficialShop: p.isOfficialShop,
  });
}

/** Row shape for discovery cards/tables — mirrors competitor SKU mapping. */
export function mapDiscoveryProductToRow(p: ProductDiscoveryItem) {
  const metrics = mapDiscoveryProductFields(p);
  return {
    id: p.id,
    name: p.name,
    shopName: p.shopName,
    marketplace: p.marketplace,
    price: p.price,
    rating: p.rating,
    reviewCount: p.reviewCount,
    soldCount: metrics.historicalSold ?? metrics.exactSold,
    hasPromo: p.hasPromo,
    promoText: p.promoText,
    productUrl: p.productUrl,
    categoryRank: p.categoryRank,
    imageUrl: p.imageUrl ?? null,
    shopLocation: metrics.shopLocation ?? p.shopLocation ?? null,
    isOfficialShop: metrics.isOfficialShop ?? p.isOfficialShop,
    ...metrics,
  };
}

export function mapCompetitorSkuFields(
  s: CompetitorSku,
  latestSnapshot?: SnapshotMetrics | null,
) {
  return resolveShopProductMetrics({
    exactSold: s.exactSold,
    historicalSold: s.historicalSold,
    monthlySold: s.monthlySold,
    estimatedRevenue: s.estimatedRevenue,
    stock: s.stock,
    price: s.currentPrice,
    shopLocation: s.shopLocation,
    isOfficialShop: s.isOfficialShop,
    snapshot: snapshotAsMetrics(latestSnapshot),
  });
}

export type SoldHistoryPoint = {
  date: string;
  exactSold: number | null;
  historicalSold: number | null;
  monthlySold: number | null;
  estimatedRevenue: number | null;
  price: number | null;
};

export function buildSkuSoldHistory(
  snapshots: Pick<
    CompetitorSnapshot,
    | "capturedAt"
    | "exactSold"
    | "historicalSold"
    | "monthlySold"
    | "estimatedRevenue"
    | "price"
    | "stock"
  >[],
): SoldHistoryPoint[] {
  return snapshots
    .map((s) => {
      const resolved = resolveShopProductMetrics({
        exactSold: s.exactSold,
        historicalSold: s.historicalSold,
        monthlySold: s.monthlySold,
        estimatedRevenue: s.estimatedRevenue,
        stock: s.stock,
        price: s.price,
      });
      return {
        date: s.capturedAt.toISOString().slice(0, 10),
        exactSold: resolved.exactSold,
        historicalSold: resolved.historicalSold,
        monthlySold: resolved.monthlySold,
        estimatedRevenue: resolved.estimatedRevenue,
        price: s.price,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}
