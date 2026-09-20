import {
  SALES_CATEGORY_LABELS,
  isSystemStockLog,
  parseSystemMeta,
  resolveEffectiveOutLogs,
  type OutLogRow,
} from "@/lib/stock-log-utils";

/**
 * Agregasi barang keluar (StockLog OUT) per kategori — sumber kebenaran tunggal
 * untuk Executive overview dan lapisan AI/MCP. Murni (tanpa prisma) agar bisa
 * diuji dan diimpor dari komponen client.
 */

/** Urutan tetap: dipakai untuk stack chart, legend, dan teks. Jangan diurut ulang. */
export const OUTGOING_CATEGORIES = [
  "penjualan",
  "sampling",
  "retur",
  "rusak",
  "other",
] as const;

export type OutgoingCategory = (typeof OUTGOING_CATEGORIES)[number];

export const OUTGOING_CATEGORY_LABELS: Record<OutgoingCategory, string> = {
  penjualan: SALES_CATEGORY_LABELS.penjualan ?? "Penjualan",
  sampling: SALES_CATEGORY_LABELS.sampling ?? "Sampling",
  retur: SALES_CATEGORY_LABELS.retur ?? "Retur",
  rusak: SALES_CATEGORY_LABELS.rusak ?? "Rusak / expired",
  other: "Tanpa kategori",
};

/** Warna mengikuti kategori (bukan peringkat) — token di globals.css. */
export const OUTGOING_CATEGORY_COLOR_VAR: Record<OutgoingCategory, string> = {
  penjualan: "var(--outgoing-penjualan)",
  sampling: "var(--outgoing-sampling)",
  retur: "var(--outgoing-retur)",
  rusak: "var(--outgoing-rusak)",
  other: "var(--outgoing-other)",
};

export type CategoryPcs = Record<OutgoingCategory, number>;

export function emptyCategoryPcs(): CategoryPcs {
  return { penjualan: 0, sampling: 0, retur: 0, rusak: 0, other: 0 };
}

/**
 * `salesCategory` null = log lama sebelum kategori diwajibkan. Tidak dilebur ke
 * penjualan supaya angka penjualan di sini sama dengan burn rate forecast PO
 * (yang strict `=== "penjualan"`).
 */
export function normalizeOutgoingCategory(
  value: string | null | undefined,
): OutgoingCategory {
  const v = (value ?? "").trim().toLowerCase();
  if (v === "penjualan" || v === "sampling" || v === "retur" || v === "rusak") {
    return v;
  }
  return "other";
}

export type OutgoingLogInput = OutLogRow & {
  createdAt: Date;
  productId: string;
  product: { name: string; sku: string; brand: { name: string } };
};

export type OutgoingBrandRow = {
  brandName: string;
  totalPcs: number;
  byCategory: CategoryPcs;
  /** sampling / penjualan × 100; null bila penjualan 0. */
  samplingToSalesPct: number | null;
};

export type OutgoingWeekPoint = {
  /** Senin (WIB) awal minggu, `YYYY-MM-DD`. */
  weekStart: string;
  /** Label sumbu, mis. "12 Agu". */
  label: string;
  /** Minggu terpotong batas jendela (awal/akhir) — bukan minggu penuh. */
  partial: boolean;
  totalPcs: number;
} & CategoryPcs;

export type OutgoingSkuRow = {
  productId: string;
  sku: string;
  name: string;
  brandName: string;
  totalPcs: number;
  byCategory: CategoryPcs;
  /** (retur + rusak) / total × 100. */
  lossRatePct: number;
};

export type OutgoingAggregate = {
  windowDays: number;
  totalPcs: number;
  totals: CategoryPcs;
  /** Total jendela sebelumnya dengan panjang sama; null bila log-nya tidak dimuat. */
  previousTotalPcs: number | null;
  deltaPct: number | null;
  brands: OutgoingBrandRow[];
  weekly: OutgoingWeekPoint[];
  topSellers: OutgoingSkuRow[];
  topLoss: OutgoingSkuRow[];
};

const DAY_MS = 24 * 60 * 60 * 1000;
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const MONTHS_ID = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

/** Nomor hari sejak epoch dalam kalender WIB (UTC+7, tanpa DST). */
function wibDayNumber(d: Date): number {
  return Math.floor((d.getTime() + WIB_OFFSET_MS) / DAY_MS);
}

/** Hari ke-0 epoch adalah Kamis → Senin = day - ((day + 3) % 7). */
function wibMondayDayNumber(d: Date): number {
  const day = wibDayNumber(d);
  return day - ((day + 3) % 7);
}

