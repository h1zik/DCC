"use client";

import {
  type CSSProperties,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  /** Tinggi tetap viewport tabel; isi tabel akan scroll di dalam area ini. */
  viewportHeight?: string;
  /** Sticky `<thead>` di atas saat scroll vertikal di dalam viewport. */
  stickyHeader?: boolean;
  /**
   * Jumlah kolom pertama yang dipin ke kiri saat scroll horizontal, sehingga
   * kolom identitas (mis. judul konten) tetap terlihat. Offset kiri diukur dari
   * lebar header aslinya, jadi aman walau kolom melar mengikuti kontainer.
   */
  stickyColumns?: number;
}

/** Divider tipis di tepi kanan kolom pin terakhir (pseudo-element: aman dari `border-collapse`). */
const STICKY_EDGE_CLASS =
  "after:bg-border after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:w-px after:content-['']";

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

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
  viewportHeight,
  stickyHeader = false,
  stickyColumns = 0,
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

  const useInternalScroll = !!viewportMaxHeight || !!viewportHeight;

  const stickyCount = Math.max(0, Math.min(stickyColumns, columns.length));
  const headerCellRefs = useRef<(HTMLTableCellElement | null)[]>([]);
  const [measuredOffsets, setMeasuredOffsets] = useState<number[] | null>(null);

  // Tebakan awal dari `size` kolom supaya paint pertama tidak menumpuk.
  const fallbackOffsets = useMemo(() => {
    const offsets: number[] = [];
    let acc = 0;
    for (let i = 0; i < stickyCount; i += 1) {
      offsets.push(acc);
      const size = columns[i]?.size;
      acc += typeof size === "number" ? size : 0;
    }
    return offsets;
  }, [columns, stickyCount]);

  useIsomorphicLayoutEffect(() => {
    if (stickyCount === 0) return;
    const cells = headerCellRefs.current
      .slice(0, stickyCount)
      .filter((cell): cell is HTMLTableCellElement => cell !== null);
    if (cells.length !== stickyCount) return;

    const measure = () => {
      const next: number[] = [];
      let acc = 0;
      for (const cell of cells) {
        next.push(acc);
        acc += cell.getBoundingClientRect().width;
      }
      setMeasuredOffsets((prev) =>
        prev &&
        prev.length === next.length &&
        prev.every((value, i) => Math.abs(value - next[i]) < 0.5)
          ? prev
          : next,
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    for (const cell of cells) observer.observe(cell);
    return () => observer.disconnect();
  }, [columns, stickyCount]);

  const stickyOffsets = measuredOffsets ?? fallbackOffsets;

  const stickyCellStyle = (
    index: number,
    variant: "head" | "cell",
  ): CSSProperties | undefined => {
    if (index >= stickyCount) return undefined;
    // Inline supaya menang dari selector `[&_th]:z-10` / `[&_th]:bg-card/95`
    // milik sticky header — kolom pin harus benar-benar opaque.
    return {
      position: "sticky",
      left: stickyOffsets[index] ?? 0,
      zIndex: variant === "head" ? 20 : 5,
      ...(variant === "head" ? { backgroundColor: "var(--card)" } : null),
    };
  };

  const stickyCellClass = (index: number, variant: "head" | "cell") => {
    if (index >= stickyCount) return undefined;
    return cn(
      variant === "cell"
        ? "bg-card group-hover/row:bg-muted/50"
        : !stickyHeader && "bg-card",
      index === stickyCount - 1 && STICKY_EDGE_CLASS,
    );
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-border",
        useInternalScroll ? "overflow-hidden bg-card" : "overflow-hidden",
        fitViewport && "min-w-0",
      )}
      style={viewportHeight ? { height: viewportHeight } : undefined}
    >
      <Table
        fitViewport={fitViewport}
        className={fitViewport ? "text-[11px] leading-snug" : undefined}
        containerStyle={
          useInternalScroll
            ? {
                height: viewportHeight ? "100%" : undefined,
                maxHeight: viewportMaxHeight,
              }
            : undefined
        }
      >
        <TableHeader sticky={stickyHeader}>
          {table.getHeaderGroups().map((headerGroup, groupIndex) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header, index) => (
                <TableHead
                  key={header.id}
                  ref={
                    groupIndex === 0 && index < stickyCount
                      ? (node) => {
                          headerCellRefs.current[index] = node;
                        }
                      : undefined
                  }
                  className={stickyCellClass(index, "head")}
                  style={{
                    ...columnWidthStyle(header.column, fitViewport),
                    ...stickyCellStyle(index, "head"),
                  }}
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
                className={cn(
                  "group/row",
                  onRowClick && "hover:bg-muted/50 cursor-pointer",
                )}
                onClick={
                  onRowClick ? () => onRowClick(row.original) : undefined
                }
              >
                {row.getVisibleCells().map((cell, index) => (
                  <TableCell
                    key={cell.id}
                    className={stickyCellClass(index, "cell")}
                    style={{
                      ...columnWidthStyle(cell.column, fitViewport),
                      ...stickyCellStyle(index, "cell"),
                    }}
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
