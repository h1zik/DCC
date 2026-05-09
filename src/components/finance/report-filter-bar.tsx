"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type ReportFilterPreset = "this-month" | "last-month" | "ytd" | "last-90" | "custom";

type Brand = { id: string; name: string };

type Props = {
  basePath: string;
  fromIso: string;
  toIso: string;
  brandId: string | null;
  brands: Brand[];
  /** Bila false, sembunyikan input "Sampai" (untuk laporan as-of seperti Neraca). */
  withRange?: boolean;
};

function presetFor(from: Date, to: Date): ReportFilterPreset {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  if (sameDate(from, startOfMonth) && sameDate(to, endOfMonth)) return "this-month";
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  if (sameDate(from, lastMonthStart) && sameDate(to, lastMonthEnd)) return "last-month";
  const yearStart = new Date(now.getFullYear(), 0, 1);
  if (sameDate(from, yearStart) && sameDate(to, endOfMonth)) return "ytd";
  const ninetyAgo = new Date(now.getTime() - 90 * 24 * 3600 * 1000);
  if (sameDate(from, ninetyAgo) && sameDate(to, now)) return "last-90";
  return "custom";
}

function sameDate(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const PRESETS: { value: ReportFilterPreset; label: string }[] = [
  { value: "this-month", label: "Bulan ini" },
  { value: "last-month", label: "Bulan lalu" },
  { value: "ytd", label: "YTD" },
  { value: "last-90", label: "90 hari" },
  { value: "custom", label: "Kustom" },
];

export function ReportFilterBar({
  basePath,
  fromIso,
  toIso,
  brandId,
  brands,
  withRange = true,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const from = new Date(fromIso);
  const to = new Date(toIso);
  const currentPreset = presetFor(from, to);

  function pushQuery(next: Record<string, string | null>) {
    const sp = new URLSearchParams(searchParams?.toString() ?? "");
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === "") sp.delete(k);
      else sp.set(k, v);
    }
    startTransition(() => {
      router.replace(`${basePath}?${sp.toString()}`, { scroll: false });
    });
  }

  function applyPreset(p: ReportFilterPreset) {
    if (p === "custom") return;
    const now = new Date();
    let f: Date, t: Date;
    if (p === "this-month") {
      f = new Date(now.getFullYear(), now.getMonth(), 1);
      t = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (p === "last-month") {
      f = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      t = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (p === "ytd") {
      f = new Date(now.getFullYear(), 0, 1);
      t = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else {
      f = new Date(now.getTime() - 90 * 24 * 3600 * 1000);
      t = now;
    }
    pushQuery({
      from: f.toISOString().slice(0, 10),
      to: t.toISOString().slice(0, 10),
    });
  }

  const safeBrand =
    brandId && brands.some((b) => b.id === brandId) ? brandId : "__all__";
  const brandLabel =
    safeBrand === "__all__"
      ? "Semua brand"
      : brands.find((b) => b.id === safeBrand)?.name ?? "Semua brand";

  return (
    <div className="border-border bg-card flex flex-wrap items-end gap-3 rounded-xl border p-3">
      <div className="flex flex-wrap items-center gap-1">
        {PRESETS.map((p) => {
          const active = p.value === currentPreset;
          return (
            <button
              key={p.value}
              type="button"
              onClick={() => applyPreset(p.value)}
              disabled={pending || p.value === "custom"}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                active
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                p.value === "custom" && "cursor-default",
              )}
              aria-current={active ? "true" : undefined}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="bg-border/60 mx-1 hidden h-6 w-px sm:block" aria-hidden />

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {withRange ? "Dari" : "Per tanggal"}
          </Label>
          <div className="flex items-center gap-1.5">
            <CalendarIcon className="text-muted-foreground size-3.5" aria-hidden />
            <Input
              type="date"
              defaultValue={withRange ? fromIso.slice(0, 10) : toIso.slice(0, 10)}
              className="h-8 w-36 text-xs"
              onBlur={(e) =>
                pushQuery(
                  withRange
                    ? { from: e.target.value }
                    : { to: e.target.value, from: e.target.value },
                )
              }
            />
          </div>
        </div>
        {withRange ? (
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Sampai
            </Label>
            <div className="flex items-center gap-1.5">
              <CalendarIcon className="text-muted-foreground size-3.5" aria-hidden />
              <Input
                type="date"
                defaultValue={toIso.slice(0, 10)}
                className="h-8 w-36 text-xs"
                onBlur={(e) => pushQuery({ to: e.target.value })}
              />
            </div>
          </div>
        ) : null}
      </div>

      <div className="bg-border/60 mx-1 hidden h-6 w-px sm:block" aria-hidden />

      <div className="space-y-1">
        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Brand
        </Label>
        <Select
          value={safeBrand}
          onValueChange={(v) =>
            pushQuery({ brandId: !v || v === "__all__" ? null : v })
          }
        >
          <SelectTrigger className="h-8 min-w-[10rem] text-xs">
            <span className="line-clamp-1">{brandLabel}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Semua brand</SelectItem>
            {brands.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {pending ? (
        <Button type="button" size="sm" variant="ghost" disabled>
          Memuat…
        </Button>
      ) : null}
    </div>
  );
}
