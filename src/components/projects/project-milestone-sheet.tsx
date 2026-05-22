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
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  deleteProjectMilestone,
  ensureProjectMilestones,
  updateProjectMilestoneStatus,
  upsertProjectMilestone,
} from "@/actions/project-milestones";
import { computeMilestoneProgress } from "@/lib/project-milestones";
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
  /** Pesan untuk CEO / admin (mode pantau). */
  readOnlyHint?: string;
  /** Sinkronkan kartu proyek di halaman utama tanpa refresh manual. */
  onMilestonesChange?: (milestones: ProjectMilestoneDTO[]) => void;
}) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectMilestoneDTO | null>(null);
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

  const sorted = useMemo(
    () => [...localMilestones].sort((a, b) => a.sortOrder - b.sortOrder),
    [localMilestones],
  );

  const progressPct = computeMilestoneProgress(sorted);
  const doneCount = sorted.filter((m) => m.status === RoomTimelineStatus.DONE).length;

  function openCreate() {
    setEditing(null);
    setForm({
      title: "",
      description: "",
      status: RoomTimelineStatus.UPCOMING,
    });
    setDialogOpen(true);
  }

  function openEdit(m: ProjectMilestoneDTO) {
    setEditing(m);
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
    publishMilestones(localMilestones.filter((x) => x.id !== id));
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
    const optimisticId = editing?.id ?? `optimistic-${Date.now()}`;
    const optimisticRow: ProjectMilestoneDTO = {
      id: optimisticId,
      title: form.title.trim(),
      description: form.description.trim() || null,
      status: form.status,
      sortOrder: editing?.sortOrder ?? prev.length,
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
    if (!confirm(`Hapus milestone “${m.title}”?`)) return;
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
                    Progress milestone
                  </p>
                  <p className="text-foreground mt-0.5 text-2xl font-bold tabular-nums">
                    {progressPct}%
                  </p>
                </div>
                <div className="text-muted-foreground text-right text-xs">
                  <span className="text-foreground font-semibold tabular-nums">
                    {doneCount}
                  </span>
                  <span> / {sorted.length} selesai</span>
                </div>
              </div>
              <Progress value={progressPct} className="h-2.5" />
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
                {sorted.length} tahap dalam linimasa
              </p>
              {canEdit ? (
                <Button
                  type="button"
                  size="sm"
                  className="gap-1.5"
                  onClick={openCreate}
                  disabled={pending}
                >
                  <Plus className="size-3.5" aria-hidden />
                  Tambah
                </Button>
              ) : null}
            </div>

            {sorted.length === 0 ? (
              <div className="border-border flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
                <Flag className="text-muted-foreground/50 size-10" aria-hidden />
                <p className="text-sm font-medium">Belum ada milestone</p>
                <p className="text-muted-foreground max-w-xs text-xs leading-relaxed">
                  Terapkan template 9 tahap standar (Market Validation → Production)
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
                {sorted.map((m, index) => {
                  const meta = STATUS_META[m.status];
                  const Icon = meta.icon;
                  const isLast = index === sorted.length - 1;
                  const isDone = m.status === RoomTimelineStatus.DONE;

                  return (
                    <li key={m.id} className="relative flex gap-4 pb-6">
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
                            m.status === RoomTimelineStatus.IN_PROGRESS &&
                              "animate-spin",
                          )}
                          aria-hidden
                        />
                      </div>
                      <div
                        className={cn(
                          "min-w-0 flex-1 rounded-xl border p-3 transition-colors",
                          isDone
                            ? "border-emerald-500/25 bg-emerald-500/5"
                            : "border-border bg-card",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-muted-foreground text-[10px] font-semibold tabular-nums">
                                {index + 1}
                              </span>
                              <h3 className="text-foreground text-sm font-semibold leading-snug">
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
                                  onClick={() =>
                                    onQuickStatus(m, RoomTimelineStatus.DONE)
                                  }
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
                                onClick={() => openEdit(m)}
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
                              onValueChange={(v) => {
                                if (v) {
                                  onQuickStatus(m, v as RoomTimelineStatus);
                                }
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs">
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
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Ubah milestone" : "Tambah milestone"}
            </DialogTitle>
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
