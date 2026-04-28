"use client";

import {
  addDays,
  differenceInCalendarDays,
  max as maxDate,
  min as minDate,
  startOfDay,
} from "date-fns";

export type GanttTask = {
  id: string;
  title: string;
  dueDate: string | null;
  createdAt: string;
};

/** Lebar satu kolom hari (px); cukup untuk label D/M tanpa overlap. */
const DAY_COLUMN_PX = 52;

export function TasksGantt({
  tasks,
  onTaskClick,
}: {
  tasks: GanttTask[];
  onTaskClick?: (taskId: string) => void;
}) {
  const dated = tasks.filter((t) => t.dueDate);
  if (dated.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Tambahkan tanggal deadline pada tugas untuk melihat Gantt.
      </p>
    );
  }

  const ends = dated.map((t) => startOfDay(new Date(t.dueDate!)));
  const starts = dated.map((t) => startOfDay(new Date(t.createdAt)));
  const rangeStart = minDate([...starts, ...ends.map((e) => addDays(e, -14))]);
  const rangeEnd = maxDate([...ends, addDays(rangeStart, 45)]);
  const totalDays = Math.max(
    7,
    differenceInCalendarDays(rangeEnd, rangeStart) + 1,
  );
  const visibleDays = Math.min(totalDays, 45);
  const timelineWidthPx = visibleDays * DAY_COLUMN_PX;

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <div className="space-y-2 p-4">
        <div className="text-muted-foreground mb-3 flex text-xs tabular-nums">
          <div className="border-border w-40 shrink-0 border-b pb-2 pr-2" aria-hidden />
          <div
            className="flex shrink-0 border-b border-border"
            style={{ width: timelineWidthPx }}
          >
            {Array.from({ length: visibleDays }).map((_, i) => {
              const d = addDays(rangeStart, i);
              return (
                <div
                  key={i}
                  className="border-border box-border flex shrink-0 items-center justify-center border-r px-0.5 py-2 text-center leading-none last:border-r-0"
                  style={{
                    width: DAY_COLUMN_PX,
                    minWidth: DAY_COLUMN_PX,
                  }}
                  title={d.toLocaleDateString("id-ID", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                >
                  <span className="block max-w-full truncate">
                    {d.getDate()}/{d.getMonth() + 1}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        {dated.map((t) => {
          const start = startOfDay(new Date(t.createdAt));
          const end = startOfDay(new Date(t.dueDate!));
          const offset = differenceInCalendarDays(start, rangeStart);
          const len = Math.max(
            1,
            differenceInCalendarDays(end, start) + 1,
          );
          const barLeftPx = offset * DAY_COLUMN_PX;
          const barWidthPx = Math.max(len * DAY_COLUMN_PX, 28);
          return (
            <div
              key={t.id}
              className="relative flex h-9 items-center rounded-md bg-muted/40"
            >
              <span className="text-muted-foreground w-40 shrink-0 truncate px-2 text-xs">
                {t.title}
              </span>
              <div
                className="relative h-6 shrink-0"
                style={{ width: timelineWidthPx }}
              >
                <button
                  type="button"
                  className="bg-accent absolute top-1 h-4 max-w-full cursor-pointer rounded-md border border-border/50 text-left text-[10px] leading-4 text-accent-foreground shadow-sm hover:bg-accent/90"
                  style={{
                    left: barLeftPx,
                    width: barWidthPx,
                  }}
                  title={t.title}
                  onClick={() => onTaskClick?.(t.id)}
                >
                  <span className="block truncate px-1">{t.title}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
