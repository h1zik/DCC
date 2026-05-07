"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { TaskStatus } from "@prisma/client";
import { archiveTask, moveTaskStatus, unarchiveTask } from "@/actions/tasks";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { RoomKanbanColumnDTO } from "@/lib/room-kanban-columns";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Archive,
  CalendarDays,
  Check,
  CheckSquare,
  Flag,
  GripVertical,
  Plus,
  RotateCcw,
} from "lucide-react";

export type KanbanTask = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: string;
  dueDate: string | null;
  checklistTotal: number;
  checklistDone: number;
  project: { name: string; brand: { name: string } };
  assignees: {
    image: string | null;
    name: string | null;
    email: string;
  }[];
  tags: { id: string; name: string; colorHex: string }[];
};

function PicStrip({
  assignees,
}: {
  assignees: KanbanTask["assignees"];
}) {
  if (assignees.length > 0) {
    const assignee = assignees[0]!;
    const label = assignee.name?.trim() || assignee.email;
    const initial = label.slice(0, 1).toUpperCase() || "?";
    const extra = assignees.length - 1;
    return (
      <div className="mt-2 flex items-center gap-1.5 border-t border-border/70 pt-2">
        {assignee.image ? (
          <Image
            src={assignee.image}
            alt=""
            width={24}
            height={24}
            className="border-border size-6 shrink-0 rounded-full border object-cover"
            unoptimized
          />
        ) : (
          <div
            className="border-border bg-muted text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold"
            aria-hidden
          >
            {initial}
          </div>
        )}
        <span className="text-muted-foreground truncate text-[10px]" title={label}>
          PIC: {label}
          {extra > 0 ? ` +${extra}` : ""}
        </span>
      </div>
    );
  }
  return (
    <div className="mt-2 flex items-center gap-1.5 border-t border-border/70 pt-2">
      <div
        className="border-border/60 size-6 shrink-0 rounded-full border border-dashed"
        aria-hidden
      />
      <span className="text-muted-foreground text-[10px]">Belum ada PIC</span>
    </div>
  );
}

