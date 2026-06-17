"use client";

import { actionErrorMessage } from "@/lib/action-error-message";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Brand, Product, StockLog, User, Vendor } from "@prisma/client";
import { StockLogType } from "@prisma/client";
import type { ColumnDef } from "@tanstack/react-table";
import { format, isBefore, startOfDay, subDays } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Pencil, Printer, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createStockLog, deleteStockLog, updateStockLog } from "@/actions/stock";
import { computeInventoryDashboard } from "@/lib/inventory-metrics";
import {
  printStockCorrectionReport,
  printStockMutationReport,
} from "@/lib/inventory-print";
import {
  formatSalesCategory,
  formatStockLogNote,
  isSystemStockLog,
  parseSystemMeta,
} from "@/lib/stock-log-utils";
import { DataTable } from "@/components/data-table";
import { InventoryKpiCards, ReorderAlertPanel } from "@/components/logistics/inventory-kpi-cards";
import { LogisticsNav } from "@/components/logistics/logistics-nav";
import { ReorderForecastTab } from "@/components/logistics/reorder-forecast-tab";
import { StockHealthBadge } from "@/components/logistics/stock-health-badge";
import type { ProductReorderForecast } from "@/lib/reorder-forecast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  brandFilterItems,
  DAYS_FILTER_ITEMS,
  labeledItems,
  productSelectItems,
  STOCK_LOG_TYPE_FILTER_ITEMS,
  STOCK_LOG_TYPE_ITEMS,
  vendorSelectItems,
} from "@/lib/select-option-items";

type ProductRow = Product & {
  brand: Brand;
  preferredVendor?: { id: string; name: string } | null;
};
type LogRow = StockLog & {
  product: ProductRow;
  vendor?: { id: string; name: string } | null;
  createdBy?: Pick<User, "id" | "name" | "email"> | null;
};

type SalesCategory = "penjualan" | "sampling" | "retur" | "rusak";

const OUT_CATEGORIES: { value: SalesCategory; label: string }[] = [
  { value: "penjualan", label: "Penjualan" },
  { value: "sampling", label: "Sampling" },
  { value: "retur", label: "Retur" },
  { value: "rusak", label: "Rusak / expired" },
];

