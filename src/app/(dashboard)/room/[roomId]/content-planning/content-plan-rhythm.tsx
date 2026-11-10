"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import type { ContentPlanJenis, ContentPlanStatusKerja } from "@prisma/client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CONTENT_PLAN_STAGES,
  contentPlanStage,
  JENIS_LABEL,
  JENIS_MARK_CLASS,
  STAGE_BAR_CLASS,
  STAGE_LABEL,
  type ContentPlanStage,
} from "@/lib/content-plan-ui";
import { cn } from "@/lib/utils";
import { toDateInput } from "./content-plan-shared";

/** Nilai `dayFilter` untuk "konten tanpa tanggal posting". */
export const UNSCHEDULED_DAY = "none";

const DAYS_SHOWN = 14;
const MAX_MARKS = 4;
const WEEKDAY_SHORT = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const WEEKDAY_LONG = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

export type ContentPlanRhythmRow = {
  id: string;
  konten: string;
  jenisKonten: ContentPlanJenis;
  tanggalPosting: Date | string | null;
  jamPosting: string | null;
  statusCopywriting: ContentPlanStatusKerja;
  statusDesign: ContentPlanStatusKerja;
};

export type ContentPlanDayInfo = { count: number; missingJam: number; dupJam: boolean };

const subscribeNever = () => () => {};
const todayKeySnapshot = () => toDateInput(new Date());
const todayKeyServerSnapshot = () => "";

/** "YYYY-MM-DD" → Date tengah malam lokal. */
function dateFromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** Senin pada minggu yang memuat `d` (minggu kerja Indonesia mulai Senin). */
function mondayOf(d: Date): Date {
  return addDays(d, -((d.getDay() + 6) % 7));
}

function rangeLabel(first: Date, last: Date): string {
  const tail = `${last.getDate()} ${MONTH_SHORT[last.getMonth()]} ${last.getFullYear()}`;
  if (first.getMonth() === last.getMonth()) return `${first.getDate()} – ${tail}`;
  return `${first.getDate()} ${MONTH_SHORT[first.getMonth()]} – ${tail}`;
}

/**
 * Ringkasan di atas tabel content plan: tahap pengerjaan seluruh konten aktif
 * dan ritme posting dua minggu (hari kosong terlihat sebagai celah). Segmen
 * tahap dan sel hari bisa diklik untuk menyaring tabel.
 */
