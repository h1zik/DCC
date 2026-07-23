"use client";
import { actionErrorMessage } from "@/lib/action-error-message";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { RoomTimelineStatus } from "@prisma/client";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  Flag,
  Loader2,
  Milestone as MilestoneIcon,
  Pencil,
  Plus,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  deleteRoomTimelineMilestone,
  upsertRoomTimelineMilestone,
} from "@/actions/room-view-timeline";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
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
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { SelectItemDef } from "@/lib/select-option-items";

type Milestone = {
  id: string;
  title: string;
  description: string | null;
  date: string;
  status: RoomTimelineStatus;
};

const STATUS_META: Record<
  RoomTimelineStatus,
  {
    label: string;
    icon: typeof CheckCircle2;
    tone: string;
    pill: string;
    node: string;
    dot: string;
  }
> = {
  [RoomTimelineStatus.UPCOMING]: {
    label: "Akan datang",
    icon: CircleDashed,
    tone: "text-muted-foreground",
    pill: "border-border bg-muted/60 text-muted-foreground hover:bg-muted",
    node: "border-border bg-card text-muted-foreground",
    dot: "bg-muted-foreground/50",
  },
  [RoomTimelineStatus.IN_PROGRESS]: {
    label: "Berjalan",
    icon: Loader2,
    tone: "text-primary",
    pill: "border-primary/25 bg-primary/10 text-primary hover:bg-primary/15",
    node: "border-primary/30 bg-primary/10 text-primary",
    dot: "bg-primary",
  },
  [RoomTimelineStatus.DONE]: {
    label: "Selesai",
    icon: CheckCircle2,
    tone: "text-emerald-600 dark:text-emerald-400",
    pill: "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/15 dark:text-emerald-400",
    node: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  [RoomTimelineStatus.BLOCKED]: {
    label: "Terhambat",
    icon: XCircle,
    tone: "text-destructive",
    pill: "border-destructive/25 bg-destructive/10 text-destructive hover:bg-destructive/15",
    node: "border-destructive/30 bg-destructive/10 text-destructive",
    dot: "bg-destructive",
  },
};

const STATUS_ORDER = Object.keys(STATUS_META) as RoomTimelineStatus[];

const STATUS_ITEMS: SelectItemDef[] = STATUS_ORDER.map((k) => ({
  value: k,
  label: STATUS_META[k].label,
}));

const MS_PER_DAY = 86_400_000;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function dayDiff(iso: string): number {
  return Math.round(
    (startOfDay(new Date(iso)).getTime() - startOfDay(new Date()).getTime()) /
      MS_PER_DAY,
  );
}

function fmtFull(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function monthKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}`;
}

function monthLabel(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });
}

function weekdayShort(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { weekday: "short" });
}

function toLocalDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDaysLocal(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toLocalDate(d.toISOString());
}

function relativeInfo(
  m: Milestone,
): { label: string; className: string } | null {
  const diff = dayDiff(m.date);
  if (diff === 0)
    return {
      label: "Hari ini",
      className: "border-primary/25 bg-primary/10 text-primary",
    };
  if (m.status === RoomTimelineStatus.DONE) return null;
  if (diff === 1)
    return {
      label: "Besok",
      className: "border-border bg-muted/60 text-muted-foreground",
    };
  if (diff > 1)
    return {
      label: `${diff} hari lagi`,
      className: "border-border bg-muted/60 text-muted-foreground",
    };
  return {
    label: `Terlambat ${-diff} hari`,
    className: "border-destructive/25 bg-destructive/10 text-destructive",
  };
}

type Entry =
  | { kind: "month"; key: string; label: string }
  | { kind: "today"; key: string }
  | { kind: "milestone"; key: string; m: Milestone };

export function TimelineViewClient({
  viewId,
  milestones,
}: {
  viewId: string;
  milestones: Milestone[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Milestone | null>(null);
  const [statusFilter, setStatusFilter] = useState<RoomTimelineStatus | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    title: "",
    description: "",
    date: "",
    status: RoomTimelineStatus.UPCOMING as RoomTimelineStatus,
  });

  const statusCounts = useMemo(() => {
    const counts = {} as Record<RoomTimelineStatus, number>;
    for (const s of STATUS_ORDER) counts[s] = 0;
    for (const m of milestones) counts[m.status] += 1;
    return counts;
  }, [milestones]);

  const doneCount = statusCounts[RoomTimelineStatus.DONE];
  const progressPct =
    milestones.length > 0
      ? Math.round((doneCount / milestones.length) * 100)
      : 0;

  const overdueCount = useMemo(
    () =>
      milestones.filter(
        (m) => m.status !== RoomTimelineStatus.DONE && dayDiff(m.date) < 0,
      ).length,
    [milestones],
  );

  const nextMilestone = useMemo(
    () =>
      milestones.find(
        (m) => m.status !== RoomTimelineStatus.DONE && dayDiff(m.date) >= 0,
      ) ?? null,
    [milestones],
  );

  const filtered = useMemo(
    () =>
      statusFilter
        ? milestones.filter((m) => m.status === statusFilter)
        : milestones,
    [milestones, statusFilter],
  );

  const entries = useMemo(() => {
    const out: Entry[] = [];
    let lastMonth = "";
    const firstFuture = filtered.findIndex((m) => dayDiff(m.date) >= 0);
    filtered.forEach((m, i) => {
      if (i === firstFuture && i > 0) out.push({ kind: "today", key: "today" });
      const mk = monthKey(m.date);
      if (mk !== lastMonth) {
        out.push({ kind: "month", key: mk, label: monthLabel(m.date) });
        lastMonth = mk;
      }
      out.push({ kind: "milestone", key: m.id, m });
    });
    return out;
  }, [filtered]);

  function openCreate() {
    setEditing(null);
    setForm({
      title: "",
      description: "",
      date: toLocalDate(new Date().toISOString()),
      status: RoomTimelineStatus.UPCOMING,
    });
    setOpen(true);
  }

  function openEdit(m: Milestone) {
    setEditing(m);
    setForm({
      title: m.title,
      description: m.description ?? "",
      date: toLocalDate(m.date),
      status: m.status,
    });
    setOpen(true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error("Judul milestone wajib diisi.");
      return;
    }
    if (!form.date) {
      toast.error("Tanggal milestone wajib diisi.");
      return;
    }
    startTransition(async () => {
      try {
        await upsertRoomTimelineMilestone({
          id: editing?.id,
          viewId,
          title: form.title.trim(),
          description: form.description || null,
          date: new Date(form.date),
          status: form.status,
        });
        toast.success(editing ? "Milestone diperbarui." : "Milestone ditambahkan.");
        setOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menyimpan."));
      }
    });
  }

  function changeStatus(m: Milestone, status: RoomTimelineStatus) {
    if (status === m.status) return;
    startTransition(async () => {
      try {
        await upsertRoomTimelineMilestone({
          id: m.id,
          viewId,
          title: m.title,
          description: m.description,
          date: new Date(m.date),
          status,
        });
        toast.success(`Status diubah ke “${STATUS_META[status].label}”.`);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal mengubah status."));
      }
    });
  }

  function onDelete(m: Milestone) {
    if (!confirm(`Hapus milestone “${m.title}”?`)) return;
    startTransition(async () => {
      try {
        await deleteRoomTimelineMilestone(m.id);
        toast.success("Milestone dihapus.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menghapus."));
      }
    });
  }

  return (
    <div className="space-y-4">
      {milestones.length > 0 ? (
        <Card size="sm">
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-muted-foreground text-xs">
                  Progres linimasa
                </p>
                <p className="text-foreground text-sm font-semibold">
                  {doneCount} dari {milestones.length} milestone selesai
                </p>
              </div>
              <span className="text-foreground shrink-0 text-lg font-bold tabular-nums">
                {progressPct}%
              </span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={progressPct}
              aria-valuemin={0}
              aria-valuemax={100}
              className="bg-muted h-1.5 overflow-hidden rounded-full"
            >
              <div
                className="h-full rounded-full bg-emerald-500 transition-[width] duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
              {STATUS_ORDER.map((s) => (
                <span
                  key={s}
                  className="text-muted-foreground inline-flex items-center gap-1.5"
                >
                  <span
                    className={cn("size-1.5 rounded-full", STATUS_META[s].dot)}
                    aria-hidden
                  />
                  {STATUS_META[s].label}
                  <span className="font-medium tabular-nums">
                    {statusCounts[s]}
                  </span>
                </span>
              ))}
              {overdueCount > 0 ? (
                <span className="text-destructive inline-flex items-center gap-1 font-medium">
                  <AlertTriangle className="size-3" aria-hidden />
                  {overdueCount} terlambat
                </span>
              ) : null}
              {nextMilestone ? (
                <span className="text-muted-foreground inline-flex min-w-0 items-center gap-1">
                  <Flag className="text-primary size-3 shrink-0" aria-hidden />
                  Berikutnya:{" "}
                  <span className="text-foreground truncate font-medium">
                    {nextMilestone.title}
                  </span>
                  {relativeInfo(nextMilestone) ? (
                    <span className="shrink-0">
                      · {relativeInfo(nextMilestone)!.label.toLowerCase()}
                    </span>
                  ) : null}
                </span>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setStatusFilter(null)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
              statusFilter === null
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            Semua
            <span
              className={cn(
                "ml-1 tabular-nums",
                statusFilter === null
                  ? "text-primary-foreground/70"
                  : "text-muted-foreground/60",
              )}
            >
              {milestones.length}
            </span>
          </button>
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter((c) => (c === s ? null : s))}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                statusFilter === s
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              <span
                className={cn("size-1.5 rounded-full", STATUS_META[s].dot)}
                aria-hidden
              />
              {STATUS_META[s].label}
              <span
                className={cn(
                  "tabular-nums",
                  statusFilter === s
                    ? "text-primary-foreground/70"
                    : "text-muted-foreground/60",
                )}
              >
                {statusCounts[s]}
              </span>
            </button>
          ))}
        </div>
        <Button type="button" size="sm" onClick={openCreate} className="gap-1.5">
          <Plus className="size-3.5" aria-hidden />
          Tambah milestone
        </Button>
      </div>

      {milestones.length === 0 ? (
        <EmptyState
          icon={MilestoneIcon}
          title="Belum ada milestone"
          description="Mulai dari H-launch, H-QC, atau target rilis."
          action={
            <Button type="button" size="sm" onClick={openCreate} className="gap-1.5">
              <Plus className="size-3.5" aria-hidden />
              Tambah milestone pertama
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={MilestoneIcon}
          title="Tidak ada milestone dengan status ini"
          description="Pilih filter lain atau tampilkan semua."
        />
      ) : (
        <ol className="border-border/70 relative ml-1 space-y-3 border-l-2 pl-6">
          {entries.map((entry) => {
            if (entry.kind === "month") {
              return (
                <li key={entry.key} className="relative pt-1 first:pt-0">
                  <span
                    aria-hidden
                    className="bg-border absolute top-1/2 -left-[29px] size-2 -translate-y-1/2 rounded-full"
                  />
                  <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                    {entry.label}
                  </span>
                </li>
              );
            }
            if (entry.kind === "today") {
              return (
                <li key={entry.key} className="relative" aria-label="Hari ini">
                  <span
                    aria-hidden
                    className="bg-primary ring-primary/20 absolute top-1/2 -left-[30px] size-2.5 -translate-y-1/2 rounded-full ring-4"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-primary text-xs font-semibold">
                      Hari ini
                    </span>
                    <span className="bg-primary/30 h-px flex-1" aria-hidden />
                    <span className="text-muted-foreground text-xs">
                      {fmtFull(new Date().toISOString())}
                    </span>
                  </div>
                </li>
              );
            }

            const m = entry.m;
            const meta = STATUS_META[m.status];
            const Icon = meta.icon;
            const rel = relativeInfo(m);
            const overdue =
              m.status !== RoomTimelineStatus.DONE && dayDiff(m.date) < 0;
            return (
              <li key={entry.key} className="group relative">
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-3 -left-[35px] flex size-6 items-center justify-center rounded-full border shadow-sm",
                    meta.node,
                  )}
                >
                  <Icon
                    className={cn(
                      "size-3.5",
                      m.status === RoomTimelineStatus.IN_PROGRESS &&
                        "animate-spin",
                    )}
                    aria-hidden
                  />
                </span>
                <Card
                  size="sm"
                  className={cn(
                    "transition-shadow",
                    overdue && "ring-destructive/30",
                  )}
                >
                  <CardContent className="flex min-w-0 gap-3">
                    <div className="bg-muted/50 flex h-fit w-11 shrink-0 flex-col items-center rounded-lg py-1.5">
                      <span className="text-muted-foreground text-[10px] leading-tight uppercase">
                        {weekdayShort(m.date)}
                      </span>
                      <span className="text-foreground text-base leading-tight font-bold tabular-nums">
                        {new Date(m.date).getDate()}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-foreground text-sm font-semibold">
                          {m.title}
                        </h3>
                        {rel ? (
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                              rel.className,
                            )}
                          >
                            {rel.label}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            aria-label="Ubah status milestone"
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors",
                              meta.pill,
                            )}
                          >
                            <Icon
                              className={cn(
                                "size-3",
                                m.status === RoomTimelineStatus.IN_PROGRESS &&
                                  "animate-spin",
                              )}
                              aria-hidden
                            />
                            {meta.label}
                            <ChevronDown
                              className="size-2.5 opacity-60"
                              aria-hidden
                            />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-44">
                            {STATUS_ORDER.map((s) => {
                              const SIcon = STATUS_META[s].icon;
                              return (
                                <DropdownMenuItem
                                  key={s}
                                  onClick={() => changeStatus(m, s)}
                                >
                                  <SIcon
                                    className={cn(
                                      "size-3.5",
                                      STATUS_META[s].tone,
                                    )}
                                    aria-hidden
                                  />
                                  {STATUS_META[s].label}
                                  {s === m.status ? (
                                    <Check
                                      className="ml-auto size-3.5"
                                      aria-hidden
                                    />
                                  ) : null}
                                </DropdownMenuItem>
                              );
                            })}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <p className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                          <CalendarDays className="size-3" aria-hidden />
                          {fmtFull(m.date)}
                        </p>
                      </div>
                      {m.description ? (
                        <p className="text-foreground/75 text-xs whitespace-pre-wrap">
                          {m.description}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-start gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 max-sm:opacity-100">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Ubah milestone"
                        onClick={() => openEdit(m)}
                      >
                        <Pencil className="size-3.5" aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Hapus milestone"
                        onClick={() => onDelete(m)}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ol>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Ubah milestone" : "Tambah milestone"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="tl-title">Judul</Label>
              <Input
                id="tl-title"
                value={form.title}
                maxLength={160}
                onChange={(e) =>
                  setForm((s) => ({ ...s, title: e.target.value }))
                }
                placeholder="Mis. H-QC produksi batch 1"
                required
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tl-date">Tanggal</Label>
                <Input
                  id="tl-date"
                  type="date"
                  value={form.date}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, date: e.target.value }))
                  }
                  required
                />
                <div className="flex flex-wrap gap-1">
                  {[
                    { label: "Hari ini", days: 0 },
                    { label: "+7 hari", days: 7 },
                    { label: "+14 hari", days: 14 },
                    { label: "+30 hari", days: 30 },
                  ].map((opt) => (
                    <button
                      key={opt.days}
                      type="button"
                      onClick={() =>
                        setForm((s) => ({ ...s, date: addDaysLocal(opt.days) }))
                      }
                      className="border-border text-muted-foreground hover:text-foreground hover:bg-muted rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  items={STATUS_ITEMS}
                  onValueChange={(v) =>
                    setForm((s) => ({
                      ...s,
                      status: v as RoomTimelineStatus,
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_ITEMS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tl-desc">Catatan (opsional)</Label>
              <Textarea
                id="tl-desc"
                value={form.description}
                maxLength={2000}
                rows={3}
                onChange={(e) =>
                  setForm((s) => ({ ...s, description: e.target.value }))
                }
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {editing ? "Simpan perubahan" : "Tambah milestone"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
