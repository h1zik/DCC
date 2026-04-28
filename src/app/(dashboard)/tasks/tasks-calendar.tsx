"use client";

import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CalendarTask = {
  id: string;
  title: string;
  dueDate: string | null;
};

const WEEKDAY_LABELS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"] as const;
const WEEK_STARTS_ON = 1 as const;

function chunkWeeks(days: Date[]): Date[][] {
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
}

export function TasksCalendar({
  tasks,
  onTaskClick,
}: {
  tasks: CalendarTask[];
  onTaskClick?: (taskId: string) => void;
}) {
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));
  const datedTasks = useMemo(() => tasks.filter((t) => t.dueDate), [tasks]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(viewMonth);
    const monthEnd = endOfMonth(viewMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: WEEK_STARTS_ON });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: WEEK_STARTS_ON });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [viewMonth]);

  const weeks = useMemo(() => chunkWeeks(calendarDays), [calendarDays]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, CalendarTask[]>();
    for (const task of datedTasks) {
      const key = format(new Date(task.dueDate!), "yyyy-MM-dd");
      const list = map.get(key) ?? [];
      list.push(task);
      map.set(key, list);
    }
    return map;
  }, [datedTasks]);

  if (datedTasks.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Tambahkan tanggal deadline pada tugas untuk melihat kalender.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-border">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => setViewMonth((m) => addMonths(m, -1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => setViewMonth((m) => addMonths(m, 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <p className="text-sm font-medium capitalize">
          {format(viewMonth, "MMMM yyyy", { locale: idLocale })}
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setViewMonth(startOfMonth(new Date()))}
        >
          Hari ini
        </Button>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-7 border-b border-border bg-muted/30">
            {WEEKDAY_LABELS.map((d) => (
              <div
                key={d}
                className="text-muted-foreground border-r border-border px-2 py-2 text-center text-xs font-semibold tracking-wide uppercase last:border-r-0"
              >
                {d}
              </div>
            ))}
          </div>

          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7">
              {week.map((day) => {
                const key = format(day, "yyyy-MM-dd");
                const inMonth = isSameMonth(day, viewMonth);
                const dayTasks = tasksByDay.get(key) ?? [];
                const visible = dayTasks.slice(0, 4);
                const more = dayTasks.length - visible.length;

                return (
                  <div
                    key={key}
                    className={cn(
                      "min-h-[124px] border-r border-b border-border p-1.5 last:border-r-0",
                      !inMonth && "bg-muted/15 text-muted-foreground",
                    )}
                  >
                    <div className="mb-1">
                      <span
                        className={cn(
                          "inline-flex size-6 items-center justify-center rounded-full text-xs font-medium",
                          isToday(day) && "bg-primary text-primary-foreground",
                        )}
                      >
                        {format(day, "d")}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {visible.map((task) => (
                        <button
                          key={task.id}
                          type="button"
                          className="bg-accent/30 hover:bg-accent/60 w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] text-accent-foreground"
                          title={task.title}
                          onClick={() => onTaskClick?.(task.id)}
                        >
                          {task.title}
                        </button>
                      ))}
                      {more > 0 ? (
                        <p className="text-muted-foreground px-1 text-[10px]">
                          +{more} lainnya
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
