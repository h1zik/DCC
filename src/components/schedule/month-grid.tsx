"use client";

import { format, isSameDay, isSameMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { EventChip } from "./event-chip";
import { dayKeyOf, type ScheduleEventRow } from "./schedule-types";

const WEEKDAY_LABELS = [
  "Sen",
  "Sel",
  "Rab",
  "Kam",
  "Jum",
  "Sab",
  "Min",
] as const;

/**
 * Grid bulan 7 kolom. Klik sel → detail hari (bukan dialog buat);
 * klik chip acara → buka form; "+N lainnya" adalah tombol ke detail hari.
 */
export function MonthGrid({
  weeks,
  viewMonth,
  eventsByDayKey,
  currentUserId,
  onDayClick,
  onEventClick,
}: {
  weeks: Date[][];
  viewMonth: Date;
  eventsByDayKey: Map<string, ScheduleEventRow[]>;
  currentUserId: string;
  onDayClick: (day: Date) => void;
  onEventClick: (ev: ScheduleEventRow) => void;
}) {
  const today = new Date();

  return (
    <div className="animate-in fade-in overflow-x-auto rounded-xl border border-border bg-card shadow-sm duration-200 motion-reduce:animate-none">
      <div className="min-w-[720px]">
        <div className="grid grid-cols-7 border-b border-border bg-muted/40">
          {WEEKDAY_LABELS.map((d) => (
            <div
              key={d}
              className="text-muted-foreground border-border border-r px-2 py-2 text-center text-xs font-semibold tracking-wide uppercase last:border-r-0"
            >
              {d}
            </div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7">
            {week.map((day) => {
              const inMonth = isSameMonth(day, viewMonth);
              const isToday = isSameDay(day, today);
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              const key = dayKeyOf(day);
              const dayEvents = eventsByDayKey.get(key) ?? [];
              const shown = dayEvents.slice(0, 4);
              const moreBase = dayEvents.length - 3; // < xl: maks 3 chip
              const moreXl = dayEvents.length - 4; // ≥ xl: maks 4 chip

              return (
                <div
                  key={key}
                  role="button"
                  tabIndex={0}
                  aria-label={`Lihat acara ${format(day, "d")}`}
                  onClick={() => onDayClick(day)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onDayClick(day);
                    }
                  }}
                  className={cn(
                    "border-border relative min-h-[120px] cursor-pointer border-r border-b p-1.5 transition-colors last:border-r-0 hover:bg-muted/30",
                    isWeekend && "bg-muted/10",
                    !inMonth && "bg-muted/15 text-muted-foreground",
                    isToday && "bg-primary/5 ring-1 ring-inset ring-primary/25",
                  )}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                        isToday && "bg-primary text-primary-foreground",
                        !inMonth && "text-muted-foreground",
                      )}
                    >
                      {format(day, "d")}
                    </span>
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {shown.map((ev, i) => (
                      <EventChip
                        key={ev.id}
                        event={ev}
                        currentUserId={currentUserId}
                        className={i === 3 ? "hidden xl:flex" : undefined}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick(ev);
                        }}
                      />
                    ))}
                    {moreBase > 0 ? (
                      <button
                        type="button"
                        className={cn(
                          "text-muted-foreground w-full rounded px-1 py-0.5 text-left text-[10px] font-medium transition-colors hover:bg-muted/60 hover:text-foreground",
                          moreXl <= 0 && "xl:hidden",
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDayClick(day);
                        }}
                      >
                        <span className="xl:hidden">+{moreBase} lainnya</span>
                        {moreXl > 0 ? (
                          <span className="hidden xl:inline">
                            +{moreXl} lainnya
                          </span>
                        ) : null}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
