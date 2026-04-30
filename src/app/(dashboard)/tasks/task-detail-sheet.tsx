"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ContentPlanJenis,
  RoomTaskProcess,
  TaskPriority,
  TaskStatus,
  type Brand,
  type Project,
  type User,
  type Vendor,
} from "@prisma/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  addChecklistItem,
  archiveTask,
  createTaskTag,
  deleteChecklistItem,
  deleteTask,
  toggleChecklistItem,
  unarchiveTask,
  updateTask,
} from "@/actions/tasks";
import { addTaskComment, deleteTaskComment } from "@/actions/task-comments";
import {
  addTaskLinkAttachment,
  deleteTaskAttachment,
  uploadTaskAttachment,
} from "@/actions/task-attachments";
import type { TaskRow } from "./task-types";
import {
  roomTaskProcessLabel,
  ROOM_TASK_PROCESS_ORDER,
} from "@/lib/room-task-process";
import { taskProjectContextLabel } from "@/lib/room-simple-hub";
import { taskStatusLabel } from "@/lib/task-status-ui";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Link2, Paperclip, Trash2 } from "lucide-react";

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

function contentPlanJenisLabel(j: ContentPlanJenis) {
  switch (j) {
    case ContentPlanJenis.CAROUSEL:
      return "Carousel";
    case ContentPlanJenis.REELS:
      return "Reels";
    case ContentPlanJenis.SINGLE_FEED:
      return "Single feed";
    default:
      return j;
  }
}

type Props = {
  task: TaskRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskPatched?: (taskId: string, patch: Partial<TaskRow>) => void;
  projects: (Project & { brand: Brand | null })[];
  users: Pick<User, "id" | "name" | "email">[];
  vendors: Pick<Vendor, "id" | "name">[];
  roomId?: string;
  roomTaskTags?: { id: string; roomId: string; name: string; colorHex: string }[];
  isRoomManager: boolean;
  currentUserId: string;
  /** Ruangan HQ/Team tanpa brand: sembunyikan fase proses alur. */
  simpleHub?: boolean;
};

function projectSelectLabel(p: Project & { brand: Brand | null }) {
  return p.brand ? `${p.brand.name} — ${p.name}` : p.name;
}

function formatFileSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function TaskDetailSheet({
  task,
  open,
  onOpenChange,
  onTaskPatched,
  projects,
  users,
  vendors,
  roomId,
  roomTaskTags = [],
  isRoomManager,
  currentUserId,
  simpleHub = false,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [projectId, setProjectId] = useState("");
  const [roomProcess, setRoomProcess] = useState<RoomTaskProcess>(
    RoomTaskProcess.MARKET_RESEARCH,
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [vendorId, setVendorId] = useState("");
  const [priority, setPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState(roomTaskTags);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColorHex, setNewTagColorHex] = useState("#6B7280");
  const [createTagPending, setCreateTagPending] = useState(false);
  const [status, setStatus] = useState<TaskStatus>(TaskStatus.TODO);
  const [dueDate, setDueDate] = useState("");
  const [leadTimeDays, setLeadTimeDays] = useState("");
  const [approval, setApproval] = useState(false);
  const [savePending, setSavePending] = useState(false);

  const [newCheck, setNewCheck] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [commentPending, setCommentPending] = useState(false);
  const [uploadPending, setUploadPending] = useState(false);
  const [attachLinkUrl, setAttachLinkUrl] = useState("");
  const [attachLinkTitle, setAttachLinkTitle] = useState("");
  const [linkAttachPending, setLinkAttachPending] = useState(false);
  const [archivePending, setArchivePending] = useState(false);
  const [doneWarningOpen, setDoneWarningOpen] = useState(false);
  const [doneWarningCount, setDoneWarningCount] = useState(0);

  useEffect(() => {
    setAvailableTags(roomTaskTags);
  }, [roomTaskTags]);

  useEffect(() => {
    if (!task) return;
    setProjectId(task.projectId);
    setRoomProcess(task.roomProcess);
    setTitle(task.title);
    setDescription(task.description ?? "");
    setAssigneeIds(task.assignees.map((a) => a.user.id));
    setVendorId(task.vendorId ?? "");
    setPriority(task.priority);
    setSelectedTagIds(task.tags.map((t) => t.tagId));
    setStatus(task.status);
    setDueDate(task.dueDate ? task.dueDate.toISOString().slice(0, 10) : "");
    setLeadTimeDays(task.leadTimeDays != null ? String(task.leadTimeDays) : "");
    setApproval(task.isApprovalRequired);
    setCommentBody("");
    setAttachLinkUrl("");
    setAttachLinkTitle("");
  }, [task]);

  const refresh = useCallback(() => {
    startTransition(() => {
      router.refresh();
    });
  }, [router, startTransition]);

  const projectSelectItems = useMemo(
    () =>
      projects.map((p) => ({
        value: p.id,
        label: projectSelectLabel(p),
      })),
    [projects],
  );
  const roomProcessSelectItems = useMemo(
    () =>
      ROOM_TASK_PROCESS_ORDER.map((p) => ({
        value: p,
        label: roomTaskProcessLabel(p),
      })),
    [],
  );
  const prioritySelectItems = useMemo(
    () =>
      (Object.values(TaskPriority) as TaskPriority[]).map((p) => ({
        value: p,
        label: priorityLabel(p),
      })),
    [],
  );
  const statusSelectItems = useMemo(
    () =>
      (Object.values(TaskStatus) as TaskStatus[]).map((s) => ({
        value: s,
        label: taskStatusLabel(s),
      })),
    [],
  );
  const vendorSelectItems = useMemo(
    () => [
      { value: "__none__", label: "—" },
      ...vendors.map((v) => ({ value: v.id, label: v.name })),
    ],
    [vendors],
  );

  const contentPlanAttachmentHint = useMemo(() => {
    if (!task?.contentPlanItemId || !task.contentPlanJenis) {
      return {
        multiple: true as boolean,
        accept: undefined as string | undefined,
        helper:
          "Satu atau beberapa file sekaligus. Pratinjau gambar ditampilkan di bawah. Batas ukuran mengikuti pengaturan server.",
      };
    }
    switch (task.contentPlanJenis) {
      case ContentPlanJenis.CAROUSEL:
        return {
          multiple: true,
          accept: "image/*",
          helper:
            "Carousel: unggah beberapa gambar (disarankan urut slide = urutan unggah). Format gambar umum didukung; batas ukuran mengikuti pengaturan server.",
        };
      case ContentPlanJenis.REELS:
        return {
          multiple: false,
          accept: "video/*,image/*",
          helper:
            "Reels: biasanya satu file video pendek (boleh juga gambar jika memang statis). Batas ukuran mengikuti pengaturan server.",
        };
      case ContentPlanJenis.SINGLE_FEED:
        return {
          multiple: false,
          accept: "image/*,video/*",
          helper:
            "Single feed: satu aset utama (gambar atau video). Batas ukuran mengikuti pengaturan server.",
        };
      default:
        return {
          multiple: true,
          accept: undefined,
          helper:
            "Satu atau beberapa file sekaligus. Pratinjau gambar ditampilkan di bawah. Batas ukuran mengikuti pengaturan server.",
        };
    }
  }, [task?.contentPlanItemId, task?.contentPlanJenis]);

  async function persistSave() {
    if (!task) return;
    setSavePending(true);
    try {
      const due = dueDate ? new Date(dueDate) : null;
      const lead =
        leadTimeDays.trim() === "" ? null : Math.max(0, parseInt(leadTimeDays, 10));
      const updated = await updateTask({
        taskId: task.id,
        projectId,
        roomProcess,
        title,
        description: description || null,
        assigneeIds,
        tagIds: selectedTagIds,
        vendorId: vendorId || null,
        priority,
        dueDate: due,
        leadTimeDays: lead,
        isApprovalRequired: approval,
        status,
      });
      toast.success("Tugas disimpan.");
      onTaskPatched?.(task.id, updated);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setSavePending(false);
    }
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
      setSelectedTagIds((prev) =>
        prev.includes(created.id) ? prev : [...prev, created.id],
      );
      setNewTagName("");
      toast.success("Tag ditambahkan.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal membuat tag.");
    } finally {
      setCreateTagPending(false);
    }
  }

  async function onSaveFields() {
    if (!task) return;
    const unfinishedChecklist = task.checklistItems.filter((item) => !item.done).length;
    const markingDoneNow = task.status !== TaskStatus.DONE && status === TaskStatus.DONE;
    if (markingDoneNow && unfinishedChecklist > 0) {
      setDoneWarningCount(unfinishedChecklist);
      setDoneWarningOpen(true);
      return;
    }
    await persistSave();
  }

  async function onAddComment() {
    if (!task || !commentBody.trim()) return;
    setCommentPending(true);
    try {
      await addTaskComment(task.id, commentBody.trim());
      setCommentBody("");
      toast.success("Komentar ditambahkan.");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal.");
    } finally {
      setCommentPending(false);
    }
  }

  async function onAddLinkAttachment() {
    if (!task || !attachLinkUrl.trim()) return;
    setLinkAttachPending(true);
    try {
      await addTaskLinkAttachment(task.id, {
        url: attachLinkUrl.trim(),
        title: attachLinkTitle.trim() || null,
      });
      setAttachLinkUrl("");
      setAttachLinkTitle("");
      toast.success("Tautan ditambahkan.");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menambah tautan.");
    } finally {
      setLinkAttachPending(false);
    }
  }

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    /** `FileList` hidup: reset `value` mengosongkan `files` — salin dulu. */
    const files = input.files?.length ? Array.from(input.files) : [];
    input.value = "";
    if (!files.length || !task) return;
    setUploadPending(true);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        await uploadTaskAttachment(task.id, fd);
      }
      toast.success(
        files.length === 1
          ? "Lampiran diunggah."
          : `${files.length} lampiran diunggah.`,
      );
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unggah gagal.");
    } finally {
      setUploadPending(false);
    }
  }

  async function onAddCheck() {
    if (!task || !newCheck.trim()) return;
    try {
      await addChecklistItem(task.id, newCheck.trim());
      setNewCheck("");
      refresh();
    } catch {
      toast.error("Gagal menambah sub-tugas.");
    }
  }

  async function onArchiveTask() {
    if (!task) return;
    setArchivePending(true);
    try {
      await archiveTask(task.id);
      toast.success("Tugas diarsipkan.");
      refresh();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengarsipkan.");
    } finally {
      setArchivePending(false);
    }
  }

  async function onUnarchiveTask() {
    if (!task) return;
    setArchivePending(true);
    try {
      await unarchiveTask(task.id);
      toast.success("Tugas dipulihkan dari arsip.");
      refresh();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal memulihkan.");
    } finally {
      setArchivePending(false);
    }
  }

  async function onDeleteTask() {
    if (!task) return;
    if (!confirm("Hapus tugas ini beserta komentar & lampiran?")) return;
    try {
      await deleteTask(task.id);
      toast.success("Tugas dihapus.");
      onOpenChange(false);
      refresh();
    } catch {
      toast.error("Gagal menghapus.");
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          showCloseButton
          className="data-[side=right]:sm:max-w-lg flex h-full w-full max-w-full flex-col gap-0 p-0"
        >
          {task ? (
            <>
            <SheetHeader className="border-border shrink-0 border-b px-4 pt-4 pb-2">
              <SheetTitle className="pr-10 leading-snug">{task.title}</SheetTitle>
              <SheetDescription>
                {taskProjectContextLabel(task.project)} · {task.project.name}
              </SheetDescription>
            </SheetHeader>

            {task.contentPlanItemId && task.contentPlanJenis ? (
              <div className="border-border bg-muted/40 shrink-0 border-b px-4 py-3 text-sm">
                <p className="text-foreground font-medium">
                  Tugas dari Content Planning ·{" "}
                  {contentPlanJenisLabel(task.contentPlanJenis)}
                </p>
                <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                  Lampiran di bagian bawah disesuaikan dengan jenis konten. Saat status
                  tugas menjadi <span className="text-foreground font-medium">Selesai</span>
                  , file design dari lampiran tugas disalin ke baris Content Planning
                  (urutan slide = urutan unggah), lalu status design menjadi{" "}
                  <span className="text-foreground font-medium">Dipublikasikan</span>.
                </p>
              </div>
            ) : null}

            <ScrollArea className="min-h-0 flex-1">
              <div className="flex flex-col gap-6 px-4 py-4">
                <section className="space-y-3">
                  <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                    Ringkasan
                  </h3>
                  <div className="space-y-2">
                    <Label>Proyek</Label>
                    <Select
                      value={projectId}
                      items={projectSelectItems}
                      disabled={!isRoomManager}
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
                  {!simpleHub ? (
                    <div className="space-y-2">
                      <Label>Proses alur ruangan</Label>
                      <Select
                        value={roomProcess}
                        items={roomProcessSelectItems}
                        onValueChange={(v) => {
                          if (v) setRoomProcess(v as RoomTaskProcess);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROOM_TASK_PROCESS_ORDER.map((p) => (
                            <SelectItem key={p} value={p}>
                              {roomTaskProcessLabel(p)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-muted-foreground text-xs">
                        Memindahkan tugas ke tab proses lain: ubah nilai ini lalu
                        simpan — kartu akan muncul di tab yang sesuai setelah
                        penyegaran.
                      </p>
                    </div>
                  ) : null}
                  <div className="space-y-2">
                    <Label htmlFor="td-title">Judul</Label>
                    <Input
                      id="td-title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="td-desc">Deskripsi</Label>
                    <Textarea
                      id="td-desc"
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
                          Hanya manager ruangan yang dapat mengubah PIC (anggota
                          ruangan dengan akses fase ini).
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <Label>Prioritas</Label>
                      <Select
                        value={priority}
                        items={prioritySelectItems}
                        onValueChange={(v) => {
                          if (v) setPriority(v as TaskPriority);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.values(TaskPriority) as TaskPriority[]).map(
                            (p) => (
                              <SelectItem key={p} value={p}>
                                {priorityLabel(p)}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label htmlFor="td-due">Deadline</Label>
                      <Input
                        id="td-due"
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select
                        value={status}
                        items={statusSelectItems}
                        disabled={Boolean(task.archivedAt)}
                        onValueChange={(v) => {
                          if (v) setStatus(v as TaskStatus);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.values(TaskStatus) as TaskStatus[]).map(
                            (s) => (
                              <SelectItem key={s} value={s}>
                                {taskStatusLabel(s)}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                      {task.archivedAt ? (
                        <p className="text-muted-foreground text-xs">
                          Status tidak dapat diubah selama tugas diarsipkan.
                          Pulihkan dari Arsip untuk mengubah status.
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label>Vendor</Label>
                      <Select
                        value={vendorId || "__none__"}
                        items={vendorSelectItems}
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
                      <Label htmlFor="td-lt">Lead time (hari)</Label>
                      <Input
                        id="td-lt"
                        type="number"
                        min={0}
                        value={leadTimeDays}
                        onChange={(e) => setLeadTimeDays(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Tag</Label>
                    {availableTags.length === 0 ? (
                      <p className="text-muted-foreground text-xs">
                        Belum ada tag di ruangan ini.
                      </p>
                    ) : (
                      <div className="max-h-36 space-y-1 overflow-auto rounded-md border p-2">
                        {availableTags.map((tag) => (
                          <label key={tag.id} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={selectedTagIds.includes(tag.id)}
                              onCheckedChange={(v) => {
                                const next = v === true;
                                setSelectedTagIds((prev) =>
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
                        ))}
                      </div>
                    )}
                    {isRoomManager ? (
                      <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-md border p-2">
                        <Input
                          placeholder="Tag baru…"
                          value={newTagName}
                          onChange={(e) => setNewTagName(e.target.value)}
                          maxLength={40}
                          disabled={createTagPending || !roomId}
                        />
                        <Input
                          type="color"
                          value={newTagColorHex}
                          onChange={(e) => setNewTagColorHex(e.target.value.toUpperCase())}
                          className="h-9 w-12 p-1"
                          disabled={createTagPending || !roomId}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={
                            createTagPending || !roomId || newTagName.trim().length === 0
                          }
                          onClick={() => void onCreateTag()}
                        >
                          {createTagPending ? "..." : "Tambah"}
                        </Button>
                      </div>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      {availableTags
                        .filter((tag) => selectedTagIds.includes(tag.id))
                        .map((tag) => (
                          <Badge key={tag.id} variant="secondary">
                            <span
                              className="mr-1 inline-block size-2 rounded-full"
                              style={{ backgroundColor: tag.colorHex }}
                              aria-hidden
                            />
                            {tag.name}
                          </Badge>
                        ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="td-appr"
                      checked={approval}
                      disabled={!isRoomManager}
                      onCheckedChange={(c) => setApproval(c === true)}
                    />
                    <Label htmlFor="td-appr" className="text-sm font-normal">
                      Perlu persetujuan CEO
                    </Label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{taskStatusLabel(status)}</Badge>
                    <Badge variant="secondary">{priorityLabel(priority)}</Badge>
                  </div>
                </section>

                <Separator />

                <section className="space-y-3">
                  <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                    Sub-tugas
                  </h3>
                  <ul className="space-y-2">
                    {task.checklistItems.map((c) => (
                      <li
                        key={c.id}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <label className="flex flex-1 items-center gap-2">
                          <Checkbox
                            checked={c.done}
                            onCheckedChange={async (v) => {
                              await toggleChecklistItem(c.id, v === true);
                              refresh();
                            }}
                          />
                          <span
                            className={
                              c.done ? "text-muted-foreground line-through" : ""
                            }
                          >
                            {c.title}
                          </span>
                        </label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          onClick={async () => {
                            await deleteChecklistItem(c.id);
                            refresh();
                          }}
                        >
                          ×
                        </Button>
                      </li>
                    ))}
                  </ul>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Sub-tugas baru…"
                      value={newCheck}
                      onChange={(e) => setNewCheck(e.target.value)}
                    />
                    <Button type="button" variant="secondary" onClick={onAddCheck}>
                      Tambah
                    </Button>
                  </div>
                </section>

                <Separator />

                <section className="space-y-3">
                  <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                    Komentar
                  </h3>
                  <div className="max-h-48 space-y-3 overflow-y-auto rounded-md border border-border p-2">
                    {task.comments.length === 0 ? (
                      <p className="text-muted-foreground text-sm">
                        Belum ada komentar.
                      </p>
                    ) : (
                      task.comments.map((c) => (
                        <div
                          key={c.id}
                          className="border-border/80 space-y-1 border-b pb-2 text-sm last:border-0"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <Link
                              href={`/profile/${c.author.id}`}
                              className="font-medium underline-offset-4 hover:underline focus-visible:underline"
                            >
                              {c.author.name ?? c.author.email}
                            </Link>
                            <div className="flex shrink-0 items-center gap-1">
                              <span className="text-muted-foreground text-xs">
                                {new Date(c.createdAt).toLocaleString("id-ID")}
                              </span>
                              {(c.author.id === currentUserId || isRoomManager) && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  className="text-muted-foreground h-7 w-7"
                                  aria-label="Hapus komentar"
                                  onClick={async () => {
                                    try {
                                      await deleteTaskComment(c.id);
                                      toast.success("Komentar dihapus.");
                                      onTaskPatched?.(task.id, {
                                        comments: task.comments.filter(
                                          (item) => item.id !== c.id,
                                        ),
                                      });
                                    } catch (e) {
                                      toast.error(
                                        e instanceof Error
                                          ? e.message
                                          : "Gagal.",
                                      );
                                    }
                                  }}
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                          <p className="text-muted-foreground whitespace-pre-wrap">
                            {c.body}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                  <Textarea
                    rows={2}
                    placeholder="Tulis komentar…"
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={commentPending || !commentBody.trim()}
                    onClick={onAddComment}
                  >
                    Kirim komentar
                  </Button>
                </section>

                <Separator />

                <section className="space-y-3">
                  <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                    Lampiran
                  </h3>
                  <div className="space-y-2">
                    <Label
                      htmlFor={`task-attach-${task.id}`}
                      className="text-foreground flex items-center gap-2 text-sm font-medium"
                    >
                      <Paperclip className="text-muted-foreground size-4" />
                      Sisipkan file
                    </Label>
                    <input
                      id={`task-attach-${task.id}`}
                      type="file"
                      multiple={contentPlanAttachmentHint.multiple}
                      accept={contentPlanAttachmentHint.accept}
                      disabled={uploadPending}
                      onChange={onFileSelected}
                      className={cn(
                        "border-input bg-background text-foreground file:bg-muted file:text-foreground flex min-h-9 w-full cursor-pointer rounded-lg border px-2.5 py-2 text-sm transition-colors outline-none",
                        "file:mr-3 file:inline-flex file:h-8 file:cursor-pointer file:items-center file:rounded-md file:border-0 file:px-3 file:py-1.5 file:text-sm file:font-medium",
                        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3",
                        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
                      )}
                    />
                    <p className="text-muted-foreground text-xs">
                      {uploadPending ? "Mengunggah…" : contentPlanAttachmentHint.helper}
                    </p>
                  </div>
                  <div className="space-y-2 border-t border-border pt-3">
                    <Label className="text-foreground flex items-center gap-2 text-sm font-medium">
                      <Link2 className="text-muted-foreground size-4" />
                      Sisipkan tautan
                    </Label>
                    <Input
                      id={`task-attach-link-url-${task.id}`}
                      type="url"
                      inputMode="url"
                      placeholder="https://…"
                      value={attachLinkUrl}
                      onChange={(e) => setAttachLinkUrl(e.target.value)}
                      disabled={linkAttachPending}
                      className="font-mono text-sm"
                    />
                    <Input
                      id={`task-attach-link-title-${task.id}`}
                      type="text"
                      placeholder="Judul tampilan (opsional)"
                      value={attachLinkTitle}
                      onChange={(e) => setAttachLinkTitle(e.target.value)}
                      disabled={linkAttachPending}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={
                        linkAttachPending || !attachLinkUrl.trim() || uploadPending
                      }
                      onClick={() => void onAddLinkAttachment()}
                    >
                      {linkAttachPending ? "Menyimpan…" : "Tambah tautan"}
                    </Button>
                    <p className="text-muted-foreground text-xs">
                      Tautan http/https (mis. Drive, Figma, Notion). Tanpa{" "}
                      <code className="text-foreground">https://</code> akan ditambahkan
                      otomatis.
                    </p>
                  </div>
                  <ul className="space-y-3">
                    {task.attachments.map((a) => (
                      <li
                        key={a.id}
                        className="flex flex-col gap-2 rounded-md border border-border px-2 py-2 text-sm"
                      >
                        {a.publicPath && a.mimeType.startsWith("image/") ? (
                          <a
                            href={a.publicPath}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="border-border relative block max-h-40 max-w-full self-start overflow-hidden rounded-md border"
                          >
                            <Image
                              src={a.publicPath}
                              alt={a.fileName}
                              width={400}
                              height={280}
                              unoptimized
                              className="max-h-40 w-auto max-w-full object-contain"
                            />
                          </a>
                        ) : null}
                        <div className="flex items-center justify-between gap-2">
                          <a
                            href={a.linkUrl ?? a.publicPath ?? "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent-foreground flex min-w-0 flex-1 items-center gap-1.5 truncate underline-offset-2 hover:underline"
                          >
                            {a.linkUrl ? (
                              <Link2 className="text-muted-foreground size-3.5 shrink-0" />
                            ) : null}
                            <span className="truncate">{a.fileName}</span>
                          </a>
                          <span className="text-muted-foreground shrink-0 text-xs">
                            {a.linkUrl ? "Tautan" : formatFileSize(a.size)}
                          </span>
                          {(a.uploadedBy.id === currentUserId || isRoomManager) && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="shrink-0"
                              aria-label="Hapus lampiran"
                              onClick={async () => {
                                try {
                                  await deleteTaskAttachment(a.id);
                                  toast.success("Lampiran dihapus.");
                                  onTaskPatched?.(task.id, {
                                    attachments: task.attachments.filter(
                                      (item) => item.id !== a.id,
                                    ),
                                  });
                                } catch (e) {
                                  toast.error(
                                    e instanceof Error ? e.message : "Gagal.",
                                  );
                                }
                              }}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            </ScrollArea>

            <SheetFooter className="border-border shrink-0 flex-row flex-wrap gap-2 border-t">
              {isRoomManager ? (
                <Button variant="destructive" size="sm" onClick={onDeleteTask}>
                  Hapus tugas
                </Button>
              ) : null}
              {isRoomManager &&
              task.status === TaskStatus.DONE &&
              !task.archivedAt ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={archivePending}
                  onClick={() => void onArchiveTask()}
                >
                  Arsipkan
                </Button>
              ) : null}
              {isRoomManager && task.archivedAt ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={archivePending}
                  onClick={() => void onUnarchiveTask()}
                >
                  Pulihkan dari arsip
                </Button>
              ) : null}
              <Button
                className="ml-auto"
                disabled={savePending || !title.trim() || !projectId}
                onClick={onSaveFields}
              >
                Simpan perubahan
              </Button>
            </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog open={doneWarningOpen} onOpenChange={setDoneWarningOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sub-tugas belum selesai</DialogTitle>
            <DialogDescription>
              Masih ada {doneWarningCount} sub-tugas yang belum selesai. Tetap ubah
              status menjadi <b>Selesai</b>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDoneWarningOpen(false)}
            >
              Batalkan
            </Button>
            <Button
              type="button"
              onClick={async () => {
                setDoneWarningOpen(false);
                await persistSave();
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
