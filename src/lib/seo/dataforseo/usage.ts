import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Pencatat biaya DataForSEO (dari field `cost` di tiap respons). Fire-and-forget
 * — kegagalan mencatat tidak boleh mengganggu request utama.
 */

/** Kategori API dari prefix endpoint (untuk agregasi widget biaya). */
export function moduleForEndpoint(endpoint: string): string {
  const e = endpoint.replace(/^\//, "");
  if (e.startsWith("serp/")) return "serp";
  if (e.startsWith("dataforseo_labs/")) return "labs";
  if (e.startsWith("on_page/")) return "onpage";
  if (e.startsWith("backlinks/")) return "backlinks";
  if (e.startsWith("keywords_data/")) return "keywords_data";
  return "other";
}

export function recordDataForSeoUsage(
  endpoint: string,
  cost: number | null | undefined,
  taskCount = 1,
): void {
  void prisma.seoApiUsage
    .create({
      data: {
        endpoint: endpoint.replace(/^\//, ""),
        module: moduleForEndpoint(endpoint),
        cost: cost != null && Number.isFinite(cost) ? cost : 0,
        taskCount,
      },
    })
    .catch((err) => {
      console.warn("[seo/usage] gagal mencatat biaya (diabaikan)", err);
    });
}

export type MonthlySpend = {
  total: number;
  byModule: { module: string; cost: number; calls: number }[];
};

/** Spend bulan berjalan (UTC month-to-date). */
export async function getMonthlySpend(): Promise<MonthlySpend> {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const grouped = await prisma.seoApiUsage.groupBy({
    by: ["module"],
    where: { createdAt: { gte: monthStart } },
    _sum: { cost: true },
    _count: { _all: true },
  });

  const byModule = grouped
    .map((g) => ({
      module: g.module,
      cost: Math.round((g._sum.cost ?? 0) * 10000) / 10000,
      calls: g._count._all,
    }))
    .sort((a, b) => b.cost - a.cost);

  return {
    total: Math.round(byModule.reduce((s, m) => s + m.cost, 0) * 10000) / 10000,
    byModule,
  };
}
