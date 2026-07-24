"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";
import {
  LogisticsFilterBar,
  LogisticsFilterField,
} from "@/components/logistics/logistics-filter-bar";
import { ReorderStatusBadge } from "@/components/logistics/reorder-status-badge";
import { StockHealthBadge } from "@/components/logistics/stock-health-badge";
import { getStockHealth } from "@/lib/stock-status";
import type {
  ProductReorderForecast,
  ReorderForecastStatus,
} from "@/lib/reorder-forecast";
import {
  brandNameFilterItems,
  FORECAST_WINDOW_ITEMS,
} from "@/lib/select-option-items";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApplyRopDialog } from "./apply-rop-dialog";

type StatusFilter = "all" | "attention" | ReorderForecastStatus;

const STATUS_FILTER_ITEMS = [
  { value: "all", label: "Semua" },
  { value: "attention", label: "Perlu perhatian" },
  { value: "ORDER_NOW", label: "Pesan sekarang" },
  { value: "ORDER_SOON", label: "Pesan minggu ini" },
  { value: "OK", label: "Aman" },
  { value: "NO_DATA", label: "Belum ada data" },
  { value: "NO_LEAD_TIME", label: "Set lead time" },
];

function needsAttention(f: ProductReorderForecast): boolean {
  if (f.status === "ORDER_NOW" || f.status === "ORDER_SOON") return true;
  return getStockHealth(f.currentStock, f.manualMinStock) !== "OK";
}

/**
 * Tab "Stok & Reorder" — gabungan tab "Stok" dan "Forecast & Reorder" lama;
 * satu-satunya rumah data forecast/reorder di seluruh app.
 */
export function StockReorderPanel({
  forecasts,
  windowDays,
  initialStatus,
}: {
  forecasts: ProductReorderForecast[];
  windowDays: number;
  initialStatus?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    initialStatus &&
      STATUS_FILTER_ITEMS.some((item) => item.value === initialStatus)
      ? (initialStatus as StatusFilter)
      : "all",
  );
  const [applyTarget, setApplyTarget] = useState<ProductReorderForecast | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const [applySession, setApplySession] = useState(0);

  const brands = useMemo(() => {
    const names = new Map<string, string>();
    for (const f of forecasts) names.set(f.brandName, f.brandName);
    return [...names.values()].sort();
  }, [forecasts]);

  const brandFilterSelectItems = useMemo(() => brandNameFilterItems(brands), [brands]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return forecasts.filter((f) => {
      if (brandFilter !== "all" && f.brandName !== brandFilter) return false;
      if (statusFilter === "attention" && !needsAttention(f)) return false;
      if (
        statusFilter !== "all" &&
        statusFilter !== "attention" &&
        f.status !== statusFilter
      )
        return false;
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
      ? withCover.reduce((s, f) => s + (f.daysUntilStockout ?? 0), 0) /
        withCover.length
      : 0;

  function changeWindow(v: string) {
    const sp = new URLSearchParams(searchParams?.toString() ?? "");
    sp.set("window", v);
    sp.set("tab", "stok");
    router.push(`${pathname}?${sp.toString()}`, { scroll: false });
  }

  const columns = useMemo<ColumnDef<ProductReorderForecast>[]>(
    () => [
      {
        id: "product",
        header: "Produk",
        cell: ({ row }) => (
          <div className="min-w-[140px]">
            <p className="font-medium">{row.original.name}</p>
            <p className="text-muted-foreground font-mono text-[10px]">
              {row.original.sku} · {row.original.brandName}
            </p>
          </div>
        ),
      },
      {
        id: "stock",
        header: "Stok",
        cell: ({ row }) => (
          <span className="text-base font-semibold tabular-nums">
            {row.original.currentStock}
          </span>
        ),
      },
      {
        id: "health",
        header: "Kesehatan",
        cell: ({ row }) => (
          <StockHealthBadge
            currentStock={row.original.currentStock}
            minStock={row.original.manualMinStock}
          />
        ),
      },
      {
        id: "burn",
        header: "Burn/hari",
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">
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
            <span className="text-sm tabular-nums">{row.original.leadTimeDays}d</span>
          ) : (
            "—"
          ),
      },
      {
        id: "rop",
        header: "ROP",
        cell: ({ row }) => (
          <div className="text-sm">
            <p className="font-medium tabular-nums">
              {row.original.reorderPoint ?? "—"}
            </p>
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
          <span className="font-medium tabular-nums">
            {row.original.suggestedOrderQty ?? "—"}
          </span>
        ),
      },
      {
        id: "vendor",
        header: "Vendor",
        cell: ({ row }) => (
          <span className="max-w-[180px] text-xs leading-snug">
            {row.original.vendorsSummary}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => <ReorderStatusBadge status={row.original.status} />,
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
                setApplySession((s) => s + 1);
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
      <div className="text-muted-foreground flex flex-wrap items-center gap-x-5 gap-y-1 rounded-xl border bg-card px-4 py-2.5 text-xs">
        <span>
          Pesan sekarang:{" "}
          <strong
            className={
              orderNow > 0 ? "text-danger tabular-nums" : "text-foreground tabular-nums"
            }
          >
            {orderNow}
          </strong>
        </span>
        <span>
          Pesan minggu ini:{" "}
          <strong
            className={
              orderSoon > 0
                ? "text-warning tabular-nums"
                : "text-foreground tabular-nums"
            }
          >
            {orderSoon}
          </strong>
        </span>
        <span>
          Rata-rata cover:{" "}
          <strong className="text-foreground tabular-nums">
            {avgCover > 0 ? `${avgCover.toFixed(1)} hari` : "—"}
          </strong>
        </span>
        <span className="ms-auto hidden sm:inline">
          Burn rate dihitung dari stok keluar kategori <strong>penjualan</strong>.
        </span>
      </div>

      <LogisticsFilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="SKU, produk, vendor…"
      >
        <LogisticsFilterField label="Brand">
          <Select
            value={brandFilter}
            items={brandFilterSelectItems}
            onValueChange={(v) => setBrandFilter(v ?? "all")}
          >
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              {brands.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </LogisticsFilterField>
        <LogisticsFilterField label="Status">
          <Select
            value={statusFilter}
            items={STATUS_FILTER_ITEMS}
            onValueChange={(v) => setStatusFilter((v ?? "all") as StatusFilter)}
          >
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTER_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </LogisticsFilterField>
        <LogisticsFilterField label="Window penjualan">
          <Select
            value={String(windowDays)}
            items={FORECAST_WINDOW_ITEMS}
            onValueChange={(v) => v && changeWindow(v)}
          >
            <SelectTrigger className="h-8 w-[100px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30 hari</SelectItem>
              <SelectItem value="60">60 hari</SelectItem>
              <SelectItem value="90">90 hari</SelectItem>
            </SelectContent>
          </Select>
        </LogisticsFilterField>
      </LogisticsFilterBar>

      <DataTable
        columns={columns}
        data={filtered}
        empty="Tidak ada SKU yang cocok dengan filter."
        sortable
        viewportMaxHeight="calc(100dvh - 380px)"
        stickyHeader
      />

      {applyTarget ? (
        <ApplyRopDialog
          key={applySession}
          open={applyOpen}
          onOpenChange={setApplyOpen}
          target={applyTarget}
          windowDays={windowDays}
        />
      ) : null}
    </div>
  );
}
