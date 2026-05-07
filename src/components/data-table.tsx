"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  type Column,
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  empty?: string;
  onRowClick?: (row: TData) => void;
  /** Tabel mengisi lebar area; kolom wrap — scroll dua arah di dalam viewport. */
  fitViewport?: boolean;
  /** Urutkan baris di klien (klik header kolom). */
  sortable?: boolean;
  /**
   * Aktifkan scroll internal (viewport) pada tabel: scrollbar horizontal
   * tetap terlihat di bawah area tabel tanpa harus scroll halaman.
   * Contoh nilai: `"calc(100dvh - 280px)"` atau `"60vh"`.
   */
  viewportMaxHeight?: string;
  /** Sticky `<thead>` di atas saat scroll vertikal di dalam viewport. */
  stickyHeader?: boolean;
}

function columnWidthStyle<TData>(
  column: Column<TData, unknown>,
  fitViewport: boolean,
) {
  const def = column.columnDef;
  const width = typeof def.size === "number" ? def.size : undefined;
  const minWidth = typeof def.minSize === "number" ? def.minSize : undefined;
  const maxWidth = typeof def.maxSize === "number" ? def.maxSize : undefined;
  if (width === undefined && minWidth === undefined && maxWidth === undefined) {
    return undefined;
  }
  // TanStack stores px numbers; apply in both modes so `table-fixed` + fitViewport
  // can reserve space for primary columns (e.g. judul konten).
  return { width, minWidth, maxWidth };
}

export function DataTable<TData, TValue>({
  columns,
  data,
  empty = "Tidak ada data.",
  onRowClick,
  fitViewport = false,
  sortable = false,
  viewportMaxHeight,
  stickyHeader = false,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: sortable ? { sorting } : undefined,
    onSortingChange: sortable ? setSorting : undefined,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: sortable ? getSortedRowModel() : undefined,
    enableSorting: sortable,
  });

  const useInternalScroll = !!viewportMaxHeight;

  return (
    <div
      className={cn(
        "rounded-xl border border-border",
        useInternalScroll ? "overflow-hidden bg-card" : "overflow-hidden",
        fitViewport && "min-w-0",
      )}
    >
      <Table
        fitViewport={fitViewport}
        className={fitViewport ? "text-[11px] leading-snug" : undefined}
        containerStyle={
          useInternalScroll ? { maxHeight: viewportMaxHeight } : undefined
        }
      >
        <TableHeader sticky={stickyHeader}>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  style={columnWidthStyle(header.column, fitViewport)}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className={onRowClick ? "hover:bg-muted/50 cursor-pointer" : undefined}
                onClick={
                  onRowClick ? () => onRowClick(row.original) : undefined
                }
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    style={columnWidthStyle(cell.column, fitViewport)}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                {empty}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
