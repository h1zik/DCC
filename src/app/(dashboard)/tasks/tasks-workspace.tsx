"use client";
import { actionErrorMessage } from "@/lib/action-error-message";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  RoomTaskProcess,
  TaskWorkspaceView,
  TaskPriority,
  TaskStatus,
  type Brand,
  type Project,
  type User,
  type Vendor,
} from "@prisma/client";
import Link from "next/link";
import { Archive, Columns3, LayoutGrid, Plus } from "lucide-react";
import { toast } from "sonner";
import { createTask, deleteTask } from "@/actions/tasks";
import { setDefaultTaskWorkspaceView } from "@/actions/task-view-preference";
import { TasksCalendar, type CalendarTask } from "./tasks-calendar";
import { TasksList } from "./tasks-list";
import { TasksGantt, type GanttTask } from "./tasks-gantt";
import { TasksKanban, type KanbanTask } from "./tasks-kanban";
import { TaskDetailSheet } from "./task-detail-sheet";
import type { TaskRow } from "./task-types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  roomProcessPhaseKey,
  type RoomProcessPhaseRef,
} from "@/lib/room-process-phase";
import { taskProjectContextLabel } from "@/lib/room-simple-hub";
import type { RoomKanbanColumnDTO } from "@/lib/room-kanban-columns";
import { DEFAULT_KANBAN_STATUSES, taskStatusLabel } from "@/lib/task-status-ui";
import { cn } from "@/lib/utils";
import type { SelectItemDef } from "@/lib/select-option-items";
import { RoomKanbanSettingsDialog } from "./room-kanban-settings-dialog";

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
  vendors,
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
  vendors: Pick<Vendor, "id" | "name">[];
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
  const [createOpen, setCreateOpen] = useState(false);
  const [localTasks, setLocalTasks] = useState<TaskRow[]>(tasks);
  const [detailTask, setDetailTask] = useState<TaskRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [kanbanSettingsOpen, setKanbanSettingsOpen] = useState(false);
  const [activeView, setActiveView] = useState<TaskViewTab>(
    taskWorkspaceViewToTab(defaultTaskView),
  );

  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [vendorId, setVendorId] = useState<string>("");
  const [priority, setPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);
  const [status, setStatus] = useState<TaskStatus>(TaskStatus.TODO);
  const [dueDate, setDueDate] = useState("");
  const [leadTimeDays, setLeadTimeDays] = useState("");
  const [approval, setApproval] = useState(false);
  const [pending, setPending] = useState(false);

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

  function openCreate(initialStatus: TaskStatus = TaskStatus.TODO) {
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
    setVendorId("");
    setPriority(TaskPriority.MEDIUM);
    setStatus(initialStatus);
    setDueDate("");
    setLeadTimeDays("");
    setApproval(false);
    setCreateOpen(true);
  }

  const openDetail = useCallback((task: TaskRow) => {
    setDetailTask(task);
    setDetailOpen(true);
  }, []);

  async function onSaveCreate() {
    setPending(true);
    try {
      const due = dueDate ? new Date(dueDate) : null;
      const lead =
        leadTimeDays.trim() === "" ? null : Math.max(0, parseInt(leadTimeDays, 10));
      const payload = {
        projectId,
        title,
        description: description || null,
        assigneeIds: isRoomManager ? assigneeIds : [],
        tagIds,
        vendorId: vendorId || null,
        priority,
        status,
        dueDate: due,
        leadTimeDays: lead,
        isApprovalRequired: approval,
        ...(activePhase ? { customProcessPhaseId: activePhase.id } : {}),
      };
      const created = await createTask(payload);
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

  const resolvedKanbanColumns = useMemo((): RoomKanbanColumnDTO[] => {
    if (kanbanColumns?.length) return kanbanColumns;
    return DEFAULT_KANBAN_STATUSES.map((linkedStatus, sortOrder) => ({
      id: `fallback-${linkedStatus}`,
      linkedStatus,
      title: taskStatusLabel(linkedStatus),
      sortOrder,
    }));
  }, [kanbanColumns]);

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
      localTasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: priorityLabel(t.priority),
        dueDate: t.dueDate ? t.dueDate.toISOString() : null,
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
          image: a.user.image ?? null,
          name: a.user.name,
          email: a.user.email,
        })),
        tags: t.tags.map((row) => ({
          id: row.tag.id,
          name: row.tag.name,
          colorHex: row.tag.colorHex,
        })),
      })),
    [localTasks],
  );

  const ganttTasks: GanttTask[] = useMemo(
    () =>
      localTasks.map((t) => ({
        id: t.id,
        title: t.title,
        dueDate: t.dueDate ? t.dueDate.toISOString() : null,
        createdAt: t.createdAt.toISOString(),
      })),
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
  const createDialogPriorityItems = useMemo((): SelectItemDef[] => {
    return (Object.values(TaskPriority) as TaskPriority[]).map((p) => ({
      value: p,
      label: priorityLabel(p),
    }));
  }, []);
  const createDialogStatusItems = useMemo((): SelectItemDef[] => {
    return (Object.values(TaskStatus) as TaskStatus[]).map((s) => ({
      value: s,
      label: taskStatusLabel(s),
    }));
  }, []);
  const createDialogVendorItems = useMemo((): SelectItemDef[] => {
    return [
      { value: "__none__", label: "—" },
      ...vendors.map((v) => ({ value: v.id, label: v.name })),
    ];
  }, [vendors]);

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
        vendors={vendors}
        roomId={roomId}
        roomTaskTags={roomTaskTags}
        isRoomManager={isRoomManager}
        currentUserId={currentUserId}
        simpleHub={simpleHub}
        documentFolders={documentFolders}
      />

      {roomId != null && activePhase && (kanbanColumns?.length ?? 0) > 0 ? (
        <RoomKanbanSettingsDialog
          open={kanbanSettingsOpen}
          onOpenChange={setKanbanSettingsOpen}
          roomId={roomId}
          activePhase={activePhase}
          columns={kanbanColumns!}
        />
      ) : null}

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
              activeView === "kanban" &&
              (kanbanColumns?.length ?? 0) > 0 ? (
                <>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    className="sm:hidden"
                    aria-label="Kolom Kanban"
                    onClick={() => setKanbanSettingsOpen(true)}
                  >
                    <Columns3 className="size-3.5" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="hidden gap-1.5 sm:inline-flex"
                    onClick={() => setKanbanSettingsOpen(true)}
                  >
                    <Columns3 className="size-3.5" aria-hidden />
                    Kolom Kanban
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
            tasks={kanbanTasks}
            columns={resolvedKanbanColumns}
            kanbanReadOnly={showArchived}
            isRoomManager={isRoomManager}
            showArchived={showArchived}
            onTaskClick={(id) => {
              const t = localTasks.find((x) => x.id === id);
              if (t) openDetail(t);
            }}
            onAddTask={
              isRoomManager && !showArchived
                ? (taskStatus) => openCreate(taskStatus)
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
                ? (taskStatus) => openCreate(taskStatus)
                : undefined
            }
            readOnly={showArchived}
            empty="Belum ada tugas."
          />
        </TabsContent>
        <TabsContent value="gantt" className="mt-0">
          <TasksGantt
            tasks={ganttTasks}
            onTaskClick={(id) => {
              const t = localTasks.find((x) => x.id === id);
              if (t) openDetail(t);
            }}
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
        <DialogContent className="max-h-[90vh] max-w-[calc(100%-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tugas baru</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-2">
              <Label>Proyek</Label>
              <Select
                value={projectId}
                items={createDialogProjectItems}
                onValueChange={(v) => {
                  if (v) setProjectId(v);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {projectSelectLabel(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tt">Judul</Label>
              <Input id="tt" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="td">Deskripsi</Label>
              <Textarea
                id="td"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>PIC</Label>
                <div className="max-h-40 space-y-1 overflow-auto rounded-md border p-2">
                  {users.map((u) => {
                    const checked = assigneeIds.includes(u.id);
                    return (
                      <label key={u.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={checked}
                          disabled={!isRoomManager}
                          onCheckedChange={(v) => {
                            const next = v === true;
                            setAssigneeIds((prev) =>
                              next
                                ? [...prev, u.id]
                                : prev.filter((id) => id !== u.id),
                            );
                          }}
                        />
                        <span>{u.name ?? u.email}</span>
                      </label>
                    );
                  })}
                </div>
                {!isRoomManager ? (
                  <p className="text-muted-foreground text-xs">
                    PIC ditetapkan oleh manager ruangan lewat detail tugas setelah
                    tugas dibuat.
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label>Tag</Label>
                <div className="max-h-40 space-y-1 overflow-auto rounded-md border p-2">
                  {roomTaskTags.length === 0 ? (
                    <p className="text-muted-foreground text-xs">Belum ada tag ruangan.</p>
                  ) : (
                    roomTaskTags.map((tag) => {
                      const checked = tagIds.includes(tag.id);
                      return (
                        <label key={tag.id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              const next = v === true;
                              setTagIds((prev) =>
                                next
                                  ? [...prev, tag.id]
                                  : prev.filter((id) => id !== tag.id),
                              );
                            }}
                          />
                          <span
                            className="inline-block size-3 rounded-sm border border-border"
                            style={{ backgroundColor: tag.colorHex }}
                            aria-hidden
                          />
                          <span>{tag.name}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Prioritas</Label>
                <Select
                  value={priority}
                  items={createDialogPriorityItems}
                  onValueChange={(v) => {
                    if (v) setPriority(v as TaskPriority);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.values(TaskPriority) as TaskPriority[]).map((p) => (
                      <SelectItem key={p} value={p}>
                        {priorityLabel(p)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={status}
                  items={createDialogStatusItems}
                  onValueChange={(v) => {
                    if (v) setStatus(v as TaskStatus);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.values(TaskStatus) as TaskStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        {taskStatusLabel(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="dd">Deadline</Label>
                <Input
                  id="dd"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
              <div className="space-y-2" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Vendor (opsional)</Label>
                <Select
                  value={vendorId || "__none__"}
                  items={createDialogVendorItems}
                  onValueChange={(v) => {
                    if (!v || v === "__none__") setVendorId("");
                    else setVendorId(v);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {vendors.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lt">Lead time (hari)</Label>
                <Input
                  id="lt"
                  type="number"
                  min={0}
                  value={leadTimeDays}
                  onChange={(e) => setLeadTimeDays(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="appr"
                checked={approval}
                onCheckedChange={(c) => setApproval(c === true)}
              />
              <Label htmlFor="appr" className="text-sm font-normal">
                Perlu persetujuan CEO
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={onSaveCreate}
              disabled={pending || !title.trim() || !projectId}
            >
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
