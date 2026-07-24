"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Printer, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { DataTable } from "@/components/data-table";
import { printStockCorrectionReport } from "@/lib/inventory-print";
import { parseSystemMeta } from "@/lib/stock-log-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { StockLogRow } from "./types";

export function AuditPanel({ correctionLogs }: { correctionLogs: StockLogRow[] }) {
  const columns = useMemo<ColumnDef<StockLogRow>[]>(
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
      {
        id: "product",
        header: "Produk",
        cell: ({ row }) => row.original.product.name,
      },
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
        cell: ({ row }) =>
          row.original.createdBy?.name ?? row.original.createdBy?.email ?? "—",
      },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card px-4 py-2.5">
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <ShieldCheck className="size-4 shrink-0" aria-hidden />
          Jejak koreksi dan void — entri sistem append-only, tidak dapat diedit
          langsung.
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
        columns={columns}
        data={correctionLogs}
        empty="Belum ada koreksi atau void."
        sortable
        viewportMaxHeight="calc(100dvh - 300px)"
        stickyHeader
      />
    </div>
  );
}
