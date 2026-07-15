"use client";
import { actionErrorMessage } from "@/lib/action-error-message";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  RoomTaskProcess,
  TaskWorkspaceView,
  TaskPriority,
  TaskStatus,
  type Brand,
  type Project,
  type User,
} from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, LayoutGrid, ListChecks, Paperclip, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  addChecklistItem,
  createTask,
  createTaskTag,
  deleteTask,
  updateTask,
} from "@/actions/tasks";
import {
  addTaskLinkAttachment,
  uploadTaskAttachment,
} from "@/actions/task-attachments";
import { setDefaultTaskWorkspaceView } from "@/actions/task-view-preference";
import { TasksCalendar, type CalendarTask } from "./tasks-calendar";
import { TasksList } from "./tasks-list";
import { TasksGantt, type GanttTask } from "./tasks-gantt";
import { TasksKanban, type KanbanTask } from "./tasks-kanban";
import { TaskDetailSheet } from "./task-detail-sheet";
import type { TaskRow } from "./task-types";
import { Button } from "@/components/ui/button";
import {
  TaskFormAttachmentsDraft,
  TaskFormChecklistDraft,
  TaskFormCollapsibleSection,
  TaskFormEssentials,
  TaskFormPeople,
  TaskFormPlanning,
} from "@/components/tasks/task-form-ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  roomProcessPhaseKey,
  type RoomProcessPhaseRef,
} from "@/lib/room-process-phase";
import { taskProjectContextLabel } from "@/lib/room-simple-hub";
import {
  mergeKanbanColumns,
  type RoomKanbanColumnDTO,
  resolveColumnIdForTask,
} from "@/lib/room-kanban-columns";
import { DEFAULT_KANBAN_STATUSES, taskStatusLabel } from "@/lib/task-status-ui";
import { cn } from "@/lib/utils";
import type { SelectItemDef } from "@/lib/select-option-items";

type TaskViewTab = "kanban" | "list" | "gantt" | "calendar";

function taskWorkspaceViewToTab(view: TaskWorkspaceView): TaskViewTab {
  switch (view) {
    case TaskWorkspaceView.LIST:
      return "list";
    case TaskWorkspaceView.GANTT:
      return "gantt";
    case TaskWorkspaceView.CALENDAR:
      return "calendar";
    case TaskWorkspaceView.KANBAN:
    default:
      return "kanban";
  }
}

function tabToTaskWorkspaceView(tab: TaskViewTab): TaskWorkspaceView {
  switch (tab) {
    case "list":
      return TaskWorkspaceView.LIST;
    case "gantt":
      return TaskWorkspaceView.GANTT;
    case "calendar":
      return TaskWorkspaceView.CALENDAR;
    case "kanban":
    default:
      return TaskWorkspaceView.KANBAN;
  }
}

function priorityLabel(p: TaskPriority) {
  switch (p) {
    case TaskPriority.HIGH:
      return "Tinggi";
    case TaskPriority.MEDIUM:
      return "Sedang";
    case TaskPriority.LOW:
      return "Rendah";
    default:
      return p;
  }
}

function projectSelectLabel(p: Project & { brand: Brand | null }) {
  return p.brand ? `${p.brand.name} — ${p.name}` : p.name;
}

function fallbackKanbanColumns(): RoomKanbanColumnDTO[] {
  return DEFAULT_KANBAN_STATUSES.map((linkedStatus, sortOrder) => ({
    id: `fallback-${linkedStatus}`,
    kind: "CORE" as const,
    coreRole: linkedStatus,
    linkedStatus,
    title: taskStatusLabel(linkedStatus),
    sortOrder,
  }));
}

function kanbanColumnsFromProp(
  columns?: RoomKanbanColumnDTO[],
): RoomKanbanColumnDTO[] {
  return columns?.length ? columns : fallbackKanbanColumns();
}

function roomTasksPath(opts: {
  roomId: string;
  simpleHub: boolean;
  activePhase?: RoomProcessPhaseRef;
  archived: boolean;
}) {
  const qs = new URLSearchParams();
  if (!opts.simpleHub && opts.activePhase) {
    qs.set("process", roomProcessPhaseKey(opts.activePhase));
  }
  if (opts.archived) qs.set("archived", "1");
  const q = qs.toString();
  return `/room/${opts.roomId}/tasks${q ? `?${q}` : ""}`;
}

