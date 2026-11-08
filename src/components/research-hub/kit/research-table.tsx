"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Table, TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * Kontainer tabel Research Hub: kartu berbingkai, header sticky saat
 * `maxHeight` diset, ukuran teks 13px (lihat research-hub.css).
 * Pakai bersama `TableHeader sticky` dari ui/table.
 */
export function ResearchTable({
  children,
  maxHeight,
  className,
}: {
  children: React.ReactNode;
  /** Mis. "70vh" — mengaktifkan scroll internal + header sticky. */
  maxHeight?: string;
  className?: string;
}) {
  return (
    <div className={cn("border-border bg-card overflow-hidden rounded-xl border", className)}>
      <Table
        className="rh-table"
        containerStyle={maxHeight ? { maxHeight } : undefined}
        containerClassName={maxHeight ? "overflow-auto" : undefined}
      >
        {children}
      </Table>
    </div>
  );
}

export type SortDir = "asc" | "desc";
export type SortState<K extends string> = { key: K; dir: SortDir } | null;

/** Header kolom yang bisa diurutkan; aria-sort untuk pembaca layar. */
export function SortableHead<K extends string>({
  sortKey,
  sort,
  onSort,
  children,
  align = "left",
  className,
}: {
  sortKey: K;
  sort: SortState<K>;
  onSort: (key: K) => void;
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  const active = sort?.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className={cn(align === "right" && "text-right", className)}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "focus-visible:ring-ring -mx-1 inline-flex items-center gap-1 rounded px-1 transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:outline-none",
          active && "text-foreground",
          align === "right" && "flex-row-reverse",
        )}
      >
        {children}
        <Icon className={cn("size-3.5", !active && "opacity-40")} aria-hidden />
      </button>
    </TableHead>
  );
}

/**
 * State urutan + baris terurut. Klik kolom yang sama membalik arah;
 * nilai null selalu di bawah.
 */
export function useSortedRows<T, K extends string>(
  rows: T[],
  accessors: Record<K, (row: T) => string | number | null | undefined>,
  initial: SortState<K> = null,
) {
  const [sort, setSort] = useState<SortState<K>>(initial);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const get = accessors[sort.key];
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * factor;
      return String(va).localeCompare(String(vb), "id") * factor;
    });
    // accessors sengaja tidak masuk deps: objek literal baru tiap render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sort]);

  function toggle(key: K) {
    setSort((prev) =>
      prev?.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "desc" },
    );
  }

  return { sorted, sort, toggle };
}
