"use client";

import { useMemo } from "react";
import { StockLogType } from "@prisma/client";
import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Pencil, Trash2 } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { MovementTypeBadge } from "@/components/logistics/movement-type-badge";
import { formatSalesCategory, formatStockLogNote } from "@/lib/stock-log-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { StockLogRow } from "./types";

export function MovementsTable({
  data,
  statusById,
  replacementByTargetId,
  onEdit,
  onVoid,
}: {
  data: StockLogRow[];
  /** Label status turunan ledger ("Di-void" / "Dikoreksi" / "Dibalik"). */
  statusById: Map<string, string>;
  replacementByTargetId: Map<string, StockLogRow>;
  onEdit: (log: StockLogRow) => void;
  onVoid: (log: StockLogRow) => void;
}) {
  const columns = useMemo<ColumnDef<StockLogRow>[]>(
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
            <p className="text-muted-foreground font-mono text-[10px]">
              {row.original.product.sku}
            </p>
          </div>
        ),
      },
      {
        id: "type",
        header: "Tipe",
        cell: ({ row }) => {
          const effective =
            replacementByTargetId.get(row.original.id) ?? row.original;
          return (
            <MovementTypeBadge
              type={effective.type === StockLogType.IN ? "IN" : "OUT"}
            />
          );
        },
      },
      {
        accessorKey: "amount",
        header: "Qty",
        cell: ({ row }) => {
          const effective =
            replacementByTargetId.get(row.original.id) ?? row.original;
          return <span className="font-medium tabular-nums">{effective.amount}</span>;
        },
      },
      {
        id: "category",
        header: "Kategori",
        cell: ({ row }) => {
          const effective =
            replacementByTargetId.get(row.original.id) ?? row.original;
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
            <p
              className="text-muted-foreground line-clamp-2 text-xs"
              title={formatStockLogNote(row.original)}
            >
              {formatStockLogNote(row.original)}
            </p>
            {row.original.reference ? (
              <p className="text-muted-foreground font-mono text-[10px]">
                Ref: {row.original.reference}
              </p>
            ) : null}
            {statusById.get(row.original.id) ? (
              <Badge variant="outline" className="text-[10px]">
                {statusById.get(row.original.id)}
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
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => onEdit(row.original)}
              aria-label="Koreksi"
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-destructive"
              onClick={() => onVoid(row.original)}
              aria-label="Void"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    [statusById, replacementByTargetId, onEdit, onVoid],
  );

  return (
    <DataTable
      columns={columns}
      data={data}
      empty="Tidak ada mutasi yang cocok dengan filter."
      sortable
      viewportMaxHeight="calc(100dvh - 420px)"
      stickyHeader
    />
  );
}
