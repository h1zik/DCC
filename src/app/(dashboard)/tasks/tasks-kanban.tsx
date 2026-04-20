"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
import { moveTaskStatus } from "@/actions/tasks";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, GripVertical, Plus } from "lucide-react";

const COLS = [
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.OVERDUE,
  TaskStatus.DONE,
] as const;

const LABELS: Record<TaskStatus, string> = {
  TODO: "To-Do",
  IN_PROGRESS: "Berjalan",
  OVERDUE: "Overdue",
  DONE: "Selesai",
};

export type KanbanTask = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: string;
  dueDate: string | null;
  project: { name: string; brand: { name: string } };
  assignee: {
    image: string | null;
    name: string | null;
    email: string;
  } | null;
};

function PicStrip({
  assignee,
}: {
  assignee: KanbanTask["assignee"];
}) {
  if (assignee) {
    const label = assignee.name?.trim() || assignee.email;
    const initial = label.slice(0, 1).toUpperCase() || "?";
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
}: {
  task: KanbanTask;
  onTaskClick?: (taskId: string) => void;
  onQuickDone?: (taskId: string) => Promise<void>;
}) {
  const [quickPending, setQuickPending] = useState(false);
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: task.id });
  const style = {
    transform: CSS.Transform.toString(transform),
  };
  const canQuickDone = task.status !== TaskStatus.DONE;

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
        className="text-muted-foreground hover:bg-muted/80 touch-none shrink-0 cursor-grab rounded-l-md p-2 active:cursor-grabbing"
        {...listeners}
        {...attributes}
        aria-label="Seret tugas"
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
        <PicStrip assignee={task.assignee} />
      </button>
    </div>
  );
}

function DroppableColumn({
  status,
  children,
  onAddTask,
}: {
  status: TaskStatus;
  children: React.ReactNode;
  onAddTask?: (status: TaskStatus) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[300px] flex-1 flex-col gap-2 rounded-xl border border-dashed border-border bg-muted/15 p-2",
        isOver && "border-accent bg-muted/40",
      )}
    >
      <div className="text-muted-foreground flex items-center justify-between px-1 text-xs font-semibold tracking-wide uppercase">
        <span>{LABELS[status]}</span>
        {onAddTask ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => onAddTask(status)}
            aria-label={`Tambah tugas ${LABELS[status]}`}
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
  onTaskClick,
  onAddTask,
}: {
  tasks: KanbanTask[];
  onTaskClick?: (taskId: string) => void;
  onAddTask?: (status: TaskStatus) => void;
}) {
  const router = useRouter();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over) return;
    const taskId = String(active.id);
    const newStatus = over.id as TaskStatus;
    if (!COLS.some((c) => c === newStatus)) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;
    try {
      await moveTaskStatus({ taskId, status: newStatus });
      toast.success("Status tugas diperbarui.");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal memindahkan tugas.";
      toast.error(msg);
    }
  }

  async function onQuickDone(taskId: string) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === TaskStatus.DONE) return;
    try {
      await moveTaskStatus({ taskId, status: TaskStatus.DONE });
      toast.success("Tugas dipindahkan ke Selesai.");
      router.refresh();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Gagal memindahkan tugas ke Selesai.";
      toast.error(msg);
    }
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="flex flex-col gap-4 lg:flex-row">
        {COLS.map((status) => (
          <DroppableColumn key={status} status={status} onAddTask={onAddTask}>
            {tasks
              .filter((t) => t.status === status)
              .map((t) => (
                <DraggableTask
                  key={t.id}
                  task={t}
                  onTaskClick={onTaskClick}
                  onQuickDone={onQuickDone}
                />
              ))}
          </DroppableColumn>
        ))}
      </div>
    </DndContext>
  );
}
