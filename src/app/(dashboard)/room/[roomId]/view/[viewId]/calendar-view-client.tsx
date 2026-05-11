"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MapPin,
  Plus,
  Trash2,
} from "lucide-react";
import {
  deleteRoomCalendarEvent,
  upsertRoomCalendarEvent,
} from "@/actions/room-view-calendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Event = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
};

const WEEK_DAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

const MONTH_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "long",
  year: "numeric",
};

const TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
};

function toDateInput(d: Date) {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function toTimeInput(d: Date) {
  return [
    String(d.getHours()).padStart(2, "0"),
    String(d.getMinutes()).padStart(2, "0"),
  ].join(":");
}

function combineDateTime(date: string, time: string): Date {
  return new Date(`${date}T${time || "00:00"}:00`);
}

/** Daftar tanggal (inclusive) yang disinggung event mulai dari `startsAt` sampai `endsAt`. */
function expandEventDays(event: Event): Date[] {
  const start = startOfDay(new Date(event.startsAt));
  const end = event.endsAt ? startOfDay(new Date(event.endsAt)) : start;
  if (end < start) return [start];
  return eachDayOfInterval({ start, end });
}

type FormState = {
  id?: string;
  title: string;
  description: string;
  location: string;
  allDay: boolean;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
};

function emptyForm(forDate?: Date): FormState {
  const base = forDate ?? new Date();
  const start = new Date(base);
  start.setHours(9, 0, 0, 0);
  const end = new Date(start);
  end.setHours(10, 0, 0, 0);
  return {
    title: "",
    description: "",
    location: "",
    allDay: false,
    startDate: toDateInput(start),
    startTime: toTimeInput(start),
    endDate: toDateInput(end),
    endTime: toTimeInput(end),
  };
}

function formFromEvent(e: Event): FormState {
  const start = new Date(e.startsAt);
  const end = e.endsAt ? new Date(e.endsAt) : start;
  return {
    id: e.id,
    title: e.title,
    description: e.description ?? "",
    location: e.location ?? "",
    allDay: e.allDay,
    startDate: toDateInput(start),
    startTime: toTimeInput(start),
    endDate: toDateInput(end),
    endTime: toTimeInput(end),
  };
}

export function CalendarViewClient({
  viewId,
  events,
}: {
  viewId: string;
  events: Event[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [cursor, setCursor] = useState<Date>(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date>(() => startOfDay(new Date()));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [submitting, setSubmitting] = useState(false);

  /** 6 minggu × 7 hari, dimulai Senin agar mirip Google Calendar (region id-ID). */
  const weeks = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const gridEnd = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
    // Pastikan selalu 6 baris penuh agar tinggi grid stabil saat navigasi bulan.
    while (days.length < 42) days.push(addDays(days[days.length - 1], 1));
    const rows: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));
    return rows;
  }, [cursor]);

  /** Indeks event per ISO-tanggal untuk pencarian cepat O(1) di sel. */
  const eventsByDay = useMemo(() => {
    const map = new Map<string, Event[]>();
    for (const ev of events) {
      for (const day of expandEventDays(ev)) {
        const key = toDateInput(day);
        const list = map.get(key) ?? [];
        list.push(ev);
        map.set(key, list);
      }
    }
    // Urutkan: all-day dulu, lalu berdasarkan jam mulai.
    for (const list of map.values()) {
      list.sort((a, b) => {
        if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
        return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
      });
    }
    return map;
  }, [events]);

  const today = startOfDay(new Date());
  const monthLabel = cursor.toLocaleString("id-ID", MONTH_OPTIONS);
  const selectedDayEvents = eventsByDay.get(toDateInput(selectedDay)) ?? [];

  const openCreate = useCallback((date: Date) => {
    setForm(emptyForm(date));
    setDialogOpen(true);
  }, []);

  const openEdit = useCallback((ev: Event) => {
    setForm(formFromEvent(ev));
    setDialogOpen(true);
  }, []);

  function onSubmit() {
    if (!form.title.trim()) {
      toast.error("Judul acara wajib diisi.");
      return;
    }
    const startsAt = form.allDay
      ? combineDateTime(form.startDate, "00:00")
      : combineDateTime(form.startDate, form.startTime);
    const endsAt = form.allDay
      ? combineDateTime(form.endDate || form.startDate, "23:59")
      : form.endDate || form.endTime
        ? combineDateTime(form.endDate || form.startDate, form.endTime || "23:59")
        : null;
    if (endsAt && endsAt.getTime() < startsAt.getTime()) {
      toast.error("Waktu selesai tidak boleh sebelum waktu mulai.");
      return;
    }
    setSubmitting(true);
    startTransition(async () => {
      try {
        await upsertRoomCalendarEvent({
          id: form.id,
          viewId,
          title: form.title.trim(),
          description: form.description.trim() || null,
          location: form.location.trim() || null,
          startsAt,
          endsAt,
          allDay: form.allDay,
        });
        setDialogOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Gagal menyimpan acara.",
        );
      } finally {
        setSubmitting(false);
      }
    });
  }

  function onDelete() {
    if (!form.id) return;
    if (!confirm(`Hapus acara “${form.title}”?`)) return;
    startTransition(async () => {
      try {
        await deleteRoomCalendarEvent(form.id!);
        setDialogOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Gagal menghapus acara.",
        );
      }
    });
  }

  return (
    <div className="space-y-3">
      {/* Toolbar: navigasi bulan + tombol acara baru */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setCursor(startOfMonth(new Date()))}
        >
          Hari ini
        </Button>
        <div className="inline-flex items-center">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Bulan sebelumnya"
            onClick={() => setCursor((c) => subMonths(c, 1))}
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Bulan berikutnya"
            onClick={() => setCursor((c) => addMonths(c, 1))}
          >
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
        <h2 className="text-foreground text-lg font-semibold capitalize">
          {monthLabel}
        </h2>
        <div className="ml-auto">
          <Button
            type="button"
            size="sm"
            onClick={() => openCreate(selectedDay)}
            className="gap-1.5"
          >
            <Plus className="size-3.5" aria-hidden />
            Acara baru
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        <CardContent className="p-0">
          {/* Header hari */}
          <div className="border-border bg-muted/40 text-muted-foreground grid grid-cols-7 border-b text-[11px] font-semibold tracking-wider uppercase">
            {WEEK_DAYS.map((d, i) => (
              <div
                key={d}
                className={cn(
                  "px-2 py-1.5 text-center",
                  i >= 5 && "text-foreground/70",
                )}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Grid 6 minggu */}
          <div className="grid grid-cols-7">
            {weeks.flatMap((row, wIdx) =>
              row.map((day, dIdx) => {
                const inMonth = isSameMonth(day, cursor);
                const isToday = isSameDay(day, today);
                const isSelected = isSameDay(day, selectedDay);
                const isWeekend = dIdx >= 5;
                const dayEvents = eventsByDay.get(toDateInput(day)) ?? [];
                const visible = dayEvents.slice(0, 3);
                const overflow = dayEvents.length - visible.length;
                return (
                  <button
                    type="button"
                    key={`${wIdx}-${dIdx}`}
                    onClick={() => setSelectedDay(day)}
                    onDoubleClick={() => openCreate(day)}
                    className={cn(
                      "border-border focus:bg-muted/50 group/cell relative flex min-h-[96px] flex-col gap-1 border-r border-b p-1.5 text-left transition-colors outline-none last-of-type:border-r-0",
                      // Hilangkan border bawah untuk baris terakhir
                      wIdx === weeks.length - 1 && "border-b-0",
                      // Hilangkan border kanan untuk kolom terakhir
                      dIdx === 6 && "border-r-0",
                      !inMonth && "bg-muted/20 text-muted-foreground/70",
                      isWeekend && inMonth && "bg-accent/15",
                      isSelected && "ring-primary/40 z-10 ring-2 ring-inset",
                    )}
                    aria-current={isToday ? "date" : undefined}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          "inline-flex size-6 items-center justify-center rounded-full text-xs font-medium tabular-nums",
                          isToday &&
                            "bg-primary text-primary-foreground font-semibold",
                          !isToday && !inMonth && "text-muted-foreground/60",
                        )}
                      >
                        {day.getDate()}
                      </span>
                      <span
                        className="text-muted-foreground/0 group-hover/cell:text-muted-foreground/70 inline-flex size-5 items-center justify-center rounded-md transition-colors"
                        aria-hidden
                        onClick={(e) => {
                          e.stopPropagation();
                          openCreate(day);
                        }}
                        role="button"
                        tabIndex={-1}
                      >
                        <Plus className="size-3" />
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      {visible.map((ev) => (
                        <EventChip
                          key={ev.id}
                          ev={ev}
                          dayStart={day}
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(ev);
                          }}
                        />
                      ))}
                      {overflow > 0 ? (
                        <span className="text-muted-foreground hover:text-foreground self-start truncate text-[10px] font-medium">
                          +{overflow} lainnya
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              }),
            )}
          </div>
        </CardContent>
      </Card>

      {/* Panel agenda hari terpilih */}
      <Card>
        <CardContent className="space-y-2 p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-foreground text-sm font-semibold capitalize">
                {selectedDay.toLocaleString("id-ID", DATE_OPTIONS)}
              </p>
              <p className="text-muted-foreground text-xs">
                {selectedDayEvents.length === 0
                  ? "Tidak ada acara"
                  : `${selectedDayEvents.length} acara`}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => openCreate(selectedDay)}
              className="gap-1.5"
            >
              <Plus className="size-3.5" aria-hidden />
              Tambah
            </Button>
          </div>
          {selectedDayEvents.length === 0 ? (
            <div className="text-muted-foreground bg-muted/30 flex items-center justify-center gap-2 rounded-md py-6 text-xs">
              <CalendarDays className="size-4" aria-hidden />
              Klik dua kali pada tanggal di kalender untuk membuat acara cepat.
            </div>
          ) : (
            <ul role="list" className="space-y-1">
              {selectedDayEvents.map((ev) => (
                <li key={ev.id}>
                  <button
                    type="button"
                    onClick={() => openEdit(ev)}
                    className="hover:bg-muted/50 flex w-full items-start gap-3 rounded-md p-2 text-left transition-colors"
                  >
                    <div className="bg-primary mt-1.5 size-2 shrink-0 rounded-full" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground truncate text-sm font-medium">
                        {ev.title}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {ev.allDay ? "Sepanjang hari" : eventTimeRange(ev)}
                        {ev.location ? ` · ${ev.location}` : ""}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <EventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        form={form}
        setForm={setForm}
        onSubmit={onSubmit}
        onDelete={form.id ? onDelete : undefined}
        submitting={submitting}
      />
    </div>
  );
}

function eventTimeRange(ev: Event): string {
  const start = new Date(ev.startsAt);
  const end = ev.endsAt ? new Date(ev.endsAt) : null;
  const startStr = start.toLocaleTimeString("id-ID", TIME_OPTIONS);
  if (!end) return startStr;
  if (isSameDay(start, end)) {
    return `${startStr} – ${end.toLocaleTimeString("id-ID", TIME_OPTIONS)}`;
  }
  return `${startStr} – ${end.toLocaleString("id-ID", { day: "numeric", month: "short", ...TIME_OPTIONS })}`;
}

function EventChip({
  ev,
  dayStart,
  onClick,
}: {
  ev: Event;
  dayStart: Date;
  onClick: (e: React.MouseEvent) => void;
}) {
  const start = new Date(ev.startsAt);
  const end = ev.endsAt ? new Date(ev.endsAt) : null;
  const isFirst = isSameDay(start, dayStart);
  const isLast = end ? isSameDay(end, dayStart) : true;
  const single = isFirst && isLast;

  const timePrefix =
    !ev.allDay && isFirst
      ? `${start.toLocaleTimeString("id-ID", TIME_OPTIONS)} `
      : "";

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(e as unknown as React.MouseEvent);
        }
      }}
      title={ev.title}
      className={cn(
        "block cursor-pointer truncate px-1.5 py-0.5 text-[10px] font-medium transition-colors",
        ev.allDay || !single
          ? "bg-primary text-primary-foreground hover:bg-primary/90"
          : "text-foreground hover:bg-primary/10",
        single && "rounded",
        !single && isFirst && "rounded-l",
        !single && isLast && "rounded-r",
        !single && !isFirst && !isLast && "rounded-none",
        !single && !isLast && "-mr-1.5",
        !single && !isFirst && "-ml-1.5",
      )}
    >
      {!single || ev.allDay ? null : (
        <span className="bg-primary mr-1 inline-block size-1.5 rounded-full align-middle" aria-hidden />
      )}
      {timePrefix}
      {ev.title}
    </span>
  );
}

