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
  brandName: string;
};

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

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <div className="min-w-[720px] space-y-2 p-4">
        <div className="text-muted-foreground mb-3 flex text-xs">
          {Array.from({ length: Math.min(totalDays, 45) }).map((_, i) => {
            const d = addDays(rangeStart, i);
            return (
              <div
                key={i}
                className="border-border shrink-0 border-r px-1 text-center"
                style={{ width: `${100 / Math.min(totalDays, 45)}%` }}
              >
                {d.getDate()}/{d.getMonth() + 1}
              </div>
            );
          })}
        </div>
        {dated.map((t) => {
          const start = startOfDay(new Date(t.createdAt));
          const end = startOfDay(new Date(t.dueDate!));
          const offset = differenceInCalendarDays(start, rangeStart);
          const len = Math.max(
            1,
            differenceInCalendarDays(end, start) + 1,
          );
          const pct = 100 / Math.min(totalDays, 45);
          return (
            <div
              key={t.id}
              className="relative flex h-9 items-center rounded-md bg-muted/40"
            >
              <span className="text-muted-foreground w-40 shrink-0 truncate px-2 text-xs">
                {t.brandName}
              </span>
              <div className="relative h-6 flex-1">
                <button
                  type="button"
                  className="bg-accent absolute top-1 h-4 cursor-pointer rounded-md border border-border/50 text-left text-[10px] leading-4 text-accent-foreground shadow-sm hover:bg-accent/90"
                  style={{
                    left: `${offset * pct}%`,
                    width: `${len * pct}%`,
                    minWidth: "8%",
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
