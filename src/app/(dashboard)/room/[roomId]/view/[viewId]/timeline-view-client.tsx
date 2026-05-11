"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { RoomTimelineStatus } from "@prisma/client";
import {
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  Loader2,
  Milestone,
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

type Milestone = {
  id: string;
  title: string;
  description: string | null;
  date: string;
  status: RoomTimelineStatus;
};

const STATUS_META: Record<
  RoomTimelineStatus,
  { label: string; icon: typeof CheckCircle2; tone: string }
> = {
  [RoomTimelineStatus.UPCOMING]: {
    label: "Akan datang",
    icon: CircleDashed,
    tone: "text-muted-foreground",
  },
  [RoomTimelineStatus.IN_PROGRESS]: {
    label: "Berjalan",
    icon: Loader2,
    tone: "text-primary",
  },
  [RoomTimelineStatus.DONE]: {
    label: "Selesai",
    icon: CheckCircle2,
    tone: "text-emerald-600 dark:text-emerald-400",
  },
  [RoomTimelineStatus.BLOCKED]: {
    label: "Terhambat",
    icon: XCircle,
    tone: "text-destructive",
  },
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function toLocalDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

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
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    title: "",
    description: "",
    date: "",
    status: RoomTimelineStatus.UPCOMING as RoomTimelineStatus,
  });

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
        toast.error(err instanceof Error ? err.message : "Gagal menyimpan.");
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
        toast.error(err instanceof Error ? err.message : "Gagal menghapus.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {milestones.length} milestone
        </p>
        <Button type="button" size="sm" onClick={openCreate} className="gap-1.5">
          <Plus className="size-3.5" aria-hidden />
          Tambah milestone
        </Button>
      </div>

      {milestones.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground flex flex-col items-center gap-2 py-10 text-center text-sm">
            <Milestone className="text-muted-foreground/60 size-8" aria-hidden />
            Belum ada milestone. Mulai dari H-launch, H-QC, atau target rilis.
          </CardContent>
        </Card>
      ) : (
        <ol className="relative space-y-3 border-l border-border pl-6">
          {milestones.map((m) => {
            const meta = STATUS_META[m.status];
            const Icon = meta.icon;
            return (
              <li key={m.id} className="relative">
                <span
                  aria-hidden
                  className={cn(
                    "border-border bg-card absolute -left-[34px] flex size-6 items-center justify-center rounded-full border shadow-sm",
                    meta.tone,
                  )}
                >
                  <Icon
                    className={cn(
                      "size-3.5",
                      m.status === RoomTimelineStatus.IN_PROGRESS && "animate-spin",
                    )}
                    aria-hidden
                  />
                </span>
                <Card>
                  <CardContent className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-foreground text-sm font-semibold">
                          {m.title}
                        </h3>
                        <span
                          className={cn(
                            "border-border bg-muted/60 inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                            meta.tone,
                          )}
                        >
                          {meta.label}
                        </span>
                      </div>
                      <p className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                        <CalendarDays className="size-3" aria-hidden />
                        {fmt(m.date)}
                      </p>
                      {m.description ? (
                        <p className="text-foreground/80 text-xs whitespace-pre-wrap">
                          {m.description}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
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
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={form.status}
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
                    {(Object.keys(STATUS_META) as RoomTimelineStatus[]).map(
                      (k) => (
                        <SelectItem key={k} value={k}>
                          {STATUS_META[k].label}
                        </SelectItem>
                      ),
                    )}
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