function EventDialog({
  open,
  onOpenChange,
  form,
  setForm,
  onSubmit,
  onDelete,
  submitting,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  form: FormState;
  setForm: (next: FormState) => void;
  onSubmit: () => void;
  onDelete?: () => void;
  submitting: boolean;
}) {
  const isEdit = Boolean(form.id);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Sunting acara" : "Acara baru"}</DialogTitle>
          <DialogDescription className="text-xs">
            Tetapkan judul, waktu, dan lokasi. Acara ini hanya tampil di kalender
            ruangan, bukan kalender pribadi anggota.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="event-title">Judul</Label>
            <Input
              id="event-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Contoh: Shooting katalog batch 2"
              autoFocus
            />
          </div>

          <label className="text-foreground inline-flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.allDay}
              onCheckedChange={(v) => setForm({ ...form, allDay: Boolean(v) })}
            />
            Sepanjang hari
          </label>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="start-date">Mulai</Label>
              <div className="flex gap-1.5">
                <Input
                  id="start-date"
                  type="date"
                  value={form.startDate}
                  onChange={(e) =>
                    setForm({ ...form, startDate: e.target.value })
                  }
                  className="flex-1"
                />
                {!form.allDay ? (
                  <Input
                    type="time"
                    value={form.startTime}
                    onChange={(e) =>
                      setForm({ ...form, startTime: e.target.value })
                    }
                    className="w-[6.25rem]"
                  />
                ) : null}
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="end-date">Selesai</Label>
              <div className="flex gap-1.5">
                <Input
                  id="end-date"
                  type="date"
                  value={form.endDate}
                  onChange={(e) =>
                    setForm({ ...form, endDate: e.target.value })
                  }
                  className="flex-1"
                />
                {!form.allDay ? (
                  <Input
                    type="time"
                    value={form.endTime}
                    onChange={(e) =>
                      setForm({ ...form, endTime: e.target.value })
                    }
                    className="w-[6.25rem]"
                  />
                ) : null}
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="event-location">
              <MapPin className="inline size-3.5" aria-hidden /> Lokasi
            </Label>
            <Input
              id="event-location"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="Opsional"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="event-desc">Catatan</Label>
            <Textarea
              id="event-desc"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              rows={3}
              placeholder="Opsional"
            />
          </div>
        </div>

        <DialogFooter className="flex flex-row items-center justify-between gap-2 sm:justify-between">
          <div>
            {onDelete ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onDelete}
                className="text-destructive hover:text-destructive gap-1"
                disabled={submitting}
              >
                <Trash2 className="size-3.5" aria-hidden />
                Hapus
              </Button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={onSubmit}
              disabled={submitting}
              className="gap-1.5"
            >
              {submitting ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : null}
              Simpan
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
