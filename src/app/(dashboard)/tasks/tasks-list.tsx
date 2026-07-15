"use client";

import Image from "next/image";
import { useCallback, useMemo, useState } from "react";
import { TaskPriority, TaskStatus, type User } from "@prisma/client";
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleDashed,
  CircleDot,
  Flag,
  PlayCircle,
  Plus,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import {
  moveTaskStatus,
  moveTaskToColumn,
  updateTask,
  type TaskMutationResult,
} from "@/actions/tasks";
import { actionErrorMessage } from "@/lib/action-error-message";
import { sortTasksForKanbanColumn, sortTasksForKanbanStatus } from "@/lib/kanban-sort";
import {
  resolveColumnIdForTask,
  statusForColumn,
} from "@/lib/room-kanban-columns";
import { cn } from "@/lib/utils";
import type { RoomKanbanColumnDTO } from "@/lib/room-kanban-columns";
import { taskStatusLabel } from "@/lib/task-status-ui";
import type { TaskRow } from "./task-types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function priorityLabel(p: TaskPriority): string {
  switch (p) {
    case TaskPriority.HIGH:
      return "Tinggi";
    case TaskPriority.MEDIUM:
      return "Sedang";
    case TaskPriority.LOW:
      return "Rendah";
    default:
      return String(p);
  }
}

function statusGroupStyle(status: TaskStatus): {
  pill: string;
  iconColor: string;
  icon: typeof Circle;
} {
  switch (status) {
    case TaskStatus.IN_REVIEW:
      return {
        pill: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
        iconColor: "text-amber-600 dark:text-amber-400",
        icon: CircleDot,
      };
    case TaskStatus.IN_PROGRESS:
      return {
        pill: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
        iconColor: "text-violet-600 dark:text-violet-400",
        icon: PlayCircle,
      };
    case TaskStatus.TODO:
      return {
        pill: "bg-muted text-muted-foreground",
        iconColor: "text-muted-foreground",
        icon: CircleDashed,
      };
    case TaskStatus.DONE:
      return {
        pill: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
        iconColor: "text-emerald-600 dark:text-emerald-400",
        icon: Circle,
      };
    case TaskStatus.OVERDUE:
      return {
        pill: "bg-red-500/15 text-red-700 dark:text-red-300",
        iconColor: "text-red-600 dark:text-red-400",
        icon: CircleDot,
      };
    case TaskStatus.BLOCKED:
      return {
        pill: "bg-red-500/10 text-red-600 dark:text-red-400",
        iconColor: "text-red-500",
        icon: Circle,
      };
    default:
      return {
        pill: "bg-muted text-muted-foreground",
        iconColor: "text-muted-foreground",
        icon: Circle,
      };
  }
}

function priorityFlagClass(p: TaskPriority): string {
  switch (p) {
    case TaskPriority.HIGH:
      return "text-red-500";
    case TaskPriority.MEDIUM:
      return "text-amber-500";
    case TaskPriority.LOW:
      return "text-sky-500";
    default:
      return "text-muted-foreground/40";
  }
}

const GRID_COLS =
  "grid grid-cols-[minmax(0,1fr)_8.5rem_8.5rem_6rem] gap-4";

function taskToUpdatePayload(
  task: TaskRow,
  overrides: {
    assigneeIds?: string[];
    priority?: TaskPriority;
    dueDate?: Date | null;
    status?: TaskStatus;
  } = {},
) {
  return {
    taskId: task.id,
    projectId: task.projectId,
    title: task.title,
    description: task.description ?? null,
    assigneeIds: overrides.assigneeIds ?? task.assignees.map((a) => a.user.id),
    tagIds: task.tags.map((t) => t.tagId),
    vendorId: task.vendorId ?? null,
    priority: overrides.priority ?? task.priority,
    dueDate: overrides.dueDate !== undefined ? overrides.dueDate : task.dueDate,
    leadTimeDays: task.leadTimeDays,
    isApprovalRequired: task.isApprovalRequired,
    status: overrides.status ?? task.status,
  };
}

