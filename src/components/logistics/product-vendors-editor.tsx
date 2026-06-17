"use client";

import type { ProductVendorRole, Vendor } from "@prisma/client";
import { useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  PRODUCT_VENDOR_ROLE_LABELS,
  PRODUCT_VENDOR_ROLE_ORDER,
  type ProductVendorLinkInput,
} from "@/lib/product-vendor";
import {
  PRODUCT_VENDOR_ROLE_ITEMS,
  vendorSelectItems,
} from "@/lib/select-option-items";import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type ProductVendorFormRow = ProductVendorLinkInput & { key: string };

function newRow(role: ProductVendorRole = "MAKLON"): ProductVendorFormRow {
  return {
    key: crypto.randomUUID(),
    vendorId: "",
    role,
    roleLabel: "",
    leadTimeDaysOverride: null,
    sortOrder: 0,
  };
}

export function productVendorsFromDb(
  rows: Array<{
    vendorId: string;
    role: ProductVendorRole;
    roleLabel: string | null;
    leadTimeDaysOverride: number | null;
    sortOrder: number;
  }>,
): ProductVendorFormRow[] {
  if (rows.length === 0) return [newRow()];
  return rows.map((row) => ({
    key: crypto.randomUUID(),
    vendorId: row.vendorId,
    role: row.role,
    roleLabel: row.roleLabel ?? "",
    leadTimeDaysOverride: row.leadTimeDaysOverride,
    sortOrder: row.sortOrder,
  }));
}

export function productVendorsToPayload(
  rows: ProductVendorFormRow[],
): ProductVendorLinkInput[] {
  return rows
    .filter((row) => row.vendorId)
    .map((row, index) => ({
      vendorId: row.vendorId,
      role: row.role,
      roleLabel: row.role === "OTHER" ? row.roleLabel?.trim() || null : null,
      leadTimeDaysOverride:
        row.leadTimeDaysOverride == null ? null : Number(row.leadTimeDaysOverride),
      sortOrder: index,
    }));
}

export function ProductVendorsEditor({
  rows,
  vendors,
  onChange,
}: {
  rows: ProductVendorFormRow[];
  vendors: Vendor[];
  onChange: (rows: ProductVendorFormRow[]) => void;
}) {
  const vendorSelectItemsList = useMemo(
    () => vendorSelectItems(vendors, "none", "— Pilih —"),
    [vendors],
  );

  function updateRow(key: string, patch: Partial<ProductVendorFormRow>) {
    onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function removeRow(key: string) {
    const next = rows.filter((row) => row.key !== key);
    onChange(next.length > 0 ? next : [newRow()]);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label>Rantai vendor</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...rows, newRow("PACKAGING")])}
        >
          <Plus className="size-4" />
          Tambah vendor
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        Satu SKU bisa punya beberapa vendor — contoh parfum: botol, packaging,
        dan maklon filling. Forecast memakai lead time terpanjang (bottleneck).
      </p>
      <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.key}
            className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_100px_32px]"
          >
            <div className="space-y-1">
              <Label className="text-xs">Peran</Label>
              <Select
                value={row.role}
                items={PRODUCT_VENDOR_ROLE_ITEMS}
                onValueChange={(v) =>
                  v && updateRow(row.key, { role: v as ProductVendorRole })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_VENDOR_ROLE_ORDER.map((role) => (
                    <SelectItem key={role} value={role}>
                      {PRODUCT_VENDOR_ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Vendor</Label>
              <Select
                value={row.vendorId || "none"}
                items={vendorSelectItemsList}
                onValueChange={(v) =>
                  updateRow(row.key, { vendorId: !v || v === "none" ? "" : v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih vendor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Pilih —</SelectItem>
                  {vendors.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">LT override</Label>
              <Input
                type="number"
                min={0}
                placeholder="Hari"
                value={row.leadTimeDaysOverride ?? ""}
                onChange={(e) =>
                  updateRow(row.key, {
                    leadTimeDaysOverride:
                      e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </div>
            <div className="flex items-end justify-end">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-8"
                onClick={() => removeRow(row.key)}
                aria-label="Hapus vendor"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
            {row.role === "OTHER" ? (
              <div className="space-y-1 sm:col-span-3">
                <Label className="text-xs">Label peran kustom</Label>
                <Input
                  value={row.roleLabel ?? ""}
                  onChange={(e) => updateRow(row.key, { roleLabel: e.target.value })}
                  placeholder="Mis. Cap / pump spray"
                />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