export function ContentPlanRhythm({
  rows,
  dayInfo,
  dayFilter,
  onDayFilterChange,
  stageFilter,
  onStageFilterChange,
  archivePending,
  onArchiveDone,
}: {
  /** Baris aktif (belum diarsipkan), tanpa filter toolbar. */
  rows: ContentPlanRhythmRow[];
  dayInfo: Map<string, ContentPlanDayInfo>;
  dayFilter: string | null;
  onDayFilterChange: (next: string | null) => void;
  stageFilter: ContentPlanStage | null;
  onStageFilterChange: (next: ContentPlanStage | null) => void;
  archivePending: boolean;
  /** Arsipkan semua konten bertahap Selesai. */
  onArchiveDone: () => void;
}) {
  // "Hari ini" bergantung zona waktu peramban: server merender kerangka kosong,
  // klien mengisinya setelah hidrasi agar keduanya tidak berbeda di sekitar tengah malam.
  const todayKey = useSyncExternalStore(
    subscribeNever,
    todayKeySnapshot,
    todayKeyServerSnapshot,
  );
  const [weekOffset, setWeekOffset] = useState(0);

  const stageCounts = useMemo(() => {
    const counts: Record<ContentPlanStage, number> = {
      belum: 0,
      proses: 0,
      tertahan: 0,
      selesai: 0,
    };
    for (const row of rows) counts[contentPlanStage(row)] += 1;
    return counts;
  }, [rows]);

  const { byDay, unscheduled } = useMemo(() => {
    const map = new Map<string, ContentPlanRhythmRow[]>();
    let none = 0;
    for (const row of rows) {
      const key = toDateInput(row.tanggalPosting);
      if (!key) {
        none += 1;
        continue;
      }
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.jamPosting ?? "99:99").localeCompare(b.jamPosting ?? "99:99"));
    }
    return { byDay: map, unscheduled: none };
  }, [rows]);

  const days = useMemo(() => {
    if (!todayKey) return null;
    const first = addDays(mondayOf(dateFromKey(todayKey)), weekOffset * 7);
    return Array.from({ length: DAYS_SHOWN }, (_, i) => addDays(first, i));
  }, [todayKey, weekOffset]);

  const total = rows.length;

  return (
    <section
      aria-label="Ringkasan content plan"
      className="border-border bg-card flex shrink-0 flex-col rounded-xl border lg:flex-row"
    >
      <div className="border-border flex flex-col gap-2 border-b p-3 lg:w-60 lg:shrink-0 lg:border-r lg:border-b-0">
        <p className="text-sm font-semibold tabular-nums">
          {total} konten aktif
        </p>
        <div
          className="bg-muted flex h-1.5 w-full gap-px overflow-hidden rounded-full"
          aria-hidden
        >
          {total > 0
            ? CONTENT_PLAN_STAGES.map((stage) =>
                stageCounts[stage] > 0 ? (
                  <span
                    key={stage}
                    className={STAGE_BAR_CLASS[stage]}
                    style={{ flexGrow: stageCounts[stage] }}
                  />
                ) : null,
              )
            : null}
        </div>
        <ul className="grid grid-cols-2 gap-x-2 gap-y-0.5">
          {CONTENT_PLAN_STAGES.map((stage) => {
            const active = stageFilter === stage;
            const count = stageCounts[stage];
            return (
              <li key={stage}>
                <button
                  type="button"
                  aria-pressed={active}
                  disabled={count === 0 && !active}
                  onClick={() => onStageFilterChange(active ? null : stage)}
                  title={
                    active
                      ? "Klik untuk melepas saringan tahap ini."
                      : `Tampilkan hanya konten bertahap ${STAGE_LABEL[stage]}.`
                  }
                  className={cn(
                    "focus-visible:ring-ring flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-xs outline-none transition-colors focus-visible:ring-2",
                    active ? "bg-muted font-medium" : "hover:bg-muted/60",
                    "disabled:pointer-events-none disabled:opacity-50",
                  )}
                >
                  <span
                    className={cn("size-2 shrink-0 rounded-full", STAGE_BAR_CLASS[stage])}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate">{STAGE_LABEL[stage]}</span>
                  <span className="text-muted-foreground tabular-nums">{count}</span>
                </button>
              </li>
            );
          })}
        </ul>
        {stageCounts.selesai > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="w-fit"
            disabled={archivePending}
            title="Konten yang copy dan design-nya sudah Dipublikasikan pindah ke Arsip dan bisa dipulihkan kapan saja."
            onClick={onArchiveDone}
          >
            {archivePending
              ? "Mengarsipkan…"
              : `Arsipkan ${stageCounts.selesai} yang selesai`}
          </Button>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 className="text-sm font-semibold">Ritme posting</h2>
          <span className="text-muted-foreground text-xs tabular-nums">
            {days ? rangeLabel(days[0], days[DAYS_SHOWN - 1]) : " "}
          </span>
          <div className="flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Minggu sebelumnya"
              onClick={() => setWeekOffset((n) => n - 1)}
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              disabled={weekOffset === 0}
              onClick={() => setWeekOffset(0)}
            >
              Minggu ini
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Minggu berikutnya"
              onClick={() => setWeekOffset((n) => n + 1)}
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
          <ul className="text-muted-foreground ml-auto hidden items-center gap-3 text-[11px] xl:flex">
            {(Object.keys(JENIS_LABEL) as ContentPlanJenis[]).map((jenis) => (
              <li key={jenis} className="inline-flex items-center gap-1">
                <span
                  className={cn("h-2.5 w-1.5 rounded-sm", JENIS_MARK_CLASS[jenis])}
                  aria-hidden
                />
                {JENIS_LABEL[jenis]}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex min-w-0 items-stretch gap-2">
          <ol className="grid min-w-0 flex-1 auto-cols-[minmax(2.75rem,1fr)] grid-flow-col gap-1 overflow-x-auto pb-0.5">
            {(days ?? Array.from({ length: DAYS_SHOWN }, () => null)).map((day, i) => {
              if (!day) {
                return (
                  <li
                    key={i}
                    className="bg-muted/40 h-16 rounded-lg motion-safe:animate-pulse"
                    aria-hidden
                  />
                );
              }
              const key = toDateInput(day);
              const list = byDay.get(key) ?? [];
              const info = dayInfo.get(key);
              const count = list.length;
              const isToday = key === todayKey;
              const isPast = key < todayKey;
              const isSunday = day.getDay() === 0;
              const selected = dayFilter === key;
              const problem =
                count > 1 && ((info?.missingJam ?? 0) > 0 || Boolean(info?.dupJam));
              const dayLabel = `${WEEKDAY_LONG[day.getDay()]} ${day.getDate()} ${MONTH_SHORT[day.getMonth()]}`;
              const title =
                count === 0
                  ? `${dayLabel}: belum ada konten`
                  : [
                      `${dayLabel}: ${count} konten${problem ? " (jam kosong atau bentrok)" : ""}`,
                      ...list.map(
                        (r) =>
                          `${r.jamPosting ?? "--:--"}  ${r.konten || "(tanpa judul)"} (${JENIS_LABEL[r.jenisKonten]})`,
                      ),
                    ].join("\n");
              const body = (
                <>
                  <span
                    className={cn(
                      "text-[11px] leading-none",
                      isSunday ? "text-red-600 dark:text-red-400" : "text-muted-foreground",
                    )}
                  >
                    {WEEKDAY_SHORT[day.getDay()]}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-sm leading-5 font-semibold tabular-nums",
                      isToday
                        ? "bg-foreground text-background"
                        : isSunday
                          ? "text-red-600 dark:text-red-400"
                          : undefined,
                    )}
                  >
                    {day.getDate()}
                  </span>
                  <span className="flex h-2.5 items-end justify-center gap-0.5">
                    {list.slice(0, MAX_MARKS).map((r) => (
                      <span
                        key={r.id}
                        className={cn("h-2.5 w-1.5 rounded-sm", JENIS_MARK_CLASS[r.jenisKonten])}
                      />
                    ))}
                    {count > MAX_MARKS ? (
                      <span className="text-muted-foreground text-[9px] leading-none tabular-nums">
                        +{count - MAX_MARKS}
                      </span>
                    ) : null}
                  </span>
                  {problem ? (
                    <span
                      className="absolute top-1 right-1 size-1.5 rounded-full bg-amber-500"
                      aria-hidden
                    />
                  ) : null}
                </>
              );
              const cellClass = cn(
                "relative flex h-16 w-full flex-col items-center justify-between rounded-lg border px-1 pt-1.5 pb-1.5",
                isPast && !selected && "opacity-60",
              );
              return (
                <li key={key} aria-current={isToday ? "date" : undefined}>
                  {count === 0 ? (
                    <div
                      title={title}
                      className={cn(
                        cellClass,
                        isPast ? "border-transparent" : "border-border/80 border-dashed",
                      )}
                    >
                      {body}
                    </div>
                  ) : (
                    <button
                      type="button"
                      title={title}
                      aria-pressed={selected}
                      aria-label={`${dayLabel}, ${count} konten. ${selected ? "Lepas saringan hari ini" : "Saring tabel ke hari ini"}`}
                      onClick={() => onDayFilterChange(selected ? null : key)}
                      className={cn(
                        cellClass,
                        "focus-visible:ring-ring outline-none transition-colors focus-visible:ring-2",
                        selected
                          ? "border-primary bg-primary/10 opacity-100"
                          : "border-border bg-background hover:bg-muted/60",
                      )}
                    >
                      {body}
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
          {unscheduled > 0 || dayFilter === UNSCHEDULED_DAY ? (
            <button
              type="button"
              aria-pressed={dayFilter === UNSCHEDULED_DAY}
              title="Konten yang belum punya tanggal posting. Klik untuk menyaring tabel."
              onClick={() =>
                onDayFilterChange(dayFilter === UNSCHEDULED_DAY ? null : UNSCHEDULED_DAY)
              }
              className={cn(
                "focus-visible:ring-ring flex h-16 w-24 shrink-0 flex-col items-start justify-center rounded-lg border px-2.5 text-left outline-none transition-colors focus-visible:ring-2",
                dayFilter === UNSCHEDULED_DAY
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background hover:bg-muted/60",
              )}
            >
              <span className="text-sm leading-5 font-semibold tabular-nums">
                {unscheduled}
              </span>
              <span className="text-muted-foreground text-[11px] leading-tight">
                belum dijadwalkan
              </span>
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
