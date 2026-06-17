"use client";

import { actionErrorMessage } from "@/lib/action-error-message";
import { useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import type { ColumnDef } from "@tanstack/react-table";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { applySuggestedReorderPoint } from "@/actions/products";
import {
  reorderStatusLabel,
  type ProductReorderForecast,
  type ReorderForecastStatus,
} from "@/lib/reorder-forecast";
import { DataTable } from "@/components/data-table";
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
  brandNameFilterItems,
  FORECAST_WINDOW_ITEMS,
  REORDER_STATUS_FILTER_ITEMS,
} from "@/lib/select-option-items";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function statusBadgeVariant(
  status: ReorderForecastStatus,
): "destructive" | "secondary" | "outline" {
  if (status === "ORDER_NOW") return "destructive";
  if (status === "ORDER_SOON") return "secondary";
  return "outline";
}

export function ReorderForecastTab({
  forecasts,
  windowDays: initialWindowDays,
}: {
  forecasts: ProductReorderForecast[];
  windowDays: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [windowDays, setWindowDays] = useState(String(initialWindowDays));
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | ReorderForecastStatus>("all");
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyTarget, setApplyTarget] = useState<ProductReorderForecast | null>(null);
  const [applyPending, setApplyPending] = useState(false);

  const brands = useMemo(() => {
    const names = new Map<string, string>();
    for (const f of forecasts) names.set(f.brandName, f.brandName);
    return [...names.values()].sort();
  }, [forecasts]);

  const brandFilterSelectItems = useMemo(
    () => brandNameFilterItems(brands),
    [brands],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return forecasts.filter((f) => {
      if (brandFilter !== "all" && f.brandName !== brandFilter) return false;
      if (statusFilter !== "all" && f.status !== statusFilter) return false;
      if (!q) return true;
      return [f.name, f.sku, f.brandName, f.vendorsSummary, f.preferredVendor?.name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [forecasts, search, brandFilter, statusFilter]);

  const orderNow = forecasts.filter((f) => f.status === "ORDER_NOW").length;
  const orderSoon = forecasts.filter((f) => f.status === "ORDER_SOON").length;
  const withCover = forecasts.filter((f) => f.daysUntilStockout != null);
  const avgCover =
    withCover.length > 0
      ? withCover.reduce((s, f) => s + (f.daysUntilStockout ?? 0), 0) / withCover.length
      : 0;

  async function onApplyRop() {
    if (!applyTarget) return;
    setApplyPending(true);
    try {
      const result = await applySuggestedReorderPoint({
        productId: applyTarget.productId,
        windowDays: Number(windowDays),
      });
      toast.success(`Min. stok diupdate ke ${result.appliedMinStock} unit.`);
      setApplyOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(actionErrorMessage(e, "Gagal menerapkan ROP."));
    } finally {
      setApplyPending(false);
    }
  }

  const columns = useMemo<ColumnDef<ProductReorderForecast>[]>(
    () => [
      {
        id: "product",
        header: "SKU",
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.name}</p>
            <p className="text-muted-foreground font-mono text-[10px]">{row.original.sku}</p>
          </div>
        ),
      },
      { id: "brand", header: "Brand", cell: ({ row }) => row.original.brandName },
      {
        id: "stock",
        header: "Stok",
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums">{row.original.currentStock}</span>
        ),
      },
      {
        id: "burn",
        header: "Burn/hari",
        cell: ({ row }) => (
          <span className="tabular-nums text-sm">
            {row.original.avgDailyDemand > 0
              ? row.original.avgDailyDemand.toFixed(2)
              : "—"}
          </span>
        ),
      },
      {
        id: "lead",
        header: "Lead time",
        cell: ({ row }) =>
          row.original.leadTimeDays != null ? (
            <div className="text-sm">
              <p className="tabular-nums">{row.original.leadTimeDays}d</p>
              <p className="text-muted-foreground text-[10px]">bottleneck</p>
            </div>
          ) : (
            "—"
          ),
      },
      {
        id: "rop",
        header: "ROP",
        cell: ({ row }) => (
          <div className="text-sm">
            <p className="tabular-nums font-medium">{row.original.reorderPoint ?? "—"}</p>
            <p className="text-muted-foreground text-[10px]">
              min: {row.original.manualMinStock}
            </p>
          </div>
        ),
      },
      {
        id: "runout",
        header: "Habis ~",
        cell: ({ row }) =>
          row.original.daysUntilStockout != null ? (
            <span className="tabular-nums">
              {row.original.daysUntilStockout.toFixed(1)} hari
            </span>
          ) : (
            "—"
          ),
      },
      {
        id: "orderBy",
        header: "Order sebelum",
        cell: ({ row }) =>
          row.original.orderByDate ? (
            <span className="text-sm">
              {format(row.original.orderByDate, "d MMM yyyy", { locale: idLocale })}
            </span>
          ) : (
            "—"
          ),
      },
      {
        id: "qty",
        header: "Qty disarankan",
        cell: ({ row }) => (
          <span className="tabular-nums font-medium">
            {row.original.suggestedOrderQty ?? "—"}
          </span>
        ),
      },
      {
        id: "vendor",
        header: "Vendor",
        cell: ({ row }) => (
          <span className="max-w-[200px] text-xs leading-snug">
            {row.original.vendorsSummary}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={statusBadgeVariant(row.original.status)}>
            {reorderStatusLabel(row.original.status)}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) =>
          row.original.reorderPoint != null ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setApplyTarget(row.original);
                setApplyOpen(true);
              }}
            >
              Terapkan ROP
            </Button>
          ) : null,
      },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pesan sekarang
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{orderNow}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pesan minggu ini
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{orderSoon}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Rata-rata days of cover
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {avgCover > 0 ? avgCover.toFixed(1) : "—"}
              {avgCover > 0 ? <span className="text-muted-foreground text-sm"> hari</span> : null}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/30 p-3">
        <div className="min-w-[180px] flex-1 space-y-1">
          <Label className="text-xs">Cari</Label>
          <div className="relative">
            <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
            <Input
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="SKU, produk, vendor…"
            />
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
                <SelectItem key={b} value={b}>{b}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Status</Label>
          <Select
            value={statusFilter}
            items={REORDER_STATUS_FILTER_ITEMS}
            onValueChange={(v) => setStatusFilter((v ?? "all") as typeof statusFilter)}
          >
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              <SelectItem value="ORDER_NOW">Pesan sekarang</SelectItem>
              <SelectItem value="ORDER_SOON">Pesan minggu ini</SelectItem>
              <SelectItem value="OK">Aman</SelectItem>
              <SelectItem value="NO_DATA">Belum ada data</SelectItem>
              <SelectItem value="NO_LEAD_TIME">Set lead time</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Window penjualan</Label>
          <Select
            value={windowDays}
            items={FORECAST_WINDOW_ITEMS}
            onValueChange={(v) => {
              if (!v) return;
              setWindowDays(v);
              router.push(`${pathname}?window=${v}`);
            }}
          >
            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30 hari</SelectItem>
              <SelectItem value="60">60 hari</SelectItem>
              <SelectItem value="90">90 hari</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-muted-foreground w-full text-xs">
          Burn rate dari stok keluar kategori <strong>penjualan</strong> saja. Window dihitung
          ulang otomatis saat diubah.
        </p>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        empty="Tidak ada SKU yang cocok dengan filter."
        sortable
        viewportMaxHeight="calc(100dvh - 480px)"
        stickyHeader
      />

      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Terapkan ROP sebagai min. stok?</DialogTitle>
          </DialogHeader>
          {applyTarget ? (
            <p className="text-muted-foreground text-sm">
              {applyTarget.name} — ROP terhitung:{" "}
              <strong>{applyTarget.reorderPoint}</strong> unit (min. manual saat ini:{" "}
              {applyTarget.manualMinStock}).
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyOpen(false)} disabled={applyPending}>
              Batal
            </Button>
            <Button onClick={onApplyRop} disabled={applyPending}>
              {applyPending ? "Menyimpan…" : "Terapkan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
