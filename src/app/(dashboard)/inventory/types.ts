import type { Brand, Product, StockLog, User } from "@prisma/client";

export type InventoryProductRow = Product & {
  brand: Brand;
  preferredVendor?: { id: string; name: string } | null;
};

export type StockLogRow = StockLog & {
  product: InventoryProductRow;
  vendor?: { id: string; name: string } | null;
  createdBy?: Pick<User, "id" | "name" | "email"> | null;
};

export type SalesCategory = "penjualan" | "sampling" | "retur" | "rusak";

export const OUT_CATEGORIES: { value: SalesCategory; label: string }[] = [
  { value: "penjualan", label: "Penjualan" },
  { value: "sampling", label: "Sampling" },
  { value: "retur", label: "Retur" },
  { value: "rusak", label: "Rusak / expired" },
];
