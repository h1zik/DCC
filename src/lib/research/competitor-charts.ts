import "server-only";

import { subDays } from "date-fns";

type SnapshotRow = {
  capturedAt: Date;
  skuId: string | null;
  price: number | null;
  rating: number | null;
  reviewCount: number | null;
  sku: { name: string } | null;
};

type SkuRow = {
  id: string;
  name: string;
  productUrl: string;
  currentPrice: number | null;
  rating: number | null;
  reviewCount: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
};

function shortSkuLabel(name: string, max = 28): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

export function buildCurrentPriceBarData(
  skus: (SkuRow & { hasPromo?: boolean })[],
  limit = 10,
) {
  return skus
    .filter((s) => s.currentPrice != null && s.currentPrice > 0)
    .slice(0, limit)
    .map((s) => ({
      name: shortSkuLabel(s.name),
      price: s.currentPrice!,
      hasPromo: s.hasPromo ?? false,
    }));
}

export function countDistinctSnapshotDates(snapshots: SnapshotRow[]): number {
  return new Set(
    snapshots.map((s) => s.capturedAt.toISOString().slice(0, 10)),
  ).size;
}

export function buildPriceChartData(
  snapshots: SnapshotRow[],
  skus: SkuRow[],
  days: number,
) {
  const since = subDays(new Date(), days);
  const filtered = snapshots.filter((s) => s.capturedAt >= since && s.skuId);

  const topSkus = skus.slice(0, 8);
  const topSkuIds = new Set(topSkus.map((s) => s.id));
  const labelBySkuId = new Map(
    topSkus.map((s) => [s.id, shortSkuLabel(s.name)]),
  );
  const skuNames = topSkus.map((s) => labelBySkuId.get(s.id)!);

  const byDate = new Map<string, Record<string, number | string | null>>();

  for (const snap of filtered) {
    if (!snap.skuId || !topSkuIds.has(snap.skuId)) continue;
    const label = labelBySkuId.get(snap.skuId);
    if (!label || snap.price == null) continue;

    const dateKey = snap.capturedAt.toISOString().slice(0, 10);
    const row = byDate.get(dateKey) ?? { date: dateKey };
    row[label] = snap.price;
    byDate.set(dateKey, row);
  }

  const data = [...byDate.values()].sort((a, b) =>
    String(a.date).localeCompare(String(b.date)),
  );

  const distinctDates = data.length;

  return { data, skuNames, distinctDates, hasTrend: distinctDates >= 2 };
}

export function buildRatingChartData(
  snapshots: SnapshotRow[],
  skus: SkuRow[],
  days: number,
) {
  const since = subDays(new Date(), days);
  const filtered = snapshots.filter((s) => s.capturedAt >= since);

  const byDate = new Map<string, { date: string; rating: number; count: number }>();

  for (const snap of filtered) {
    if (snap.rating == null) continue;
    const dateKey = snap.capturedAt.toISOString().slice(0, 10);
    const row = byDate.get(dateKey) ?? { date: dateKey, rating: 0, count: 0 };
    row.rating += snap.rating;
    row.count += 1;
    byDate.set(dateKey, row);
  }

  return [...byDate.values()]
    .map((r) => ({
      date: r.date,
      rating: r.count > 0 ? r.rating / r.count : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function buildShareOfReviewData(skus: SkuRow[]) {
  return skus
    .filter((s) => s.reviewCount > 0)
    .map((s) => ({ name: s.name.slice(0, 24), value: s.reviewCount }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
}

export function isNewSku(firstSeenAt: Date): boolean {
  return Date.now() - firstSeenAt.getTime() < 7 * 86400000;
}
