"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Shell filter seragam untuk halaman logistik (gaya ReportFilterBar Finance):
 * search di kiri, slot `children` untuk Select-select filter, slot `right`
 * untuk aksi (print/CTA). Filter tetap client-state — bukan URL state.
 */
export function LogisticsFilterBar({
  search,
  onSearchChange,
  searchPlaceholder = "Cari…",
  children,
  right,
  className,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  children?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-border bg-card flex flex-wrap items-end gap-3 rounded-xl border p-3",
        className,
      )}
    >
      <div className="min-w-[12rem] flex-1 space-y-1 sm:max-w-xs">
        <Label className="text-[10px] tracking-wide text-muted-foreground uppercase">
          Cari
        </Label>
        <div className="relative">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>
      {children ? (
        <>
          <div className="bg-border/60 mx-1 hidden h-6 w-px sm:block" aria-hidden />
          <div className="flex flex-wrap items-end gap-2">{children}</div>
        </>
      ) : null}
      {right ? (
        <div className="ms-auto flex items-end gap-2">{right}</div>
      ) : null}
    </div>
  );
}

/** Satu kolom filter berlabel mikro untuk dipasang di dalam LogisticsFilterBar. */
export function LogisticsFilterField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <Label className="text-[10px] tracking-wide text-muted-foreground uppercase">
        {label}
      </Label>
      {children}
    </div>
  );
}
