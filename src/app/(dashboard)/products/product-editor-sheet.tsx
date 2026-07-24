"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PipelineStage } from "@prisma/client";
import type { Brand, Vendor } from "@prisma/client";
import { toast } from "sonner";
import { createProduct, updateProduct } from "@/actions/products";
import { actionErrorMessage } from "@/lib/action-error-message";
import { PIPELINE_LABELS, PIPELINE_ORDER } from "@/lib/pipeline";
import { brandIdItems } from "@/lib/select-option-items";
import type { ProductReorderForecast } from "@/lib/reorder-forecast";
import {
  ProductVendorsEditor,
  productVendorsFromDb,
  productVendorsToPayload,
  type ProductVendorFormRow,
} from "@/components/logistics/product-vendors-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ProductForecastSummary } from "./product-forecast-summary";
import type { ProductRow } from "./types";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
    </p>
  );
}

export function ProductEditorSheet({
  open,
  onOpenChange,
  editing,
  brands,
  vendors,
  forecast,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `null` = mode buat produk baru. */
  editing: ProductRow | null;
  brands: Brand[];
  vendors: Vendor[];
  forecast: ProductReorderForecast | null;
}) {
  const router = useRouter();
  const [brandId, setBrandId] = useState(editing?.brandId ?? brands[0]?.id ?? "");
  const [name, setName] = useState(editing?.name ?? "");
  const [sku, setSku] = useState(editing?.sku ?? "");
  const [openingStock, setOpeningStock] = useState(0);
  const [minStock, setMinStock] = useState(editing?.minStock ?? 0);
  const [category, setCategory] = useState(editing?.category ?? "");
  const [pipelineStage, setPipelineStage] = useState<PipelineStage>(
    editing?.pipelineStage ?? PipelineStage.MARKET_RESEARCH,
  );
  const [productVendorRows, setProductVendorRows] = useState<ProductVendorFormRow[]>(
    () =>
      productVendorsFromDb(
        editing
          ? editing.productVendors.length > 0
            ? editing.productVendors.map((pv) => ({
                vendorId: pv.vendorId,
                role: pv.role,
                roleLabel: pv.roleLabel,
                leadTimeDaysOverride: pv.leadTimeDaysOverride,
                sortOrder: pv.sortOrder,
              }))
            : editing.preferredVendorId
              ? [
                  {
                    vendorId: editing.preferredVendorId,
                    role: "MAKLON" as const,
                    roleLabel: null,
                    leadTimeDaysOverride: null,
                    sortOrder: 0,
                  },
                ]
              : []
          : [],
      ),
  );
  const [leadTimeDaysOverride, setLeadTimeDaysOverride] = useState<number | "">(
    editing?.leadTimeDaysOverride ?? "",
  );
  const [safetyStockDaysOverride, setSafetyStockDaysOverride] = useState<number | "">(
    editing?.safetyStockDaysOverride ?? "",
  );
  const [pending, setPending] = useState(false);

  const brandSelectItems = useMemo(() => brandIdItems(brands), [brands]);
  const pipelineSelectItems = useMemo(
    () =>
      PIPELINE_ORDER.map((stage) => ({
        value: stage,
        label: PIPELINE_LABELS[stage],
      })),
    [],
  );

  async function onSave() {
    setPending(true);
    try {
      const payload = {
        brandId,
        name,
        sku,
        minStock,
        category: category || null,
        pipelineStage,
        productVendors: productVendorsToPayload(productVendorRows),
        leadTimeDaysOverride:
          leadTimeDaysOverride === "" ? null : Number(leadTimeDaysOverride),
        safetyStockDaysOverride:
          safetyStockDaysOverride === "" ? null : Number(safetyStockDaysOverride),
      };
      if (editing) {
        await updateProduct(editing.id, payload);
        toast.success("Produk diperbarui.");
      } else {
        await createProduct({ ...payload, openingStock });
        toast.success("Produk ditambahkan.");
      }
      onOpenChange(false);
      router.refresh();
    } catch (e) {
      toast.error(actionErrorMessage(e, "Gagal menyimpan produk."));
    } finally {
      setPending(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="gap-0 overflow-x-hidden sm:max-w-xl">
        <SheetHeader className="border-b">
          <SheetTitle>{editing ? "Edit produk" : "Produk baru"}</SheetTitle>
          <SheetDescription>
            {editing
              ? `${editing.brand.name} · ${editing.sku}`
              : "Master data SKU — stok hanya berubah lewat mutasi atau opname."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          <section className="space-y-3">
            <SectionLabel>Identitas</SectionLabel>
            <div className="space-y-2">
              <Label>Brand</Label>
              <Select
                value={brandId}
                items={brandSelectItems}
                onValueChange={(v) => v && setBrandId(v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih brand" />
                </SelectTrigger>
                <SelectContent>
                  {brandSelectItems.map((b) => (
                    <SelectItem key={b.value} value={b.value}>
                      {b.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nama produk</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>SKU</Label>
                <Input
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  disabled={!!editing}
                  className="font-mono"
                />
                {editing ? (
                  <p className="text-muted-foreground text-xs">
                    SKU terkunci setelah dibuat.
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label>Kategori</Label>
                <Input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Body lotion, parfum…"
                />
              </div>
            </div>
          </section>

          <Separator />

          <section className="space-y-3">
            <SectionLabel>Stok &amp; reorder</SectionLabel>
            {editing ? (
              <>
                <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                  Stok saat ini: <strong>{editing.currentStock}</strong> unit —
                  gunakan &quot;Sesuaikan stok&quot; untuk stock opname
                  (tercatat di ledger).
                </div>
                {forecast ? <ProductForecastSummary forecast={forecast} /> : null}
              </>
            ) : (
              <div className="space-y-2">
                <Label>Saldo awal (opsional)</Label>
                <Input
                  type="number"
                  min={0}
                  value={openingStock}
                  onChange={(e) => setOpeningStock(Number(e.target.value))}
                />
                <p className="text-muted-foreground text-xs">
                  Dicatat sebagai mutasi masuk &quot;Saldo awal produk&quot;.
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Min. stok (reorder point)</Label>
              <Input
                type="number"
                min={0}
                value={minStock}
                onChange={(e) => setMinStock(Number(e.target.value))}
              />
            </div>
          </section>

          <Separator />

          <section className="space-y-3">
            <SectionLabel>Rantai vendor</SectionLabel>
            <ProductVendorsEditor
              rows={productVendorRows}
              vendors={vendors}
              onChange={setProductVendorRows}
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Override lead time (hari)</Label>
                <Input
                  type="number"
                  min={0}
                  value={leadTimeDaysOverride}
                  onChange={(e) =>
                    setLeadTimeDaysOverride(
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                  placeholder="Pakai vendor"
                />
              </div>
              <div className="space-y-2">
                <Label>Override safety buffer (hari)</Label>
                <Input
                  type="number"
                  min={0}
                  value={safetyStockDaysOverride}
                  onChange={(e) =>
                    setSafetyStockDaysOverride(
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                  placeholder="Pakai vendor"
                />
              </div>
            </div>
          </section>

          <Separator />

          <section className="space-y-3">
            <SectionLabel>Pipeline</SectionLabel>
            <div className="space-y-2">
              <Label>Tahap pipeline</Label>
              <Select
                value={pipelineStage}
                items={pipelineSelectItems}
                onValueChange={(v) => v && setPipelineStage(v as PipelineStage)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PIPELINE_ORDER.map((s) => (
                    <SelectItem key={s} value={s}>
                      {PIPELINE_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>
        </div>

        <SheetFooter className="flex-row justify-end border-t bg-muted/30">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button
            onClick={onSave}
            disabled={pending || !name.trim() || !sku.trim() || !brandId}
          >
            {pending ? "Menyimpan…" : "Simpan"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
