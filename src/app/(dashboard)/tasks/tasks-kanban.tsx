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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Archive, Check, GripVertical, Plus, RotateCcw } from "lucide-react";

export type KanbanTask = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: string;
  dueDate: string | null;
  project: { name: string; brand: { name: string } };
  assignees: {
    image: string | null;
    name: string | null;
    email: string;
  }[];
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
    transform: CSS.Transform.toString(transform),
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-card flex gap-0.5 rounded-lg border border-border text-sm shadow-sm",
        isDragging && "z-10 opacity-70 ring-2 ring-primary",
      )}
    >
      <button
        type="button"
        className={cn(
          "text-muted-foreground shrink-0 rounded-l-md p-2 touch-none",
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
      {canQuickDone ? (
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          className="text-emerald-600 hover:bg-emerald-500/10 mt-2 h-6 w-6 self-start"
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
          className="text-muted-foreground hover:bg-muted/80 mt-2 h-6 w-6 self-start"
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
          className="text-muted-foreground hover:bg-muted/80 mt-2 h-6 w-6 self-start"
          aria-label="Pulihkan dari arsip"
          disabled={archivePending}
          title="Pulihkan"
          onClick={(e) => void handleUnarchive(e)}
        >
          <RotateCcw className="size-3.5" />
        </Button>
      ) : null}
      <button
        type="button"
        className="hover:bg-muted/30 min-w-0 flex-1 cursor-pointer rounded-r-md p-2.5 text-left"
        onClick={() => onTaskClick?.(task.id)}
      >
        <p className="font-medium leading-snug">{task.title}</p>
        <p className="text-muted-foreground mt-1 text-xs">
          {task.project.brand.name} · {task.project.name}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1">
          <Badge variant="outline" className="text-[10px]">
            {task.priority}
          </Badge>
          {task.dueDate ? (
            <span className="text-muted-foreground text-[10px]">
              Due {new Date(task.dueDate).toLocaleDateString("id-ID")}
            </span>
          ) : null}
        </div>
        <PicStrip assignees={task.assignees} />
      </button>
    </div>
  );
}

function DroppableColumn({
  column,
  children,
  onAddTask,
  readOnly,
}: {
  column: Pick<RoomKanbanColumnDTO, "linkedStatus" | "title">;
  children: React.ReactNode;
  onAddTask?: (status: TaskStatus) => void;
  readOnly?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.linkedStatus });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[300px] flex-1 flex-col gap-2 rounded-xl border border-dashed border-border bg-muted/15 p-2",
        isOver && !readOnly && "border-accent bg-muted/40",
      )}
    >
      <div className="text-muted-foreground flex items-center justify-between px-1 text-xs font-semibold tracking-wide uppercase">
        <span className="text-pretty">{column.title}</span>
        {onAddTask && !readOnly ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => onAddTask(column.linkedStatus)}
            aria-label={`Tambah tugas ${column.title}`}
          >
            <Plus className="size-3.5" />
          </Button>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-2">{children}</div>
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

  async function onDragEnd(e: DragEndEvent) {
    if (kanbanReadOnly) return;
    const { active, over } = e;
    if (!over) return;
    const taskId = String(active.id);
    const newStatus = over.id as TaskStatus;
    if (!statusSet.has(newStatus)) return;
    const task = viewTasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;
    setLocalStatuses((prev) => ({ ...prev, [taskId]: newStatus }));
    toast.success("Status tugas diperbarui.");
    try {
      await moveTaskStatus({ taskId, status: newStatus });
    } catch (err) {
      setLocalStatuses((prev) => ({ ...prev, [taskId]: task.status }));
      const msg = err instanceof Error ? err.message : "Gagal memindahkan tugas.";
      toast.error(msg);
    }
  }

  async function onQuickDone(taskId: string) {
    const task = viewTasks.find((t) => t.id === taskId);
    if (!task || task.status === TaskStatus.DONE) return;
    setLocalStatuses((prev) => ({ ...prev, [taskId]: TaskStatus.DONE }));
    toast.success("Tugas dipindahkan ke Selesai.");
    try {
      await moveTaskStatus({ taskId, status: TaskStatus.DONE });
    } catch (err) {
      setLocalStatuses((prev) => ({ ...prev, [taskId]: task.status }));
      const msg =
        err instanceof Error ? err.message : "Gagal memindahkan tugas ke Selesai.";
      toast.error(msg);
    }
  }

  const readOnly = Boolean(kanbanReadOnly);

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="flex flex-col gap-4 lg:flex-row">
        {columns.map((col) => (
          <DroppableColumn
            key={col.id}
            column={col}
            onAddTask={readOnly ? undefined : onAddTask}
            readOnly={readOnly}
          >
            {viewTasks
              .filter((t) => t.status === col.linkedStatus)
              .map((t) => (
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
        ))}
      </div>
    </DndContext>
  );
}