export function TasksWorkspace({
  roomId,
  roomTitle,
  activePhase,
  simpleHub = false,
  tasks,
  projects,
  users,
  isRoomManager,
  currentUserId,
  kanbanColumns,
  showArchived = false,
  defaultTaskView = TaskWorkspaceView.KANBAN,
  roomTaskTags = [],
  documentFolders = [],
}: {
  roomId?: string;
  roomTitle?: string;
  /** Tab proses aktif di hub ruangan — tugas baru mengikuti fase ini. */
  activePhase?: RoomProcessPhaseRef;
  /** Ruangan HQ/Team tanpa brand: UI tanpa fase proses / pipeline. */
  simpleHub?: boolean;
  tasks: TaskRow[];
  projects: (Project & { brand: Brand | null })[];
  users: Pick<User, "id" | "name" | "email">[];
  /** Manager ruangan: buat/hapus tugas, ubah PIC, moderasi lampiran & komentar. */
  isRoomManager: boolean;
  currentUserId: string;
  /** Kolom Kanban per ruangan + fase (dari server). */
  kanbanColumns?: RoomKanbanColumnDTO[];
  /** Tampilan arsip: hanya tugas selesai yang diarsipkan. */
  showArchived?: boolean;
  /** Preferensi tampilan default per-user untuk modul Tasks. */
  defaultTaskView?: TaskWorkspaceView;
  /** Tag tugas reusable khusus ruangan aktif. */
  roomTaskTags?: { id: string; roomId: string; name: string; colorHex: string }[];
  /** Folder Documents & files ruangan — untuk opsi upload lampiran tugas. */
  documentFolders?: {
    id: string;
    name: string;
    parentId: string | null;
    sortOrder: number;
  }[];
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [localTasks, setLocalTasks] = useState<TaskRow[]>(tasks);
  const [detailTask, setDetailTask] = useState<TaskRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [kanbanAddColumnOpen, setKanbanAddColumnOpen] = useState(false);
  const [localKanbanColumns, setLocalKanbanColumns] = useState<RoomKanbanColumnDTO[]>(
    () => kanbanColumnsFromProp(kanbanColumns),
  );
  const [activeView, setActiveView] = useState<TaskViewTab>(
    taskWorkspaceViewToTab(defaultTaskView),
  );

  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState(roomTaskTags);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColorHex, setNewTagColorHex] = useState("#6B7280");
  const [createTagPending, setCreateTagPending] = useState(false);
  const [draftChecklist, setDraftChecklist] = useState<string[]>([]);
  const [newCheck, setNewCheck] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingLinks, setPendingLinks] = useState<
    { id: string; url: string; title: string }[]
  >([]);
  const [attachLinkUrl, setAttachLinkUrl] = useState("");
  const [attachLinkTitle, setAttachLinkTitle] = useState("");
  const [alsoSaveToDocuments, setAlsoSaveToDocuments] = useState(false);
  const [documentsFolderId, setDocumentsFolderId] = useState<string | null>(null);
  const [priority, setPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);
  const [status, setStatus] = useState<TaskStatus>(TaskStatus.TODO);
  /** Tahap awal tugas baru (kolom papan) — menggantikan pilihan status enum. */
  const [createStageColumnId, setCreateStageColumnId] = useState<string>("");
  const [dueDate, setDueDate] = useState("");
  const [approval, setApproval] = useState(false);
  const [pending, setPending] = useState(false);
  const kanbanBoardKeyRef = useRef(
    `${roomId ?? ""}:${activePhase?.id ?? "simple-hub"}`,
  );

  useEffect(() => {
    setAvailableTags(roomTaskTags);
  }, [roomTaskTags]);

  useEffect(() => {
    const fromServer = kanbanColumnsFromProp(kanbanColumns);
    const boardKey = `${roomId ?? ""}:${activePhase?.id ?? "simple-hub"}`;
    const boardChanged = kanbanBoardKeyRef.current !== boardKey;
    kanbanBoardKeyRef.current = boardKey;
    setLocalKanbanColumns((prev) => {
      if (boardChanged) {
        return mergeKanbanColumns(fromServer, []);
      }
      return mergeKanbanColumns(fromServer, prev);
    });
  }, [kanbanColumns, roomId, activePhase?.id]);

  const detailId = detailTask?.id;
  useEffect(() => {
    setActiveView(taskWorkspaceViewToTab(defaultTaskView));
  }, [defaultTaskView]);

  useEffect(() => {
    setLocalTasks(tasks);
  }, [tasks]);

  useEffect(() => {
    if (!detailId) return;
    const next = localTasks.find((t) => t.id === detailId);
    if (next) setDetailTask(next);
    else {
      setDetailOpen(false);
      setDetailTask(null);
    }
  }, [localTasks, detailId]);

  function openCreate(initialColumnId?: string) {
    if (projects.length === 0) {
      toast.error(
        simpleHub
          ? "Papan tugas ruangan belum siap. Muat ulang halaman atau hubungi CEO."
          : "Belum ada proyek di ruangan ini. Tugas harus terikat ke proyek — tambahkan proyek ke ruangan ini lewat menu Pipeline (CEO atau akun yang punya akses editor proyek).",
      );
      return;
    }
    setProjectId(projects[0]!.id);
    setTitle("");
    setDescription("");
    setAssigneeIds([]);
    setTagIds([]);
    setNewTagName("");
    setDraftChecklist([]);
    setNewCheck("");
    setPendingFiles([]);
    setPendingLinks([]);
    setAttachLinkUrl("");
    setAttachLinkTitle("");
    setAlsoSaveToDocuments(false);
    setDocumentsFolderId(null);
    setPriority(TaskPriority.MEDIUM);
    setStatus(TaskStatus.TODO);
    setCreateStageColumnId(initialColumnId ?? defaultCreateStageColumnId);
    setDueDate("");
    setApproval(false);
    setCreateOpen(true);
  }

  async function onCreateTag() {
    if (!roomId || !newTagName.trim()) return;
    setCreateTagPending(true);
    try {
      const created = await createTaskTag({
        roomId,
        name: newTagName.trim(),
        colorHex: newTagColorHex,
      });
      setAvailableTags((prev) => {
        if (prev.some((t) => t.id === created.id)) return prev;
        return [...prev, created].sort((a, b) => a.name.localeCompare(b.name));
      });
      setTagIds((prev) =>
        prev.includes(created.id) ? prev : [...prev, created.id],
      );
      setNewTagName("");
      toast.success("Tag ditambahkan.");
    } catch (e) {
      toast.error(actionErrorMessage(e, "Gagal membuat tag."));
    } finally {
      setCreateTagPending(false);
    }
  }

  function onAddDraftCheck() {
    const title = newCheck.trim();
    if (!title) return;
    setDraftChecklist((prev) => [...prev, title]);
    setNewCheck("");
  }

  function onAddDraftLink() {
    const url = attachLinkUrl.trim();
    if (!url) return;
    setPendingLinks((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        url,
        title: attachLinkTitle.trim(),
      },
    ]);
    setAttachLinkUrl("");
    setAttachLinkTitle("");
  }

  function onPickCreateFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files?.length ? Array.from(e.target.files) : [];
    e.target.value = "";
    if (!files.length) return;
    setPendingFiles((prev) => [...prev, ...files]);
  }

  const openDetail = useCallback((task: TaskRow) => {
    setDetailTask(task);
    setDetailOpen(true);
  }, []);

  async function onSaveCreate() {
    setPending(true);
    try {
      const due = dueDate ? new Date(dueDate) : null;
      const createStageColumn =
        realKanbanColumns.find((c) => c.id === createStageColumnId) ?? null;
      const payload = {
        projectId,
        title,
        description: description || null,
        assigneeIds: isRoomManager ? assigneeIds : [],
        tagIds,
        priority,
        // Tahap (kolom) diutamakan; status legacy hanya saat papan fallback.
        ...(createStageColumn
          ? { kanbanColumnId: createStageColumn.id }
          : { status }),
        dueDate: due,
        isApprovalRequired: approval,
        ...(activePhase ? { customProcessPhaseId: activePhase.id } : {}),
      };
      const created = await createTask(payload);

      for (const itemTitle of draftChecklist) {
        await addChecklistItem(created.id, itemTitle);
      }

      for (const file of pendingFiles) {
        const fd = new FormData();
        fd.append("file", file);
        if (alsoSaveToDocuments && roomId) {
          fd.append("alsoSaveToDocuments", "true");
          if (documentsFolderId) {
            fd.append("documentsFolderId", documentsFolderId);
          }
        }
        await uploadTaskAttachment(created.id, fd);
      }

      for (const link of pendingLinks) {
        await addTaskLinkAttachment(created.id, {
          url: link.url,
          title: link.title || null,
        });
      }

      toast.success("Tugas dibuat.");
      setCreateOpen(false);
      setLocalTasks((prev) => {
        if (prev.some((t) => t.id === created.id)) return prev;
        return [
          ...prev,
          {
            ...created,
            checklistItems: [],
            comments: [],
            attachments: [],
            tags: created.tags ?? [],
          },
        ];
      });
    } catch (e) {
      const msg = actionErrorMessage(e, "Gagal menyimpan.");
      toast.error(msg);
    } finally {
      setPending(false);
    }
  }

  const onDeleteTask = useCallback(
    async (id: string) => {
      if (!confirm("Hapus tugas ini?")) return;
      const removedTask = localTasks.find((t) => t.id === id) ?? null;
      setLocalTasks((prev) => prev.filter((t) => t.id !== id));
      if (detailTask?.id === id) {
        setDetailOpen(false);
        setDetailTask(null);
      }
      try {
        await deleteTask(id);
        toast.success("Tugas dihapus.");
      } catch {
        if (removedTask) {
          setLocalTasks((prev) => [...prev, removedTask]);
        }
        toast.error("Gagal menghapus.");
      }
    },
    [detailTask?.id, localTasks],
  );

  const resolvedKanbanColumns = localKanbanColumns;
  /** Kolom papan asli (bukan fallback klien) — bahan dropdown "Tahap".
   * Tanpa useMemo — React Compiler yang meng-memo turunan ini. */
  const realKanbanColumns = localKanbanColumns.filter(
    (c) => !c.id.startsWith("fallback-"),
  );
  const defaultCreateStageColumnId =
    realKanbanColumns.find(
      (c) => c.kind === "CORE" && c.coreRole === TaskStatus.TODO,
    )?.id ??
    realKanbanColumns[0]?.id ??
    "";
  const stageSelectItems = realKanbanColumns.map((c) => ({
    value: c.id,
    label: c.title,
  }));

  const boardPath =
    roomId != null
      ? roomTasksPath({
          roomId,
          simpleHub,
          activePhase,
          archived: false,
        })
      : null;
  const archivedPath =
    roomId != null
      ? roomTasksPath({
          roomId,
          simpleHub,
          activePhase,
          archived: true,
        })
      : null;

  const kanbanTasks: KanbanTask[] = useMemo(
    () =>
      localTasks.map((t) => {
        const columnId = resolveColumnIdForTask(t, resolvedKanbanColumns);
        const kanbanSortKey =
          columnId != null
            ? (t.kanbanPositions?.find((p) => p.columnId === columnId)
                ?.sortKey ?? null)
            : null;
        return {
        id: t.id,
        projectId: t.projectId,
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate ? t.dueDate.toISOString() : null,
        description: t.description,
        isApprovalRequired: t.isApprovalRequired,
        vendorId: t.vendorId,
        leadTimeDays: t.leadTimeDays,
        checklistTotal: t.checklistItems.length,
        checklistDone: t.checklistItems.filter((item) => item.done).length,
        checklistItems: t.checklistItems.map((c) => ({
          id: c.id,
          title: c.title,
          done: c.done,
        })),
        project: {
          name: t.project.name,
          brand: { name: taskProjectContextLabel(t.project) },
        },
        assignees: t.assignees.map((a) => ({
          id: a.user.id,
          image: a.user.image ?? null,
          name: a.user.name,
          email: a.user.email,
        })),
        tagIds: t.tags.map((row) => row.tagId),
        tags: t.tags.map((row) => ({
          id: row.tag.id,
          name: row.tag.name,
          colorHex: row.tag.colorHex,
        })),
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
        kanbanColumnId: columnId,
        kanbanSortKey,
      };
      }),
    [localTasks, resolvedKanbanColumns],
  );

  const ganttTasks: GanttTask[] = useMemo(
    () =>
      localTasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        dueDate: t.dueDate ? t.dueDate.toISOString() : null,
        createdAt: t.createdAt.toISOString(),
        projectId: t.projectId,
        projectName: t.project.name,
        projectContext: taskProjectContextLabel(t.project),
        checklistDone: t.checklistItems.filter((item) => item.done).length,
        checklistTotal: t.checklistItems.length,
        assignees: t.assignees.map((a) => ({
          id: a.user.id,
          name: a.user.name,
          email: a.user.email,
          image: a.user.image ?? null,
        })),
      })),
    [localTasks],
  );

  const onGanttReschedule = useCallback(
    async (taskId: string, nextDue: Date) => {
      const task = localTasks.find((t) => t.id === taskId);
      if (!task) return;
      const prevDue = task.dueDate;
      // Optimistis: geser bar dulu, rollback jika server menolak.
      setLocalTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, dueDate: nextDue } : t)),
      );
      try {
        await updateTask({
          taskId: task.id,
          projectId: task.projectId,
          title: task.title,
          description: task.description ?? null,
          assigneeIds: task.assignees.map((a) => a.user.id),
          tagIds: task.tags.map((row) => row.tagId),
          vendorId: task.vendorId ?? null,
          priority: task.priority,
          dueDate: nextDue,
          leadTimeDays: task.leadTimeDays,
          isApprovalRequired: task.isApprovalRequired,
          status: task.status,
        });
        toast.success("Tenggat diperbarui.");
      } catch (e) {
        setLocalTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, dueDate: prevDue } : t)),
        );
        toast.error(actionErrorMessage(e, "Gagal memperbarui tenggat."));
      }
    },
    [localTasks],
  );
  const calendarTasks: CalendarTask[] = useMemo(
    () =>
      localTasks.map((t) => ({
        id: t.id,
        title: t.title,
        dueDate: t.dueDate ? t.dueDate.toISOString() : null,
      })),
    [localTasks],
  );

  const createDialogProjectItems = useMemo((): SelectItemDef[] => {
    return projects.map((p) => ({
      value: p.id,
      label: projectSelectLabel(p),
    }));
  }, [projects]);
  const onChangeView = useCallback((nextValue: string) => {
    const next = nextValue as TaskViewTab;
    setActiveView(next);
    void setDefaultTaskWorkspaceView({
      view: tabToTaskWorkspaceView(next),
    }).catch(() => {
      // Biarkan tetap berpindah tab walau simpan preferensi gagal.
    });
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <TaskDetailSheet
        task={detailTask}
        open={detailOpen}
        onOpenChange={(o) => {
          setDetailOpen(o);
          if (!o) setDetailTask(null);
        }}
        onTaskPatched={(taskId, patch) => {
          setLocalTasks((prev) =>
            prev.map((task) =>
              task.id === taskId ? ({ ...task, ...patch } as TaskRow) : task,
            ),
          );
          setDetailTask((prev) =>
            prev && prev.id === taskId ? ({ ...prev, ...patch } as TaskRow) : prev,
          );
        }}
        projects={projects}
        users={users}
        roomId={roomId}
        roomTaskTags={roomTaskTags}
        isRoomManager={isRoomManager}
        currentUserId={currentUserId}
        simpleHub={simpleHub}
        documentFolders={documentFolders}
        kanbanColumns={resolvedKanbanColumns}
      />

      {roomTitle && isRoomManager && projects.length === 0 && !simpleHub ? (
        <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-50">
          <p className="font-medium">Belum ada proyek di ruangan ini</p>
          <p className="text-muted-foreground mt-1 text-pretty">
            Setiap tugas harus terikat ke proyek. Tambahkan proyek ke ruangan ini
            dari menu{" "}
            <Link
              href="/projects"
              className="text-accent-foreground font-medium underline-offset-2 hover:underline"
            >
              Pipeline
            </Link>{" "}
            (CEO atau akun dengan akses editor proyek), lalu kembali ke sini untuk
            membuat tugas.
          </p>
        </div>
      ) : null}
      <Tabs value={activeView} onValueChange={onChangeView} className="gap-3">
        <div className="border-border flex flex-col gap-2 border-b pb-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2 sm:rounded-xl sm:border sm:bg-card sm:p-1.5 sm:shadow-sm">
          <div className="flex items-center justify-between gap-2 sm:contents">
            {roomId != null && boardPath != null && archivedPath != null ? (
              <div
                className="bg-muted/50 flex shrink-0 items-center rounded-lg p-0.5"
                role="tablist"
                aria-label="Papan atau arsip"
              >
                <Link
                  href={boardPath}
                  scroll={false}
                  aria-current={!showArchived ? "page" : undefined}
                  aria-label="Papan tugas"
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors sm:px-3",
                    !showArchived
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <LayoutGrid className="size-3.5 shrink-0" aria-hidden />
                  <span className="hidden sm:inline">Papan</span>
                </Link>
                <Link
                  href={archivedPath}
                  scroll={false}
                  aria-current={showArchived ? "page" : undefined}
                  aria-label="Arsip tugas"
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors sm:px-3",
                    showArchived
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Archive className="size-3.5 shrink-0" aria-hidden />
                  <span className="hidden sm:inline">Arsip</span>
                </Link>
              </div>
            ) : (
              <span className="sm:hidden" />
            )}

            <div className="flex shrink-0 items-center gap-1 sm:order-last sm:ml-auto">
              {roomId != null &&
              isRoomManager &&
              !showArchived &&
              activeView === "kanban" ? (
                <>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    className="sm:hidden"
                    aria-label="Tambah kolom"
                    onClick={() => setKanbanAddColumnOpen(true)}
                  >
                    <Plus className="size-3.5" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="hidden gap-1.5 sm:inline-flex"
                    onClick={() => setKanbanAddColumnOpen(true)}
                  >
                    <Plus className="size-3.5" aria-hidden />
                    Tambah kolom
                  </Button>
                </>
              ) : null}
              {isRoomManager && !showArchived ? (
                <>
                  <Button
                    type="button"
                    size="icon-sm"
                    className="sm:hidden"
                    aria-label="Tugas baru"
                    onClick={() => openCreate()}
                  >
                    <Plus className="size-3.5" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="hidden gap-1.5 sm:inline-flex"
                    onClick={() => openCreate()}
                  >
                    <Plus className="size-3.5" aria-hidden />
                    Tugas baru
                  </Button>
                </>
              ) : null}
            </div>
          </div>

          <TabsList className="h-8 w-full max-w-full justify-start overflow-x-auto [scrollbar-width:none] sm:w-fit sm:shrink-0 [&::-webkit-scrollbar]:hidden">
            <TabsTrigger value="kanban" className="max-sm:flex-none max-sm:px-2.5">
              Kanban
            </TabsTrigger>
            <TabsTrigger value="list" className="max-sm:flex-none max-sm:px-2.5">
              Daftar
            </TabsTrigger>
            <TabsTrigger value="gantt" className="max-sm:flex-none max-sm:px-2.5">
              Gantt
            </TabsTrigger>
            <TabsTrigger value="calendar" className="max-sm:flex-none max-sm:px-2.5">
              Kalender
            </TabsTrigger>
          </TabsList>
        </div>

        {showArchived ? (
          <p className="text-muted-foreground rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2 text-sm">
            Menampilkan tugas <span className="text-foreground font-medium">Selesai</span>{" "}
            yang diarsipkan. Pulihkan jika perlu muncul lagi di papan utama.
          </p>
        ) : null}

        <TabsContent value="kanban" className="mt-0">
          <TasksKanban
            key={
              roomId != null
                ? `${roomId}:${
                    activePhase ? roomProcessPhaseKey(activePhase) : "simple-hub"
                  }`
                : "tasks-kanban"
            }
            tasks={kanbanTasks}
            columns={resolvedKanbanColumns}
            users={users}
            roomTaskTags={availableTags}
            roomId={roomId}
            kanbanReadOnly={showArchived}
            isRoomManager={isRoomManager}
            processKey={
              activePhase ? roomProcessPhaseKey(activePhase) : "market-research"
            }
            simpleHub={simpleHub}
            onColumnsChange={() => router.refresh()}
            onKanbanColumnAdded={(col) => {
              setLocalKanbanColumns((prev) => {
                if (prev.some((c) => c.id === col.id)) return prev;
                return [...prev, col];
              });
            }}
            onKanbanColumnRemoved={(columnId) => {
              setLocalKanbanColumns((prev) =>
                prev.filter((c) => c.id !== columnId),
              );
            }}
            addColumnOpen={kanbanAddColumnOpen}
            onAddColumnOpenChange={setKanbanAddColumnOpen}
            showArchived={showArchived}
            onTagCreated={(created) => {
              setAvailableTags((prev) => {
                if (prev.some((t) => t.id === created.id)) return prev;
                return [...prev, created].sort((a, b) =>
                  a.name.localeCompare(b.name),
                );
              });
            }}
            onTaskClick={(id) => {
              const t = localTasks.find((x) => x.id === id);
              if (t) openDetail(t);
            }}
            onTaskPatched={(taskId, patch) => {
              setLocalTasks((prev) =>
                prev.map((task) => {
                  if (task.id !== taskId) return task;
                  const next: TaskRow = { ...task };
                  if (patch.title !== undefined) next.title = patch.title;
                  if (patch.priority !== undefined) next.priority = patch.priority;
                  if (patch.status !== undefined) next.status = patch.status;
                  if (patch.kanbanColumnId !== undefined) {
                    next.kanbanColumnId = patch.kanbanColumnId;
                  }
                  if (patch.dueDate !== undefined) {
                    next.dueDate = patch.dueDate ? new Date(patch.dueDate) : null;
                  }
                  if (patch.kanbanSortKey !== undefined && patch.kanbanSortKey != null) {
                    const colId =
                      patch.kanbanColumnId ??
                      task.kanbanColumnId ??
                      resolveColumnIdForTask(task, resolvedKanbanColumns);
                    if (colId) {
                      const others = (task.kanbanPositions ?? []).filter(
                        (p) => p.columnId !== colId,
                      );
                      next.kanbanPositions = [
                        ...others,
                        { columnId: colId, sortKey: patch.kanbanSortKey },
                      ];
                    }
                  }
                  if (patch.assignees !== undefined) {
                    next.assignees = patch.assignees.map((a) => ({
                      user: {
                        id: a.id,
                        name: a.name,
                        email: a.email,
                        image: a.image,
                      },
                    }));
                  }
                  if (patch.tags !== undefined) {
                    next.tags = patch.tags.map((tag) => ({
                      taskId,
                      tagId: tag.id,
                      tag: {
                        id: tag.id,
                        roomId:
                          roomTaskTags.find((rt) => rt.id === tag.id)?.roomId ??
                          task.tags.find((row) => row.tagId === tag.id)?.tag
                            .roomId ??
                          "",
                        name: tag.name,
                        colorHex: tag.colorHex,
                      },
                    }));
                  }
                  return next;
                }),
              );
              setDetailTask((prev) => {
                if (!prev || prev.id !== taskId) return prev;
                const task = localTasks.find((t) => t.id === taskId);
                if (!task) return prev;
                const next: TaskRow = { ...prev };
                if (patch.title !== undefined) next.title = patch.title;
                if (patch.priority !== undefined) next.priority = patch.priority;
                if (patch.status !== undefined) next.status = patch.status;
                if (patch.dueDate !== undefined) {
                  next.dueDate = patch.dueDate ? new Date(patch.dueDate) : null;
                }
                if (patch.kanbanSortKey !== undefined && patch.kanbanSortKey != null) {
                  const colId =
                    patch.kanbanColumnId ??
                    prev.kanbanColumnId ??
                    resolveColumnIdForTask(prev, resolvedKanbanColumns);
                  if (colId) {
                    const others = (prev.kanbanPositions ?? []).filter(
                      (p) => p.columnId !== colId,
                    );
                    next.kanbanPositions = [
                      ...others,
                      { columnId: colId, sortKey: patch.kanbanSortKey },
                    ];
                  }
                }
                if (patch.assignees !== undefined) {
                  next.assignees = patch.assignees.map((a) => ({
                    user: {
                      id: a.id,
                      name: a.name,
                      email: a.email,
                      image: a.image,
                    },
                  }));
                }
                if (patch.tags !== undefined) {
                  next.tags = patch.tags.map((tag) => ({
                    taskId,
                    tagId: tag.id,
                    tag: {
                      id: tag.id,
                      roomId:
                        roomTaskTags.find((rt) => rt.id === tag.id)?.roomId ??
                        prev.tags.find((row) => row.tagId === tag.id)?.tag
                          .roomId ??
                        "",
                      name: tag.name,
                      colorHex: tag.colorHex,
                    },
                  }));
                }
                return next;
              });
            }}
            onAddTask={
              isRoomManager && !showArchived
                ? (columnId) => openCreate(columnId)
                : undefined
            }
          />
        </TabsContent>
        <TabsContent value="list" className="mt-0">
          <TasksList
            tasks={localTasks}
            columns={resolvedKanbanColumns}
            users={users}
            isRoomManager={isRoomManager}
            onTaskClick={openDetail}
            onTaskPatched={(taskId, patch) => {
              setLocalTasks((prev) =>
                prev.map((task) =>
                  task.id === taskId ? ({ ...task, ...patch } as TaskRow) : task,
                ),
              );
              setDetailTask((prev) =>
                prev && prev.id === taskId
                  ? ({ ...prev, ...patch } as TaskRow)
                  : prev,
              );
            }}
            onAddTask={
              isRoomManager && !showArchived
                ? (columnId) => openCreate(columnId)
                : undefined
            }
            readOnly={showArchived}
            empty="Belum ada tugas."
          />
        </TabsContent>
        <TabsContent value="gantt" className="mt-0">
          <TasksGantt
            tasks={ganttTasks}
            readOnly={showArchived}
            onTaskClick={(id) => {
              const t = localTasks.find((x) => x.id === id);
              if (t) openDetail(t);
            }}
            onTaskReschedule={
              showArchived
                ? undefined
                : (taskId, nextDue) => void onGanttReschedule(taskId, nextDue)
            }
            onAddTask={
              isRoomManager && !showArchived ? () => openCreate() : undefined
            }
          />
        </TabsContent>
        <TabsContent value="calendar" className="mt-0">
          <TasksCalendar
            tasks={calendarTasks}
            onTaskClick={(id) => {
              const t = localTasks.find((x) => x.id === id);
              if (t) openDetail(t);
            }}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="flex max-h-[92vh] max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="border-border shrink-0 border-b px-6 pt-6 pb-4">
            <DialogTitle>Buat tugas baru</DialogTitle>
            <DialogDescription>
              Isi informasi utama dulu. Sub-tugas dan lampiran bisa ditambah di
              bawah — semuanya opsional.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <TaskFormEssentials
              projectId={projectId}
              projects={createDialogProjectItems}
              onProjectChange={setProjectId}
              title={title}
              onTitleChange={setTitle}
              titleId="create-task-title"
              description={description}
              onDescriptionChange={setDescription}
              descriptionId="create-task-desc"
            />

            <TaskFormPlanning
              status={status}
              onStatusChange={setStatus}
              stageItems={stageSelectItems}
              stageValue={createStageColumnId}
              onStageChange={setCreateStageColumnId}
              priority={priority}
              onPriorityChange={setPriority}
              dueDate={dueDate}
              onDueDateChange={setDueDate}
              dueDateId="create-task-due"
              approval={approval}
              onApprovalChange={setApproval}
              approvalId="create-task-approval"
            />

            <TaskFormPeople
              users={users}
              assigneeIds={assigneeIds}
              onAssigneeToggle={(userId, selected) => {
                setAssigneeIds((prev) =>
                  selected
                    ? [...prev, userId]
                    : prev.filter((id) => id !== userId),
                );
              }}
              assigneeDisabled={!isRoomManager}
              tags={availableTags}
              selectedTagIds={tagIds}
              onTagToggle={(tagId, selected) => {
                setTagIds((prev) =>
                  selected
                    ? [...prev, tagId]
                    : prev.filter((id) => id !== tagId),
                );
              }}
              canCreateTag={isRoomManager}
              newTagName={newTagName}
              onNewTagNameChange={setNewTagName}
              newTagColorHex={newTagColorHex}
              onNewTagColorChange={setNewTagColorHex}
              onCreateTag={() => void onCreateTag()}
              createTagPending={createTagPending}
              roomId={roomId}
            />

            <TaskFormCollapsibleSection
              icon={<ListChecks className="size-4" />}
              title="Sub-tugas"
              defaultOpen={draftChecklist.length > 0}
              badge={
                draftChecklist.length > 0 ? (
                  <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums">
                    {draftChecklist.length}
                  </span>
                ) : null
              }
            >
              <TaskFormChecklistDraft
                items={draftChecklist}
                draft={newCheck}
                onDraftChange={setNewCheck}
                onAdd={onAddDraftCheck}
                onRemove={(index) =>
                  setDraftChecklist((prev) => prev.filter((_, i) => i !== index))
                }
              />
            </TaskFormCollapsibleSection>

            <TaskFormCollapsibleSection
              icon={<Paperclip className="size-4" />}
              title="Lampiran"
              defaultOpen={
                pendingFiles.length > 0 || pendingLinks.length > 0
              }
              badge={
                pendingFiles.length + pendingLinks.length > 0 ? (
                  <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums">
                    {pendingFiles.length + pendingLinks.length}
                  </span>
                ) : null
              }
            >
              <TaskFormAttachmentsDraft
                pendingFiles={pendingFiles}
                onPickFiles={onPickCreateFiles}
                onRemoveFile={(index) =>
                  setPendingFiles((prev) => prev.filter((_, i) => i !== index))
                }
                pendingLinks={pendingLinks}
                linkUrl={attachLinkUrl}
                onLinkUrlChange={setAttachLinkUrl}
                linkTitle={attachLinkTitle}
                onLinkTitleChange={setAttachLinkTitle}
                onAddLink={onAddDraftLink}
                onRemoveLink={(id) =>
                  setPendingLinks((prev) => prev.filter((item) => item.id !== id))
                }
                disabled={pending}
                roomId={roomId}
                documentFolders={documentFolders}
                alsoSaveToDocuments={alsoSaveToDocuments}
                onAlsoSaveToDocumentsChange={setAlsoSaveToDocuments}
                documentsFolderId={documentsFolderId}
                onDocumentsFolderIdChange={setDocumentsFolderId}
                fileInputId="create-task-attach"
              />
            </TaskFormCollapsibleSection>
          </div>

          <DialogFooter className="border-border shrink-0 border-t px-6 py-4">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={onSaveCreate}
              disabled={pending || !title.trim() || !projectId}
            >
              {pending ? "Menyimpan…" : "Buat tugas"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
