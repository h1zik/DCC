"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ScheduleRecurrence, UserRole } from "@prisma/client";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { toast } from "sonner";
import {
  createScheduleEvent,
  deleteScheduleEvent,
  deleteScheduleEventsBulk,
  updateScheduleEvent,
} from "@/actions/schedule-events";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";

type UserPick = { id: string; name: string | null; email: string };

export type ScheduleEventRow = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  recurrence: ScheduleRecurrence;
  recurrenceUntil: string | null;
  seriesId: string | null;
  createdById: string;
  createdBy: { name: string | null; email: string };
  participants: { user: UserPick }[];
};

const WEEK_STARTS_ON = 1 as const; // Senin
const WEEKDAY_LABELS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"] as const;

function toDatetimeLocalValue(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function defaultSlotOnDay(day: Date): string {
  const d = new Date(day);
  d.setHours(9, 0, 0, 0);
  return toDatetimeLocalValue(d);
}

function canManageEvent(
  role: UserRole,
  currentUserId: string,
  createdById: string,
): boolean {
  return role === UserRole.CEO || currentUserId === createdById;
}

function chunkWeeks(days: Date[]): Date[][] {
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
}

export function ScheduleClient({
  initialEvents,
  users,
  currentUserId,
  currentRole,
}: {
  initialEvents: ScheduleEventRow[];
  users: UserPick[];
  currentUserId: string;
  currentRole: UserRole;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));

  const [createOpen, setCreateOpen] = useState(false);
  const [participantFilter, setParticipantFilter] = useState("");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [startsAtLocal, setStartsAtLocal] = useState("");
  const [recurrence, setRecurrence] = useState<ScheduleRecurrence>(ScheduleRecurrence.NONE);
  const [recurrenceUntilLocal, setRecurrenceUntilLocal] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    const s = new Set<string>();
    s.add(currentUserId);
    return s;
  });

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduleEventRow | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStartsAtLocal, setEditStartsAtLocal] = useState("");
  const [editSelectedIds, setEditSelectedIds] = useState<Set<string>>(new Set());
  const [editRecurrence, setEditRecurrence] = useState<ScheduleRecurrence>(
    ScheduleRecurrence.NONE,
  );
  const [editRecurrenceUntilLocal, setEditRecurrenceUntilLocal] = useState("");
  const [editApplyTo, setEditApplyTo] = useState<"SINGLE" | "SERIES">("SINGLE");
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkSelectedEventIds, setBulkSelectedEventIds] = useState<Set<string>>(
    new Set(),
  );

  const filteredUsers = useMemo(() => {
    const q = participantFilter.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const label = (u.name?.trim() || u.email).toLowerCase();
      return label.includes(q) || u.email.toLowerCase().includes(q);
    });
  }, [users, participantFilter]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(viewMonth);
    const monthEnd = endOfMonth(viewMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: WEEK_STARTS_ON });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: WEEK_STARTS_ON });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [viewMonth]);

  const weeks = useMemo(() => chunkWeeks(calendarDays), [calendarDays]);

  const eventsByDayKey = useMemo(() => {
    const map = new Map<string, ScheduleEventRow[]>();
    for (const ev of initialEvents) {
      const d = new Date(ev.startsAt);
      const key = format(d, "yyyy-MM-dd");
      const list = map.get(key) ?? [];
      list.push(ev);
      map.set(key, list);
    }
    for (const [, list] of map) {
      list.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    }
    return map;
  }, [initialEvents]);

  const manageableEventsInMonth = useMemo(() => {
    return initialEvents
      .filter(
        (ev) =>
          isSameMonth(new Date(ev.startsAt), viewMonth) &&
          canManageEvent(currentRole, currentUserId, ev.createdById),
      )
      .sort(
        (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
      );
  }, [currentRole, currentUserId, initialEvents, viewMonth]);

  function resetCreateForm(prefillDay?: Date) {
    setTitle("");
    setLocation("");
    setDescription("");
    setParticipantFilter("");
    setSelectedIds(new Set([currentUserId]));
    setStartsAtLocal(prefillDay ? defaultSlotOnDay(prefillDay) : "");
    setRecurrence(ScheduleRecurrence.NONE);
    setRecurrenceUntilLocal("");
  }

  function openCreateDialog(prefillDay?: Date) {
    resetCreateForm(prefillDay);
    setCreateOpen(true);
  }

  function toggleUser(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleEditUser(id: string) {
    setEditSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openEdit(ev: ScheduleEventRow) {
    setEditing(ev);
    setEditTitle(ev.title);
    setEditLocation(ev.location ?? "");
    setEditDescription(ev.description ?? "");
    setEditStartsAtLocal(toDatetimeLocalValue(new Date(ev.startsAt)));
    setEditSelectedIds(new Set(ev.participants.map((p) => p.user.id)));
    setEditRecurrence(ev.recurrence);
    setEditRecurrenceUntilLocal(
      ev.recurrenceUntil ? ev.recurrenceUntil.slice(0, 10) : "",
    );
    setEditApplyTo("SINGLE");
    setEditOpen(true);
  }

  function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Isi judul acara.");
      return;
    }
    if (!startsAtLocal) {
      toast.error("Pilih tanggal & waktu mulai.");
      return;
    }
    const ids = [...selectedIds];
    if (ids.length === 0) {
      toast.error("Pilih minimal satu peserta untuk pengingat.");
      return;
    }
    if (recurrence !== ScheduleRecurrence.NONE && !recurrenceUntilLocal) {
      toast.error("Pilih tanggal selesai pengulangan.");
      return;
    }
    startTransition(async () => {
      try {
        await createScheduleEvent({
          title: title.trim(),
          description: description.trim() || null,
          location: location.trim() || null,
          startsAt: new Date(startsAtLocal),
          participantUserIds: ids,
          recurrence,
          recurrenceUntil:
            recurrence === ScheduleRecurrence.NONE
              ? null
              : new Date(`${recurrenceUntilLocal}T23:59`),
        });
        toast.success("Jadwal dibuat.");
        setCreateOpen(false);
        resetCreateForm();
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Gagal menyimpan.");
      }
    });
  }

  function onSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    if (!editTitle.trim()) {
      toast.error("Isi judul acara.");
      return;
    }
    if (!editStartsAtLocal) {
      toast.error("Pilih tanggal & waktu mulai.");
      return;
    }
    const ids = [...editSelectedIds];
    if (ids.length === 0) {
      toast.error("Pilih minimal satu peserta untuk pengingat.");
      return;
    }
    if (
      editApplyTo === "SERIES" &&
      editRecurrence !== ScheduleRecurrence.NONE &&
      !editRecurrenceUntilLocal
    ) {
      toast.error("Pilih tanggal selesai pengulangan untuk seri.");
      return;
    }
    startTransition(async () => {
      try {
        await updateScheduleEvent({
          eventId: editing.id,
          title: editTitle.trim(),
          description: editDescription.trim() || null,
          location: editLocation.trim() || null,
          startsAt: new Date(editStartsAtLocal),
          participantUserIds: ids,
          recurrence: editRecurrence,
          recurrenceUntil:
            editRecurrence === ScheduleRecurrence.NONE
              ? null
              : new Date(`${editRecurrenceUntilLocal}T23:59`),
          applyTo: editApplyTo,
        });
        toast.success("Jadwal diperbarui.");
        setEditOpen(false);
        setEditing(null);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Gagal menyimpan.");
      }
    });
  }

  function onDeleteFromEdit() {
    if (!editing) return;
    if (!confirm(`Hapus jadwal "${editing.title}"?`)) return;
    startTransition(async () => {
      try {
        await deleteScheduleEvent({ eventId: editing.id });
        toast.success("Jadwal dihapus.");
        setEditOpen(false);
        setEditing(null);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Gagal menghapus.");
      }
    });
  }

  function openBulkDelete() {
    setBulkSelectedEventIds(new Set());
    setBulkDeleteOpen(true);
  }

  function toggleBulkEvent(eventId: string) {
    setBulkSelectedEventIds((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  }

  function onConfirmBulkDelete() {
    const ids = [...bulkSelectedEventIds];
    if (ids.length === 0) {
      toast.error("Pilih minimal satu jadwal.");
      return;
    }
    if (!confirm(`Hapus ${ids.length} jadwal terpilih?`)) return;
    startTransition(async () => {
      try {
        await deleteScheduleEventsBulk({ eventIds: ids });
        toast.success(`${ids.length} jadwal dihapus.`);
        setBulkDeleteOpen(false);
        setBulkSelectedEventIds(new Set());
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Gagal hapus massal.");
      }
    });
  }

  const today = new Date();

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar mirip Google Calendar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-9 shrink-0"
            aria-label="Bulan sebelumnya"
            disabled={pending}
            onClick={() => setViewMonth((m) => addMonths(m, -1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-9 shrink-0"
            aria-label="Bulan berikutnya"
            disabled={pending}
            onClick={() => setViewMonth((m) => addMonths(m, 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
          <h2 className="text-lg font-semibold tracking-tight capitalize">
            {format(viewMonth, "MMMM yyyy", { locale: idLocale })}
          </h2>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="ml-1"
            disabled={pending}
            onClick={() => setViewMonth(startOfMonth(new Date()))}
          >
            Hari ini
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="destructive"
            className="gap-2"
            disabled={pending || manageableEventsInMonth.length === 0}
            onClick={() => openBulkDelete()}
          >
            <Trash2 className="size-4" />
            Hapus massal
          </Button>
          <Button
            type="button"
            className="gap-2"
            disabled={pending}
            onClick={() => openCreateDialog()}
          >
            <Plus className="size-4" />
            Tambah jadwal
          </Button>
        </div>
      </div>

      {/* Grid kalender */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-7 border-b border-border bg-muted/40">
            {WEEKDAY_LABELS.map((d) => (
              <div
                key={d}
                className="text-muted-foreground border-border border-r px-2 py-2 text-center text-xs font-semibold tracking-wide uppercase last:border-r-0"
              >
                {d}
              </div>
            ))}
          </div>
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7">
              {week.map((day) => {
                const inMonth = isSameMonth(day, viewMonth);
                const isToday = isSameDay(day, today);
                const key = format(day, "yyyy-MM-dd");
                const dayEvents = eventsByDayKey.get(key) ?? [];
                const visible = dayEvents.slice(0, 3);
                const more = dayEvents.length - visible.length;

                return (
                  <div
                    key={key}
                    role="button"
                    tabIndex={0}
                    onClick={() => openCreateDialog(day)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openCreateDialog(day);
                      }
                    }}
                    className={cn(
                      "border-border relative min-h-[112px] cursor-pointer border-r border-b p-1.5 transition-colors last:border-r-0 hover:bg-muted/30",
                      !inMonth && "bg-muted/15 text-muted-foreground",
                      isToday && "bg-primary/5 ring-1 ring-inset ring-primary/25",
                    )}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                          isToday && "bg-primary text-primary-foreground",
                          !inMonth && "text-muted-foreground",
                        )}
                      >
                        {format(day, "d")}
                      </span>
                    </div>
                    <div className="mt-1 space-y-0.5" onClick={(e) => e.stopPropagation()}>
                      {visible.map((ev) => {
                        const t = format(new Date(ev.startsAt), "HH:mm");
                        return (
                          <button
                            key={ev.id}
                            type="button"
                            className="hover:bg-accent/80 flex w-full min-w-0 items-center gap-1 rounded border border-transparent bg-accent/25 px-1 py-0.5 text-left text-[11px] leading-tight text-accent-foreground shadow-sm"
                            title={ev.title}
                            disabled={pending}
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(ev);
                            }}
                          >
                            <span className="text-muted-foreground shrink-0 font-mono tabular-nums">
                              {t}
                            </span>
                            <span className="truncate font-medium">{ev.title}</span>
                          </button>
                        );
                      })}
                      {more > 0 ? (
                        <p className="text-muted-foreground px-1 text-[10px] font-medium">
                          +{more} lainnya
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <p className="text-muted-foreground text-center text-xs">
        Klik tanggal untuk buat jadwal di hari itu (jam default 09:00) · klik acara untuk edit
      </p>

      {/* Dialog: tambah jadwal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[min(90vh,640px)] max-w-md overflow-y-auto">
          <form onSubmit={onCreate} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Tambah jadwal</DialogTitle>
              <DialogDescription>
                Isi detail acara dan pilih siapa yang mendapat pengingat (H-1 dan ±1 jam sebelum mulai).
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="sch-title">Judul</Label>
              <Input
                id="sch-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Meeting, review, …"
                disabled={pending}
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sch-when">Waktu mulai</Label>
              <Input
                id="sch-when"
                type="datetime-local"
                value={startsAtLocal}
                onChange={(e) => setStartsAtLocal(e.target.value)}
                disabled={pending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sch-recur">Pengulangan</Label>
              <select
                id="sch-recur"
                value={recurrence}
                onChange={(e) =>
                  setRecurrence(e.target.value as ScheduleRecurrence)
                }
                disabled={pending}
                className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="NONE">Sekali saja</option>
                <option value="DAILY">Setiap hari</option>
                <option value="WEEKLY">Setiap minggu</option>
                <option value="MONTHLY">Setiap bulan</option>
              </select>
            </div>
            {recurrence !== ScheduleRecurrence.NONE ? (
              <div className="space-y-2">
                <Label htmlFor="sch-recur-until">Ulangi sampai tanggal</Label>
                <Input
                  id="sch-recur-until"
                  type="date"
                  value={recurrenceUntilLocal}
                  onChange={(e) => setRecurrenceUntilLocal(e.target.value)}
                  disabled={pending}
                />
                <p className="text-muted-foreground text-xs">
                  Event akan dibuat otomatis sampai tanggal ini (maksimal 120 kejadian).
                </p>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="sch-loc">Lokasi / link (opsional)</Label>
              <Input
                id="sch-loc"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ruang / Zoom …"
                disabled={pending}
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sch-desc">Deskripsi (opsional)</Label>
              <Textarea
                id="sch-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                disabled={pending}
                maxLength={2000}
              />
            </div>
            <div className="space-y-2">
              <Label>Peserta</Label>
              <Input
                placeholder="Cari nama atau email…"
                value={participantFilter}
                onChange={(e) => setParticipantFilter(e.target.value)}
                disabled={pending}
                className="text-sm"
              />
              <ScrollArea className="h-44 rounded-md border border-border p-2">
                <ul className="space-y-2">
                  {filteredUsers.map((u) => (
                    <li key={u.id} className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        id={`p-${u.id}`}
                        className="mt-1"
                        checked={selectedIds.has(u.id)}
                        onChange={() => toggleUser(u.id)}
                        disabled={pending}
                      />
                      <label htmlFor={`p-${u.id}`} className="min-w-0 cursor-pointer leading-snug">
                        <span className="font-medium">{u.name?.trim() || u.email}</span>
                        {u.name?.trim() ? (
                          <span className="text-muted-foreground block text-xs">{u.email}</span>
                        ) : null}
                      </label>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={pending}
              >
                Batal
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Menyimpan…" : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: edit */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[min(90vh,640px)] max-w-md overflow-y-auto">
          <form onSubmit={onSaveEdit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Edit jadwal</DialogTitle>
              <DialogDescription>Ubah detail atau peserta pengingat.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="ed-title">Judul</Label>
              <Input
                id="ed-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                disabled={pending}
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ed-when">Waktu mulai</Label>
              <Input
                id="ed-when"
                type="datetime-local"
                value={editStartsAtLocal}
                onChange={(e) => setEditStartsAtLocal(e.target.value)}
                disabled={pending}
              />
            </div>
            {editing?.seriesId ? (
              <div className="space-y-2">
                <Label htmlFor="ed-apply">Terapkan perubahan ke</Label>
                <select
                  id="ed-apply"
                  value={editApplyTo}
                  onChange={(e) => setEditApplyTo(e.target.value as "SINGLE" | "SERIES")}
                  disabled={pending}
                  className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="SINGLE">Acara ini saja</option>
                  <option value="SERIES">Seluruh seri pengulangan</option>
                </select>
              </div>
            ) : null}
            {editApplyTo === "SERIES" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="ed-recur">Pengulangan</Label>
                  <select
                    id="ed-recur"
                    value={editRecurrence}
                    onChange={(e) => setEditRecurrence(e.target.value as ScheduleRecurrence)}
                    disabled={pending}
                    className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value={ScheduleRecurrence.DAILY}>Setiap hari</option>
                    <option value={ScheduleRecurrence.WEEKLY}>Setiap minggu</option>
                    <option value={ScheduleRecurrence.MONTHLY}>Setiap bulan</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ed-recur-until">Ulangi sampai tanggal</Label>
                  <Input
                    id="ed-recur-until"
                    type="date"
                    value={editRecurrenceUntilLocal}
                    onChange={(e) => setEditRecurrenceUntilLocal(e.target.value)}
                    disabled={pending}
                  />
                </div>
              </>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="ed-loc">Lokasi / link</Label>
              <Input
                id="ed-loc"
                value={editLocation}
                onChange={(e) => setEditLocation(e.target.value)}
                disabled={pending}
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ed-desc">Deskripsi</Label>
              <Textarea
                id="ed-desc"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
                disabled={pending}
                maxLength={2000}
              />
            </div>
            <div className="space-y-2">
              <Label>Peserta</Label>
              <ScrollArea className="h-40 rounded-md border border-border p-2">
                <ul className="space-y-2">
                  {users.map((u) => (
                    <li key={u.id} className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        id={`ep-${u.id}`}
                        className="mt-1"
                        checked={editSelectedIds.has(u.id)}
                        onChange={() => toggleEditUser(u.id)}
                        disabled={pending}
                      />
                      <label htmlFor={`ep-${u.id}`} className="min-w-0 cursor-pointer leading-snug">
                        <span className="font-medium">{u.name?.trim() || u.email}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
              <div>
                {editing &&
                canManageEvent(currentRole, currentUserId, editing.createdById) ? (
                  <Button
                    type="button"
                    variant="destructive"
                    className="gap-2"
                    disabled={pending}
                    onClick={() => onDeleteFromEdit()}
                  >
                    <Trash2 className="size-4" />
                    Hapus
                  </Button>
                ) : null}
              </div>
              <div className="flex gap-2 sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditOpen(false)}
                  disabled={pending}
                >
                  Batal
                </Button>
                <Button type="submit" disabled={pending} className="gap-2">
                  <Pencil className="size-4" />
                  Simpan
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent className="max-h-[min(90vh,640px)] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Hapus jadwal massal</DialogTitle>
            <DialogDescription>
              Pilih jadwal di bulan {format(viewMonth, "MMMM yyyy", { locale: idLocale })} yang
              ingin dihapus sekaligus.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <ScrollArea className="h-72 rounded-md border border-border p-2">
              {manageableEventsInMonth.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Tidak ada jadwal yang bisa Anda hapus di bulan ini.
                </p>
              ) : (
                <ul className="space-y-2">
                  {manageableEventsInMonth.map((ev) => (
                    <li key={ev.id} className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        id={`bulk-${ev.id}`}
                        className="mt-1"
                        checked={bulkSelectedEventIds.has(ev.id)}
                        onChange={() => toggleBulkEvent(ev.id)}
                        disabled={pending}
                      />
                      <label
                        htmlFor={`bulk-${ev.id}`}
                        className="min-w-0 cursor-pointer leading-snug"
                      >
                        <span className="font-medium">{ev.title}</span>
                        <span className="text-muted-foreground block text-xs">
                          {format(new Date(ev.startsAt), "dd MMM yyyy HH:mm", {
                            locale: idLocale,
                          })}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setBulkDeleteOpen(false)}
              disabled={pending}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => onConfirmBulkDelete()}
              disabled={pending || bulkSelectedEventIds.size === 0}
            >
              {pending ? "Menghapus…" : `Hapus (${bulkSelectedEventIds.size})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
