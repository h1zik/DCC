import type { NormalizedShopProduct } from "@/lib/apify/normalize";

export function shopProductMetricsFields(p: NormalizedShopProduct) {
  return {
    soldCount: p.soldCount,
    exactSold: p.exactSold,
    historicalSold: p.historicalSold,
    monthlySold: p.monthlySold,
    estimatedRevenue: p.estimatedRevenue,
    stock: p.stock,
    shopLocation: p.shopLocation,
    isOfficialShop: p.isOfficialShop,
  };
}

export function snapshotMetricsFromProduct(p: NormalizedShopProduct) {
  return {
    exactSold: p.exactSold,
    historicalSold: p.historicalSold,
    monthlySold: p.monthlySold,
    estimatedRevenue: p.estimatedRevenue,
    stock: p.stock,
  };
}
