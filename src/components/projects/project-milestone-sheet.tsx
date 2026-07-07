"use client";

import { actionErrorMessage } from "@/lib/action-error-message";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { RoomTimelineStatus } from "@prisma/client";
import {
  CheckCircle2,
  CircleDashed,
  Flag,
  Loader2,
  Milestone,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  deleteProjectMilestone,
  ensureProjectMilestones,
  resetAllProjectMilestonesToDefault,
  updateProjectMilestoneStatus,
  upsertProjectMilestone,
} from "@/actions/project-milestones";
import {
  buildMilestoneTree,
  computeMilestoneProgress,
  DEFAULT_PROJECT_MILESTONES,
  topLevelMilestones,
  type ProjectMilestoneNode,
} from "@/lib/project-milestones";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

export type ProjectMilestoneDTO = {
  id: string;
  parentId: string | null;
  title: string;
  description: string | null;
  status: RoomTimelineStatus;
  sortOrder: number;
};

const STATUS_META: Record<
  RoomTimelineStatus,
  { label: string; icon: typeof CheckCircle2; tone: string; ring: string }
> = {
  [RoomTimelineStatus.UPCOMING]: {
    label: "Belum mulai",
    icon: CircleDashed,
    tone: "text-muted-foreground",
    ring: "border-muted-foreground/30 bg-muted/50",
  },
  [RoomTimelineStatus.IN_PROGRESS]: {
    label: "Berjalan",
    icon: Loader2,
    tone: "text-primary",
    ring: "border-primary/40 bg-primary/10",
  },
  [RoomTimelineStatus.DONE]: {
    label: "Selesai",
    icon: CheckCircle2,
    tone: "text-emerald-600 dark:text-emerald-400",
    ring: "border-emerald-500/40 bg-emerald-500/10",
  },
  [RoomTimelineStatus.BLOCKED]: {
    label: "Terhambat",
    icon: XCircle,
    tone: "text-destructive",
    ring: "border-destructive/40 bg-destructive/10",
  },
};

const STATUS_OPTIONS = (
  Object.values(RoomTimelineStatus) as RoomTimelineStatus[]
).map((s) => ({
  value: s,
  label: STATUS_META[s].label,
}));

function nextSortOrder(
  flat: ProjectMilestoneDTO[],
  parentId: string | null,
): number {
  const siblings = flat.filter((m) => (m.parentId ?? null) === parentId);
  if (siblings.length === 0) return 0;
  return Math.max(...siblings.map((m) => m.sortOrder)) + 1;
}

