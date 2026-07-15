"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  getFirstCollision,
  pointerWithin,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TaskPriority, TaskStatus, type User } from "@prisma/client";
import {
  addChecklistItem,
  archiveTask,
  createTaskTag,
  moveTaskToColumn,
  reorderKanbanColumn,
  unarchiveTask,
  updateTask,
  type TaskMutationResult,
} from "@/actions/tasks";
import { toast } from "sonner";
import { actionErrorMessage } from "@/lib/action-error-message";
import { sortTasksForKanbanColumn } from "@/lib/kanban-sort";
import { cn } from "@/lib/utils";
import {
  mergeKanbanColumns,
  DEFAULT_KANBAN_COLUMN_COLOR,
  kanbanColumnAccent,
  type RoomKanbanColumnDTO,
  resolveColumnIdForTask,
  statusForColumn,
} from "@/lib/room-kanban-columns";
import { KanbanColumnColorField } from "@/components/tasks/kanban-column-color-field";
import {
  addCustomKanbanColumn,
  addSimpleHubCustomKanbanColumn,
  deleteCustomKanbanColumn,
  reorderRoomKanbanColumns,
  reorderSimpleHubKanbanColumns,
  updateRoomKanbanColumn,
} from "@/actions/room-kanban-columns";
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
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Archive,
  CalendarDays,
  Check,
  Flag,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Tag,
  Trash2,
  UserRound,
} from "lucide-react";
import { TaskChecklistPopover } from "@/components/tasks/task-checklist-popover";

export type KanbanTask = {
  id: string;
  projectId: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  description: string | null;
  isApprovalRequired: boolean;
  vendorId: string | null;
  leadTimeDays: number | null;
  checklistTotal: number;
  checklistDone: number;
  checklistItems: { id: string; title: string; done: boolean }[];
  project: { name: string; brand: { name: string } };
  assignees: {
    id: string;
    image: string | null;
    name: string | null;
    email: string;
  }[];
  tagIds: string[];
  tags: { id: string; name: string; colorHex: string }[];
  createdAt: string;
  updatedAt: string;
  kanbanColumnId?: string | null;
  kanbanSortKey?: number | null;
};

type RoomTaskTag = {
  id: string;
  name: string;
  colorHex: string;
  roomId?: string;
};

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

function priorityFlagClass(p: TaskPriority): string {
  switch (p) {
    case TaskPriority.HIGH:
      return "text-rose-500";
    case TaskPriority.MEDIUM:
      return "text-amber-500";
    case TaskPriority.LOW:
      return "text-sky-500";
    default:
      return "text-muted-foreground";
  }
}

function kanbanTaskToUpdatePayload(
  task: KanbanTask,
  overrides: {
    title?: string;
    assigneeIds?: string[];
    tagIds?: string[];
    priority?: TaskPriority;
    dueDate?: Date | null;
  } = {},
) {
  return {
    taskId: task.id,
    projectId: task.projectId,
    title: overrides.title ?? task.title,
    description: task.description,
    assigneeIds:
      overrides.assigneeIds ?? task.assignees.map((a) => a.id),
    tagIds: overrides.tagIds ?? task.tagIds,
    vendorId: task.vendorId,
    priority: overrides.priority ?? task.priority,
    dueDate:
      overrides.dueDate !== undefined
        ? overrides.dueDate
        : task.dueDate
          ? new Date(task.dueDate)
          : null,
    leadTimeDays: task.leadTimeDays,
    isApprovalRequired: task.isApprovalRequired,
    status: task.status,
  };
}

function applyKanbanPatch(
  task: KanbanTask,
  updated: TaskMutationResult,
): Partial<KanbanTask> {
  return {
    title: updated.title,
    priority: updated.priority,
    dueDate: updated.dueDate ? updated.dueDate.toISOString() : null,
    assignees: updated.assignees.map((a) => ({
      id: a.user.id,
      image: a.user.image ?? null,
      name: a.user.name,
      email: a.user.email,
    })),
    tagIds: updated.tags.map((t) => t.tagId),
    tags: updated.tags.map((t) => ({
      id: t.tag.id,
      name: t.tag.name,
      colorHex: t.tag.colorHex,
    })),
  };
}

const ASSIGNEE_AVATAR_COLORS = [
  "bg-rose-500",
  "bg-violet-500",
  "bg-sky-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-fuchsia-500",
] as const;

function assigneeAvatarColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash + id.charCodeAt(i)) % 997;
  return ASSIGNEE_AVATAR_COLORS[hash % ASSIGNEE_AVATAR_COLORS.length]!;
}

function assigneeInitials(assignee: KanbanTask["assignees"][number]) {
  const name = assignee.name?.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  return assignee.email.slice(0, 2).toUpperCase();
}

function formatDueDateChip(
  dueDate: string,
  isDone: boolean,
): { label: string; tone: string } {
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueStart = new Date(due);
  dueStart.setHours(0, 0, 0, 0);
  const diffDays = Math.floor(
    (dueStart.getTime() - today.getTime()) / 86_400_000,
  );

  let label: string;
  if (!isDone && diffDays < 0) {
    // Badge telat — Overdue bukan lagi kolom; kartu tetap di tahapnya.
    label =
      diffDays >= -7
        ? `Telat ${Math.abs(diffDays)} hari`
        : `Telat sejak ${due.toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
          })}`;
  } else if (diffDays === 0) label = "Hari ini";
  else if (diffDays === 1) label = "Besok";
  else if (diffDays === -1) label = "Kemarin";
  else if (diffDays > 1 && diffDays <= 7) label = `${diffDays} hari lagi`;
  else if (diffDays < -1 && diffDays >= -7) label = `${Math.abs(diffDays)} hari lalu`;
  else {
    label = due.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
    });
  }

  let tone = "text-muted-foreground";
  if (!isDone) {
    if (diffDays < 0) tone = "text-rose-600 dark:text-rose-400";
    else if (diffDays <= 3) tone = "text-amber-600 dark:text-amber-400";
  }

  return { label, tone };
}

function metaChipClass(className?: string) {
  return cn(
    "border-border/70 bg-background hover:bg-muted/40 inline-flex h-6 max-w-full shrink-0 items-center gap-1 rounded-full border px-1.5 text-[10px] font-medium transition-colors",
    className,
  );
}

function AssigneeAvatar({
  assignee,
  className,
}: {
  assignee: KanbanTask["assignees"][number];
  className?: string;
}) {
  const initials = assigneeInitials(assignee);
  if (assignee.image) {
    return (
      <Image
        src={assignee.image}
        alt=""
        width={18}
        height={18}
        className={cn("size-[18px] rounded-full object-cover", className)}
        unoptimized
      />
    );
  }
  return (
    <span
      className={cn(
        "text-background flex size-[18px] items-center justify-center rounded-full text-[7px] font-bold",
        assigneeAvatarColor(assignee.id),
        className,
      )}
      aria-hidden
    >
      {initials}
    </span>
  );
}