function DraggableTask({
  task,
  onTaskClick,
  onQuickDone,
  dragDisabled,
  isRoomManager,
  showArchived,
}: {
  task: KanbanTask;
  onTaskClick?: (taskId: string) => void;
  onQuickDone?: (taskId: string) => Promise<void>;
  dragDisabled?: boolean;
  isRoomManager?: boolean;
  showArchived?: boolean;
}) {
  const router = useRouter();
  const [quickPending, setQuickPending] = useState(false);
  const [archivePending, setArchivePending] = useState(false);
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: task.id, disabled: dragDisabled });
  const style = {
    transform: CSS.Translate.toString(transform),
  };
  const canQuickDone = task.status !== TaskStatus.DONE && !showArchived;
  const canArchive =
    isRoomManager &&
    !showArchived &&
    task.status === TaskStatus.DONE;
  const canUnarchive = isRoomManager && showArchived;

  async function handleQuickDone(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    if (!onQuickDone || !canQuickDone || quickPending) return;
    setQuickPending(true);
    try {
      await onQuickDone(task.id);
    } finally {
      setQuickPending(false);
    }
  }

  async function handleArchive(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    if (!canArchive || archivePending) return;
    setArchivePending(true);
    try {
      await archiveTask(task.id);
      toast.success("Tugas diarsipkan.");
      router.refresh();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Gagal mengarsipkan tugas.";
      toast.error(msg);
    } finally {
      setArchivePending(false);
    }
  }

  async function handleUnarchive(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    if (!canUnarchive || archivePending) return;
    setArchivePending(true);
    try {
      await unarchiveTask(task.id);
      toast.success("Tugas dipulihkan dari arsip.");
      router.refresh();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Gagal memulihkan tugas.";
      toast.error(msg);
    } finally {
      setArchivePending(false);
    }
  }

  const priorityTone = (() => {
    const p = task.priority.toUpperCase();
    if (p === "HIGH" || p === "URGENT")
      return "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300";
    if (p === "MEDIUM")
      return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    if (p === "LOW")
      return "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300";
    return "border-border bg-muted text-muted-foreground";
  })();

  const dueDateInfo = (() => {
    if (!task.dueDate) return null;
    const due = new Date(task.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueStart = new Date(due);
    dueStart.setHours(0, 0, 0, 0);
    const diffDays = Math.floor(
      (dueStart.getTime() - today.getTime()) / 86_400_000,
    );
    const isDone = task.status === TaskStatus.DONE;
    let tone = "text-muted-foreground";
    if (!isDone) {
      if (diffDays < 0) tone = "text-rose-600 dark:text-rose-400";
      else if (diffDays <= 3) tone = "text-amber-600 dark:text-amber-400";
    }
    return {
      label: due.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
      }),
      tone,
    };
  })();

  const checklistPct =
    task.checklistTotal > 0
      ? Math.round((task.checklistDone / task.checklistTotal) * 100)
      : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-card group/task hover:border-primary/30 hover:shadow-md flex min-w-0 gap-0.5 rounded-lg border border-border text-sm shadow-sm transition-shadow",
        isDragging && "z-10 opacity-70 ring-2 ring-primary",
      )}
    >
      <button
        type="button"
        className={cn(
          "text-muted-foreground shrink-0 touch-none rounded-l-md p-2",
          dragDisabled
            ? "cursor-not-allowed opacity-40"
            : "hover:bg-muted/80 cursor-grab active:cursor-grabbing",
        )}
        {...(dragDisabled ? {} : listeners)}
        {...(dragDisabled ? {} : attributes)}
        aria-label="Seret tugas"
        disabled={dragDisabled}
      >
        <GripVertical className="size-4" />
      </button>
      <div className="flex shrink-0 flex-col items-center gap-0.5 self-start pt-2">
        {canQuickDone ? (
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            className="text-emerald-600 hover:bg-emerald-500/10 size-6"
            aria-label="Tandai selesai"
            disabled={quickPending}
            onClick={(e) => void handleQuickDone(e)}
          >
            <Check className="size-3.5" />
          </Button>
        ) : null}
        {canArchive ? (
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            className="text-muted-foreground hover:bg-muted/80 size-6"
            aria-label="Arsipkan tugas"
            disabled={archivePending}
            title="Arsipkan"
            onClick={(e) => void handleArchive(e)}
          >
            <Archive className="size-3.5" />
          </Button>
        ) : null}
        {canUnarchive ? (
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            className="text-muted-foreground hover:bg-muted/80 size-6"
            aria-label="Pulihkan dari arsip"
            disabled={archivePending}
            title="Pulihkan"
            onClick={(e) => void handleUnarchive(e)}
          >
            <RotateCcw className="size-3.5" />
          </Button>
        ) : null}
      </div>
      <button
        type="button"
        className="hover:bg-muted/30 min-w-0 flex-1 cursor-pointer overflow-hidden rounded-r-md p-2.5 text-left"
        onClick={() => onTaskClick?.(task.id)}
      >
        <p className="text-foreground break-words font-medium leading-snug">
          {task.title}
        </p>
        <p className="text-muted-foreground mt-1 line-clamp-1 text-xs">
          {task.project.brand.name} · {task.project.name}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold",
              priorityTone,
            )}
          >
            <Flag className="size-2.5" aria-hidden />
            {task.priority}
          </span>
          {dueDateInfo ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[10px] font-medium",
                dueDateInfo.tone,
              )}
            >
              <CalendarDays className="size-2.5" aria-hidden />
              {dueDateInfo.label}
            </span>
          ) : null}
          {checklistPct != null ? (
            <span
              className="text-muted-foreground inline-flex items-center gap-1 text-[10px] font-medium tabular-nums"
              title={`${task.checklistDone} dari ${task.checklistTotal} sub-tugas selesai`}
            >
              <CheckSquare className="size-2.5" aria-hidden />
              {task.checklistDone}/{task.checklistTotal}
            </span>
          ) : null}
        </div>
        {checklistPct != null && task.checklistTotal > 0 ? (
          <div className="bg-muted/60 relative mt-1.5 h-1 w-full overflow-hidden rounded-full">
            <div
              className={cn(
                "absolute inset-y-0 left-0 rounded-full",
                checklistPct >= 100
                  ? "bg-emerald-500"
                  : checklistPct >= 50
                    ? "bg-primary"
                    : "bg-muted-foreground/40",
              )}
              style={{ width: `${Math.max(2, checklistPct)}%` }}
            />
          </div>
        ) : null}
        {task.tags.length > 0 ? (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {task.tags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex max-w-full items-center break-words rounded-full border border-border/70 px-1.5 py-0.5 text-[10px] leading-none font-medium"
                style={{
                  backgroundColor: `${tag.colorHex}22`,
                  color: tag.colorHex,
                }}
              >
                {tag.name}
              </span>
            ))}
          </div>
        ) : null}
        <PicStrip assignees={task.assignees} />
      </button>
    </div>
  );
}

