"use client";

import { actionErrorMessage } from "@/lib/action-error-message";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Brand, Product, ProductVendor, Vendor } from "@prisma/client";
import { PipelineStage } from "@prisma/client";
import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Pencil, Plus, Scale, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { adjustProductStock } from "@/actions/stock";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { createProduct, deleteProduct, updateProduct } from "@/actions/products";
import {
  reorderStatusLabel,
  type ProductReorderForecast,
} from "@/lib/reorder-forecast";
import { PIPELINE_LABELS, PIPELINE_ORDER } from "@/lib/pipeline";
import { brandIdItems, brandFilterItems } from "@/lib/select-option-items";
import { DataTable } from "@/components/data-table";
import { LogisticsNav } from "@/components/logistics/logistics-nav";
import {
  ProductVendorsEditor,
  productVendorsFromDb,
  productVendorsToPayload,
  type ProductVendorFormRow,
} from "@/components/logistics/product-vendors-editor";
import { formatProductVendorsSummary, resolveProductVendorLinks } from "@/lib/product-vendor";
import { StockHealthBadge } from "@/components/logistics/stock-health-badge";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ProductVendorRow = Pick<
  ProductVendor,
  "vendorId" | "role" | "roleLabel" | "leadTimeDaysOverride" | "sortOrder"
> & {
  vendor: Pick<
    Vendor,
    "id" | "name" | "leadTimeDays" | "safetyStockDays" | "reviewPeriodDays"
  >;
};

type Row = Product & {
  brand: Brand;
  preferredVendor?: { id: string; name: string } | null;
  productVendors: ProductVendorRow[];
};

