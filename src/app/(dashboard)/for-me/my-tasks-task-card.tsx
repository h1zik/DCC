"use client";

import Link from "next/link";
import { TaskStatus } from "@prisma/client";
import { CalendarDays } from "lucide-react";
import { TaskChecklistPopover } from "@/components/tasks/task-checklist-popover";
import { taskStatusLabel } from "@/lib/task-status-ui";
import { cn } from "@/lib/utils";

function formatShortDate(d: Date) {
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
}

function dueLine(dueIso: string | null) {
  if (!dueIso) {
    return (
      <span className="text-muted-foreground inline-flex items-center gap-1 text-[11px]">
        <CalendarDays className="size-3" aria-hidden /> Tanpa deadline
      </span>
    );
  }
  const due = new Date(dueIso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(due);
  start.setHours(0, 0, 0, 0);
  const diff = Math.floor((start.getTime() - today.getTime()) / 86_400_000);
  let tone = "text-muted-foreground";
  let label = `Due ${formatShortDate(due)}`;
  if (diff < 0) {
    tone = "text-rose-600 dark:text-rose-400";
    label = `${Math.abs(diff)} hari lewat`;
  } else if (diff === 0) {
    tone = "text-amber-600 dark:text-amber-400";
    label = "Hari ini";
  } else if (diff <= 3) {
    tone = "text-amber-600 dark:text-amber-400";
    label = `${diff} hari lagi`;
  }
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium", tone)}>
      <CalendarDays className="size-3" aria-hidden />
      {label}
    </span>
  );
}

export function MyTasksTaskCard({
  href,
  title,
  roomName,
  processLabel,
  status,
  statusChipClassName,
  dueDateIso,
  checklistItems,
}: {
  href: string;
  title: string;
  roomName: string;
  processLabel: string;
  status: TaskStatus;
  statusChipClassName: string;
  dueDateIso: string | null;
  checklistItems: { id: string; title: string; done: boolean }[];
}) {
  const total = checklistItems.length;
  const done = checklistItems.filter((i) => i.done).length;

  return (
    <div className="bg-background hover:border-primary/40 hover:bg-muted/30 group flex gap-2 rounded-lg border border-border/70 transition-colors">
      <Link
        href={href}
        className="flex min-w-0 flex-1 flex-col gap-2 px-3 py-2.5"
      >
        <p className="text-foreground line-clamp-2 text-sm font-medium leading-snug">
          {title}
        </p>
        <p className="text-muted-foreground line-clamp-1 text-[11px]">
          <span className="text-foreground/80 font-medium">{roomName}</span> ·{" "}
          {processLabel}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
              statusChipClassName,
            )}
          >
            {taskStatusLabel(status)}
          </span>
          {dueLine(dueDateIso)}
        </div>
      </Link>
      {total > 0 ? (
        <div className="flex shrink-0 flex-col items-center justify-center border-l border-border/60 px-1 py-2">
          <TaskChecklistPopover
            items={checklistItems}
            doneCount={done}
            totalCount={total}
            compact
          />
        </div>
      ) : null}
    </div>
  );
}
