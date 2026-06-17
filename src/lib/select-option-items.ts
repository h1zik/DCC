import type { ReactNode } from "react";
import { StockLogType } from "@prisma/client";
import {
  PRODUCT_VENDOR_ROLE_LABELS,
  PRODUCT_VENDOR_ROLE_ORDER,
} from "@/lib/product-vendor";
import { reorderStatusLabel, type ReorderForecastStatus } from "@/lib/reorder-forecast";

/** Bentuk `items` untuk Base UI Select agar trigger menampilkan label, bukan raw value. */
export type SelectItemDef = { value: string; label: ReactNode };

export function idLabelItems(
  rows: { id: string; name?: string | null; email?: string | null }[],
): SelectItemDef[] {
  return rows.map((r) => ({
    value: r.id,
    label: (r.name?.trim() || r.email || r.id) as ReactNode,
  }));
}

export function brandIdItems(
  brands: { id: string; name: string }[],
): SelectItemDef[] {
  return brands.map((b) => ({ value: b.id, label: b.name }));
}

export function brandFilterItems(
  brands: { id: string; name: string }[],
  allLabel = "Semua brand",
): SelectItemDef[] {
  return [{ value: "all", label: allLabel }, ...brandIdItems(brands)];
}

export function brandNameFilterItems(
  brandNames: string[],
  allLabel = "Semua",
): SelectItemDef[] {
  return [
    { value: "all", label: allLabel },
    ...brandNames.map((name) => ({ value: name, label: name })),
  ];
}

export function vendorSelectItems(
  vendors: { id: string; name: string }[],
  emptyValue = "none",
  emptyLabel = "— Tanpa vendor —",
): SelectItemDef[] {
  return [{ value: emptyValue, label: emptyLabel }, ...idLabelItems(vendors)];
}

export function productSelectItems(
  products: {
    id: string;
    name: string;
    sku: string;
    currentStock: number;
    brand: { name: string };
  }[],
): SelectItemDef[] {
  return products.map((p) => ({
    value: p.id,
    label: `${p.brand.name} — ${p.name} (${p.sku}) · stok ${p.currentStock}`,
  }));
}

export const STOCK_LOG_TYPE_ITEMS: SelectItemDef[] = [
  { value: StockLogType.IN, label: "Masuk" },
  { value: StockLogType.OUT, label: "Keluar" },
];

export const STOCK_LOG_TYPE_FILTER_ITEMS: SelectItemDef[] = [
  { value: "all", label: "Semua" },
  ...STOCK_LOG_TYPE_ITEMS,
];

export const DAYS_FILTER_ITEMS: SelectItemDef[] = [
  { value: "7", label: "7 hari" },
  { value: "30", label: "30 hari" },
  { value: "90", label: "90 hari" },
  { value: "all", label: "Semua" },
];

export const FORECAST_WINDOW_ITEMS: SelectItemDef[] = [
  { value: "30", label: "30 hari" },
  { value: "60", label: "60 hari" },
  { value: "90", label: "90 hari" },
];

const REORDER_STATUS_FILTER_VALUES: Array<"all" | ReorderForecastStatus> = [
  "all",
  "ORDER_NOW",
  "ORDER_SOON",
  "OK",
  "NO_DATA",
  "NO_LEAD_TIME",
];

export const REORDER_STATUS_FILTER_ITEMS: SelectItemDef[] =
  REORDER_STATUS_FILTER_VALUES.map((value) => ({
    value,
    label:
      value === "all"
        ? "Semua"
        : reorderStatusLabel(value as ReorderForecastStatus),
  }));

export const PRODUCT_VENDOR_ROLE_ITEMS: SelectItemDef[] =
  PRODUCT_VENDOR_ROLE_ORDER.map((role) => ({
    value: role,
    label: PRODUCT_VENDOR_ROLE_LABELS[role],
  }));

export function labeledItems(
  rows: { value: string; label: string }[],
): SelectItemDef[] {
  return rows.map((row) => ({ value: row.value, label: row.label }));
}