function applyTaskMutation(task: TaskRow, updated: TaskMutationResult): TaskRow {
  return {
    ...task,
    ...updated,
    checklistItems: task.checklistItems,
    comments: task.comments,
    attachments: task.attachments,
  };
}

/**
 * Picker Tahap: memilih KOLOM papan (termasuk kolom custom seperti "Revisi"),
 * bukan status enum. Status jadi kategori turunan kolom di server.
 */
function StagePicker({
  task,
  columns,
  readOnly,
  onStageChange,
}: {
  task: TaskRow;
  columns: RoomKanbanColumnDTO[];
  readOnly?: boolean;
  onStageChange: (task: TaskRow, columnId: string) => void;
}) {
  const currentColumnId = resolveColumnIdForTask(task, columns);
  const currentColumn = columns.find((c) => c.id === currentColumnId) ?? null;
  const style = statusGroupStyle(
    currentColumn ? statusForColumn(currentColumn) : task.status,
  );
  const StatusIcon = style.icon;

  if (readOnly) {
    return (
      <StatusIcon
        className={cn("size-4 shrink-0", style.iconColor)}
        aria-hidden
      />
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        type="button"
        className="hover:bg-muted/60 inline-flex shrink-0 items-center justify-center rounded p-0.5 transition-colors"
        aria-label={`Ubah tahap: ${currentColumn?.title ?? taskStatusLabel(task.status)}`}
        onClick={(e) => e.stopPropagation()}
      >
        <StatusIcon className={cn("size-4", style.iconColor)} aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-44">
        {columns
          // Lajur Overdue diisi otomatis oleh sistem — bukan tahap pilihan.
          .filter(
            (column) =>
              statusForColumn(column) !== TaskStatus.OVERDUE ||
              column.id === currentColumnId,
          )
          .map((column) => {
          const optStyle = statusGroupStyle(statusForColumn(column));
          const OptIcon = optStyle.icon;
          return (
            <DropdownMenuItem
              key={column.id}
              onClick={(e) => {
                e.stopPropagation();
                if (column.id !== currentColumnId) onStageChange(task, column.id);
              }}
            >
              <OptIcon className={cn("size-4", optStyle.iconColor)} aria-hidden />
              <span className="flex-1">{column.title}</span>
              {currentColumnId === column.id ? (
                <Check className="text-primary size-4" aria-hidden />
              ) : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AssigneePicker({
  task,
  users,
  readOnly,
  onAssigneesChange,
}: {
  task: TaskRow;
  users: Pick<User, "id" | "name" | "email">[];
  readOnly?: boolean;
  onAssigneesChange: (task: TaskRow, assigneeIds: string[]) => void;
}) {
  const assignees = task.assignees.map((a) => a.user);
  const selectedIds = assignees.map((a) => a.id);

  const display = (() => {
    if (assignees.length === 0) {
      return (
        <span className="text-muted-foreground/50 inline-flex items-center justify-center">
          <UserPlus className="size-4" aria-hidden />
        </span>
      );
    }
    const a = assignees[0]!;
    const label = a.name ?? a.email;
    const initial = label.slice(0, 1).toUpperCase();
    return (
      <div className="flex items-center justify-center gap-1">
        {a.image ? (
          <Image
            src={a.image}
            alt=""
            width={24}
            height={24}
            className="border-border size-6 rounded-full border object-cover"
            unoptimized
          />
        ) : (
          <div
            className="border-border bg-muted text-muted-foreground flex size-6 items-center justify-center rounded-full border text-[10px] font-semibold"
            aria-hidden
          >
            {initial}
          </div>
        )}
        {assignees.length > 1 ? (
          <span className="text-muted-foreground text-[10px] font-medium">
            +{assignees.length - 1}
          </span>
        ) : null}
      </div>
    );
  })();

  if (readOnly) {
    return <div className="inline-flex justify-self-center">{display}</div>;
  }

  return (
    <Popover>
      <PopoverTrigger
        type="button"
        className="hover:bg-muted/60 inline-flex shrink-0 items-center justify-center justify-self-center rounded px-1 py-1 transition-colors"
        aria-label="Ubah PIC"
        onClick={(e) => e.stopPropagation()}
      >
        {display}
      </PopoverTrigger>
      <PopoverContent align="center" className="w-56 p-2" onClick={(e) => e.stopPropagation()}>
        <p className="text-muted-foreground mb-2 px-1 text-xs font-medium">PIC</p>
        <div className="max-h-48 space-y-1 overflow-auto">
          {users.map((u) => {
            const checked = selectedIds.includes(u.id);
            return (
              <label
                key={u.id}
                className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 rounded-md px-1 py-1.5 text-sm"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) => {
                    const next = v === true;
                    const nextIds = next
                      ? [...selectedIds, u.id]
                      : selectedIds.filter((id) => id !== u.id);
                    onAssigneesChange(task, nextIds);
                  }}
                />
                <span className="truncate">{u.name ?? u.email}</span>
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function DueDatePicker({
  task,
  readOnly,
  onDueDateChange,
}: {
  task: TaskRow;
  readOnly?: boolean;
  onDueDateChange: (task: TaskRow, dueDate: Date | null) => void;
}) {
  const value = task.dueDate ? task.dueDate.toISOString().slice(0, 10) : "";

  const display = task.dueDate ? (
    <span className="text-muted-foreground text-xs tabular-nums">
      {task.dueDate.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
      })}
    </span>
  ) : (
    <span className="text-muted-foreground/50 inline-flex items-center justify-center">
      <Calendar className="size-4" aria-hidden />
    </span>
  );

  if (readOnly) {
    return <div className="inline-flex justify-self-center">{display}</div>;
  }

  return (
    <Popover>
      <PopoverTrigger
        type="button"
        className="hover:bg-muted/60 inline-flex shrink-0 items-center justify-center justify-self-center rounded px-1 py-1 transition-colors"
        aria-label="Ubah deadline"
        onClick={(e) => e.stopPropagation()}
      >
        {display}
      </PopoverTrigger>
      <PopoverContent align="center" className="w-52 p-3" onClick={(e) => e.stopPropagation()}>
        <p className="text-muted-foreground mb-2 text-xs font-medium">Deadline</p>
        <Input
          type="date"
          value={value}
          onChange={(e) => {
            const raw = e.target.value;
            onDueDateChange(task, raw ? new Date(raw) : null);
          }}
        />
        {task.dueDate ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2 w-full"
            onClick={() => onDueDateChange(task, null)}
          >
            Hapus deadline
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function PriorityPicker({
  task,
  readOnly,
  onPriorityChange,
}: {
  task: TaskRow;
  readOnly?: boolean;
  onPriorityChange: (task: TaskRow, priority: TaskPriority) => void;
}) {
  const display = (
    <span
      className={cn("inline-flex items-center justify-center", priorityFlagClass(task.priority))}
      title={priorityLabel(task.priority)}
    >
      <Flag className="size-4 fill-current" aria-hidden />
    </span>
  );

  if (readOnly) {
    return <div className="inline-flex justify-self-center">{display}</div>;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        type="button"
        className="hover:bg-muted/60 inline-flex shrink-0 items-center justify-center justify-self-center rounded px-1 py-1 transition-colors"
        aria-label={`Ubah prioritas: ${priorityLabel(task.priority)}`}
        onClick={(e) => e.stopPropagation()}
      >
        {display}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        {(Object.values(TaskPriority) as TaskPriority[]).map((p) => (
          <DropdownMenuItem
            key={p}
            onClick={(e) => {
              e.stopPropagation();
              if (p !== task.priority) onPriorityChange(task, p);
            }}
          >
            <Flag
              className={cn("size-4 fill-current", priorityFlagClass(p))}
              aria-hidden
            />
            <span className="flex-1">{priorityLabel(p)}</span>
            {task.priority === p ? (
              <Check className="text-primary size-4" aria-hidden />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TaskListRow({
  task,
  columns,
  users,
  canEditAssignees,
  readOnly,
  onTaskClick,
  onStageChange,
  onAssigneesChange,
  onDueDateChange,
  onPriorityChange,
}: {
  task: TaskRow;
  columns: RoomKanbanColumnDTO[];
  users: Pick<User, "id" | "name" | "email">[];
  canEditAssignees: boolean;
  readOnly?: boolean;
  onTaskClick: (task: TaskRow) => void;
  onStageChange: (task: TaskRow, columnId: string) => void;
  onAssigneesChange: (task: TaskRow, assigneeIds: string[]) => void;
  onDueDateChange: (task: TaskRow, dueDate: Date | null) => void;
  onPriorityChange: (task: TaskRow, priority: TaskPriority) => void;
}) {
  const metaPickers = (
    <>
      <AssigneePicker
        task={task}
        users={users}
        readOnly={readOnly || !canEditAssignees}
        onAssigneesChange={onAssigneesChange}
      />
      <DueDatePicker
        task={task}
        readOnly={readOnly}
        onDueDateChange={onDueDateChange}
      />
      <PriorityPicker
        task={task}
        readOnly={readOnly}
        onPriorityChange={onPriorityChange}
      />
    </>
  );

  return (
    <li className="border-border/30 border-b last:border-b-0">
      {/* HP: judul full-width, metadata di baris kedua */}
      <div className="hover:bg-muted/20 flex flex-col gap-2 px-0.5 py-2.5 transition-colors sm:hidden">
        <div className="flex min-w-0 items-start gap-1.5">
          <StagePicker
            task={task}
            columns={columns}
            readOnly={readOnly}
            onStageChange={onStageChange}
          />
          <button
            type="button"
            onClick={() => onTaskClick(task)}
            className="hover:text-primary min-w-0 flex-1 text-left text-sm leading-snug break-words transition-colors"
          >
            {task.title}
          </button>
        </div>
        <div className="flex items-center gap-5 pl-6">{metaPickers}</div>
      </div>

      {/* Desktop: tabel kolom */}
      <div
        className={cn(
          GRID_COLS,
          "hover:bg-muted/20 hidden items-center py-1.5 transition-colors sm:grid",
        )}
      >
        <div className="flex min-w-0 items-center gap-1.5 pl-3">
          <StagePicker
            task={task}
            columns={columns}
            readOnly={readOnly}
            onStageChange={onStageChange}
          />
          <button
            type="button"
            onClick={() => onTaskClick(task)}
            className="hover:text-primary min-w-0 flex-1 truncate text-left text-sm transition-colors"
          >
            {task.title}
          </button>
        </div>
        {metaPickers}
      </div>
    </li>
  );
}

function StatusGroup({
  column,
  tasks,
  collapsed,
  columns,
  users,
  canEditAssignees,
  onToggle,
  onTaskClick,
  onAddTask,
  onStageChange,
  onAssigneesChange,
  onDueDateChange,
  onPriorityChange,
  readOnly,
}: {
  column: RoomKanbanColumnDTO;
  tasks: TaskRow[];
  collapsed: boolean;
  columns: RoomKanbanColumnDTO[];
  users: Pick<User, "id" | "name" | "email">[];
  canEditAssignees: boolean;
  onToggle: () => void;
  onTaskClick: (task: TaskRow) => void;
  onAddTask?: (columnId: string) => void;
  onStageChange: (task: TaskRow, columnId: string) => void;
  onAssigneesChange: (task: TaskRow, assigneeIds: string[]) => void;
  onDueDateChange: (task: TaskRow, dueDate: Date | null) => void;
  onPriorityChange: (task: TaskRow, priority: TaskPriority) => void;
  readOnly?: boolean;
}) {
  const style = statusGroupStyle(statusForColumn(column));
  const StatusIcon = style.icon;

  return (
    <section className="mb-1">
      <div className="flex items-center gap-1 px-1 sm:px-0">
        <button
          type="button"
          onClick={onToggle}
          className="hover:bg-muted/30 flex min-w-0 flex-1 items-center gap-2 rounded-md py-2 text-left transition-colors"
          aria-expanded={!collapsed}
        >
          {collapsed ? (
            <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden />
          ) : (
            <ChevronDown className="text-muted-foreground size-4 shrink-0" aria-hidden />
          )}
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase",
              style.pill,
            )}
          >
            <StatusIcon className="size-3.5 shrink-0" aria-hidden />
            {column.title}
          </span>
          <span className="text-muted-foreground text-xs font-medium tabular-nums">
            {tasks.length}
          </span>
        </button>
        {onAddTask && !readOnly ? (
          <button
            type="button"
            onClick={() => onAddTask(column.id)}
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex size-6 shrink-0 items-center justify-center rounded-full transition-colors"
            aria-label={`Tambah tugas ${column.title}`}
          >
            <Plus className="size-3.5" aria-hidden />
          </button>
        ) : null}
      </div>

      {!collapsed ? (
        <div className="pl-3 sm:pl-6">
          <div
            className={cn(
              GRID_COLS,
              "text-muted-foreground mb-0.5 hidden items-center px-1 py-1.5 text-[11px] font-medium sm:grid sm:px-0",
            )}
          >
            <span className="pl-3">Nama</span>
            <span className="text-center">PIC</span>
            <span className="text-center">Deadline</span>
            <span className="text-center">Prioritas</span>
          </div>

          {tasks.length > 0 ? (
            <ul>
              {tasks.map((task) => (
                <TaskListRow
                  key={task.id}
                  task={task}
                  columns={columns}
                  users={users}
                  canEditAssignees={canEditAssignees}
                  readOnly={readOnly}
                  onTaskClick={onTaskClick}
                  onStageChange={onStageChange}
                  onAssigneesChange={onAssigneesChange}
                  onDueDateChange={onDueDateChange}
                  onPriorityChange={onPriorityChange}
                />
              ))}
            </ul>
          ) : null}

          {onAddTask && !readOnly ? (
            <button
              type="button"
              onClick={() => onAddTask(column.id)}
              className="text-muted-foreground hover:bg-muted/30 hover:text-foreground flex w-full items-center gap-2 rounded-md px-1 py-2 text-sm transition-colors sm:px-0"
            >
              <Plus className="size-4 shrink-0" aria-hidden />
              Tambah tugas
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export function TasksList({
  tasks,
  columns,
  users,
  isRoomManager,
  onTaskClick,
  onTaskPatched,
  onAddTask,
  readOnly = false,
  empty = "Belum ada tugas.",
}: {
  tasks: TaskRow[];
  columns: RoomKanbanColumnDTO[];
  users: Pick<User, "id" | "name" | "email">[];
  isRoomManager: boolean;
  onTaskClick: (task: TaskRow) => void;
  onTaskPatched?: (taskId: string, patch: Partial<TaskRow>) => void;
  onAddTask?: (columnId: string) => void;
  readOnly?: boolean;
  empty?: string;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [doneConfirmTaskId, setDoneConfirmTaskId] = useState<string | null>(null);
  const [doneConfirmUnfinished, setDoneConfirmUnfinished] = useState(0);
  const [doneConfirmColumnId, setDoneConfirmColumnId] = useState<string | null>(
    null,
  );

  const groups = useMemo(() => {
    return columns.map((col) => {
      const colTasks = tasks
        .filter(
          (task) =>
            resolveColumnIdForTask(task, columns) === col.id,
        )
        .map((task) => ({
          ...task,
          // Samakan dengan hasil resolusi — task yang jatuh ke kolom ini via
          // fallback status tidak boleh hilang saat disortir per kolom.
          kanbanColumnId: col.id,
          kanbanSortKey:
            task.kanbanPositions?.find((p) => p.columnId === col.id)?.sortKey ??
            null,
        }));
      return {
        column: col,
        tasks: sortTasksForKanbanColumn(colTasks, col.id),
      };
    });
  }, [tasks, columns]);

  // Grup darurat: hanya untuk task yang benar-benar tak terpetakan ke kolom
  // mana pun (papan kosong). Dengan kolom inti selalu ada, praktis tak muncul.
  const extraStatuses = useMemo(() => {
    const extras = new Map<TaskStatus, TaskRow[]>();
    for (const task of tasks) {
      if (resolveColumnIdForTask(task, columns) != null) continue;
      const list = extras.get(task.status) ?? [];
      list.push(task);
      extras.set(task.status, list);
    }
    return [...extras.entries()].map(([status, statusTasks]) => ({
      column: {
        id: `extra-${status}`,
        kind: "CUSTOM" as const,
        coreRole: null,
        linkedStatus: status,
        title: taskStatusLabel(status),
        sortOrder: 999,
      } satisfies RoomKanbanColumnDTO,
      tasks: sortTasksForKanbanStatus(statusTasks, status),
    }));
  }, [tasks, columns]);

  const allGroups = [...groups, ...extraStatuses];

  const persistStageChange = useCallback(
    async (task: TaskRow, columnId: string) => {
      const targetColumn = columns.find((c) => c.id === columnId);
      if (!targetColumn) return;
      const bucket = statusForColumn(targetColumn);
      const previousStatus = task.status;
      const previousColumnId = task.kanbanColumnId ?? null;
      onTaskPatched?.(task.id, { status: bucket, kanbanColumnId: columnId });
      try {
        if (columnId.startsWith("fallback-")) {
          // Papan fallback klien (kolom belum dimuat) — jalur status legacy.
          await moveTaskStatus({ taskId: task.id, status: bucket });
        } else {
          await moveTaskToColumn({ taskId: task.id, columnId });
        }
        toast.success(
          bucket === TaskStatus.DONE
            ? "Tugas dipindahkan ke Selesai."
            : `Tugas dipindahkan ke "${targetColumn.title}".`,
        );
      } catch (err) {
        onTaskPatched?.(task.id, {
          status: previousStatus,
          kanbanColumnId: previousColumnId,
        });
        toast.error(
          actionErrorMessage(
            err,
            bucket === TaskStatus.DONE
              ? "Gagal memindahkan tugas ke Selesai."
              : "Gagal memindahkan tugas.",
          ),
        );
      }
    },
    [columns, onTaskPatched],
  );

  const handleStageChange = useCallback(
    (task: TaskRow, columnId: string) => {
      if (readOnly) return;
      const targetColumn = columns.find((c) => c.id === columnId);
      if (!targetColumn) return;
      if (statusForColumn(targetColumn) === TaskStatus.DONE) {
        const unfinished = task.checklistItems.filter((c) => !c.done).length;
        if (unfinished > 0) {
          setDoneConfirmTaskId(task.id);
          setDoneConfirmUnfinished(unfinished);
          setDoneConfirmColumnId(columnId);
          return;
        }
      }
      void persistStageChange(task, columnId);
    },
    [columns, persistStageChange, readOnly],
  );

  const persistFieldUpdate = useCallback(
    async (
      task: TaskRow,
      overrides: Parameters<typeof taskToUpdatePayload>[1],
      rollback: Partial<TaskRow>,
      successMsg: string,
      errorMsg: string,
    ) => {
      onTaskPatched?.(task.id, overrides as Partial<TaskRow>);
      try {
        const updated = await updateTask(taskToUpdatePayload(task, overrides));
        onTaskPatched?.(task.id, applyTaskMutation(task, updated));
        toast.success(successMsg);
      } catch (err) {
        onTaskPatched?.(task.id, rollback);
        toast.error(actionErrorMessage(err, errorMsg));
      }
    },
    [onTaskPatched],
  );

  const handleAssigneesChange = useCallback(
    async (task: TaskRow, assigneeIds: string[]) => {
      if (readOnly || !isRoomManager) return;
      const prevAssignees = task.assignees;
      const userById = new Map(users.map((u) => [u.id, u]));
      const nextAssignees = assigneeIds
        .map((id) => userById.get(id))
        .filter(Boolean)
        .map((user) => ({
          user: {
            id: user!.id,
            name: user!.name,
            email: user!.email,
            image:
              task.assignees.find((a) => a.user.id === user!.id)?.user.image ?? null,
          },
        }));
      onTaskPatched?.(task.id, { assignees: nextAssignees });
      try {
        const updated = await updateTask(
          taskToUpdatePayload(task, { assigneeIds }),
        );
        onTaskPatched?.(task.id, applyTaskMutation(task, updated));
        toast.success("PIC diperbarui.");
      } catch (err) {
        onTaskPatched?.(task.id, { assignees: prevAssignees });
        toast.error(actionErrorMessage(err, "Gagal memperbarui PIC."));
      }
    },
    [isRoomManager, onTaskPatched, readOnly, users],
  );

  const handleDueDateChange = useCallback(
    (task: TaskRow, dueDate: Date | null) => {
      if (readOnly) return;
      void persistFieldUpdate(
        task,
        { dueDate },
        { dueDate: task.dueDate },
        dueDate ? "Deadline diperbarui." : "Deadline dihapus.",
        "Gagal memperbarui deadline.",
      );
    },
    [persistFieldUpdate, readOnly],
  );

  const handlePriorityChange = useCallback(
    (task: TaskRow, priority: TaskPriority) => {
      if (readOnly) return;
      void persistFieldUpdate(
        task,
        { priority },
        { priority: task.priority },
        "Prioritas diperbarui.",
        "Gagal memperbarui prioritas.",
      );
    },
    [persistFieldUpdate, readOnly],
  );

  if (allGroups.length === 0) {
    return (
      <p className="text-muted-foreground px-4 py-10 text-center text-sm">{empty}</p>
    );
  }

  return (
    <>
      <div className="flex flex-col">
        {allGroups.map(({ column, tasks: groupTasks }) => (
          <StatusGroup
            key={column.id}
            column={column}
            tasks={groupTasks}
            collapsed={collapsed[column.id] ?? false}
            columns={columns}
            users={users}
            canEditAssignees={isRoomManager}
            onToggle={() =>
              setCollapsed((prev) => ({
                ...prev,
                [column.id]: !prev[column.id],
              }))
            }
            onTaskClick={onTaskClick}
            onAddTask={onAddTask}
            onStageChange={handleStageChange}
            onAssigneesChange={handleAssigneesChange}
            onDueDateChange={handleDueDateChange}
            onPriorityChange={handlePriorityChange}
            readOnly={readOnly}
          />
        ))}
      </div>

      <Dialog
        open={doneConfirmTaskId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDoneConfirmTaskId(null);
            setDoneConfirmUnfinished(0);
            setDoneConfirmColumnId(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sub-tugas belum selesai</DialogTitle>
            <DialogDescription>
              Masih ada {doneConfirmUnfinished} sub-tugas yang belum selesai. Tetap tandai
              tugas ini sebagai Selesai?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDoneConfirmTaskId(null);
                setDoneConfirmUnfinished(0);
                setDoneConfirmColumnId(null);
              }}
            >
              Batalkan
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!doneConfirmTaskId || doneConfirmColumnId === null) return;
                const task = tasks.find((t) => t.id === doneConfirmTaskId);
                if (!task) return;
                const targetColumnId = doneConfirmColumnId;
                setDoneConfirmTaskId(null);
                setDoneConfirmUnfinished(0);
                setDoneConfirmColumnId(null);
                void persistStageChange(task, targetColumnId);
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
