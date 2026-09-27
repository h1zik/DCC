"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarPlus, ClipboardList, Search } from "lucide-react";
import { KolSelect } from "@/components/kol-hub/kol-fields";
import { ScheduleTable } from "@/components/kol-hub/schedule-table";
import { useUrlFilters } from "@/components/kol-hub/use-url-filters";
import { LabEmptyState, LabToolbar } from "@/components/lab/lab-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  SCHEDULE_STATUS_META,
  SCHEDULE_STATUS_ORDER,
  type KolScheduleStatusValue,
} from "@/lib/kol/labels";
import type { ScheduleRow } from "@/lib/kol/readers";
import { cn } from "@/lib/utils";

export function SchedulesClient({
  rows,
  counts,
  brands,
  campaigns,
}: {
  rows: ScheduleRow[];
  counts: Record<KolScheduleStatusValue, number>;
  brands: { id: string; name: string }[];
  campaigns: { id: string; title: string; brandId: string }[];
}) {
  const { get, set, pending } = useUrlFilters();
  const [q, setQ] = useState(get("q"));
  const status = get("status");
  const brand = get("brand");
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  useEffect(() => {
    if (q === get("q")) return;
    const t = setTimeout(() => set({ q }), 300);
    return () => clearTimeout(t);
  }, [q, get, set]);

  const hasFilter = ["q", "brand", "campaign", "platform"].some((k) => get(k));

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label="Status jadwal"
        className="flex gap-1 overflow-x-auto border-b border-border/70"
      >
        {[{ value: "", label: "Semua", count: total }, ...SCHEDULE_STATUS_ORDER.map((s) => ({
          value: s,
          label: SCHEDULE_STATUS_META[s].label,
          count: counts[s],
        }))].map((t) => {
          const active = status === t.value;
          return (
            <button
              key={t.value || "all"}
              role="tab"
              aria-selected={active}
              onClick={() => set({ status: t.value })}
              className={cn(
                "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors",
                active
                  ? "border-[var(--lab-accent,var(--primary))] text-foreground"
                  : "text-muted-foreground hover:text-foreground border-transparent",
              )}
            >
              {t.label}
              <span
                className={cn(
                  "rounded-full px-1.5 text-[10px] tabular-nums",
                  active ? "bg-[color-mix(in_srgb,var(--lab-accent,var(--primary))_14%,transparent)]" : "bg-muted",
                )}
              >
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      <LabToolbar>
        <div className="relative min-w-[200px] flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nomor, KOL, username, campaign…"
            aria-label="Cari jadwal"
            className="h-8 pl-8 text-xs"
          />
        </div>
        <KolSelect
          className="h-8 w-[160px] text-xs"
          ariaLabel="Filter brand"
          value={brand}
          onChange={(v) => set({ brand: v, campaign: null })}
          emptyLabel="Semua brand"
          options={brands.map((b) => ({ value: b.id, label: b.name }))}
        />
        <KolSelect
          className="h-8 w-[200px] text-xs"
          ariaLabel="Filter campaign"
          value={get("campaign")}
          onChange={(v) => set({ campaign: v })}
          emptyLabel="Semua campaign"
          options={campaigns
            .filter((c) => !brand || c.brandId === brand)
            .map((c) => ({ value: c.id, label: c.title }))}
        />
        <KolSelect
          className="h-8 w-[140px] text-xs"
          ariaLabel="Filter platform"
          value={get("platform")}
          onChange={(v) => set({ platform: v })}
          emptyLabel="Semua platform"
          options={[
            { value: "INSTAGRAM", label: "Instagram" },
            { value: "TIKTOK", label: "TikTok" },
          ]}
        />
        {hasFilter ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQ("");
              set({ q: null, brand: null, campaign: null, platform: null });
            }}
          >
            Reset
          </Button>
        ) : null}
      </LabToolbar>

      {rows.length === 0 ? (
        <LabEmptyState
          icon={ClipboardList}
          title={total === 0 ? "Belum ada jadwal" : "Tidak ada jadwal di tampilan ini"}
          description={
            total === 0
              ? "Buat jadwal pertama: pilih campaign dan KOL, lalu tambahkan slot kontennya."
              : "Ganti tab status atau longgarkan filter."
          }
          action={
            total === 0 ? (
              <Button size="sm" render={<Link href="/kol-hub/schedules/new" />}>
                <CalendarPlus />
                Buat jadwal
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ScheduleTable rows={rows} dimmed={pending} />
      )}
    </div>
  );
}
