/** Client-safe shop product sales metrics + formatters. */

export type ShopProductMetrics = {
  exactSold: number | null;
  historicalSold: number | null;
  monthlySold: number | null;
  estimatedRevenue: number | null;
  stock: number | null;
  shopLocation?: string | null;
  isOfficialShop?: boolean;
};

export type ResolveShopProductMetricsInput = Partial<ShopProductMetrics> & {
  /** Legacy discovery aggregate. */
  soldCount?: number | null;
  price?: number | null;
  /** Optional newer snapshot to backfill stale SKU rows. */
  snapshot?: Partial<ShopProductMetrics> | null;
};

/** Merge SKU row + optional snapshot; fill gaps and compute revenue when missing. */
export function resolveShopProductMetrics(
  input: ResolveShopProductMetricsInput,
): ShopProductMetrics {
  const snap = input.snapshot;

  const historicalSold =
    input.historicalSold ??
    snap?.historicalSold ??
    null;

  const exactSold =
    input.exactSold ??
    snap?.exactSold ??
    null;

  const monthlySold = input.monthlySold ?? snap?.monthlySold ?? null;

  const totalSold =
    historicalSold ??
    exactSold ??
    snap?.historicalSold ??
    snap?.exactSold ??
    input.soldCount ??
    null;

  const stock = input.stock ?? snap?.stock ?? null;

  const price = input.price ?? null;
  let estimatedRevenue =
    input.estimatedRevenue ?? snap?.estimatedRevenue ?? null;
  if (
    estimatedRevenue == null &&
    price != null &&
    totalSold != null &&
    totalSold > 0
  ) {
    estimatedRevenue = price * totalSold;
  }

  return {
    exactSold: exactSold ?? totalSold,
    historicalSold: totalSold,
    monthlySold,
    estimatedRevenue,
    stock,
    shopLocation: input.shopLocation ?? snap?.shopLocation ?? null,
    isOfficialShop: input.isOfficialShop ?? snap?.isOfficialShop ?? false,
  };
}

export function primarySoldCount(
  m: Pick<ShopProductMetrics, "historicalSold" | "exactSold" | "monthlySold">,
): number | null {
  return m.historicalSold ?? m.exactSold ?? null;
}

/** Parse compact sold counts: "10k+", "10rb+", "1jt" → integer. */
export function parseCompactCount(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, "");
  if (!s) return null;

  const plus = s.endsWith("+") ? s.slice(0, -1) : s;
  const numMatch = plus.match(/^([\d.,]+)(rb|ribu|k|jt|juta|m)?$/i);
  if (!numMatch) {
    const plain = Number(plus.replace(/[^\d.-]/g, ""));
    return Number.isFinite(plain) ? Math.round(plain) : null;
  }

  const base = parseFloat(numMatch[1].replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(base)) return null;

  const suffix = (numMatch[2] ?? "").toLowerCase();
  let mult = 1;
  if (suffix === "k") mult = 1_000;
  else if (suffix === "rb" || suffix === "ribu") mult = 1_000;
  else if (suffix === "jt" || suffix === "juta") mult = 1_000_000;
  else if (suffix === "m") mult = 1_000_000;

  return Math.round(base * mult);
}

export function formatCompactCount(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} jt`;
  if (n >= 100_000) return `${(n / 1_000).toFixed(0)} rb`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)} rb`;
  return n.toLocaleString("id-ID");
}

export function formatRevenueIdr(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return "—";
  if (amount >= 1_000_000_000) {
    return `Rp ${(amount / 1_000_000_000).toFixed(2)} M`;
  }
  if (amount >= 1_000_000) {
    return `Rp ${(amount / 1_000_000).toFixed(1)} jt`;
  }
  return `Rp ${Math.round(amount).toLocaleString("id-ID")}`;
}
