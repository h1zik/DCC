"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Brand, Vendor } from "@prisma/client";
import { Package, Plus } from "lucide-react";
import { toast } from "sonner";
import { deleteProduct } from "@/actions/products";
import { actionErrorMessage } from "@/lib/action-error-message";
import type { ProductReorderForecast } from "@/lib/reorder-forecast";
import { brandFilterItems } from "@/lib/select-option-items";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  LogisticsFilterBar,
  LogisticsFilterField,
} from "@/components/logistics/logistics-filter-bar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdjustStockDialog } from "./adjust-stock-dialog";
import { ProductEditorSheet } from "./product-editor-sheet";
import { ProductsTable } from "./products-table";
import type { ProductRow } from "./types";

export function ProductsClient({
  products,
  brands,
  vendors,
  forecasts,
}: {
  products: ProductRow[];
  brands: Brand[];
  vendors: Vendor[];
  forecasts: ProductReorderForecast[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [editorSession, setEditorSession] = useState(0);

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState<ProductRow | null>(null);
  const [adjustSession, setAdjustSession] = useState(0);

  const [deleteTarget, setDeleteTarget] = useState<ProductRow | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const forecastById = useMemo(() => {
    const map = new Map<string, ProductReorderForecast>();
    for (const f of forecasts) map.set(f.productId, f);
    return map;
  }, [forecasts]);

  const brandFilterSelectItems = useMemo(() => brandFilterItems(brands), [brands]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (brandFilter !== "all" && p.brandId !== brandFilter) return false;
      if (!q) return true;
      return [p.name, p.sku, p.brand.name, p.category]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [products, search, brandFilter]);

  function openCreate() {
    setEditing(null);
    setEditorSession((s) => s + 1);
    setEditorOpen(true);
  }

  function openEdit(p: ProductRow) {
    setEditing(p);
    setEditorSession((s) => s + 1);
    setEditorOpen(true);
  }

  function openAdjust(p: ProductRow) {
    setAdjustTarget(p);
    setAdjustSession((s) => s + 1);
    setAdjustOpen(true);
  }

  async function onConfirmDelete() {
    if (!deleteTarget) return;
    setDeletePending(true);
    try {
      await deleteProduct(deleteTarget.id);
      toast.success("Produk dihapus.");
      setDeleteTarget(null);
      router.refresh();
    } catch (e) {
      toast.error(actionErrorMessage(e, "Gagal menghapus produk."));
    } finally {
      setDeletePending(false);
    }
  }

  if (brands.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="Belum ada brand terdaftar"
        description="Minta Administrator menambahkan brand di modul Brands sebelum membuat SKU."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <LogisticsFilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Cari nama, SKU, kategori…"
        right={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Produk baru
          </Button>
        }
      >
        <LogisticsFilterField label="Brand">
          <Select
            value={brandFilter}
            items={brandFilterSelectItems}
            onValueChange={(v) => setBrandFilter(v ?? "all")}
          >
            <SelectTrigger className="h-8 min-w-[10rem] text-xs">
              <SelectValue placeholder="Brand" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua brand</SelectItem>
              {brands.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </LogisticsFilterField>
      </LogisticsFilterBar>

      {products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Belum ada produk"
          description="Mulai dengan menambahkan SKU pertama untuk brand Anda."
          action={
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              Produk baru
            </Button>
          }
        />
      ) : (
        <ProductsTable
          data={filtered}
          onEdit={openEdit}
          onAdjust={openAdjust}
          onDelete={setDeleteTarget}
        />
      )}

      <ProductEditorSheet
        key={editorSession}
        open={editorOpen}
        onOpenChange={setEditorOpen}
        editing={editing}
        brands={brands}
        vendors={vendors}
        forecast={editing ? forecastById.get(editing.id) ?? null : null}
      />

      {adjustTarget ? (
        <AdjustStockDialog
          key={adjustSession}
          open={adjustOpen}
          onOpenChange={setAdjustOpen}
          target={adjustTarget}
        />
      ) : null}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => {
          if (!v) setDeleteTarget(null);
        }}
        title={`Hapus produk "${deleteTarget?.name ?? ""}"?`}
        description="Produk dihapus beserta seluruh riwayat stoknya — tindakan ini tidak bisa dibatalkan."
        confirmLabel="Hapus produk"
        pending={deletePending}
        onConfirm={onConfirmDelete}
      />
    </div>
  );
}
