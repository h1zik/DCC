"use client";

import { useMemo, useState } from "react";
import { StockLogType } from "@prisma/client";
import { isBefore, startOfDay, subDays } from "date-fns";
import { PenLine, Printer } from "lucide-react";
import { toast } from "sonner";
import { printStockMutationReport } from "@/lib/inventory-print";
import { isSystemStockLog } from "@/lib/stock-log-utils";
import {
  brandFilterItems,
  DAYS_FILTER_ITEMS,
  STOCK_LOG_TYPE_FILTER_ITEMS,
} from "@/lib/select-option-items";
import {
  LogisticsFilterBar,
  LogisticsFilterField,
} from "@/components/logistics/logistics-filter-bar";
import { StockMovementSheet } from "@/components/logistics/stock-movement-sheet";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MovementCorrectionDialog } from "./movement-correction-dialog";
import { MovementVoidDialog } from "./movement-void-dialog";
import { MovementsTable } from "./movements-table";
import type { InventoryProductRow, StockLogRow } from "./types";

export function MovementsPanel({
  businessLogs,
  brands,
  statusById,
  replacementByTargetId,
  products,
  vendors,
}: {
  businessLogs: StockLogRow[];
  brands: { id: string; name: string }[];
  statusById: Map<string, string>;
  replacementByTargetId: Map<string, StockLogRow>;
  products: InventoryProductRow[];
  vendors: { id: string; name: string }[];
}) {
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<"all" | StockLogType>("all");
  const [daysFilter, setDaysFilter] = useState("30");

  const [editLog, setEditLog] = useState<StockLogRow | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editSession, setEditSession] = useState(0);
  const [voidLog, setVoidLog] = useState<StockLogRow | null>(null);
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidSession, setVoidSession] = useState(0);

  const brandFilterSelectItems = useMemo(() => brandFilterItems(brands), [brands]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const dayLimit =
      daysFilter === "all"
        ? null
        : subDays(startOfDay(new Date()), Number(daysFilter));
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

  function openEdit(log: StockLogRow) {
    if (isSystemStockLog(log.note)) {
      toast.error("Mutasi sistem tidak dapat dikoreksi.");
      return;
    }
    setEditLog(log);
    setEditSession((s) => s + 1);
    setEditOpen(true);
  }

  function openVoid(log: StockLogRow) {
    if (isSystemStockLog(log.note)) {
      toast.error("Mutasi sistem tidak dapat di-void.");
      return;
    }
    setVoidLog(log);
    setVoidSession((s) => s + 1);
    setVoidOpen(true);
  }

  return (
    <div className="space-y-4">
      <LogisticsFilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="SKU, produk, catatan…"
        right={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={filtered.length === 0}
              onClick={() => {
                if (!printStockMutationReport(filtered)) {
                  toast.error("Pop-up diblokir. Izinkan pop-up lalu coba lagi.");
                }
              }}
            >
              <Printer className="size-4" />
              Cetak ({filtered.length})
            </Button>
            <StockMovementSheet
              products={products}
              vendors={vendors}
              trigger={
                <Button type="button" size="sm" className="gap-1.5">
                  <PenLine className="size-4" />
                  Catat mutasi
                </Button>
              }
            />
          </>
        }
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
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </LogisticsFilterField>
        <LogisticsFilterField label="Tipe">
          <Select
            value={typeFilter}
            items={STOCK_LOG_TYPE_FILTER_ITEMS}
            onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}
          >
            <SelectTrigger className="h-8 w-[110px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              <SelectItem value={StockLogType.IN}>Masuk</SelectItem>
              <SelectItem value={StockLogType.OUT}>Keluar</SelectItem>
            </SelectContent>
          </Select>
        </LogisticsFilterField>
        <LogisticsFilterField label="Periode">
          <Select
            value={daysFilter}
            items={DAYS_FILTER_ITEMS}
            onValueChange={(v) => setDaysFilter(v ?? "30")}
          >
            <SelectTrigger className="h-8 w-[110px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 hari</SelectItem>
              <SelectItem value="30">30 hari</SelectItem>
              <SelectItem value="90">90 hari</SelectItem>
              <SelectItem value="all">Semua</SelectItem>
            </SelectContent>
          </Select>
        </LogisticsFilterField>
      </LogisticsFilterBar>

      <MovementsTable
        data={filtered}
        statusById={statusById}
        replacementByTargetId={replacementByTargetId}
        onEdit={openEdit}
        onVoid={openVoid}
      />

      {editLog ? (
        <MovementCorrectionDialog
          key={editSession}
          open={editOpen}
          onOpenChange={setEditOpen}
          log={editLog}
        />
      ) : null}
      {voidLog ? (
        <MovementVoidDialog
          key={voidSession}
          open={voidOpen}
          onOpenChange={setVoidOpen}
          log={voidLog}
        />
      ) : null}
    </div>
  );
}
