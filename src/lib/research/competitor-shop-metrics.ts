import type { ShopProductMetrics } from "@/lib/research/shop-product-metrics";

export type CompetitorShopMetrics = {
  totalHistoricalSold: number | null;
  totalMonthlySold: number | null;
  totalEstimatedRevenue: number | null;
  totalStock: number | null;
  skusWithSold: number;
  skusWithMonthlySold: number;
  skusWithRevenue: number;
  skusWithStock: number;
};

type SkuMetricsInput = Pick<
  ShopProductMetrics,
  "historicalSold" | "monthlySold" | "estimatedRevenue" | "stock"
>;

function sumNullable(values: (number | null | undefined)[]): number | null {
  const nums = values.filter(
    (v): v is number => v != null && Number.isFinite(v),
  );
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0);
}

/** Aggregate sold / revenue / stock across competitor SKUs (latest metrics per SKU). */
export function buildCompetitorShopMetrics(
  skus: SkuMetricsInput[],
): CompetitorShopMetrics {
  const historicalValues = skus.map((s) => s.historicalSold);
  const monthlyValues = skus.map((s) => s.monthlySold);
  const revenueValues = skus.map((s) => s.estimatedRevenue);
  const stockValues = skus.map((s) => s.stock);

  return {
    totalHistoricalSold: sumNullable(historicalValues),
    totalMonthlySold: sumNullable(monthlyValues),
    totalEstimatedRevenue: sumNullable(revenueValues),
    totalStock: sumNullable(stockValues),
    skusWithSold: historicalValues.filter((v) => v != null).length,
    skusWithMonthlySold: monthlyValues.filter((v) => v != null).length,
    skusWithRevenue: revenueValues.filter((v) => v != null).length,
    skusWithStock: stockValues.filter((v) => v != null).length,
  };
}
