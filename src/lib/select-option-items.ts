import type { ReactNode } from "react";

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