function MilestoneCard({
  m,
  indexLabel,
  compact,
  canEdit,
  pending,
  onQuickStatus,
  onEdit,
  onDelete,
  onAddSub,
}: {
  m: ProjectMilestoneDTO;
  indexLabel?: string;
  compact?: boolean;
  canEdit: boolean;
  pending: boolean;
  onQuickStatus: (m: ProjectMilestoneDTO, status: RoomTimelineStatus) => void;
  onEdit: (m: ProjectMilestoneDTO) => void;
  onDelete: (m: ProjectMilestoneDTO) => void;
  onAddSub?: (parentId: string) => void;
}) {
  const meta = STATUS_META[m.status];
  const Icon = meta.icon;
  const isDone = m.status === RoomTimelineStatus.DONE;

  return (
    <div
      className={cn(
        "min-w-0 flex-1 rounded-xl border p-3 transition-colors",
        isDone
          ? "border-emerald-500/25 bg-emerald-500/5"
          : "border-border bg-card",
        compact && "p-2.5",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            {indexLabel ? (
              <span className="text-muted-foreground text-[10px] font-semibold tabular-nums">
                {indexLabel}
              </span>
            ) : null}
            <h3
              className={cn(
                "text-foreground font-semibold leading-snug",
                compact ? "text-xs" : "text-sm",
              )}
            >
              {m.title}
            </h3>
          </div>
          <span
            className={cn(
              "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium",
              meta.ring,
              meta.tone,
            )}
          >
            {meta.label}
          </span>
          {m.description ? (
            <p className="text-muted-foreground pt-1 text-xs leading-relaxed">
              {m.description}
            </p>
          ) : null}
        </div>
        {canEdit ? (
          <div className="flex shrink-0 items-center gap-0.5">
            {m.status !== RoomTimelineStatus.DONE ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                title="Tandai selesai"
                aria-label="Tandai selesai"
                onClick={() => onQuickStatus(m, RoomTimelineStatus.DONE)}
                disabled={pending}
              >
                <CheckCircle2 className="size-3.5 text-emerald-600" />
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Ubah milestone"
              onClick={() => onEdit(m)}
              disabled={pending}
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Hapus milestone"
              onClick={() => onDelete(m)}
              disabled={pending}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ) : null}
      </div>
      {canEdit ? (
        <div className="mt-3 border-t border-border/60 pt-2">
          <Select
            value={m.status}
            items={STATUS_OPTIONS}
            onValueChange={(v) => {
              if (v) onQuickStatus(m, v as RoomTimelineStatus);
            }}
          >
            <SelectTrigger className={cn("text-xs", compact ? "h-7" : "h-8")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      {canEdit && onAddSub && !compact ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground mt-2 h-7 gap-1 px-2 text-xs"
          onClick={() => onAddSub(m.id)}
          disabled={pending}
        >
          <Plus className="size-3" aria-hidden />
          Sub-milestone
        </Button>
      ) : null}
    </div>
  );
}

export function ProjectMilestoneSheet({
  open,
  onOpenChange,
  projectId,
  projectName,
  brandName,
  brandColor,
  roomName,
  milestones,
  canEdit,
  readOnlyHint,
  onMilestonesChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  brandName: string | null;
  brandColor: string | null;
  roomName: string;
  milestones: ProjectMilestoneDTO[];
  canEdit: boolean;
  readOnlyHint?: string;
  onMilestonesChange?: (milestones: ProjectMilestoneDTO[]) => void;
}) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectMilestoneDTO | null>(null);
  const [createParentId, setCreateParentId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [localMilestones, setLocalMilestones] =
    useState<ProjectMilestoneDTO[]>(milestones);
  const [form, setForm] = useState({
    title: "",
    description: "",
    status: RoomTimelineStatus.UPCOMING as RoomTimelineStatus,
  });

  useEffect(() => {
    setLocalMilestones(milestones);
  }, [milestones]);

  function publishMilestones(next: ProjectMilestoneDTO[]) {
    setLocalMilestones(next);
    onMilestonesChange?.(next);
  }

  const tree = useMemo(
    () => buildMilestoneTree(localMilestones),
    [localMilestones],
  );
  const topLevel = useMemo(
    () => topLevelMilestones(localMilestones),
    [localMilestones],
  );

  const progressPct = computeMilestoneProgress(localMilestones);
  const doneCount = topLevel.filter(
    (m) => m.status === RoomTimelineStatus.DONE,
  ).length;
  const subCount = localMilestones.length - topLevel.length;

  function openCreateMain() {
    setEditing(null);
    setCreateParentId(null);
    setForm({
      title: "",
      description: "",
      status: RoomTimelineStatus.UPCOMING,
    });
    setDialogOpen(true);
  }

  function openCreateSub(parentId: string) {
    setEditing(null);
    setCreateParentId(parentId);
    setForm({
      title: "",
      description: "",
      status: RoomTimelineStatus.UPCOMING,
    });
    setDialogOpen(true);
  }

  function openEdit(m: ProjectMilestoneDTO) {
    setEditing(m);
    setCreateParentId(m.parentId);
    setForm({
      title: m.title,
      description: m.description ?? "",
      status: m.status,
    });
    setDialogOpen(true);
  }

  function onEnsureDefaults() {
    startTransition(async () => {
      try {
        await ensureProjectMilestones(projectId);
        toast.success("Milestone default diterapkan.");
        router.refresh();
      } catch (e) {
        toast.error(actionErrorMessage(e, "Gagal menerapkan template."));
      }
    });
  }

  function patchLocalMilestone(id: string, patch: Partial<ProjectMilestoneDTO>) {
    publishMilestones(
      localMilestones.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    );
  }

  function removeLocalMilestone(id: string) {
    publishMilestones(
      localMilestones.filter((x) => x.id !== id && x.parentId !== id),
    );
  }

  function appendLocalMilestone(row: ProjectMilestoneDTO) {
    publishMilestones([...localMilestones, row]);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error("Judul milestone wajib diisi.");
      return;
    }
    const prev = localMilestones;
    const parentId = editing?.parentId ?? createParentId;
    const optimisticId = editing?.id ?? `optimistic-${Date.now()}`;
    const optimisticRow: ProjectMilestoneDTO = {
      id: optimisticId,
      parentId: parentId ?? null,
      title: form.title.trim(),
      description: form.description.trim() || null,
      status: form.status,
      sortOrder:
        editing?.sortOrder ??
        nextSortOrder(prev, parentId ?? null),
    };
    if (editing) {
      patchLocalMilestone(editing.id, optimisticRow);
    } else {
      appendLocalMilestone(optimisticRow);
    }
    setDialogOpen(false);

    startTransition(async () => {
      try {
        await upsertProjectMilestone({
          id: editing?.id,
          projectId,
          parentId: parentId ?? null,
          title: form.title.trim(),
          description: form.description.trim() || null,
          status: form.status,
        });
        toast.success(editing ? "Milestone diperbarui." : "Milestone ditambahkan.");
        router.refresh();
      } catch (err) {
        publishMilestones(prev);
        setDialogOpen(true);
        toast.error(actionErrorMessage(err, "Gagal menyimpan."));
      }
    });
  }

  function onDelete(m: ProjectMilestoneDTO) {
    const childCount = localMilestones.filter((x) => x.parentId === m.id).length;
    const msg =
      childCount > 0
        ? `Hapus milestone “${m.title}” beserta ${childCount} sub-milestone?`
        : `Hapus milestone “${m.title}”?`;
    if (!confirm(msg)) return;
    const prev = localMilestones;
    removeLocalMilestone(m.id);
    startTransition(async () => {
      try {
        await deleteProjectMilestone(m.id);
        toast.success("Milestone dihapus.");
        router.refresh();
      } catch (err) {
        publishMilestones(prev);
        toast.error(actionErrorMessage(err, "Gagal menghapus."));
      }
    });
  }

  function optimisticDefaultMilestones(): ProjectMilestoneDTO[] {
    return DEFAULT_PROJECT_MILESTONES.map((m, i) => ({
      id: `optimistic-default-${i}`,
      parentId: null,
      title: m.title,
      description: m.description,
      status: RoomTimelineStatus.UPCOMING,
      sortOrder: i,
    }));
  }

  function onResetAllProcess() {
    if (
      !confirm(
        "Reset seluruh proses milestone?\n\nSemua tahap (termasuk kustom dan sub-milestone) akan dihapus dan dibuat ulang dengan template 11 tahap default. Semua progres direset ke Belum mulai.",
      )
    ) {
      return;
    }
    const prev = localMilestones;
    publishMilestones(optimisticDefaultMilestones());
    startTransition(async () => {
      try {
        await resetAllProjectMilestonesToDefault(projectId);
        toast.success("Seluruh proses milestone dibuat ulang ke default.");
        router.refresh();
      } catch (err) {
        publishMilestones(prev);
        toast.error(actionErrorMessage(err, "Gagal reset seluruh proses."));
      }
    });
  }

  function onQuickStatus(m: ProjectMilestoneDTO, status: RoomTimelineStatus) {
    if (!canEdit || m.status === status) return;
    const prev = localMilestones;
    const next = prev.map((x) =>
      x.id === m.id ? { ...x, status } : x,
    );
    publishMilestones(next);
    startTransition(async () => {
      try {
        await updateProjectMilestoneStatus(m.id, status);
        router.refresh();
      } catch (err) {
        publishMilestones(prev);
        toast.error(actionErrorMessage(err, "Gagal mengubah status."));
      }
    });
  }

  function renderMainRow(node: ProjectMilestoneNode, index: number, isLast: boolean) {
    const meta = STATUS_META[node.status];
    const Icon = meta.icon;
    const isDone = node.status === RoomTimelineStatus.DONE;

    return (
      <li key={node.id} className="relative flex gap-4 pb-6">
        {!isLast ? (
          <span
            aria-hidden
            className={cn(
              "absolute top-8 left-[15px] w-px",
              isDone ? "bg-emerald-500/50" : "bg-border",
            )}
            style={{ height: "calc(100% - 1.25rem)" }}
          />
        ) : null}
        <div
          className={cn(
            "relative z-[1] flex size-8 shrink-0 items-center justify-center rounded-full border-2 shadow-sm",
            meta.ring,
            meta.tone,
          )}
        >
          <Icon
            className={cn(
              "size-4",
              node.status === RoomTimelineStatus.IN_PROGRESS && "animate-spin",
            )}
            aria-hidden
          />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <MilestoneCard
            m={node}
            indexLabel={String(index + 1)}
            canEdit={canEdit}
            pending={pending}
            onQuickStatus={onQuickStatus}
            onEdit={openEdit}
            onDelete={onDelete}
            onAddSub={canEdit ? openCreateSub : undefined}
          />
          {node.children.length > 0 ? (
            <ul className="border-border ml-2 space-y-2 border-l-2 pl-4">
              {node.children.map((child) => (
                <li key={child.id}>
                  <MilestoneCard
                    m={child}
                    compact
                    canEdit={canEdit}
                    pending={pending}
                    onQuickStatus={onQuickStatus}
                    onEdit={openEdit}
                    onDelete={onDelete}
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </li>
    );
  }

  const dialogTitle = editing
    ? "Ubah milestone"
    : createParentId
      ? "Tambah sub-milestone"
      : "Tambah milestone utama";

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
        >
          <SheetHeader className="border-border space-y-4 border-b px-5 py-5 text-left">
            <div className="flex items-start gap-3">
              <div className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl">
                <Milestone className="size-5" aria-hidden />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <SheetTitle className="text-base leading-snug">{projectName}</SheetTitle>
                <SheetDescription className="flex flex-wrap items-center gap-1.5 text-xs">
                  {brandColor ? (
                    <span
                      className="size-2 shrink-0 rounded-full border border-border"
                      style={{ backgroundColor: brandColor }}
                      aria-hidden
                    />
                  ) : null}
                  <span>{brandName ?? "—"}</span>
                  <span aria-hidden>·</span>
                  <span>{roomName}</span>
                </SheetDescription>
              </div>
            </div>

            <div className="bg-muted/40 space-y-3 rounded-xl border border-border p-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
                    Progress milestone utama
                  </p>
                  <p className="text-foreground mt-0.5 text-2xl font-bold tabular-nums">
                    {progressPct}%
                  </p>
                </div>
                <div className="text-muted-foreground text-right text-xs">
                  <span className="text-foreground font-semibold tabular-nums">
                    {doneCount}
                  </span>
                  <span> / {topLevel.length} utama selesai</span>
                  {subCount > 0 ? (
                    <p className="mt-0.5 tabular-nums">{subCount} sub-milestone</p>
                  ) : null}
                </div>
              </div>
              <Progress value={progressPct} className="h-2.5" />
              {canEdit && localMilestones.length > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-destructive/35 text-destructive hover:bg-destructive/10 w-full gap-1.5"
                  onClick={onResetAllProcess}
                  disabled={pending}
                >
                  <RotateCcw className="size-3.5" aria-hidden />
                  Reset seluruh proses ke default
                </Button>
              ) : null}
            </div>
          </SheetHeader>

          {readOnlyHint ? (
            <p className="text-muted-foreground border-amber-500/30 bg-amber-500/8 mx-5 rounded-lg border px-3 py-2 text-xs leading-relaxed">
              {readOnlyHint}
            </p>
          ) : null}

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-muted-foreground text-sm">
                {topLevel.length} tahap utama
                {subCount > 0 ? ` · ${subCount} sub` : ""}
              </p>
              {canEdit ? (
                <Button
                  type="button"
                  size="sm"
                  className="gap-1.5"
                  onClick={openCreateMain}
                  disabled={pending}
                >
                  <Plus className="size-3.5" aria-hidden />
                  Tahap utama
                </Button>
              ) : null}
            </div>

            {tree.length === 0 ? (
              <div className="border-border flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
                <Flag className="text-muted-foreground/50 size-10" aria-hidden />
                <p className="text-sm font-medium">Belum ada milestone</p>
                <p className="text-muted-foreground max-w-xs text-xs leading-relaxed">
                  Terapkan template 11 tahap standar (Idea Development → Launch)
                  atau tambahkan milestone sendiri.
                </p>
                {canEdit ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={onEnsureDefaults}
                    disabled={pending}
                  >
                    Pakai template default
                  </Button>
                ) : null}
              </div>
            ) : (
              <ol className="relative space-y-0">
                {tree.map((node, index) =>
                  renderMainRow(node, index, index === tree.length - 1),
                )}
              </ol>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="pm-title">Judul</Label>
              <Input
                id="pm-title"
                value={form.title}
                maxLength={200}
                onChange={(e) =>
                  setForm((s) => ({ ...s, title: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pm-desc">Deskripsi (opsional)</Label>
              <Textarea
                id="pm-desc"
                value={form.description}
                rows={3}
                maxLength={2000}
                onChange={(e) =>
                  setForm((s) => ({ ...s, description: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.status}
                items={STATUS_OPTIONS}
                onValueChange={(v) => {
                  if (v) setForm((s) => ({ ...s, status: v as RoomTimelineStatus }));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Batal
              </Button>
              <Button type="submit" disabled={pending}>
                {editing ? "Simpan" : "Tambah"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