export function ProductsClient({
  products,
  brands,
  vendors,
  forecasts,
}: {
  products: Row[];
  brands: Brand[];
  vendors: Vendor[];
  forecasts: ProductReorderForecast[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [brandId, setBrandId] = useState("");
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [openingStock, setOpeningStock] = useState(0);
  const [minStock, setMinStock] = useState(0);
  const [category, setCategory] = useState("");
  const [pipelineStage, setPipelineStage] = useState<PipelineStage>(
    PipelineStage.MARKET_RESEARCH,
  );
  const [productVendorRows, setProductVendorRows] = useState<ProductVendorFormRow[]>(
    productVendorsFromDb([]),
  );
  const [leadTimeDaysOverride, setLeadTimeDaysOverride] = useState<number | "">("");
  const [safetyStockDaysOverride, setSafetyStockDaysOverride] = useState<number | "">("");
  const [pending, setPending] = useState(false);

  const forecastById = useMemo(() => {
    const map = new Map<string, ProductReorderForecast>();
    for (const f of forecasts) map.set(f.productId, f);
    return map;
  }, [forecasts]);

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState<Row | null>(null);
  const [targetStock, setTargetStock] = useState(0);
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustPending, setAdjustPending] = useState(false);

  const brandSelectItems = useMemo(() => brandIdItems(brands), [brands]);
  const brandFilterSelectItems = useMemo(() => brandFilterItems(brands), [brands]);
  const pipelineSelectItems = useMemo(
    () =>
      PIPELINE_ORDER.map((stage) => ({
        value: stage,
        label: PIPELINE_LABELS[stage],
      })),
    [],
  );

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

  function resetForm() {
    setEditing(null);
    setBrandId(brands[0]?.id ?? "");
    setName("");
    setSku("");
    setOpeningStock(0);
    setMinStock(0);
    setCategory("");
    setPipelineStage(PipelineStage.MARKET_RESEARCH);
    setProductVendorRows(productVendorsFromDb([]));
    setLeadTimeDaysOverride("");
    setSafetyStockDaysOverride("");
  }

  function openCreate() {
    resetForm();
    setOpen(true);
  }

  function openEdit(p: Row) {
    setEditing(p);
    setBrandId(p.brandId);
    setName(p.name);
    setSku(p.sku);
    setMinStock(p.minStock);
    setCategory(p.category ?? "");
    setPipelineStage(p.pipelineStage);
    setProductVendorRows(
      productVendorsFromDb(
        p.productVendors.length > 0
          ? p.productVendors.map((pv) => ({
              vendorId: pv.vendorId,
              role: pv.role,
              roleLabel: pv.roleLabel,
              leadTimeDaysOverride: pv.leadTimeDaysOverride,
              sortOrder: pv.sortOrder,
            }))
          : p.preferredVendorId
            ? [
                {
                  vendorId: p.preferredVendorId,
                  role: "MAKLON" as const,
                  roleLabel: null,
                  leadTimeDaysOverride: null,
                  sortOrder: 0,
                },
              ]
            : [],
      ),
    );
    setLeadTimeDaysOverride(p.leadTimeDaysOverride ?? "");
    setSafetyStockDaysOverride(p.safetyStockDaysOverride ?? "");
    setOpen(true);
  }

  function openAdjust(p: Row) {
    setAdjustTarget(p);
    setTargetStock(p.currentStock);
    setAdjustReason("");
    setAdjustOpen(true);
  }

  async function onSave() {
    setPending(true);
    try {
      const overrides = {
        leadTimeDaysOverride:
          leadTimeDaysOverride === "" ? null : Number(leadTimeDaysOverride),
        safetyStockDaysOverride:
          safetyStockDaysOverride === "" ? null : Number(safetyStockDaysOverride),
      };
      const vendorPayload = productVendorsToPayload(productVendorRows);
      const payload = {
        brandId,
        name,
        sku,
        minStock,
        category: category || null,
        pipelineStage,
        productVendors: vendorPayload,
        ...overrides,
      };
      if (editing) {
        await updateProduct(editing.id, payload);
        toast.success("Produk diperbarui.");
      } else {
        await createProduct({
          ...payload,
          openingStock,
        });
        toast.success("Produk ditambahkan.");
      }
      setOpen(false);
      resetForm();
      router.refresh();
    } catch (e) {
      toast.error(actionErrorMessage(e, "Gagal menyimpan produk."));
    } finally {
      setPending(false);
    }
  }

  async function onAdjustSave() {
    if (!adjustTarget) return;
    if (adjustReason.trim().length < 3) {
      toast.error("Alasan penyesuaian minimal 3 karakter.");
      return;
    }
    setAdjustPending(true);
    try {
      await adjustProductStock({
        productId: adjustTarget.id,
        targetStock,
        reason: adjustReason.trim(),
      });
      toast.success("Stok disesuaikan dengan jejak audit.");
      setAdjustOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(actionErrorMessage(e, "Gagal menyesuaikan stok."));
    } finally {
      setAdjustPending(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Hapus produk ini beserta riwayat stoknya?")) return;
    try {
      await deleteProduct(id);
      toast.success("Produk dihapus.");
      router.refresh();
    } catch {
      toast.error("Gagal menghapus produk.");
    }
  }

  const columns = useMemo<ColumnDef<Row>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Produk",
        cell: ({ row }) => (
          <div>
            <span className="font-medium">{row.original.name}</span>
            <p className="text-muted-foreground font-mono text-[10px]">{row.original.sku}</p>
          </div>
        ),
      },
      { id: "brand", header: "Brand", cell: ({ row }) => row.original.brand.name },
      {
        id: "stock",
        header: "Stok",
        cell: ({ row }) => (
          <span className="text-base font-semibold tabular-nums">{row.original.currentStock}</span>
        ),
      },
      {
        id: "min",
        header: "Min.",
        cell: ({ row }) => <span className="tabular-nums">{row.original.minStock}</span>,
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => (
          <StockHealthBadge
            currentStock={row.original.currentStock}
            minStock={row.original.minStock}
          />
        ),
      },
      {
        id: "vendor",
        header: "Vendor",
        cell: ({ row }) => {
          const links = resolveProductVendorLinks({
            leadTimeDaysOverride: row.original.leadTimeDaysOverride,
            safetyStockDaysOverride: row.original.safetyStockDaysOverride,
            preferredVendor: row.original.preferredVendor
              ? {
                  id: row.original.preferredVendor.id,
                  name: row.original.preferredVendor.name,
                  leadTimeDays: null,
                  safetyStockDays: 7,
                  reviewPeriodDays: 14,
                }
              : null,
            productVendors: row.original.productVendors.map((pv) => ({
              role: pv.role,
              roleLabel: pv.roleLabel,
              leadTimeDaysOverride: pv.leadTimeDaysOverride,
              sortOrder: pv.sortOrder,
              vendor: {
                id: pv.vendor.id,
                name: pv.vendor.name,
                leadTimeDays: pv.vendor.leadTimeDays,
                safetyStockDays: pv.vendor.safetyStockDays,
                reviewPeriodDays: pv.vendor.reviewPeriodDays,
              },
            })),
          });
          return (
            <span className="text-muted-foreground max-w-[220px] text-xs leading-snug">
              {formatProductVendorsSummary(links, 2)}
            </span>
          );
        },
      },
      {
        id: "pipeline",
        header: "Pipeline",
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">
            {PIPELINE_LABELS[row.original.pipelineStage]}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "size-8")}
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openEdit(row.original)}>
                <Pencil className="size-4" />
                Edit master
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openAdjust(row.original)}>
                <Scale className="size-4" />
                Sesuaikan stok
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => onDelete(row.original.id)}>
                <Trash2 className="size-4" />
                Hapus
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [],
  );

  return (
    <div className="flex flex-col gap-6">
      <LogisticsNav />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
          <Input
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, SKU, kategori…"
          />
        </div>
        <Select
          value={brandFilter}
          items={brandFilterSelectItems}
          onValueChange={(v) => setBrandFilter(v ?? "all")}
        >
          <SelectTrigger className="w-[160px]">
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
        <Button onClick={openCreate} disabled={brands.length === 0}>
          <Plus className="size-4" />
          Produk baru
        </Button>
      </div>

      {brands.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <p className="text-muted-foreground text-sm">
            Belum ada brand terdaftar. Minta Administrator menambahkan brand di
            modul Brands sebelum membuat SKU.
          </p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          empty="Tidak ada produk yang cocok."
          sortable
          viewportMaxHeight="calc(100dvh - 320px)"
          stickyHeader
        />
      )}

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit produk" : "Produk baru"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Brand</Label>
              <Select
                value={brandId}
                items={brandSelectItems}
                onValueChange={(v) => v && setBrandId(v)}
              >
                <SelectTrigger><SelectValue placeholder="Pilih brand" /></SelectTrigger>
                <SelectContent>
                  {brandSelectItems.map((b) => (
                    <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nama produk</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>SKU</Label>
              <Input value={sku} onChange={(e) => setSku(e.target.value)} disabled={!!editing} className="font-mono" />
            </div>
            {editing ? (
              <>
                <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                  Stok saat ini: <strong>{editing.currentStock}</strong> unit — gunakan
                  &quot;Sesuaikan stok&quot; untuk stock opname (tercatat di ledger).
                </div>
                {(() => {
                  const fc = forecastById.get(editing.id);
                  if (!fc) return null;
                  return (
                    <div className="space-y-2 rounded-md border px-3 py-2 text-sm">
                      <p className="font-medium">Forecast reorder (90 hari)</p>
                      <div className="text-muted-foreground grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        <span>Burn rate</span>
                        <span className="text-foreground tabular-nums">
                          {fc.avgDailyDemand.toFixed(2)} unit/hari
                        </span>
                        <span>ROP terhitung</span>
                        <span className="text-foreground tabular-nums">
                          {fc.reorderPoint ?? "—"}
                        </span>
                        <span>Min. manual</span>
                        <span className="text-foreground tabular-nums">{fc.manualMinStock}</span>
                        <span>Stok habis ~</span>
                        <span className="text-foreground">
                          {fc.daysUntilStockout != null
                            ? `${fc.daysUntilStockout.toFixed(1)} hari`
                            : "—"}
                        </span>
                        <span>Lead time (bottleneck)</span>
                        <span className="text-foreground tabular-nums">
                          {fc.leadTimeDays != null ? `${fc.leadTimeDays} hari` : "—"}
                        </span>
                        <span>Rantai vendor</span>
                        <span className="text-foreground text-xs leading-snug">
                          {fc.vendorsSummary}
                        </span>
                        <span>Order sebelum</span>
                        <span className="text-foreground">
                          {fc.orderByDate
                            ? format(fc.orderByDate, "d MMM yyyy", { locale: idLocale })
                            : "—"}
                        </span>
                      </div>
                      <Badge variant={fc.status === "ORDER_NOW" ? "destructive" : "secondary"}>
                        {reorderStatusLabel(fc.status)}
                      </Badge>
                    </div>
                  );
                })()}
              </>
            ) : (
              <div className="space-y-2">
                <Label>Saldo awal (opsional)</Label>
                <Input type="number" min={0} value={openingStock} onChange={(e) => setOpeningStock(Number(e.target.value))} />
                <p className="text-muted-foreground text-xs">Dicatat sebagai mutasi masuk &quot;Saldo awal produk&quot;.</p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Min. stok (reorder point)</Label>
              <Input type="number" min={0} value={minStock} onChange={(e) => setMinStock(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Kategori</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Body lotion, parfum…" />
            </div>
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
            <div className="space-y-2">
              <Label>Tahap pipeline</Label>
              <Select
                value={pipelineStage}
                items={pipelineSelectItems}
                onValueChange={(v) => v && setPipelineStage(v as PipelineStage)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PIPELINE_ORDER.map((s) => (
                    <SelectItem key={s} value={s}>{PIPELINE_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={onSave} disabled={pending || !name.trim() || !sku.trim() || !brandId}>
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sesuaikan stok (stock opname)</DialogTitle>
          </DialogHeader>
          {adjustTarget ? (
            <p className="text-muted-foreground text-sm">
              {adjustTarget.name} · stok sistem: {adjustTarget.currentStock} unit
            </p>
          ) : null}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Stok fisik (hasil hitung)</Label>
              <Input type="number" min={0} value={targetStock} onChange={(e) => setTargetStock(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Alasan penyesuaian</Label>
              <Input value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="Stock opname Maret 2026" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(false)}>Batal</Button>
            <Button onClick={onAdjustSave} disabled={adjustPending || adjustReason.trim().length < 3}>
              {adjustPending ? "Menyimpan…" : "Simpan penyesuaian"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
