import "server-only";

import { prisma } from "@/lib/prisma";
import { resolveShopProductMetrics } from "@/lib/research/shop-product-metrics";

/** Persist SKU metrics from latest snapshot when row fields are still null (post-migration). */
export async function backfillCompetitorSkuMetricsFromSnapshots(
  competitorId: string,
): Promise<void> {
  const skus = await prisma.competitorSku.findMany({
    where: { competitorId },
    include: {
      snapshots: { orderBy: { capturedAt: "desc" }, take: 1 },
    },
  });

  for (const sku of skus) {
    const snap = sku.snapshots[0];
    if (!snap) continue;

    const resolved = resolveShopProductMetrics({
      exactSold: sku.exactSold,
      historicalSold: sku.historicalSold,
      monthlySold: sku.monthlySold,
      estimatedRevenue: sku.estimatedRevenue,
      stock: sku.stock,
      price: sku.currentPrice,
      snapshot: {
        exactSold: snap.exactSold,
        historicalSold: snap.historicalSold,
        monthlySold: snap.monthlySold,
        estimatedRevenue: snap.estimatedRevenue,
        stock: snap.stock,
      },
    });

    const patch: Record<string, number | null> = {};
    if (sku.historicalSold == null && resolved.historicalSold != null) {
      patch.historicalSold = resolved.historicalSold;
    }
    if (sku.exactSold == null && resolved.exactSold != null) {
      patch.exactSold = resolved.exactSold;
    }
    if (sku.monthlySold == null && resolved.monthlySold != null) {
      patch.monthlySold = resolved.monthlySold;
    }
    if (sku.estimatedRevenue == null && resolved.estimatedRevenue != null) {
      patch.estimatedRevenue = resolved.estimatedRevenue;
    }
    if (sku.stock == null && resolved.stock != null) {
      patch.stock = resolved.stock;
    }

    if (Object.keys(patch).length === 0) continue;

    await prisma.competitorSku.update({
      where: { id: sku.id },
      data: patch,
    });
  }
}