export function InventoryClient({
  products,
  logs,
  vendors,
  forecasts,
  windowDays,
}: {
  products: ProductRow[];
  logs: LogRow[];
  vendors: Vendor[];
  forecasts: ProductReorderForecast[];
  windowDays: number;
}) {
  const router = useRouter();
  const [tab, setTab] = useState("ringkasan");

  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [amount, setAmount] = useState(1);
  const [type, setType] = useState<StockLogType>(StockLogType.IN);
  const [salesCategory, setSalesCategory] = useState<SalesCategory | "">("");
  const [note, setNote] = useState("");
  const [reference, setReference] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [pending, setPending] = useState(false);

  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<"all" | StockLogType>("all");
  const [daysFilter, setDaysFilter] = useState("30");
  const [stockSearch, setStockSearch] = useState("");
  const [stockBrandFilter, setStockBrandFilter] = useState("all");

  const [editOpen, setEditOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<LogRow | null>(null);
  const [editAmount, setEditAmount] = useState(1);
  const [editType, setEditType] = useState<StockLogType>(StockLogType.IN);
  const [editSalesCategory, setEditSalesCategory] = useState<SalesCategory | "">("");
  const [editNote, setEditNote] = useState("");
  const [editReference, setEditReference] = useState("");
  const [editReason, setEditReason] = useState("");
  const [editPending, setEditPending] = useState(false);

  const [voidOpen, setVoidOpen] = useState(false);
  const [voidingLog, setVoidingLog] = useState<LogRow | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidPending, setVoidPending] = useState(false);

  const brands = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) map.set(p.brand.id, p.brand.name);
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  const productSelectItemsList = useMemo(() => productSelectItems(products), [products]);
  const brandFilterSelectItems = useMemo(() => brandFilterItems(brands), [brands]);
  const vendorSelectItemsList = useMemo(
    () => vendorSelectItems(vendors, "none", "— Tanpa vendor —"),
    [vendors],
  );
  const salesCategorySelectItems = useMemo(
    () => labeledItems(OUT_CATEGORIES),
    [],
  );

  const forecastById = useMemo(() => {
    const map = new Map<string, ProductReorderForecast>();
    for (const f of forecasts) map.set(f.productId, f);
    return map;
  }, [forecasts]);

  const stats = useMemo(
    () => computeInventoryDashboard(products, logs, forecasts),
    [products, logs, forecasts],
  );

  const businessLogs = useMemo(() => logs.filter((l) => !isSystemStockLog(l.note)), [logs]);
  const correctionLogs = useMemo(() => logs.filter((l) => isSystemStockLog(l.note)), [logs]);

  const businessLogStatusById = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of correctionLogs) {
      const meta = parseSystemMeta(row);
      if (!meta.targetId || !meta.action) continue;
      const current = map.get(meta.targetId);
      const next =
        meta.action === "VOID"
          ? "Di-void"
          : meta.action === "REPLACEMENT"
            ? "Dikoreksi"
            : "Dibalik";
      if (current === "Di-void") continue;
      map.set(meta.targetId, next);
    }
    return map;
  }, [correctionLogs]);

  const replacementByTargetId = useMemo(() => {
    const map = new Map<string, LogRow>();
    for (const row of correctionLogs) {
      const meta = parseSystemMeta(row);
      if (meta.action !== "REPLACEMENT" || !meta.targetId) continue;
      const prev = map.get(meta.targetId);
      if (!prev || row.createdAt > prev.createdAt) map.set(meta.targetId, row);
    }
    return map;
  }, [correctionLogs]);

  const filteredBusinessLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    const dayLimit = daysFilter === "all" ? null : subDays(startOfDay(new Date()), Number(daysFilter));
    return businessLogs.filter((log) => {
      if (brandFilter !== "all" && log.product.brandId !== brandFilter) return false;
      if (typeFilter !== "all" && log.type !== typeFilter) return false;
      if (dayLimit && isBefore(new Date(log.createdAt), dayLimit)) return false;
      if (!q) return true;
      const hay = [
        log.product.name,
        log.product.sku,
        log.product.brand.name,
        log.note,
        log.reference,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [businessLogs, search, brandFilter, typeFilter, daysFilter]);

  const filteredProducts = useMemo(() => {
    const q = stockSearch.trim().toLowerCase();
    return products.filter((p) => {
      if (stockBrandFilter !== "all" && p.brandId !== stockBrandFilter) return false;
      if (!q) return true;
      return [p.name, p.sku, p.brand.name, p.category]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [products, stockSearch, stockBrandFilter]);

  const selectedProduct = products.find((p) => p.id === productId);

  async function onSubmitLog(e: React.FormEvent) {
    e.preventDefault();
    if (!productId) {
      toast.error("Pilih produk.");
      return;
    }
    if (type === StockLogType.OUT && !salesCategory) {
      toast.error("Kategori stok keluar wajib dipilih.");
      return;
    }
    setPending(true);
    try {
      await createStockLog({
        productId,
        amount,
        type,
        salesCategory: type === StockLogType.OUT ? salesCategory || null : null,
        note: note || null,
        reference: reference || null,
        vendorId: type === StockLogType.IN && vendorId ? vendorId : null,
      });
      toast.success("Pergerakan stok tercatat.");
      setNote("");
      setReference("");
      setSalesCategory("");
      setVendorId("");
      setAmount(1);
      router.refresh();
    } catch (err) {
      toast.error(actionErrorMessage(err, "Gagal mencatat stok."));
    } finally {
      setPending(false);
    }
  }

  function openEditLog(log: LogRow) {
    if (isSystemStockLog(log.note)) {
      toast.error("Mutasi sistem tidak dapat dikoreksi.");
      return;
    }
    setEditingLog(log);
    setEditAmount(log.amount);
    setEditType(log.type);
    setEditSalesCategory(
      log.type === StockLogType.OUT && log.salesCategory
        ? (log.salesCategory as SalesCategory)
        : "",
    );
    setEditNote(log.note ?? "");
    setEditReference(log.reference ?? "");
    setEditReason("");
    setEditOpen(true);
  }

  function openVoidLog(log: LogRow) {
    if (isSystemStockLog(log.note)) {
      toast.error("Mutasi sistem tidak dapat di-void.");
      return;
    }
    setVoidingLog(log);
    setVoidReason("");
    setVoidOpen(true);
  }

  async function onSaveEditLog(e: React.FormEvent) {
    e.preventDefault();
    if (!editingLog) return;
    if (editType === StockLogType.OUT && !editSalesCategory) {
      toast.error("Kategori stok keluar wajib dipilih.");
      return;
    }
    if (editReason.trim().length < 3) {
      toast.error("Alasan koreksi minimal 3 karakter.");
      return;
    }
    setEditPending(true);
    try {
      await updateStockLog({
        logId: editingLog.id,
        amount: editAmount,
        type: editType,
        salesCategory: editType === StockLogType.OUT ? editSalesCategory || null : null,
        note: editNote || null,
        reference: editReference || null,
        reason: editReason.trim(),
      });
      toast.success("Koreksi mutasi berhasil dicatat.");
      setEditOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(actionErrorMessage(err, "Gagal memperbarui mutasi."));
    } finally {
      setEditPending(false);
    }
  }

  async function onConfirmVoid(e: React.FormEvent) {
    e.preventDefault();
    if (!voidingLog) return;
    if (voidReason.trim().length < 3) {
      toast.error("Alasan void minimal 3 karakter.");
      return;
    }
    setVoidPending(true);
    try {
      await deleteStockLog({ logId: voidingLog.id, reason: voidReason.trim() });
      toast.success("Mutasi di-void dengan jejak audit.");
      setVoidOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(actionErrorMessage(err, "Gagal mem-void mutasi."));
    } finally {
      setVoidPending(false);
    }
  }

  const logColumns = useMemo<ColumnDef<LogRow>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: "Waktu",
        cell: ({ row }) =>
          format(row.original.createdAt, "d MMM yyyy, HH:mm", { locale: idLocale }),
      },
      {
        id: "brand",
        header: "Brand",
        cell: ({ row }) => row.original.product.brand.name,
      },
      {
        id: "product",
        header: "Produk",
        cell: ({ row }) => (
          <div className="min-w-[120px]">
            <p className="font-medium">{row.original.product.name}</p>
            <p className="text-muted-foreground font-mono text-[10px]">{row.original.product.sku}</p>
          </div>
        ),
      },
      {
        id: "type",
        header: "Tipe",
        cell: ({ row }) => {
          const effective = replacementByTargetId.get(row.original.id) ?? row.original;
          return effective.type === StockLogType.IN ? (
            <Badge className="bg-emerald-600 text-white hover:bg-emerald-600/90">Masuk</Badge>
          ) : (
            <Badge variant="secondary">Keluar</Badge>
          );
        },
      },
      {
        accessorKey: "amount",
        header: "Qty",
        cell: ({ row }) => {
          const effective = replacementByTargetId.get(row.original.id) ?? row.original;
          return <span className="tabular-nums font-medium">{effective.amount}</span>;
        },
      },
      {
        id: "category",
        header: "Kategori",
        cell: ({ row }) => {
          const effective = replacementByTargetId.get(row.original.id) ?? row.original;
          return (
            <span className="text-xs">
              {effective.type === StockLogType.OUT
                ? formatSalesCategory(effective.salesCategory)
                : row.original.vendor?.name ?? "—"}
            </span>
          );
        },
      },
      {
        id: "note",
        header: "Catatan",
        cell: ({ row }) => (
          <div className="max-w-[180px] space-y-1">
            <p className="text-muted-foreground line-clamp-2 text-xs" title={formatStockLogNote(row.original)}>
              {formatStockLogNote(row.original)}
            </p>
            {row.original.reference ? (
              <p className="font-mono text-[10px] text-muted-foreground">Ref: {row.original.reference}</p>
            ) : null}
            {businessLogStatusById.get(row.original.id) ? (
              <Badge variant="outline" className="text-[10px]">
                {businessLogStatusById.get(row.original.id)}
              </Badge>
            ) : null}
          </div>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex gap-1">
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => openEditLog(row.original)} aria-label="Koreksi">
              <Pencil className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-destructive"
              onClick={() => openVoidLog(row.original)}
              aria-label="Void"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    [businessLogStatusById, replacementByTargetId],
  );

  const stockColumns = useMemo<ColumnDef<ProductRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Produk",
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.name}</p>
            <p className="text-muted-foreground font-mono text-[10px]">{row.original.sku}</p>
          </div>
        ),
      },
      { id: "brand", header: "Brand", cell: ({ row }) => row.original.brand.name },
      {
        id: "stock",
        header: "Stok",
        cell: ({ row }) => (
          <span className="text-lg font-semibold tabular-nums">{row.original.currentStock}</span>
        ),
      },
      {
        id: "min",
        header: "Min.",
        cell: ({ row }) => <span className="tabular-nums">{row.original.minStock}</span>,
      },
      {
        id: "vendor",
        header: "Vendor",
        cell: ({ row }) => (
          <span className="max-w-[200px] text-xs leading-snug">
            {forecastById.get(row.original.id)?.vendorsSummary ?? "—"}
          </span>
        ),
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
    ],
    [forecastById],
  );

  const correctionColumns = useMemo<ColumnDef<LogRow>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: "Waktu",
        cell: ({ row }) =>
          format(row.original.createdAt, "d MMM yyyy, HH:mm", { locale: idLocale }),
      },
      {
        id: "action",
        header: "Aksi",
        cell: ({ row }) => {
          const action = parseSystemMeta(row.original).action;
          const label =
            action === "VOID" ? "Void" : action === "REPLACEMENT" ? "Koreksi" : "Pembalik";
          return <Badge variant="secondary">{label}</Badge>;
        },
      },
      { id: "product", header: "Produk", cell: ({ row }) => row.original.product.name },
      {
        id: "reason",
        header: "Alasan",
        cell: ({ row }) => {
          const meta = parseSystemMeta(row.original);
          return (
            <span className="text-muted-foreground text-xs">
              {[meta.reason, meta.extraNote].filter(Boolean).join(" — ") || "—"}
            </span>
          );
        },
      },
      {
        id: "by",
        header: "Oleh",
        cell: ({ row }) => row.original.createdBy?.name ?? row.original.createdBy?.email ?? "—",
      },
    ],
    [],
  );

  const movementForm = (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Catat stok masuk / keluar</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmitLog} className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4 lg:col-span-2">
            <div className="space-y-2">
              <Label>Produk</Label>
              <Select
                value={productId}
                items={productSelectItemsList}
                onValueChange={(v) => v && setProductId(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih SKU" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.brand.name} — {p.name} ({p.sku}) · stok {p.currentStock}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedProduct ? (
                <p className="text-muted-foreground text-xs">
                  Stok saat ini:{" "}
                  <span className="font-semibold text-foreground">
                    {selectedProduct.currentStock}
                  </span>{" "}
                  unit · min {selectedProduct.minStock}
                </p>
              ) : null}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Tipe</Label>
            <Select
              value={type}
              items={STOCK_LOG_TYPE_ITEMS}
              onValueChange={(v) => v && setType(v as StockLogType)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={StockLogType.IN}>Masuk</SelectItem>
                <SelectItem value={StockLogType.OUT}>Keluar</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="qty">Jumlah (unit)</Label>
            <Input id="qty" type="number" min={1} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </div>
          {type === StockLogType.OUT ? (
            <div className="space-y-2 lg:col-span-2">
              <Label>Kategori keluar</Label>
              <Select
                value={salesCategory}
                items={salesCategorySelectItems}
                onValueChange={(v) => v && setSalesCategory(v as SalesCategory)}
              >
                <SelectTrigger><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                <SelectContent>
                  {OUT_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-2 lg:col-span-2">
              <Label>Vendor / sumber (opsional)</Label>
              <Select
                value={vendorId || "none"}
                items={vendorSelectItemsList}
                onValueChange={(v) => setVendorId(!v || v === "none" ? "" : v)}
              >
                <SelectTrigger><SelectValue placeholder="Pilih vendor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Tanpa vendor —</SelectItem>
                  {vendors.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="ref">Referensi (PO / invoice)</Label>
            <Input id="ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="PO-2026-001" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="note">Catatan</Label>
            <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Channel penjualan, batch…" />
          </div>
          <div className="lg:col-span-2">
            <Button
              type="submit"
              className="w-full sm:w-auto"
              disabled={pending || products.length === 0 || (type === StockLogType.OUT && !salesCategory)}
            >
              {pending ? "Menyimpan…" : "Simpan ke buku stok"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-col gap-6">
      <LogisticsNav />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="ringkasan">Ringkasan</TabsTrigger>
          <TabsTrigger value="forecast">
            Forecast & Reorder (
            {forecasts.filter((f) => f.status === "ORDER_NOW" || f.status === "ORDER_SOON").length})
          </TabsTrigger>
          <TabsTrigger value="mutasi">Mutasi ({businessLogs.length})</TabsTrigger>
          <TabsTrigger value="stok">Stok ({products.length})</TabsTrigger>
          <TabsTrigger value="audit">Audit ({correctionLogs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="ringkasan" className="mt-4 space-y-6">
          <InventoryKpiCards stats={stats} />
          <div className="grid gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2">{movementForm}</div>
            <ReorderAlertPanel items={stats.reorderList} />
          </div>
        </TabsContent>

        <TabsContent value="forecast" className="mt-4">
          <ReorderForecastTab forecasts={forecasts} windowDays={windowDays} />
        </TabsContent>

        <TabsContent value="mutasi" className="mt-4 space-y-4">
          {movementForm}
          <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/30 p-3">
            <div className="min-w-[200px] flex-1 space-y-1">
              <Label className="text-xs">Cari</Label>
              <div className="relative">
                <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
                <Input className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="SKU, produk, catatan…" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Brand</Label>
              <Select
                value={brandFilter}
                items={brandFilterSelectItems}
                onValueChange={(v) => setBrandFilter(v ?? "all")}
              >
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  {brands.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tipe</Label>
              <Select
                value={typeFilter}
                items={STOCK_LOG_TYPE_FILTER_ITEMS}
                onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}
              >
                <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  <SelectItem value={StockLogType.IN}>Masuk</SelectItem>
                  <SelectItem value={StockLogType.OUT}>Keluar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Periode</Label>
              <Select
                value={daysFilter}
                items={DAYS_FILTER_ITEMS}
                onValueChange={(v) => setDaysFilter(v ?? "30")}
              >
                <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 hari</SelectItem>
                  <SelectItem value="30">30 hari</SelectItem>
                  <SelectItem value="90">90 hari</SelectItem>
                  <SelectItem value="all">Semua</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={filteredBusinessLogs.length === 0}
              onClick={() => {
                if (!printStockMutationReport(filteredBusinessLogs)) {
                  toast.error("Pop-up diblokir. Izinkan pop-up lalu coba lagi.");
                }
              }}
            >
              <Printer className="size-4" />
              Cetak ({filteredBusinessLogs.length})
            </Button>
          </div>
          <DataTable
            columns={logColumns}
            data={filteredBusinessLogs}
            empty="Tidak ada mutasi yang cocok dengan filter."
            sortable
            viewportMaxHeight="calc(100dvh - 420px)"
            stickyHeader
          />
        </TabsContent>

        <TabsContent value="stok" className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative min-w-[200px] flex-1">
              <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
              <Input className="pl-8" value={stockSearch} onChange={(e) => setStockSearch(e.target.value)} placeholder="Cari SKU atau produk…" />
            </div>
            <Select
              value={stockBrandFilter}
              items={brandFilterSelectItems}
              onValueChange={(v) => setStockBrandFilter(v ?? "all")}
            >
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Brand" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua brand</SelectItem>
                {brands.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DataTable
            columns={stockColumns}
            data={filteredProducts}
            empty="Tidak ada produk."
            sortable
            viewportMaxHeight="calc(100dvh - 280px)"
            stickyHeader
          />
        </TabsContent>

        <TabsContent value="audit" className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-muted-foreground text-sm">
              Jejak koreksi dan void — entri sistem append-only, tidak dapat diedit langsung.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={correctionLogs.length === 0}
              onClick={() => {
                if (!printStockCorrectionReport(correctionLogs)) {
                  toast.error("Pop-up diblokir.");
                }
              }}
            >
              <Printer className="size-4" />
              Cetak audit
            </Button>
          </div>
          <DataTable
            columns={correctionColumns}
            data={correctionLogs}
            empty="Belum ada koreksi atau void."
            sortable
            viewportMaxHeight="calc(100dvh - 280px)"
            stickyHeader
          />
        </TabsContent>
      </Tabs>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={onSaveEditLog} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Koreksi mutasi</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipe</Label>
                <Select
                  value={editType}
                  items={STOCK_LOG_TYPE_ITEMS}
                  onValueChange={(v) => v && setEditType(v as StockLogType)}
                  disabled={editPending}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={StockLogType.IN}>Masuk</SelectItem>
                    <SelectItem value={StockLogType.OUT}>Keluar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Qty</Label>
                <Input type="number" min={1} value={editAmount} onChange={(e) => setEditAmount(Number(e.target.value))} disabled={editPending} />
              </div>
            </div>
            {editType === StockLogType.OUT ? (
              <div className="space-y-2">
                <Label>Kategori keluar</Label>
                <Select
                  value={editSalesCategory}
                  items={salesCategorySelectItems}
                  onValueChange={(v) => v && setEditSalesCategory(v as SalesCategory)}
                  disabled={editPending}
                >
                  <SelectTrigger><SelectValue placeholder="Pilih" /></SelectTrigger>
                  <SelectContent>
                    {OUT_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label>Catatan</Label>
              <Textarea value={editNote} onChange={(e) => setEditNote(e.target.value)} rows={2} disabled={editPending} />
            </div>
            <div className="space-y-2">
              <Label>Alasan koreksi</Label>
              <Textarea value={editReason} onChange={(e) => setEditReason(e.target.value)} rows={2} placeholder="Salah input jumlah…" disabled={editPending} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={editPending}>Batal</Button>
              <Button type="submit" disabled={editPending || editReason.trim().length < 3}>Simpan koreksi</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={voidOpen} onOpenChange={setVoidOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={onConfirmVoid} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Void mutasi</DialogTitle>
            </DialogHeader>
            {voidingLog ? (
              <p className="text-muted-foreground text-sm">
                {voidingLog.product.name} ·{" "}
                {voidingLog.type === StockLogType.IN ? "Masuk" : "Keluar"}{" "}
                {voidingLog.amount} unit —{" "}
                {format(voidingLog.createdAt, "d MMM yyyy HH:mm", { locale: idLocale })}
              </p>
            ) : null}
            <div className="space-y-2">
              <Label>Alasan void (wajib)</Label>
              <Textarea value={voidReason} onChange={(e) => setVoidReason(e.target.value)} rows={3} placeholder="Contoh: Duplikat entry, salah produk" disabled={voidPending} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setVoidOpen(false)} disabled={voidPending}>Batal</Button>
              <Button type="submit" variant="destructive" disabled={voidPending || voidReason.trim().length < 3}>
                {voidPending ? "Memproses…" : "Konfirmasi void"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
