"use client";

import { cn } from "@/lib/utils";
import {
  type Column,
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
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
  /** Tabel mengisi lebar area; kolom wrap — hindari scroll horizontal. */
  fitViewport?: boolean;
}

function columnWidthStyle<TData>(
  column: Column<TData, unknown>,
  fitViewport: boolean,
) {
  if (fitViewport) return undefined;
  const def = column.columnDef;
  const width = typeof def.size === "number" ? def.size : undefined;
  const minWidth = typeof def.minSize === "number" ? def.minSize : undefined;
  const maxWidth = typeof def.maxSize === "number" ? def.maxSize : undefined;
  if (width === undefined && minWidth === undefined && maxWidth === undefined) {
    return undefined;
  }
  return { width, minWidth, maxWidth };
}

export function DataTable<TData, TValue>({
  columns,
  data,
  empty = "Tidak ada data.",
  onRowClick,
  fitViewport = false,
}: DataTableProps<TData, TValue>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border",
        fitViewport && "min-w-0",
      )}
    >
      <Table
        fitViewport={fitViewport}
        className={fitViewport ? "text-[11px] leading-snug" : undefined}
      >
        <TableHeader>
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