function DraggableTask({
  task,
  users,
  roomTaskTags,
  roomId,
  onTaskClick,
  onQuickDone,
  onTaskPatched,
  onTagCreated,
  dragDisabled,
  isRoomManager,
  showArchived,
}: {
  task: KanbanTask;
  users: Pick<User, "id" | "name" | "email">[];
  roomTaskTags: RoomTaskTag[];
  roomId?: string | null;
  onTaskClick?: (taskId: string) => void;
  onQuickDone?: (taskId: string) => Promise<void>;
  onTaskPatched?: (taskId: string, patch: Partial<KanbanTask>) => void;
  onTagCreated?: (tag: RoomTaskTag & { roomId: string }) => void;
  dragDisabled?: boolean;
  isRoomManager?: boolean;
  showArchived?: boolean;
}) {
  const router = useRouter();
  const [quickPending, setQuickPending] = useState(false);
  const [archivePending, setArchivePending] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState(task.title);
  const [subtaskOpen, setSubtaskOpen] = useState(false);
  const [subtaskDraft, setSubtaskDraft] = useState("");
  const [subtaskPending, setSubtaskPending] = useState(false);
  const [metaPending, setMetaPending] = useState(false);
  const [cardHovered, setCardHovered] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColorHex, setNewTagColorHex] = useState("#6B7280");
  const [createTagPending, setCreateTagPending] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, disabled: dragDisabled });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const readOnly = Boolean(dragDisabled);
  const canEditAssignees = isRoomManager && !readOnly;
  const canQuickDone = task.status !== TaskStatus.DONE && !showArchived && !readOnly;
  const canArchive =
    isRoomManager &&
    !showArchived &&
    task.status === TaskStatus.DONE;
  const canUnarchive = isRoomManager && showArchived;

  useEffect(() => {
    setRenameDraft(task.title);
  }, [task.title]);

  async function patchTask(
    overrides: Parameters<typeof kanbanTaskToUpdatePayload>[1],
  ) {
    if (readOnly) return;
    setMetaPending(true);
    try {
      const updated = await updateTask(kanbanTaskToUpdatePayload(task, overrides));
      const patch = applyKanbanPatch(task, updated);
      onTaskPatched?.(task.id, patch);
      toast.success("Tugas diperbarui.");
    } catch (e) {
      toast.error(actionErrorMessage(e, "Gagal memperbarui tugas."));
    } finally {
      setMetaPending(false);
    }
  }

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
        actionErrorMessage(err, "Gagal mengarsipkan tugas.");
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
        actionErrorMessage(err, "Gagal memulihkan tugas.");
      toast.error(msg);
    } finally {
      setArchivePending(false);
    }
  }

  async function handleRename() {
    const next = renameDraft.trim();
    if (!next || next === task.title) {
      setRenameOpen(false);
      return;
    }
    await patchTask({ title: next });
    setRenameOpen(false);
  }

  async function handleCreateTag() {
    if (!roomId || !newTagName.trim() || !isRoomManager || createTagPending) return;
    setCreateTagPending(true);
    try {
      const created = await createTaskTag({
        roomId,
        name: newTagName.trim(),
        colorHex: newTagColorHex,
      });
      onTagCreated?.(created);
      setNewTagName("");
      const nextIds = task.tagIds.includes(created.id)
        ? task.tagIds
        : [...task.tagIds, created.id];
      await patchTask({ tagIds: nextIds });
    } catch (e) {
      toast.error(actionErrorMessage(e, "Gagal membuat tag."));
    } finally {
      setCreateTagPending(false);
    }
  }

  async function handleAddSubtask() {
    const title = subtaskDraft.trim();
    if (!title || subtaskPending) return;
    setSubtaskPending(true);
    try {
      await addChecklistItem(task.id, title);
      setSubtaskDraft("");
      setSubtaskOpen(false);
      toast.success("Sub-tugas ditambahkan.");
      router.refresh();
    } catch (e) {
      toast.error(actionErrorMessage(e, "Gagal menambah sub-tugas."));
    } finally {
      setSubtaskPending(false);
    }
  }

  const dueDateInfo = task.dueDate
    ? formatDueDateChip(task.dueDate, task.status === TaskStatus.DONE)
    : null;
  const visibleAssignees = task.assignees.slice(0, 3);
  const extraAssignees = Math.max(0, task.assignees.length - 3);

  const checklistPct =
    task.checklistTotal > 0
      ? Math.round((task.checklistDone / task.checklistTotal) * 100)
      : null;

  const stopDrag = (e: React.PointerEvent) => e.stopPropagation();
  const stopClick = (e: React.MouseEvent) => e.stopPropagation();

  const showHoverActions =
    cardHovered || renameOpen || subtaskOpen || tagOpen;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-card hover:border-primary/30 hover:shadow-md relative min-w-0 rounded-lg border border-border text-sm shadow-sm transition-shadow",
        !dragDisabled && "cursor-grab touch-none active:cursor-grabbing",
        isDragging && "z-10 opacity-70 ring-2 ring-primary",
      )}
      onMouseEnter={() => setCardHovered(true)}
      onMouseLeave={() => setCardHovered(false)}
      {...(dragDisabled ? {} : listeners)}
      {...(dragDisabled ? {} : attributes)}
    >
      <div className="relative p-2">
        <div className="relative">
          <button
            type="button"
            className="text-foreground hover:text-primary w-full text-left text-sm leading-snug font-medium break-words transition-colors"
            onClick={() => onTaskClick?.(task.id)}
          >
            {task.title}
          </button>

          {/* Hover actions — overlay di kanan judul, satu box */}
          <div
            className={cn(
              "border-border bg-background divide-border absolute top-0 right-0 z-10 flex flex-row items-center divide-x overflow-hidden rounded-md border shadow-sm transition-opacity duration-150",
              showHoverActions
                ? "pointer-events-auto opacity-100"
                : "pointer-events-none opacity-0",
            )}
            onPointerDown={stopDrag}
          >
          {canQuickDone ? (
            <button
              type="button"
              className="text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-950 inline-flex size-6 shrink-0 items-center justify-center transition-colors disabled:opacity-50"
              aria-label="Tandai selesai"
              disabled={quickPending}
              onClick={(e) => void handleQuickDone(e)}
            >
              <Check className="size-3.5" />
            </button>
          ) : null}
          {!readOnly ? (
            <Popover open={subtaskOpen} onOpenChange={setSubtaskOpen}>
              <PopoverTrigger
                type="button"
                className="text-muted-foreground hover:bg-muted inline-flex size-6 shrink-0 items-center justify-center transition-colors"
                aria-label="Tambah sub-tugas"
                onClick={stopClick}
              >
                <Plus className="size-3.5" />
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className="w-56 p-3"
                onClick={stopClick}
              >
                <p className="text-muted-foreground mb-2 text-xs font-medium">
                  Sub-tugas baru
                </p>
                <Input
                  value={subtaskDraft}
                  onChange={(e) => setSubtaskDraft(e.target.value)}
                  placeholder="Judul sub-tugas…"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleAddSubtask();
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  className="mt-2 w-full"
                  disabled={subtaskPending || !subtaskDraft.trim()}
                  onClick={() => void handleAddSubtask()}
                >
                  {subtaskPending ? "Menyimpan…" : "Tambah"}
                </Button>
              </PopoverContent>
            </Popover>
          ) : null}
          {!readOnly ? (
            <Popover open={renameOpen} onOpenChange={setRenameOpen}>
              <PopoverTrigger
                type="button"
                className="text-muted-foreground hover:bg-muted inline-flex size-6 shrink-0 items-center justify-center transition-colors"
                aria-label="Ubah nama tugas"
                onClick={stopClick}
              >
                <Pencil className="size-3.5" />
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className="w-64 p-3"
                onClick={stopClick}
              >
                <p className="text-muted-foreground mb-2 text-xs font-medium">
                  Ubah nama tugas
                </p>
                <Input
                  value={renameDraft}
                  onChange={(e) => setRenameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleRename();
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  className="mt-2 w-full"
                  disabled={metaPending || !renameDraft.trim()}
                  onClick={() => void handleRename()}
                >
                  Simpan
                </Button>
              </PopoverContent>
            </Popover>
          ) : null}
          {canArchive ? (
            <button
              type="button"
              className="text-muted-foreground hover:bg-muted inline-flex size-6 shrink-0 items-center justify-center transition-colors disabled:opacity-50"
              aria-label="Arsipkan tugas"
              disabled={archivePending}
              title="Arsipkan"
              onClick={(e) => void handleArchive(e)}
            >
              <Archive className="size-3.5" />
            </button>
          ) : null}
          {canUnarchive ? (
            <button
              type="button"
              className="text-muted-foreground hover:bg-muted inline-flex size-6 shrink-0 items-center justify-center transition-colors disabled:opacity-50"
              aria-label="Pulihkan dari arsip"
              disabled={archivePending}
              title="Pulihkan"
              onClick={(e) => void handleUnarchive(e)}
            >
              <RotateCcw className="size-3.5" />
            </button>
          ) : null}
          </div>
        </div>

        {/* Meta: PIC · Deadline · Prioritas · Tag */}
        <div className="mt-1.5 flex flex-col gap-1" onPointerDown={stopDrag}>
          <div className="flex min-w-0 flex-wrap items-center gap-1">
            {/* PIC */}
            <Popover>
              <PopoverTrigger
                type="button"
                className={metaChipClass(
                  task.assignees.length > 0 ? "pl-1" : "px-1.5",
                )}
                disabled={!canEditAssignees || metaPending}
                aria-label="Atur PIC"
                onPointerDown={stopDrag}
                onClick={stopClick}
              >
                {task.assignees.length > 0 ? (
                  <>
                    <span className="flex items-center">
                      <span className="flex -space-x-1">
                        {visibleAssignees.map((assignee) => (
                          <AssigneeAvatar
                            key={assignee.id}
                            assignee={assignee}
                            className="ring-background ring-1"
                          />
                        ))}
                      </span>
                      {extraAssignees > 0 ? (
                        <span className="text-muted-foreground ml-0.5 text-[9px] font-semibold">
                          +{extraAssignees}
                        </span>
                      ) : null}
                    </span>
                  </>
                ) : (
                  <UserRound className="text-muted-foreground size-3" />
                )}
              </PopoverTrigger>
              <PopoverContent align="start" className="w-56 p-2" onClick={stopClick}>
                <p className="text-muted-foreground mb-2 px-1 text-xs font-medium">
                  PIC
                </p>
                <div className="max-h-48 space-y-1 overflow-auto">
                  {users.map((u) => {
                    const checked = task.assignees.some((a) => a.id === u.id);
                    return (
                      <label
                        key={u.id}
                        className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 rounded-md px-1 py-1.5 text-sm"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            const next = v === true;
                            const ids = task.assignees.map((a) => a.id);
                            const nextIds = next
                              ? [...ids, u.id]
                              : ids.filter((id) => id !== u.id);
                            void patchTask({ assigneeIds: nextIds });
                          }}
                        />
                        <span className="truncate">{u.name ?? u.email}</span>
                      </label>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>

            {/* Deadline */}
            <Popover>
              <PopoverTrigger
                type="button"
                className={metaChipClass()}
                disabled={readOnly || metaPending}
                aria-label={
                  dueDateInfo
                    ? `Deadline: ${dueDateInfo.label}`
                    : "Atur deadline"
                }
                onPointerDown={stopDrag}
                onClick={stopClick}
              >
                <CalendarDays
                  className={cn(
                    "size-3 shrink-0",
                    dueDateInfo?.tone ?? "text-muted-foreground",
                  )}
                />
                {dueDateInfo ? (
                  <span className={cn("truncate", dueDateInfo.tone)}>
                    {dueDateInfo.label}
                  </span>
                ) : null}
              </PopoverTrigger>
              <PopoverContent align="start" className="w-52 p-3" onClick={stopClick}>
                <p className="text-muted-foreground mb-2 text-xs font-medium">
                  Deadline
                </p>
                <Input
                  type="date"
                  value={task.dueDate ? task.dueDate.slice(0, 10) : ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    void patchTask({
                      dueDate: raw ? new Date(raw) : null,
                    });
                  }}
                />
                {task.dueDate ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-2 w-full"
                    onClick={() => void patchTask({ dueDate: null })}
                  >
                    Hapus deadline
                  </Button>
                ) : null}
              </PopoverContent>
            </Popover>

            {/* Prioritas */}
            <DropdownMenu>
              <DropdownMenuTrigger
                type="button"
                className={metaChipClass()}
                disabled={readOnly || metaPending}
                aria-label={`Prioritas: ${priorityLabel(task.priority)}`}
                onPointerDown={stopDrag}
                onClick={stopClick}
              >
                <Flag
                  className={cn(
                    "size-3 shrink-0 fill-current",
                    priorityFlagClass(task.priority),
                  )}
                />
                <span className="text-foreground truncate">
                  {priorityLabel(task.priority)}
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-36">
                {(Object.values(TaskPriority) as TaskPriority[]).map((p) => (
                  <DropdownMenuItem
                    key={p}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (p !== task.priority) void patchTask({ priority: p });
                    }}
                  >
                    <Flag
                      className={cn("size-4 fill-current", priorityFlagClass(p))}
                    />
                    <span className="flex-1">{priorityLabel(p)}</span>
                    {task.priority === p ? (
                      <Check className="text-primary size-4" />
                    ) : null}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Tag */}
          <Popover open={tagOpen} onOpenChange={setTagOpen}>
            <PopoverTrigger
              type="button"
              className={metaChipClass("min-w-0 max-w-full")}
              disabled={readOnly || metaPending}
              aria-label="Atur tag"
              onPointerDown={stopDrag}
              onClick={stopClick}
            >
              <Tag className="text-muted-foreground size-3 shrink-0" />
              {task.tags.length > 0 ? (
                <span className="flex min-w-0 flex-wrap items-center gap-0.5">
                  {task.tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="inline-flex max-w-full items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium"
                      style={{
                        backgroundColor: `${tag.colorHex}22`,
                        color: tag.colorHex,
                      }}
                    >
                      <span className="truncate">{tag.name}</span>
                    </span>
                  ))}
                </span>
              ) : null}
            </PopoverTrigger>
            <PopoverContent align="start" className="w-56 p-2" onClick={stopClick}>
              {roomTaskTags.length > 0 ? (
                <div className="max-h-40 space-y-1 overflow-auto">
                  {roomTaskTags.map((tag) => {
                    const checked = task.tagIds.includes(tag.id);
                    return (
                      <label
                        key={tag.id}
                        className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 rounded-md px-1 py-1.5 text-sm"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            const next = v === true;
                            const ids = task.tagIds;
                            const nextIds = next
                              ? [...ids, tag.id]
                              : ids.filter((id) => id !== tag.id);
                            void patchTask({ tagIds: nextIds });
                          }}
                        />
                        <span
                          className="size-2.5 shrink-0 rounded-sm"
                          style={{ backgroundColor: tag.colorHex }}
                        />
                        <span className="truncate">{tag.name}</span>
                      </label>
                    );
                  })}
                </div>
              ) : null}
              {isRoomManager && roomId ? (
                <div
                  className={cn(
                    "flex flex-wrap items-center gap-1.5 rounded-md border border-dashed p-1.5",
                    roomTaskTags.length > 0 && "mt-2",
                  )}
                >
                  <Input
                    placeholder="Buat tag baru…"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    maxLength={40}
                    disabled={createTagPending}
                    className="h-7 min-w-0 flex-1 border-0 bg-transparent px-1 text-xs shadow-none focus-visible:ring-0"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleCreateTag();
                      }
                    }}
                  />
                  <Input
                    type="color"
                    value={newTagColorHex}
                    onChange={(e) =>
                      setNewTagColorHex(e.target.value.toUpperCase())
                    }
                    className="size-6 shrink-0 cursor-pointer border-0 p-0.5"
                    disabled={createTagPending}
                    title="Warna tag"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-7 shrink-0 px-2 text-xs"
                    disabled={createTagPending || !newTagName.trim()}
                    onClick={() => void handleCreateTag()}
                  >
                    <Plus className="size-3" />
                    {createTagPending ? "…" : "Buat"}
                  </Button>
                </div>
              ) : roomTaskTags.length === 0 ? (
                <p className="text-muted-foreground px-1 text-xs">
                  Belum ada tag di ruangan.
                </p>
              ) : null}
            </PopoverContent>
          </Popover>
        </div>

        {task.checklistTotal > 0 ? (
          <div className="mt-2 flex items-center gap-2" onPointerDown={stopDrag}>
            <div className="bg-muted/60 relative h-1 min-w-0 flex-1 overflow-hidden rounded-full">
              {checklistPct != null ? (
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
              ) : null}
            </div>
            <div onClick={stopClick}>
              <TaskChecklistPopover
                items={task.checklistItems}
                doneCount={task.checklistDone}
                totalCount={task.checklistTotal}
                contentAlign="end"
                triggerClassName="text-muted-foreground hover:text-foreground text-[10px] tabular-nums"
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function KanbanColumnShell({
  column,
  children,
  count,
  onAddTask,
  readOnly,
  isRoomManager,
  roomId,
  processKey,
  simpleHub,
  onColumnUpdated,
  onDeleted,
  onMoveColumn,
  canMoveUp,
  canMoveDown,
  stretch,
}: {
  column: RoomKanbanColumnDTO;
  children: React.ReactNode;
  count: number;
  onAddTask?: (columnId: string) => void;
  readOnly?: boolean;
  isRoomManager?: boolean;
  roomId?: string | null;
  processKey?: string;
  simpleHub?: boolean;
  onColumnUpdated?: (
    columnId: string,
    patch: { title?: string; colorHex?: string | null },
  ) => void;
  onDeleted?: (columnId: string) => void;
  onMoveColumn?: (columnId: string, direction: "up" | "down") => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  /** Kolom memenuhi lebar papan (≤6 kolom). */
  stretch?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const accent = kanbanColumnAccent(column);
  const [editOpen, setEditOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState(column.title);
  const [draftColorHex, setDraftColorHex] = useState(
    column.colorHex ?? DEFAULT_KANBAN_COLUMN_COLOR,
  );
  const [pending, setPending] = useState(false);
  const isCore = column.kind === "CORE";

  useEffect(() => {
    if (!editOpen) {
      setDraftTitle(column.title);
      setDraftColorHex(column.colorHex ?? DEFAULT_KANBAN_COLUMN_COLOR);
    }
  }, [column.title, column.colorHex, editOpen]);

  function openEditDialog() {
    setDraftTitle(column.title);
    setDraftColorHex(column.colorHex ?? DEFAULT_KANBAN_COLUMN_COLOR);
    setEditOpen(true);
  }

  async function saveColumnEdit() {
    const nextTitle = draftTitle.trim();
    if (!nextTitle) {
      toast.error("Nama kolom wajib diisi.");
      return;
    }
    if (!roomId || column.id.startsWith("fallback-")) return;

    const nextColor = draftColorHex.toUpperCase();
    const titleChanged = nextTitle !== column.title;
    const colorChanged =
      (column.colorHex ?? null)?.toUpperCase() !== nextColor;

    if (!titleChanged && !colorChanged) {
      setEditOpen(false);
      return;
    }

    setPending(true);
    try {
      await updateRoomKanbanColumn({
        columnId: column.id,
        ...(titleChanged ? { title: nextTitle } : {}),
        ...(colorChanged ? { colorHex: nextColor } : {}),
      });
      onColumnUpdated?.(column.id, {
        ...(titleChanged ? { title: nextTitle } : {}),
        ...(colorChanged ? { colorHex: nextColor } : {}),
      });
      setEditOpen(false);
      toast.success("Kolom diperbarui.");
    } catch (err) {
      toast.error(actionErrorMessage(err, "Gagal memperbarui kolom."));
    } finally {
      setPending(false);
    }
  }

  async function handleDelete() {
    if (!roomId || isCore) return;
    setPending(true);
    try {
      await deleteCustomKanbanColumn({ columnId: column.id });
      onDeleted?.(column.id);
      toast.success("Kolom dihapus.");
    } catch (err) {
      toast.error(actionErrorMessage(err, "Gagal menghapus kolom."));
    } finally {
      setPending(false);
    }
  }

  const stretchColumns = stretch ?? false;

  return (
    <>
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[320px] flex-col gap-2 rounded-xl border border-border bg-muted/10 p-2 transition-colors",
        stretchColumns
          ? "w-full min-w-0 lg:w-auto lg:flex-1 lg:basis-0"
          : "w-full min-w-0 lg:w-auto lg:min-w-[220px] lg:max-w-[320px] lg:shrink-0",
        isOver && !readOnly && "border-primary/60 bg-primary/5 ring-2 ring-primary/30",
      )}
    >
      <div
        className={cn(
          "border-border/60 bg-background/85 text-foreground flex items-center justify-between gap-1 rounded-lg border px-2 py-1.5 shadow-sm backdrop-blur-sm",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          {isRoomManager && !readOnly && !column.id.startsWith("fallback-") ? (
            <span className="text-muted-foreground cursor-grab active:cursor-grabbing shrink-0">
              <GripVertical className="size-3.5" />
            </span>
          ) : null}
          <span
            className={cn(
              "size-2 shrink-0 rounded-full ring-2",
              accent.dotClassName,
              accent.ringClassName,
            )}
            style={
              accent.colorHex ? { backgroundColor: accent.colorHex } : undefined
            }
            aria-hidden
          />
          <button
            type="button"
            className={cn(
              "text-foreground line-clamp-1 min-w-0 flex-1 text-left text-[11px] font-semibold tracking-wide uppercase",
              isRoomManager && !readOnly && "hover:underline",
            )}
            onClick={() => {
              if (isRoomManager && !readOnly) openEditDialog();
            }}
          >
            {column.title}
          </button>
          <span className="text-muted-foreground inline-flex shrink-0 items-center justify-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
            {count}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {onAddTask && !readOnly ? (
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              onClick={() => onAddTask(column.id)}
              aria-label={`Tambah tugas ${column.title}`}
            >
              <Plus className="size-3.5" />
            </Button>
          ) : null}
          {isRoomManager && !readOnly && !column.id.startsWith("fallback-") ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                type="button"
                className="text-muted-foreground hover:text-foreground inline-flex size-6 items-center justify-center rounded-md"
              >
                <MoreHorizontal className="size-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openEditDialog()}>
                  <Pencil className="size-3.5" />
                  Edit kolom
                </DropdownMenuItem>
                {canMoveUp ? (
                  <DropdownMenuItem onClick={() => onMoveColumn?.(column.id, "up")}>
                    <ArrowLeft className="size-3.5 hidden lg:block" />
                    <ArrowUp className="size-3.5 lg:hidden" />
                    <span className="hidden lg:inline">Geser kiri</span>
                    <span className="lg:hidden">Geser atas</span>
                  </DropdownMenuItem>
                ) : null}
                {canMoveDown ? (
                  <DropdownMenuItem onClick={() => onMoveColumn?.(column.id, "down")}>
                    <ArrowRight className="size-3.5 hidden lg:block" />
                    <ArrowDown className="size-3.5 lg:hidden" />
                    <span className="hidden lg:inline">Geser kanan</span>
                    <span className="lg:hidden">Geser bawah</span>
                  </DropdownMenuItem>
                ) : null}
                {!isCore ? (
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={count > 0 || pending}
                    onClick={() => void handleDelete()}
                  >
                    <Trash2 className="size-3.5" />
                    Hapus kolom
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">{children}</div>
    </div>

    <Dialog open={editOpen} onOpenChange={setEditOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit kolom</DialogTitle>
          <DialogDescription>
            Ubah nama dan warna aksen kolom di papan Kanban.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`column-title-${column.id}`}>Nama kolom</Label>
            <Input
              id={`column-title-${column.id}`}
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              maxLength={80}
              disabled={pending}
              onKeyDown={(e) => {
                if (e.key === "Enter") void saveColumnEdit();
              }}
            />
          </div>
          <KanbanColumnColorField
            value={draftColorHex}
            onChange={setDraftColorHex}
            disabled={pending}
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setEditOpen(false)}
            disabled={pending}
          >
            Batal
          </Button>
          <Button
            type="button"
            disabled={pending || !draftTitle.trim()}
            onClick={() => void saveColumnEdit()}
          >
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

export function TasksKanban({
  tasks,
  columns,
  users,
  roomTaskTags,
  roomId,
  onTaskClick,
  onAddTask,
  onTaskPatched,
  onTagCreated,
  kanbanReadOnly,
  isRoomManager,
  showArchived,
  processKey = "market-research",
  simpleHub = false,
  onColumnsChange,
  onKanbanColumnAdded,
  onKanbanColumnRemoved,
  addColumnOpen: addColumnOpenProp,
  onAddColumnOpenChange,
}: {
  tasks: KanbanTask[];
  columns: RoomKanbanColumnDTO[];
  users: Pick<User, "id" | "name" | "email">[];
  roomTaskTags: RoomTaskTag[];
  roomId?: string | null;
  onTaskClick?: (taskId: string) => void;
  onAddTask?: (columnId: string) => void;
  onTaskPatched?: (taskId: string, patch: Partial<KanbanTask>) => void;
  onTagCreated?: (tag: RoomTaskTag & { roomId: string }) => void;
  kanbanReadOnly?: boolean;
  isRoomManager?: boolean;
  showArchived?: boolean;
  processKey?: string;
  simpleHub?: boolean;
  onColumnsChange?: () => void;
  onKanbanColumnAdded?: (column: RoomKanbanColumnDTO) => void;
  onKanbanColumnRemoved?: (columnId: string) => void;
  addColumnOpen?: boolean;
  onAddColumnOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const [boardColumns, setBoardColumns] = useState(columns);
  const [localColumnIds, setLocalColumnIds] = useState<Record<string, string>>({});
  const [localStatuses, setLocalStatuses] = useState<Record<string, TaskStatus>>({});
  const [localSortKeys, setLocalSortKeys] = useState<Record<string, number>>({});
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [addColumnOpenInternal, setAddColumnOpenInternal] = useState(false);
  const addColumnOpen = addColumnOpenProp ?? addColumnOpenInternal;
  const setAddColumnOpen = onAddColumnOpenChange ?? setAddColumnOpenInternal;
  const [newColumnTitle, setNewColumnTitle] = useState("");
  const [newColumnColorHex, setNewColumnColorHex] = useState<string>(
    DEFAULT_KANBAN_COLUMN_COLOR,
  );
  /** Kategori pelaporan kolom baru: task di kolom ini dihitung sebagai apa. */
  const [newColumnBucket, setNewColumnBucket] = useState<
    typeof TaskStatus.IN_PROGRESS | typeof TaskStatus.IN_REVIEW | typeof TaskStatus.BLOCKED
  >(TaskStatus.IN_PROGRESS);
  const [addColumnPending, setAddColumnPending] = useState(false);
  const [doneConfirmTaskId, setDoneConfirmTaskId] = useState<string | null>(null);
  const [doneConfirmUnfinished, setDoneConfirmUnfinished] = useState(0);
  const [doneConfirmPreviousStatus, setDoneConfirmPreviousStatus] =
    useState<TaskStatus | null>(null);
  const [pendingTargetColumnId, setPendingTargetColumnId] = useState<string | null>(
    null,
  );
  const [pendingTargetOrder, setPendingTargetOrder] = useState<string[] | null>(
    null,
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );
  const kanbanBoardKeyRef = useRef(`${roomId ?? ""}:${processKey}`);
  const dragTargetColumnIdRef = useRef<string | null>(null);
  const columnIdSetRef = useRef(new Set<string>());

  useEffect(() => {
    const boardKey = `${roomId ?? ""}:${processKey}`;
    const boardChanged = kanbanBoardKeyRef.current !== boardKey;
    kanbanBoardKeyRef.current = boardKey;
    setBoardColumns((prev) => {
      if (boardChanged) {
        return mergeKanbanColumns(columns, []);
      }
      return mergeKanbanColumns(columns, prev);
    });
  }, [columns, roomId, processKey]);

  useEffect(() => {
    setLocalColumnIds((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const task of tasks) {
        const serverCol = resolveColumnIdForTask(task, boardColumns);
        if (next[task.id] !== undefined && next[task.id] === serverCol) {
          delete next[task.id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    setLocalStatuses((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const task of tasks) {
        if (next[task.id] !== undefined && next[task.id] === task.status) {
          delete next[task.id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    setLocalSortKeys((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const task of tasks) {
        if (next[task.id] === undefined) continue;
        const serverKey = task.kanbanSortKey;
        if (serverKey != null && next[task.id] === serverKey) {
          delete next[task.id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [tasks]);

  const viewTasks = useMemo(
    () =>
      tasks.map((t) => {
        const kanbanColumnId =
          localColumnIds[t.id] ?? resolveColumnIdForTask(t, boardColumns);
        const col = boardColumns.find((c) => c.id === kanbanColumnId);
        const status =
          localStatuses[t.id] ??
          (col ? statusForColumn(col) : t.status);
        const serverKey = t.kanbanSortKey ?? null;
        return {
          ...t,
          kanbanColumnId,
          status,
          kanbanSortKey: localSortKeys[t.id] ?? serverKey ?? null,
        };
      }),
    [tasks, localColumnIds, localStatuses, localSortKeys, boardColumns],
  );

  const columnIdSet = new Set(boardColumns.map((c) => c.id));
  columnIdSetRef.current = columnIdSet;

  const kanbanCollisionDetection = useCallback<CollisionDetection>((args) => {
    const columnIds = columnIdSetRef.current;
    const pointerHits = pointerWithin(args);
    const columnHit = pointerHits.find((hit) => columnIds.has(String(hit.id)));
    if (columnHit) return [columnHit];
    const firstPointer = getFirstCollision(pointerHits);
    if (firstPointer) return [firstPointer];
    return closestCorners(args);
  }, []);

  function resolveDropColumnId(overId: string): string | null {
    if (columnIdSet.has(overId)) return overId;
    const overTask = viewTasks.find((t) => t.id === overId);
    return overTask?.kanbanColumnId ?? null;
  }

  function filterIdsForPersistedColumn(ids: string[], columnId: string): string[] {
    return ids.filter((id) => {
      const row = viewTasks.find((t) => t.id === id);
      return row?.kanbanColumnId === columnId;
    });
  }

  function patchKanbanSortKeys(orderedIds: string[], columnId: string, status: TaskStatus) {
    orderedIds.forEach((id, index) => {
      onTaskPatched?.(id, {
        kanbanSortKey: index * 1000,
        kanbanColumnId: columnId,
        status,
      });
    });
  }

  function applyOptimisticSortKeys(orderedIds: string[]) {
    setLocalSortKeys((prev) => {
      const next = { ...prev };
      orderedIds.forEach((id, index) => {
        next[id] = index * 1000;
      });
      return next;
    });
  }

  async function persistColumnChange(
    taskId: string,
    targetColumnId: string,
    previousColumnId: string,
    previousStatus: TaskStatus,
    orderedTaskIdsInTarget?: string[],
  ) {
    const targetCol = boardColumns.find((c) => c.id === targetColumnId);
    const newStatus = targetCol ? statusForColumn(targetCol) : previousStatus;

    setLocalColumnIds((prev) => ({ ...prev, [taskId]: targetColumnId }));
    setLocalStatuses((prev) => ({ ...prev, [taskId]: newStatus }));
    if (orderedTaskIdsInTarget) {
      applyOptimisticSortKeys(orderedTaskIdsInTarget);
      patchKanbanSortKeys(orderedTaskIdsInTarget, targetColumnId, newStatus);
    } else {
      onTaskPatched?.(taskId, {
        status: newStatus,
        kanbanColumnId: targetColumnId,
      });
    }
    const successMsg =
      newStatus === TaskStatus.DONE
        ? "Tugas dipindahkan ke Selesai."
        : "Status tugas diperbarui.";
    const errFallback =
      newStatus === TaskStatus.DONE
        ? "Gagal memindahkan tugas ke Selesai."
        : "Gagal memindahkan tugas.";
    try {
      if (targetColumnId.startsWith("fallback-")) {
        throw new Error("Kolom tidak valid.");
      }
      await moveTaskToColumn({
        taskId,
        columnId: targetColumnId,
        orderedTaskIdsInTarget,
      });
      router.refresh();
      toast.success(successMsg);
    } catch (err) {
      setLocalColumnIds((prev) => ({ ...prev, [taskId]: previousColumnId }));
      setLocalStatuses((prev) => ({ ...prev, [taskId]: previousStatus }));
      onTaskPatched?.(taskId, {
        status: previousStatus,
        kanbanColumnId: previousColumnId,
      });
      if (orderedTaskIdsInTarget) setLocalSortKeys({});
      toast.error(actionErrorMessage(err, errFallback));
    }
  }

  async function handleAddColumn() {
    if (!roomId || !newColumnTitle.trim()) return;
    setAddColumnPending(true);
    try {
      const col = simpleHub
        ? await addSimpleHubCustomKanbanColumn({
            roomId,
            title: newColumnTitle.trim(),
            colorHex: newColumnColorHex,
            workflowBucket: newColumnBucket,
          })
        : await addCustomKanbanColumn({
            roomId,
            processKey,
            title: newColumnTitle.trim(),
            colorHex: newColumnColorHex,
            workflowBucket: newColumnBucket,
          });
      const added: RoomKanbanColumnDTO = {
        id: col.id,
        kind: "CUSTOM",
        coreRole: null,
        linkedStatus: col.linkedStatus,
        title: col.title,
        sortOrder: col.sortOrder,
        colorHex: col.colorHex,
      };
      setBoardColumns((prev) => [...prev, added]);
      onKanbanColumnAdded?.(added);
      setNewColumnTitle("");
      setNewColumnColorHex(DEFAULT_KANBAN_COLUMN_COLOR);
      setNewColumnBucket(TaskStatus.IN_PROGRESS);
      setAddColumnOpen(false);
      onColumnsChange?.();
      toast.success("Kolom ditambahkan.");
    } catch (err) {
      toast.error(actionErrorMessage(err, "Gagal menambah kolom."));
    } finally {
      setAddColumnPending(false);
    }
  }

  function onDragStart(e: DragStartEvent) {
    if (kanbanReadOnly) return;
    dragTargetColumnIdRef.current = null;
    setActiveDragId(String(e.active.id));
  }

  function onDragOver(e: DragOverEvent) {
    if (kanbanReadOnly) return;
    const { active, over } = e;
    if (!over) return;
    const taskId = String(active.id);
    const overColumnId = resolveDropColumnId(String(over.id));
    if (!overColumnId) return;
    dragTargetColumnIdRef.current = overColumnId;
    const base = tasks.find((t) => t.id === taskId);
    if (!base) return;
    const currentCol =
      localColumnIds[taskId] ??
      base.kanbanColumnId ??
      resolveColumnIdForTask(base, boardColumns);
    if (currentCol !== overColumnId) {
      setLocalColumnIds((prev) => ({ ...prev, [taskId]: overColumnId }));
      const col = boardColumns.find((c) => c.id === overColumnId);
      if (col) {
        setLocalStatuses((prev) => ({
          ...prev,
          [taskId]: statusForColumn(col),
        }));
      }
    }
  }

  function onDragCancel() {
    setActiveDragId(null);
    dragTargetColumnIdRef.current = null;
    setLocalColumnIds({});
    setLocalStatuses({});
  }

  async function onDragEnd(e: DragEndEvent) {
    setActiveDragId(null);
    if (kanbanReadOnly) return;
    const { active, over } = e;
    if (!over) {
      dragTargetColumnIdRef.current = null;
      return;
    }
    const taskId = String(active.id);
    const overId = String(over.id);
    const sourceTask = tasks.find((t) => t.id === taskId);
    if (!sourceTask) {
      dragTargetColumnIdRef.current = null;
      return;
    }

    const task = viewTasks.find((t) => t.id === taskId);
    if (!task || !task.kanbanColumnId) {
      dragTargetColumnIdRef.current = null;
      return;
    }

    const targetColumnId =
      dragTargetColumnIdRef.current ?? resolveDropColumnId(overId);
    dragTargetColumnIdRef.current = null;
    if (!targetColumnId) return;

    const previousColumnId =
      sourceTask.kanbanColumnId ??
      resolveColumnIdForTask(sourceTask, boardColumns);
    if (!previousColumnId) return;
    const previousStatus = sourceTask.status;

    if (previousColumnId === targetColumnId) {
      const colTasks = sortTasksForKanbanColumn(viewTasks, targetColumnId);
      const oldIndex = colTasks.findIndex((t) => t.id === taskId);
      const newIndex = columnIdSet.has(overId)
        ? colTasks.length - 1
        : colTasks.findIndex((t) => t.id === overId);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;

      const reordered = arrayMove(colTasks, oldIndex, newIndex);
      const orderedIds = filterIdsForPersistedColumn(
        reordered.map((t) => t.id),
        targetColumnId,
      );
      if (orderedIds.length === 0) return;
      const colStatus = statusForColumn(
        boardColumns.find((c) => c.id === targetColumnId)!,
      );
      applyOptimisticSortKeys(orderedIds);
      patchKanbanSortKeys(orderedIds, targetColumnId, colStatus);
      try {
        await reorderKanbanColumn({
          columnId: targetColumnId,
          orderedTaskIds: orderedIds,
        });
        router.refresh();
      } catch (err) {
        setLocalSortKeys({});
        toast.error(actionErrorMessage(err, "Gagal mengurutkan tugas."));
      }
      return;
    }

    const targetColTasks = sortTasksForKanbanColumn(
      viewTasks.filter((t) => t.id !== taskId),
      targetColumnId,
    );
    let insertIndex = targetColTasks.length;
    if (!columnIdSet.has(overId)) {
      const overIdx = targetColTasks.findIndex((t) => t.id === overId);
      if (overIdx >= 0) insertIndex = overIdx;
    }
    const orderedIds = [
      ...targetColTasks.slice(0, insertIndex).map((t) => t.id),
      taskId,
      ...targetColTasks.slice(insertIndex).map((t) => t.id),
    ];

    const targetCol = boardColumns.find((c) => c.id === targetColumnId);
    const targetStatus = targetCol ? statusForColumn(targetCol) : task.status;

    if (targetStatus === TaskStatus.DONE) {
      const unfinished = task.checklistTotal - task.checklistDone;
      if (unfinished > 0) {
        setDoneConfirmTaskId(task.id);
        setDoneConfirmUnfinished(unfinished);
        setDoneConfirmPreviousStatus(previousStatus);
        setPendingTargetColumnId(targetColumnId);
        setPendingTargetOrder(orderedIds);
        return;
      }
    }
    await persistColumnChange(
      taskId,
      targetColumnId,
      previousColumnId,
      previousStatus,
      orderedIds,
    );
  }

  async function onQuickDone(taskId: string) {
    const task = viewTasks.find((t) => t.id === taskId);
    if (!task || task.status === TaskStatus.DONE) return;
    const doneCol = boardColumns.find(
      (c) => c.kind === "CORE" && c.coreRole === TaskStatus.DONE,
    );
    if (!doneCol) return;
    const previousColumnId = task.kanbanColumnId ?? doneCol.id;
    const unfinished = task.checklistTotal - task.checklistDone;
    if (unfinished > 0) {
      setDoneConfirmTaskId(task.id);
      setDoneConfirmUnfinished(unfinished);
      setDoneConfirmPreviousStatus(task.status);
      setPendingTargetColumnId(doneCol.id);
      return;
    }
    await persistColumnChange(
      taskId,
      doneCol.id,
      previousColumnId,
      task.status,
    );
  }

  async function handleMoveColumn(columnId: string, direction: "up" | "down") {
    if (!roomId) return;
    const idx = boardColumns.findIndex((c) => c.id === columnId);
    if (idx < 0) return;
    const swap = direction === "up" ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= boardColumns.length) return;
    const next = [...boardColumns];
    [next[idx], next[swap]] = [next[swap]!, next[idx]!];
    setBoardColumns(next);
    try {
      const orderedColumnIds = next.map((c) => c.id);
      if (simpleHub) {
        await reorderSimpleHubKanbanColumns({ roomId, orderedColumnIds });
      } else {
        await reorderRoomKanbanColumns({ roomId, processKey, orderedColumnIds });
      }
      onColumnsChange?.();
    } catch (err) {
      setBoardColumns(boardColumns);
      toast.error(actionErrorMessage(err, "Gagal mengurutkan kolom."));
    }
  }

  const readOnly = Boolean(kanbanReadOnly);
  const stretchColumns = boardColumns.length <= 6;

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={kanbanCollisionDetection}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragCancel={onDragCancel}
        onDragEnd={onDragEnd}
      >
        <div className={cn("w-full", !stretchColumns && "lg:overflow-x-auto")}>
          <div
            className={cn(
              "flex flex-col gap-4 lg:flex-row",
              stretchColumns ? "lg:w-full lg:min-w-0" : "lg:min-w-max",
            )}
          >
          {boardColumns.map((col, colIndex) => {
            const colTasks = sortTasksForKanbanColumn(viewTasks, col.id);
            const colTaskIds = colTasks.map((t) => t.id);
            return (
              <KanbanColumnShell
                key={col.id}
                column={col}
                count={colTasks.length}
                stretch={stretchColumns}
                onAddTask={readOnly ? undefined : onAddTask}
                readOnly={readOnly}
                isRoomManager={isRoomManager}
                roomId={roomId}
                processKey={processKey}
                simpleHub={simpleHub}
                canMoveUp={colIndex > 0}
                canMoveDown={colIndex < boardColumns.length - 1}
                onMoveColumn={(id, dir) => void handleMoveColumn(id, dir)}
                onColumnUpdated={(columnId, patch) => {
                  setBoardColumns((prev) =>
                    prev.map((c) =>
                      c.id === columnId
                        ? {
                            ...c,
                            ...(patch.title !== undefined
                              ? { title: patch.title }
                              : {}),
                            ...(patch.colorHex !== undefined
                              ? { colorHex: patch.colorHex }
                              : {}),
                          }
                        : c,
                    ),
                  );
                }}
                onDeleted={(columnId) => {
                  setBoardColumns((prev) => prev.filter((c) => c.id !== columnId));
                  onKanbanColumnRemoved?.(columnId);
                  onColumnsChange?.();
                }}
              >
                <SortableContext
                  items={colTaskIds}
                  strategy={verticalListSortingStrategy}
                >
                {colTasks.map((t) => (
                  <DraggableTask
                    key={t.id}
                    task={t}
                    users={users}
                    roomTaskTags={roomTaskTags}
                    roomId={roomId}
                    onTaskClick={onTaskClick}
                    onQuickDone={readOnly ? undefined : onQuickDone}
                    onTaskPatched={onTaskPatched}
                    onTagCreated={onTagCreated}
                    dragDisabled={readOnly}
                    isRoomManager={isRoomManager}
                    showArchived={showArchived}
                  />
                ))}
                </SortableContext>
              </KanbanColumnShell>
            );
          })}
          </div>
        </div>
        <DragOverlay dropAnimation={null}>
          {activeDragId ? (
            (() => {
              const dragged = viewTasks.find((t) => t.id === activeDragId);
              if (!dragged) return null;
              return (
                <div className="pointer-events-none w-[min(100%,280px)] opacity-95 shadow-lg">
                  <DraggableTask
                    task={dragged}
                    users={users}
                    roomTaskTags={roomTaskTags}
                    roomId={roomId}
                    dragDisabled
                    isRoomManager={isRoomManager}
                    showArchived={showArchived}
                  />
                </div>
              );
            })()
          ) : null}
        </DragOverlay>
      </DndContext>

      <Dialog
        open={doneConfirmTaskId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDoneConfirmTaskId(null);
            setDoneConfirmUnfinished(0);
            setDoneConfirmPreviousStatus(null);
            setPendingTargetOrder(null);
            setPendingTargetColumnId(null);
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
                setPendingTargetColumnId(null);
                setPendingTargetOrder(null);
              }}
            >
              Batalkan
            </Button>
            <Button
              type="button"
              onClick={async () => {
                if (
                  !doneConfirmTaskId ||
                  doneConfirmPreviousStatus === null ||
                  !pendingTargetColumnId
                )
                  return;
                const taskId = doneConfirmTaskId;
                const previous = doneConfirmPreviousStatus;
                const targetCol = pendingTargetColumnId;
                const base = tasks.find((t) => t.id === taskId);
                const previousCol =
                  base?.kanbanColumnId ??
                  resolveColumnIdForTask(base ?? { status: previous }, boardColumns) ??
                  targetCol;
                setDoneConfirmTaskId(null);
                setDoneConfirmUnfinished(0);
                setDoneConfirmPreviousStatus(null);
                await persistColumnChange(
                  taskId,
                  targetCol,
                  previousCol,
                  previous,
                  pendingTargetOrder ?? undefined,
                );
                setPendingTargetOrder(null);
                setPendingTargetColumnId(null);
              }}
            >
              Tetap Selesaikan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={addColumnOpen}
        onOpenChange={(open) => {
          setAddColumnOpen(open);
          if (!open) {
            setNewColumnTitle("");
            setNewColumnColorHex(DEFAULT_KANBAN_COLUMN_COLOR);
            setNewColumnBucket(TaskStatus.IN_PROGRESS);
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Tambah kolom</DialogTitle>
            <DialogDescription>
              Kolom custom bebas nama — misalnya Revisi, Menunggu klien.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-kanban-column-title">Nama kolom</Label>
              <Input
                id="new-kanban-column-title"
                value={newColumnTitle}
                onChange={(e) => setNewColumnTitle(e.target.value)}
                placeholder="Nama kolom"
                maxLength={80}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleAddColumn();
                }}
              />
            </div>
            <KanbanColumnColorField
              value={newColumnColorHex}
              onChange={setNewColumnColorHex}
              disabled={addColumnPending}
            />
            <div className="space-y-2">
              <Label>Dihitung sebagai</Label>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    { value: TaskStatus.IN_PROGRESS, label: "Berjalan" },
                    { value: TaskStatus.IN_REVIEW, label: "Dalam review" },
                    { value: TaskStatus.BLOCKED, label: "Diblokir" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={addColumnPending}
                    onClick={() => setNewColumnBucket(opt.value)}
                    className={cn(
                      "rounded-md border px-2 py-1.5 text-xs font-medium transition-colors",
                      newColumnBucket === opt.value
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground hover:bg-muted/40",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-muted-foreground text-xs">
                Kategori pelaporan untuk tugas di kolom ini (progres proyek,
                ringkasan, AI). Posisi kartu tetap mengikuti kolom.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAddColumnOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="button"
              disabled={addColumnPending || !newColumnTitle.trim()}
              onClick={() => void handleAddColumn()}
            >
              Tambah
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