function columnAccent(status: TaskStatus): {
  dot: string;
  ring: string;
} {
  switch (status) {
    case TaskStatus.TODO:
      return {
        dot: "bg-slate-400",
        ring: "ring-slate-300/40",
      };
    case TaskStatus.IN_PROGRESS:
      return {
        dot: "bg-amber-500",
        ring: "ring-amber-300/40",
      };
    case TaskStatus.IN_REVIEW:
      return {
        dot: "bg-violet-500",
        ring: "ring-violet-300/40",
      };
    case TaskStatus.DONE:
      return {
        dot: "bg-emerald-500",
        ring: "ring-emerald-300/40",
      };
    default:
      return {
        dot: "bg-muted-foreground",
        ring: "ring-muted-foreground/30",
      };
  }
}

function DroppableColumn({
  column,
  children,
  count,
  onAddTask,
  readOnly,
}: {
  column: Pick<RoomKanbanColumnDTO, "linkedStatus" | "title">;
  children: React.ReactNode;
  count: number;
  onAddTask?: (status: TaskStatus) => void;
  readOnly?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.linkedStatus });
  const accent = columnAccent(column.linkedStatus);
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[320px] min-w-0 flex-1 flex-col gap-2 rounded-xl border border-border bg-muted/10 p-2 transition-colors",
        isOver && !readOnly && "border-primary/60 bg-primary/5 ring-2 ring-primary/30",
      )}
    >
      <div
        className={cn(
          "border-border/60 bg-background/85 text-foreground flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 shadow-sm backdrop-blur-sm",
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn("size-2 shrink-0 rounded-full ring-2", accent.dot, accent.ring)}
            aria-hidden
          />
          <span className="text-foreground line-clamp-1 text-[11px] font-semibold tracking-wide uppercase">
            {column.title}
          </span>
          <span className="text-muted-foreground inline-flex items-center justify-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
            {count}
          </span>
        </div>
        {onAddTask && !readOnly ? (
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            onClick={() => onAddTask(column.linkedStatus)}
            aria-label={`Tambah tugas ${column.title}`}
          >
            <Plus className="size-3.5" />
          </Button>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">{children}</div>
    </div>
  );
}

export function TasksKanban({
  tasks,
  columns,
  onTaskClick,
  onAddTask,
  kanbanReadOnly,
  isRoomManager,
  showArchived,
}: {
  tasks: KanbanTask[];
  columns: RoomKanbanColumnDTO[];
  onTaskClick?: (taskId: string) => void;
  onAddTask?: (status: TaskStatus) => void;
  /** Mode arsip: tidak ada drag / pindah status dari papan. */
  kanbanReadOnly?: boolean;
  isRoomManager?: boolean;
  showArchived?: boolean;
}) {
  const router = useRouter();
  const [localStatuses, setLocalStatuses] = useState<Record<string, TaskStatus>>({});
  const [doneConfirmTaskId, setDoneConfirmTaskId] = useState<string | null>(null);
  const [doneConfirmUnfinished, setDoneConfirmUnfinished] = useState(0);
  const [doneConfirmPreviousStatus, setDoneConfirmPreviousStatus] =
    useState<TaskStatus | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  useEffect(() => {
    setLocalStatuses({});
  }, [tasks]);

  const viewTasks = useMemo(
    () =>
      tasks.map((t) => ({
        ...t,
        status: localStatuses[t.id] ?? t.status,
      })),
    [tasks, localStatuses],
  );

  const statusSet = new Set(columns.map((c) => c.linkedStatus));

  async function persistStatusChange(
    taskId: string,
    newStatus: TaskStatus,
    previousStatus: TaskStatus,
  ) {
    setLocalStatuses((prev) => ({ ...prev, [taskId]: newStatus }));
    toast.success(
      newStatus === TaskStatus.DONE
        ? "Tugas dipindahkan ke Selesai."
        : "Status tugas diperbarui.",
    );
    try {
      await moveTaskStatus({ taskId, status: newStatus });
    } catch (err) {
      setLocalStatuses((prev) => ({ ...prev, [taskId]: previousStatus }));
      const msg =
        err instanceof Error
          ? err.message
          : newStatus === TaskStatus.DONE
            ? "Gagal memindahkan tugas ke Selesai."
            : "Gagal memindahkan tugas.";
      toast.error(msg);
    }
  }

  async function onDragEnd(e: DragEndEvent) {
    if (kanbanReadOnly) return;
    const { active, over } = e;
    if (!over) return;
    const taskId = String(active.id);
    const newStatus = over.id as TaskStatus;
    if (!statusSet.has(newStatus)) return;
    const task = viewTasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;
    if (newStatus === TaskStatus.DONE) {
      const unfinished = task.checklistTotal - task.checklistDone;
      if (unfinished > 0) {
        setDoneConfirmTaskId(task.id);
        setDoneConfirmUnfinished(unfinished);
        setDoneConfirmPreviousStatus(task.status);
        return;
      }
    }
    await persistStatusChange(taskId, newStatus, task.status);
  }

  async function onQuickDone(taskId: string) {
    const task = viewTasks.find((t) => t.id === taskId);
    if (!task || task.status === TaskStatus.DONE) return;
    const unfinished = task.checklistTotal - task.checklistDone;
    if (unfinished > 0) {
      setDoneConfirmTaskId(task.id);
      setDoneConfirmUnfinished(unfinished);
      setDoneConfirmPreviousStatus(task.status);
      return;
    }
    await persistStatusChange(taskId, TaskStatus.DONE, task.status);
  }

  const readOnly = Boolean(kanbanReadOnly);

  return (
    <>
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="w-full overflow-x-auto">
          <div className="flex min-w-0 flex-col gap-4 lg:flex-row">
          {columns.map((col) => {
            const colTasks = viewTasks.filter(
              (t) => t.status === col.linkedStatus,
            );
            return (
              <DroppableColumn
                key={col.id}
                column={col}
                count={colTasks.length}
                onAddTask={readOnly ? undefined : onAddTask}
                readOnly={readOnly}
              >
                {colTasks.map((t) => (
                  <DraggableTask
                    key={t.id}
                    task={t}
                    onTaskClick={onTaskClick}
                    onQuickDone={readOnly ? undefined : onQuickDone}
                    dragDisabled={readOnly}
                    isRoomManager={isRoomManager}
                    showArchived={showArchived}
                  />
                ))}
              </DroppableColumn>
            );
          })}
          </div>
        </div>
      </DndContext>

      <Dialog
        open={doneConfirmTaskId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDoneConfirmTaskId(null);
            setDoneConfirmUnfinished(0);
            setDoneConfirmPreviousStatus(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sub-tugas belum selesai</DialogTitle>
            <DialogDescription>
              Masih ada {doneConfirmUnfinished} sub-tugas yang belum selesai.
              Tetap tandai tugas ini sebagai <b>Selesai</b>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDoneConfirmTaskId(null);
                setDoneConfirmUnfinished(0);
                setDoneConfirmPreviousStatus(null);
              }}
            >
              Batalkan
            </Button>
            <Button
              type="button"
              onClick={async () => {
                if (!doneConfirmTaskId || doneConfirmPreviousStatus === null) return;
                const taskId = doneConfirmTaskId;
                const previous = doneConfirmPreviousStatus;
                setDoneConfirmTaskId(null);
                setDoneConfirmUnfinished(0);
                setDoneConfirmPreviousStatus(null);
                await persistStatusChange(taskId, TaskStatus.DONE, previous);
              }}
            >
              Tetap Selesaikan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