function dayNumberToKey(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

function dayNumberToLabel(day: number): string {
  const d = new Date(day * DAY_MS);
  return `${d.getUTCDate()} ${MONTHS_ID[d.getUTCMonth()]}`;
}

/** Kunci minggu (Senin WIB) untuk sebuah timestamp. */
export function wibWeekStartKey(d: Date): string {
  return dayNumberToKey(wibMondayDayNumber(d));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * @param logs  Log OUT (bisnis + koreksi `[SYS]`). Untuk delta periode, muat
 *              2 × windowDays dan set `includesPreviousWindow`.
 */
export function aggregateOutgoing(
  logs: OutgoingLogInput[],
  opts: { windowDays: number; now: Date; includesPreviousWindow?: boolean },
): OutgoingAggregate {
  const { windowDays, now } = opts;
  const sinceMs = now.getTime() - windowDays * DAY_MS;
  const prevSinceMs = sinceMs - windowDays * DAY_MS;

  // Baris REPLACEMENT membawa createdAt waktu koreksi; transaksi tetap
  // dihitung pada tanggal log aslinya.
  const originalCreatedAt = new Map<string, Date>();
  for (const row of logs) {
    if (!isSystemStockLog(row.note)) originalCreatedAt.set(row.id, row.createdAt);
  }

  const effective = resolveEffectiveOutLogs(logs).map((row) => {
    if (!isSystemStockLog(row.note)) return { row, at: row.createdAt };
    const targetId = parseSystemMeta(row).targetId;
    const at = (targetId && originalCreatedAt.get(targetId)) || row.createdAt;
    return { row, at };
  });

  const totals = emptyCategoryPcs();
  let totalPcs = 0;
  let previousTotal = 0;
  const brandMap = new Map<string, { total: number; byCategory: CategoryPcs }>();
  const skuMap = new Map<string, OutgoingSkuRow>();
  const weekMap = new Map<number, CategoryPcs>();

  for (const { row, at } of effective) {
    const t = at.getTime();
    if (t < sinceMs) {
      if (t >= prevSinceMs) previousTotal += row.amount;
      continue;
    }
    const cat = normalizeOutgoingCategory(row.salesCategory);
    totals[cat] += row.amount;
    totalPcs += row.amount;

    const brandName = row.product.brand.name.trim() || "Tanpa brand";
    const brand =
      brandMap.get(brandName) ?? { total: 0, byCategory: emptyCategoryPcs() };
    brand.total += row.amount;
    brand.byCategory[cat] += row.amount;
    brandMap.set(brandName, brand);

    const sku = skuMap.get(row.productId) ?? {
      productId: row.productId,
      sku: row.product.sku,
      name: row.product.name,
      brandName,
      totalPcs: 0,
      byCategory: emptyCategoryPcs(),
      lossRatePct: 0,
    };
    sku.totalPcs += row.amount;
    sku.byCategory[cat] += row.amount;
    skuMap.set(row.productId, sku);

    const weekDay = wibMondayDayNumber(at);
    const week = weekMap.get(weekDay) ?? emptyCategoryPcs();
    week[cat] += row.amount;
    weekMap.set(weekDay, week);
  }

  const brands: OutgoingBrandRow[] = [...brandMap.entries()]
    .map(([brandName, v]) => ({
      brandName,
      totalPcs: v.total,
      byCategory: v.byCategory,
      samplingToSalesPct:
        v.byCategory.penjualan > 0
          ? round1((v.byCategory.sampling / v.byCategory.penjualan) * 100)
          : null,
    }))
    .sort((a, b) => b.totalPcs - a.totalPcs);

  // Zero-fill semua minggu dalam jendela agar sumbu waktu tidak melompat.
  const firstWeek = wibMondayDayNumber(new Date(sinceMs));
  const lastWeek = wibMondayDayNumber(now);
  const windowStartDay = wibDayNumber(new Date(sinceMs));
  const todayDay = wibDayNumber(now);
  const weekly: OutgoingWeekPoint[] = [];
  for (let day = firstWeek; day <= lastWeek; day += 7) {
    const v = weekMap.get(day) ?? emptyCategoryPcs();
    weekly.push({
      weekStart: dayNumberToKey(day),
      label: dayNumberToLabel(day),
      partial: day < windowStartDay || day + 6 > todayDay,
      totalPcs: OUTGOING_CATEGORIES.reduce((acc, c) => acc + v[c], 0),
      ...v,
    });
  }

  const skus = [...skuMap.values()].map((s) => ({
    ...s,
    lossRatePct:
      s.totalPcs > 0
        ? round1(((s.byCategory.retur + s.byCategory.rusak) / s.totalPcs) * 100)
        : 0,
  }));
  const topSellers = skus
    .filter((s) => s.byCategory.penjualan > 0)
    .sort((a, b) => b.byCategory.penjualan - a.byCategory.penjualan)
    .slice(0, 5);
  const lossOf = (s: OutgoingSkuRow) => s.byCategory.retur + s.byCategory.rusak;
  const topLoss = skus
    .filter((s) => lossOf(s) > 0)
    .sort((a, b) => lossOf(b) - lossOf(a))
    .slice(0, 5);

  const previousTotalPcs = opts.includesPreviousWindow ? previousTotal : null;
  const deltaPct =
    previousTotalPcs != null && previousTotalPcs > 0
      ? round1(((totalPcs - previousTotalPcs) / previousTotalPcs) * 100)
      : null;

  return {
    windowDays,
    totalPcs,
    totals,
    previousTotalPcs,
    deltaPct,
    brands,
    weekly,
    topSellers,
    topLoss,
  };
}
