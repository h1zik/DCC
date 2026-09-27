"use client";

import Link from "next/link";
import { useMemo } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { PlatformMark, ScheduleStatusBadge } from "@/components/kol-hub/kol-badges";
import { KolSelect } from "@/components/kol-hub/kol-fields";
import { useUrlFilters } from "@/components/kol-hub/use-url-filters";
import { LabCard, LabEmptyState, LabToolbar } from "@/components/lab/lab-primitives";
import { Button } from "@/components/ui/button";
import {
  PLACEMENT_LABEL,
  type KolPlacementValue,
  type KolPlatformValue,
  type KolScheduleStatusValue,
} from "@/lib/kol/labels";
import { formatWibTime, wibDayKey } from "@/lib/kol/time";
import { cn } from "@/lib/utils";

type CalEvent = {
  id: string;
  scheduledAt: string;
  status: KolScheduleStatusValue;
  platform: KolPlatformValue;
  placement: KolPlacementValue;
  handle: string;
  kolName: string;
  brandName: string;
  campaignTitle: string;
};

const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const monthLabel = new Intl.DateTimeFormat("id-ID", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const agendaDay = new Intl.DateTimeFormat("id-ID", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

/** Tambah bulan pada "YYYY-MM". */
function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

/** Minggu-minggu grid (Senin awal) sebagai kunci hari "YYYY-MM-DD" (UTC = hari WIB). */
function buildWeeks(month: string): string[][] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const start = new Date(first.getTime() - offset * 86400_000);
  const last = new Date(Date.UTC(y, m, 0));
  const weeks: string[][] = [];
  for (let cur = start; cur <= last || weeks.length === 0; ) {
    const week: string[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(cur.toISOString().slice(0, 10));
      cur = new Date(cur.getTime() + 86400_000);
    }
    weeks.push(week);
    if (cur > last) break;
  }
  return weeks;
}

const TENTATIVE = new Set<KolScheduleStatusValue>(["DRAFT", "PENDING_APPROVAL"]);

function EventChip({ e }: { e: CalEvent }) {
  return (
    <Link
      href={`/kol-hub/schedules/${e.id}`}
      title={`${e.kolName} · ${e.brandName} — ${e.campaignTitle}`}
      className={cn(
        "flex items-center gap-1 rounded-md px-1 py-0.5 text-[11px] leading-tight transition-colors",
        e.status === "POSTED"
          ? "bg-emerald-500/12 text-emerald-900 hover:bg-emerald-500/20 dark:text-emerald-200"
          : TENTATIVE.has(e.status)
            ? "text-muted-foreground border border-dashed border-border hover:bg-muted/60"
            : "bg-[color-mix(in_srgb,var(--lab-accent,var(--primary))_12%,transparent)] hover:bg-[color-mix(in_srgb,var(--lab-accent,var(--primary))_20%,transparent)]",
      )}
    >
      <PlatformMark platform={e.platform} className="size-3.5 rounded text-[7px]" />
      <span className="tabular-nums">{formatWibTime(e.scheduledAt)}</span>
      <span className="truncate font-medium">@{e.handle}</span>
    </Link>
  );
}

export function KolCalendarClient({
  month,
  events,
  brands,
}: {
  month: string;
  events: CalEvent[];
  brands: { id: string; name: string }[];
}) {
  const { get, set, pending } = useUrlFilters();
  const weeks = useMemo(() => buildWeeks(month), [month]);
  const byDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const e of [...events].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))) {
      const k = wibDayKey(e.scheduledAt);
      map.set(k, [...(map.get(k) ?? []), e]);
    }
    return map;
  }, [events]);
  const today = wibDayKey(new Date());
  const inMonth = (day: string) => day.startsWith(month);
  const monthEvents = events.filter((e) => wibDayKey(e.scheduledAt).startsWith(month));
  const agendaDays = [...byDay.entries()].filter(([d]) => inMonth(d));

  return (
    <div className="flex flex-col gap-4">
      <LabToolbar>
        <div className="flex items-center gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Bulan sebelumnya"
            onClick={() => set({ month: shiftMonth(month, -1) })}
          >
            <ChevronLeft />
          </Button>
          <p className="min-w-[140px] text-center text-sm font-semibold capitalize">
            {monthLabel.format(new Date(`${month}-01T00:00:00Z`))}
          </p>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Bulan berikutnya"
            onClick={() => set({ month: shiftMonth(month, 1) })}
          >
            <ChevronRight />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => set({ month: null })}>
            Bulan ini
          </Button>
        </div>
        <div className="flex-1" />
        <KolSelect
          className="h-8 w-[160px] text-xs"
          ariaLabel="Filter brand"
          value={get("brand")}
          onChange={(v) => set({ brand: v })}
          emptyLabel="Semua brand"
          options={brands.map((b) => ({ value: b.id, label: b.name }))}
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
        <KolSelect
          className="h-8 w-[140px] text-xs"
          ariaLabel="Filter placement"
          value={get("placement")}
          onChange={(v) => set({ placement: v })}
          emptyLabel="Semua placement"
          options={Object.entries(PLACEMENT_LABEL).map(([value, label]) => ({ value, label }))}
        />
      </LabToolbar>

      <p className="text-muted-foreground text-xs">
        {monthEvents.length} jadwal bulan ini ·{" "}
        {monthEvents.filter((e) => e.status === "POSTED").length} sudah tayang
      </p>

      {/* Grid bulan — layar lebar. */}
      <LabCard className={cn("hidden overflow-hidden p-0 md:block", pending && "opacity-70")}>
        <div className="grid grid-cols-7 border-b border-border/70">
          {WEEKDAYS.map((d) => (
            <div key={d} className="text-muted-foreground px-2 py-2 text-center text-[11px] font-medium">
              {d}
            </div>
          ))}
        </div>
        {weeks.map((week) => (
          <div key={week[0]} className="grid grid-cols-7 border-b border-border/50 last:border-b-0">
            {week.map((day) => {
              const list = byDay.get(day) ?? [];
              return (
                <div
                  key={day}
                  className={cn(
                    "flex max-h-[168px] min-h-[112px] flex-col gap-1 overflow-y-auto border-r border-border/50 p-1.5 last:border-r-0",
                    !inMonth(day) && "bg-muted/25",
                  )}
                >
                  <span
                    className={cn(
                      "self-end px-1 text-xs tabular-nums",
                      !inMonth(day) && "text-muted-foreground/60",
                      day === today &&
                        "rounded-md bg-[var(--lab-accent,var(--primary))] font-semibold text-primary-foreground",
                    )}
                  >
                    {Number(day.slice(8))}
                  </span>
                  {list.map((e) => (
                    <EventChip key={e.id} e={e} />
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </LabCard>

      {/* Agenda — mobile. */}
      <div className="md:hidden">
        {agendaDays.length === 0 ? (
          <LabEmptyState
            icon={CalendarDays}
            title="Tidak ada jadwal bulan ini"
            description="Geser ke bulan lain atau longgarkan filter."
          />
        ) : (
          <ol className="flex flex-col gap-4">
            {agendaDays.map(([day, list]) => (
              <li key={day}>
                <p className="mb-1.5 text-xs font-semibold capitalize">
                  {agendaDay.format(new Date(`${day}T00:00:00Z`))}
                </p>
                <LabCard className="divide-y divide-border/50 p-0">
                  {list.map((e) => (
                    <Link
                      key={e.id}
                      href={`/kol-hub/schedules/${e.id}`}
                      className="flex items-center gap-2 px-3 py-2.5"
                    >
                      <span className="w-11 text-xs font-semibold tabular-nums">
                        {formatWibTime(e.scheduledAt)}
                      </span>
                      <PlatformMark platform={e.platform} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{e.kolName}</span>
                        <span className="text-muted-foreground block truncate text-xs">
                          {PLACEMENT_LABEL[e.placement]} · {e.brandName}
                        </span>
                      </span>
                      <ScheduleStatusBadge status={e.status} />
                    </Link>
                  ))}
                </LabCard>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
