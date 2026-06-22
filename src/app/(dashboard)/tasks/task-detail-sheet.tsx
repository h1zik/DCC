"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
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
} from "@prisma/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  addChecklistItem,
  archiveTask,
  createTaskTag,
  deleteChecklistItem,
  deleteTask,
  loadTaskDetail,
  toggleChecklistItem,
  unarchiveTask,
  updateChecklistItemTitle,
  updateTask,
} from "@/actions/tasks";
import { addTaskComment, deleteTaskComment } from "@/actions/task-comments";
import {
  addTaskLinkAttachment,
  deleteTaskAttachment,
  uploadTaskAttachment,
} from "@/actions/task-attachments";
import { TaskAttachmentPreviewDialog } from "@/components/tasks/task-attachment-preview-dialog";
import type { TaskAttachmentRow, TaskCommentRow, TaskRow } from "./task-types";
import {
  roomTaskProcessLabel,
  ROOM_TASK_PROCESS_ORDER,
} from "@/lib/room-task-process";
import { taskProjectContextLabel } from "@/lib/room-simple-hub";
import { taskStatusLabel } from "@/lib/task-status-ui";
import { actionErrorMessage } from "@/lib/action-error-message";
import { downloadTaskAttachment } from "@/lib/task-attachment-download-client";
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
import { Textarea } from "@/components/ui/textarea";
import { TaskDocumentUploadOptions } from "@/components/tasks/task-document-upload-options";
import {
  TaskFormEssentials,
  TaskFormPeople,
  TaskFormPlanning,
  TaskFormSection,
  priorityLabel,
} from "@/components/tasks/task-form-ui";
import { listRoomDocumentFoldersForPicker } from "@/actions/room-documents";
import type { RoomFolderNode } from "@/lib/room-document-folders";
import { formatFolderPath } from "@/lib/room-document-folders";
import {
  Download,
  Link2,
  ListChecks,
  MessageSquare,
  Paperclip,
  Pencil,
  Trash2,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  roomId?: string;
  roomTaskTags?: { id: string; roomId: string; name: string; colorHex: string }[];
  isRoomManager: boolean;
  currentUserId: string;
  /** Ruangan HQ/Team tanpa brand: sembunyikan fase proses alur. */
  simpleHub?: boolean;
  documentFolders?: RoomFolderNode[];
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
  roomId,
  roomTaskTags = [],
  isRoomManager,
  currentUserId,
  simpleHub = false,
  documentFolders: documentFoldersProp = [],
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
  const [priority, setPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState(roomTaskTags);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColorHex, setNewTagColorHex] = useState("#6B7280");
  const [createTagPending, setCreateTagPending] = useState(false);
  const [status, setStatus] = useState<TaskStatus>(TaskStatus.TODO);
  const [dueDate, setDueDate] = useState("");
  const [approval, setApproval] = useState(false);
  const [savePending, setSavePending] = useState(false);

  const [newCheck, setNewCheck] = useState("");
  const [checklistEditId, setChecklistEditId] = useState<string | null>(null);
  const [checklistEditDraft, setChecklistEditDraft] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [commentPending, setCommentPending] = useState(false);
  const [uploadPending, setUploadPending] = useState(false);
  const [alsoSaveToDocuments, setAlsoSaveToDocuments] = useState(false);
  const [documentsFolderId, setDocumentsFolderId] = useState<string | null>(
    null,
  );
  const [loadedDocumentFolders, setLoadedDocumentFolders] = useState<
    RoomFolderNode[]
  >([]);
  const [attachLinkUrl, setAttachLinkUrl] = useState("");
  const [attachLinkTitle, setAttachLinkTitle] = useState("");
  const [linkAttachPending, setLinkAttachPending] = useState(false);
  const [archivePending, setArchivePending] = useState(false);
  const [doneWarningOpen, setDoneWarningOpen] = useState(false);
  const [doneWarningCount, setDoneWarningCount] = useState(0);
  const [detailLoading, setDetailLoading] = useState(false);
  /**
   * Komentar & lampiran disimpan di STATE LOKAL sheet — bukan di parent via
   * `onTaskPatched`. Alasan: round-tripping ke parent membuat `task` prop
   * berubah referensi pada setiap fetch, yang memicu form-reset effect
   * di bawah dan jatuh ke loop tak henti `loadTaskDetail` (PIC yang baru
   * di-check ikut hilang). Dengan local state, sheet self-contained.
   */
  const [detailComments, setDetailComments] = useState<TaskCommentRow[]>([]);
  const [detailAttachments, setDetailAttachments] = useState<
    TaskAttachmentRow[]
  >([]);
  const [previewAttachment, setPreviewAttachment] =
    useState<TaskAttachmentRow | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [downloadPendingId, setDownloadPendingId] = useState<string | null>(
    null,
  );

  async function onDownloadAttachment(a: TaskAttachmentRow) {
    if (!a.publicPath) return;
    setDownloadPendingId(a.id);
    try {
      await downloadTaskAttachment(a.id, a.fileName);
    } catch (err) {
      toast.error(actionErrorMessage(err, "Gagal mengunduh."));
    } finally {
      setDownloadPendingId(null);
    }
  }

  useEffect(() => {
    setAvailableTags(roomTaskTags);
  }, [roomTaskTags]);

  const documentFolders =
    documentFoldersProp.length > 0
      ? documentFoldersProp
      : loadedDocumentFolders;

  useEffect(() => {
    if (!open || !roomId || documentFoldersProp.length > 0) return;
    let cancelled = false;
    void listRoomDocumentFoldersForPicker(roomId)
      .then((rows) => {
        if (!cancelled) setLoadedDocumentFolders(rows);
      })
      .catch(() => {
        /* abaikan — opsi dokumen opsional */
      });
    return () => {
      cancelled = true;
    };
  }, [open, roomId, documentFoldersProp.length]);

  /**
   * Form-reset effect — HANYA jalan saat user pindah ke tugas lain (id
   * berubah), BUKAN setiap kali object `task` di-replace oleh parent. Sebelum
   * deps `[task]`, sehingga tiap patch dari parent ikut me-reset assignees
   * dan menghapus check yang baru saja user tambahkan.
   */
  const taskId = task?.id;
  useEffect(() => {
    if (!task) return;
    setProjectId(task.projectId);
    setRoomProcess(task.roomProcess);
    setTitle(task.title);
    setDescription(task.description ?? "");
    setAssigneeIds(task.assignees.map((a) => a.user.id));
    setPriority(task.priority);
    setSelectedTagIds(task.tags.map((t) => t.tagId));
    setStatus(task.status);
    setDueDate(task.dueDate ? task.dueDate.toISOString().slice(0, 10) : "");
    setApproval(task.isApprovalRequired);
    setNewCheck("");
    setChecklistEditId(null);
    setChecklistEditDraft("");
    setCommentBody("");
    setAttachLinkUrl("");
    setAttachLinkTitle("");
    setDetailComments([]);
    setDetailAttachments([]);
    // Sengaja DEPS = [taskId] saja — patch task object lain (mis. setelah
    // save) tidak boleh me-reset form draft yang sedang dikerjakan user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  /**
   * Lazy-load komentar + lampiran saat sheet terbuka untuk tugas tertentu.
   * Inline di effect agar TIDAK ada `useCallback` dep — `loadTaskDetail`
   * adalah server action yang stabil identitas-nya. Penanda `cancelled`
   * mencegah race kalau user pindah tugas saat fetch masih berjalan.
   */
  const loadDetail = useCallback(async (id: string): Promise<void> => {
    setDetailLoading(true);
    try {
      const detail = await loadTaskDetail(id);
      setDetailComments(detail.comments);
      setDetailAttachments(detail.attachments);
    } catch (e) {
      toast.error(
        actionErrorMessage(e, "Gagal memuat komentar & lampiran."));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const lastLoadedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!open) {
      lastLoadedRef.current = null;
      return;
    }
    if (!taskId) return;
    if (lastLoadedRef.current === taskId) return;
    lastLoadedRef.current = taskId;
    void loadDetail(taskId);
  }, [taskId, open, loadDetail]);

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
      const updated = await updateTask({
        taskId: task.id,
        projectId,
        roomProcess,
        title,
        description: description || null,
        assigneeIds,
        tagIds: selectedTagIds,
        vendorId: task.vendorId ?? null,
        priority,
        dueDate: due,
        leadTimeDays: task.leadTimeDays,
        isApprovalRequired: approval,
        status,
      });
      toast.success("Tugas disimpan.");
      onTaskPatched?.(task.id, updated);
    } catch (e) {
      toast.error(actionErrorMessage(e, "Gagal menyimpan."));
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
      toast.error(actionErrorMessage(e, "Gagal membuat tag."));
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
      // Refetch detail saja — daftar tugas tidak butuh refresh karena
      // jumlah komentar tidak ditampilkan di kartu Kanban/list.
      await loadDetail(task.id);
    } catch (e) {
      toast.error(actionErrorMessage(e, "Gagal."));
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
      await loadDetail(task.id);
    } catch (err) {
      toast.error(actionErrorMessage(err, "Gagal menambah tautan."));
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
        if (alsoSaveToDocuments && roomId) {
          fd.append("alsoSaveToDocuments", "true");
          if (documentsFolderId) {
            fd.append("documentsFolderId", documentsFolderId);
          }
        }
        await uploadTaskAttachment(task.id, fd);
      }
      const docHint =
        alsoSaveToDocuments && roomId
          ? ` (+ Documents & files: ${formatFolderPath(documentsFolderId, documentFolders)})`
          : "";
      toast.success(
        (files.length === 1
          ? "Lampiran diunggah."
          : `${files.length} lampiran diunggah.`) + docHint,
      );
      await loadDetail(task.id);
    } catch (err) {
      toast.error(actionErrorMessage(err, "Unggah gagal."));
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

  async function commitChecklistEdit(itemId: string) {
    if (!task) return;
    const title = checklistEditDraft.trim();
    if (!title) {
      toast.error("Judul sub-tugas tidak boleh kosong.");
      return;
    }
    const prev = task.checklistItems.find((x) => x.id === itemId)?.title;
    if (prev === title) {
      setChecklistEditId(null);
      return;
    }
    try {
      await updateChecklistItemTitle({ id: itemId, title });
      setChecklistEditId(null);
      refresh();
    } catch (e) {
      toast.error(
        actionErrorMessage(e, "Gagal menyimpan sub-tugas."));
    }
  }

  function cancelChecklistEdit() {
    setChecklistEditId(null);
    setChecklistEditDraft("");
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
      toast.error(actionErrorMessage(e, "Gagal mengarsipkan."));
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
      toast.error(actionErrorMessage(e, "Gagal memulihkan."));
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
          className="data-[side=right]:sm:max-w-xl flex h-full w-full max-w-full flex-col gap-0 p-0"
        >
          {task ? (
            <>
            <SheetHeader className="border-border shrink-0 border-b px-4 pt-4 pb-3">
              <div className="flex flex-wrap items-start justify-between gap-2 pr-8">
                <div className="min-w-0 space-y-1">
                  <SheetTitle className="text-lg leading-snug">Edit tugas</SheetTitle>
                  <SheetDescription className="line-clamp-2">
                    {taskProjectContextLabel(task.project)} · {task.project.name}
                  </SheetDescription>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  <Badge variant="outline">{taskStatusLabel(status)}</Badge>
                  <Badge variant="secondary">{priorityLabel(priority)}</Badge>
                </div>
              </div>
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

            <Tabs
              defaultValue="detail"
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
            >
              <div className="border-border shrink-0 border-b px-4 pt-2">
                <TabsList
                  variant="line"
                  className="h-9 w-full justify-start overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                    <TabsTrigger value="detail" className="text-xs sm:text-sm">
                      Detail
                    </TabsTrigger>
                    <TabsTrigger
                      value="checklist"
                      className="gap-1.5 text-xs sm:text-sm"
                    >
                      <ListChecks className="size-3.5" />
                      Sub-tugas
                      {task.checklistItems.length > 0 ? (
                        <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0 text-[10px] tabular-nums">
                          {task.checklistItems.length}
                        </span>
                      ) : null}
                    </TabsTrigger>
                    <TabsTrigger
                      value="attachments"
                      className="gap-1.5 text-xs sm:text-sm"
                    >
                      <Paperclip className="size-3.5" />
                      Lampiran
                      {detailAttachments.length > 0 ? (
                        <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0 text-[10px] tabular-nums">
                          {detailAttachments.length}
                        </span>
                      ) : null}
                    </TabsTrigger>
                    <TabsTrigger
                      value="comments"
                      className="gap-1.5 text-xs sm:text-sm"
                    >
                      <MessageSquare className="size-3.5" />
                      Komentar
                      {detailComments.length > 0 ? (
                        <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0 text-[10px] tabular-nums">
                          {detailComments.length}
                        </span>
                      ) : null}
                    </TabsTrigger>
                </TabsList>
              </div>

              <ScrollArea className="min-h-0 flex-1">
                <div className="space-y-4 px-4 py-4">
                  <TabsContent value="detail" className="mt-0 space-y-4">
                    <TaskFormEssentials
                      projectId={projectId}
                      projects={projectSelectItems}
                      onProjectChange={setProjectId}
                      projectDisabled={!isRoomManager}
                      title={title}
                      onTitleChange={setTitle}
                      titleId="td-title"
                      description={description}
                      onDescriptionChange={setDescription}
                      descriptionId="td-desc"
                    />
                    {!simpleHub ? (
                      <TaskFormSection
                        title="Proses alur"
                        description="Pindahkan tugas ke tab proses lain di ruangan ini."
                      >
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
                      </TaskFormSection>
                    ) : null}
                    <TaskFormPlanning
                      status={status}
                      onStatusChange={setStatus}
                      statusDisabled={Boolean(task.archivedAt)}
                      priority={priority}
                      onPriorityChange={setPriority}
                      dueDate={dueDate}
                      onDueDateChange={setDueDate}
                      dueDateId="td-due"
                      approval={approval}
                      onApprovalChange={setApproval}
                      approvalDisabled={!isRoomManager}
                      approvalId="td-appr"
                    />
                    {task.archivedAt ? (
                      <p className="text-muted-foreground rounded-lg border border-dashed px-3 py-2 text-xs">
                        Tugas diarsipkan — status tidak bisa diubah sampai
                        dipulihkan dari Arsip.
                      </p>
                    ) : null}
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
                      selectedTagIds={selectedTagIds}
                      onTagToggle={(tagId, selected) => {
                        setSelectedTagIds((prev) =>
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
                  </TabsContent>

                  <TabsContent value="checklist" className="mt-0">
                    <TaskFormSection
                      icon={<ListChecks className="size-4" />}
                      title="Sub-tugas"
                      description="Pecah pekerjaan jadi langkah-langkah. Centang saat selesai."
                    >
                  {task.checklistItems.length === 0 ? (
                    <p className="text-muted-foreground text-xs">
                      Belum ada sub-tugas. Tambahkan langkah pertama di bawah.
                    </p>
                  ) : null}
                  <ul className="space-y-2">
                    {task.checklistItems.map((c) => (
                      <li
                        key={c.id}
                        className="flex items-start justify-between gap-2 text-sm"
                      >
                        {checklistEditId === c.id ? (
                          <div className="flex min-w-0 flex-1 flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={c.done}
                                disabled
                                className="mt-0.5 shrink-0"
                              />
                              <Input
                                className="h-8 min-w-0 flex-1"
                                value={checklistEditDraft}
                                onChange={(e) =>
                                  setChecklistEditDraft(e.target.value)
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    void commitChecklistEdit(c.id);
                                  }
                                  if (e.key === "Escape") {
                                    e.preventDefault();
                                    cancelChecklistEdit();
                                  }
                                }}
                                onBlur={() => void commitChecklistEdit(c.id)}
                                autoFocus
                              />
                            </div>
                            <p className="text-muted-foreground px-1 text-[10px]">
                              Enter simpan · Esc batal
                            </p>
                          </div>
                        ) : (
                          <label className="flex min-w-0 flex-1 items-center gap-2">
                            <Checkbox
                              checked={c.done}
                              onCheckedChange={async (v) => {
                                await toggleChecklistItem(c.id, v === true);
                                refresh();
                              }}
                            />
                            <span
                              className={
                                c.done
                                  ? "text-muted-foreground line-through"
                                  : ""
                              }
                            >
                              {c.title}
                            </span>
                          </label>
                        )}
                        <div className="flex shrink-0 gap-0.5">
                          {checklistEditId !== c.id ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              aria-label="Edit sub-tugas"
                              className="text-muted-foreground"
                              onClick={() => {
                                setChecklistEditId(c.id);
                                setChecklistEditDraft(c.title);
                              }}
                            >
                              <Pencil className="size-3.5" aria-hidden />
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            aria-label="Hapus sub-tugas"
                            disabled={checklistEditId === c.id}
                            onClick={async () => {
                              await deleteChecklistItem(c.id);
                              if (checklistEditId === c.id) cancelChecklistEdit();
                              refresh();
                            }}
                          >
                            ×
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Sub-tugas baru…"
                      value={newCheck}
                      onChange={(e) => setNewCheck(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void onAddCheck();
                        }
                      }}
                    />
                    <Button type="button" variant="secondary" onClick={onAddCheck}>
                      Tambah
                    </Button>
                  </div>
                    </TaskFormSection>
                  </TabsContent>

                  <TabsContent value="comments" className="mt-0">
                    <TaskFormSection
                      icon={<MessageSquare className="size-4" />}
                      title="Komentar"
                      description={
                        detailLoading && detailComments.length === 0
                          ? "Memuat komentar…"
                          : "Diskusi singkat seputar tugas ini."
                      }
                    >
                  <div className="max-h-48 space-y-3 overflow-y-auto rounded-md border border-border p-2">
                    {detailComments.length === 0 ? (
                      <p className="text-muted-foreground text-sm">
                        {detailLoading ? "Memuat komentar…" : "Belum ada komentar."}
                      </p>
                    ) : (
                      detailComments.map((c) => (
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
                                      setDetailComments((prev) =>
                                        prev.filter((item) => item.id !== c.id),
                                      );
                                    } catch (e) {
                                      toast.error(
                                        actionErrorMessage(e, "Gagal."),
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
                    </TaskFormSection>
                  </TabsContent>

                  <TabsContent value="attachments" className="mt-0">
                    <TaskFormSection
                      icon={<Paperclip className="size-4" />}
                      title="Lampiran"
                      description={
                        uploadPending
                          ? "Mengunggah file…"
                          : contentPlanAttachmentHint.helper
                      }
                    >
                  <div className="space-y-2">
                    <Label
                      htmlFor={`task-attach-${task.id}`}
                      className="sr-only"
                    >
                      Unggah file
                    </Label>
                    <label
                      htmlFor={`task-attach-${task.id}`}
                      className={cn(
                        "border-border hover:border-primary/40 hover:bg-muted/20 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed px-4 py-6 text-center transition-colors",
                        uploadPending && "pointer-events-none opacity-50",
                      )}
                    >
                      <Paperclip className="text-muted-foreground size-5" aria-hidden />
                      <span className="text-foreground text-sm font-medium">
                        Klik untuk pilih file
                      </span>
                    </label>
                    <input
                      id={`task-attach-${task.id}`}
                      type="file"
                      multiple={contentPlanAttachmentHint.multiple}
                      accept={contentPlanAttachmentHint.accept}
                      disabled={uploadPending}
                      onChange={onFileSelected}
                      className="sr-only"
                    />
                    {roomId ? (
                      <TaskDocumentUploadOptions
                        roomId={roomId}
                        folders={documentFolders}
                        enabled={alsoSaveToDocuments}
                        onEnabledChange={setAlsoSaveToDocuments}
                        folderId={documentsFolderId}
                        onFolderIdChange={setDocumentsFolderId}
                        disabled={uploadPending}
                      />
                    ) : null}
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
                  {detailLoading && detailAttachments.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      Memuat lampiran…
                    </p>
                  ) : null}
                  <ul className="space-y-3">
                    {detailAttachments.map((a) => (
                      <li
                        key={a.id}
                        className="flex flex-col gap-2 rounded-md border border-border px-2 py-2 text-sm"
                      >
                        <button
                          type="button"
                          className="hover:border-primary/40 flex w-full flex-col gap-2 rounded-md text-left transition-colors"
                          onClick={() => {
                            setPreviewAttachment(a);
                            setPreviewOpen(true);
                          }}
                        >
                        {a.publicPath && a.mimeType.startsWith("image/") ? (
                          <span className="border-border relative block max-h-40 max-w-full self-start overflow-hidden rounded-md border">
                            <Image
                              src={a.publicPath}
                              alt={a.fileName}
                              width={400}
                              height={280}
                              unoptimized
                              className="max-h-40 w-auto max-w-full object-contain"
                            />
                          </span>
                        ) : null}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-accent-foreground flex min-w-0 flex-1 items-center gap-1.5 truncate">
                            {a.linkUrl ? (
                              <Link2 className="text-muted-foreground size-3.5 shrink-0" />
                            ) : null}
                            <span className="truncate">{a.fileName}</span>
                          </span>
                          <span className="text-muted-foreground shrink-0 text-xs">
                            {a.linkUrl ? "Tautan" : formatFileSize(a.size)}
                          </span>
                          {(a.commentCount ?? 0) > 0 ? (
                            <span
                              className={cn(
                                "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                                (a.unresolvedCommentCount ?? 0) > 0
                                  ? "bg-amber-500/15 text-amber-700"
                                  : "bg-muted text-muted-foreground",
                              )}
                            >
                              {a.commentCount} komentar
                            </span>
                          ) : null}
                        </div>
                        </button>
                        <div className="flex items-center justify-end gap-2">
                          {a.publicPath ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="shrink-0"
                              aria-label="Unduh lampiran"
                              disabled={downloadPendingId === a.id}
                              onClick={() => void onDownloadAttachment(a)}
                            >
                              <Download className="size-3.5" />
                            </Button>
                          ) : a.linkUrl ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="shrink-0"
                              aria-label="Buka tautan"
                              onClick={() =>
                                window.open(
                                  a.linkUrl!,
                                  "_blank",
                                  "noopener,noreferrer",
                                )
                              }
                            >
                              <Link2 className="size-3.5" />
                            </Button>
                          ) : null}
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
                                  setDetailAttachments((prev) =>
                                    prev.filter((item) => item.id !== a.id),
                                  );
                                } catch (e) {
                                  toast.error(
                                    actionErrorMessage(e, "Gagal."),
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
                    </TaskFormSection>
                  </TabsContent>
                </div>
              </ScrollArea>
            </Tabs>

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
                {savePending ? "Menyimpan…" : "Simpan perubahan"}
              </Button>
            </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <TaskAttachmentPreviewDialog
        attachment={previewAttachment}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        users={users}
        currentUserId={currentUserId}
        isRoomManager={isRoomManager}
      />

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
