"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TaskPriority, TaskStatus, type RoomTaskProcess } from "@prisma/client";
import {
  AlertOctagon,
  ArrowUpRight,
  CalendarDays,
  CalendarX,
  CheckCheck,
  CheckCircle2,
  History,
  ListTodo,
  Loader2,
  Search,
  ShieldAlert,
  UserX,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  completeOverdueTasksAsCeo,
  type CeoCompleteOverdueResult,
} from "@/actions/tasks";
import { actionErrorMessage } from "@/lib/action-error-message";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHero, PageHeroChip } from "@/components/page-hero";

export type OverdueTaskRow = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  roomProcess: RoomTaskProcess;
  dueDateIso: string | null;
  completedAtIso: string | null;
  createdAtIso: string;
  /** Hari kalender WIB sejak tugas dibuat (0 = hari ini). */
  ageDays: number;
  archived: boolean;
  /** Hari kalender WIB melewati tenggat (saat ini, atau saat selesai). */
  lateDays: number;
  /** Hari kalender WIB sejak selesai (0 = hari ini); null bila belum selesai. */
  completedAgoDays: number | null;
  /** Butuh persetujuan CEO & belum disetujui — akan otomatis disetujui saat CEO menutupnya. */
  needsApproval: boolean;
  phaseLabel: string;
  boardHref: string;
  room: { id: string; name: string };
  contextLabel: string;
  assignees: { id: string; name: string }[];
};

export type OverdueTab = "overdue" | "completed" | "incomplete";

const STATUS_LABEL: Record<TaskStatus, string> = {
  [TaskStatus.TODO]: "Belum mulai",
  [TaskStatus.IN_PROGRESS]: "Berjalan",
  [TaskStatus.OVERDUE]: "Overdue",
  [TaskStatus.DONE]: "Selesai",
  [TaskStatus.BLOCKED]: "Tertunda",
  [TaskStatus.IN_REVIEW]: "Ditinjau",
};

const PRIORITY_CHIP: Record<TaskPriority, { label: string; className: string }> =
  {
    [TaskPriority.LOW]: {
      label: "Rendah",
      className:
        "border-slate-300/40 bg-slate-500/10 text-slate-700 dark:text-slate-300",
    },
    [TaskPriority.MEDIUM]: {
      label: "Sedang",
      className:
        "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    },
    [TaskPriority.HIGH]: {
      label: "Tinggi",
      className:
        "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    },
  };

function formatDate(iso: string | null): string {
  if (!iso) return "Tanpa tenggat";
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
}

function lateLabel(days: number): string {
  return days > 0 ? `${days} hari terlambat` : "Ditandai overdue manual";
}

function ageLabel(days: number): string {
  if (days <= 0) return "Dibuat hari ini";
  if (days === 1) return "Dibuat kemarin";
  return `Dibuat ${days} hari lalu`;
}

/** Filter tab "Belum lengkap": kekurangan apa yang ditampilkan. */
type IncompleteKind = "all" | "no-due" | "no-pic" | "both";

const INCOMPLETE_KINDS: {
  id: IncompleteKind;
  label: string;
  matches: (row: OverdueTaskRow) => boolean;
}[] = [
  { id: "all", label: "Semua", matches: () => true },
  { id: "no-due", label: "Tanpa tenggat", matches: (r) => r.dueDateIso == null },
  { id: "no-pic", label: "Tanpa PIC", matches: (r) => r.assignees.length === 0 },
  {
    id: "both",
    label: "Tanpa keduanya",
    matches: (r) => r.dueDateIso == null && r.assignees.length === 0,
  },
];

/** Rentang waktu tab "Diselesaikan terlambat" — berdasarkan hari kalender WIB penyelesaian. */
export type CompletedLateRangeId =
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "90d"
  | "all";

export const COMPLETED_LATE_RANGES: {
  id: CompletedLateRangeId;
  label: string;
  /** Frasa untuk kalimat: "…melewati tenggat {phrase}". */
  phrase: string;
  matches: (agoDays: number) => boolean;
}[] = [
  { id: "today", label: "Hari ini", phrase: "hari ini", matches: (d) => d === 0 },
  { id: "yesterday", label: "Kemarin", phrase: "kemarin", matches: (d) => d === 1 },
  { id: "7d", label: "7 hari", phrase: "7 hari terakhir", matches: (d) => d < 7 },
  { id: "30d", label: "30 hari", phrase: "30 hari terakhir", matches: (d) => d < 30 },
  { id: "90d", label: "90 hari", phrase: "90 hari terakhir", matches: (d) => d < 90 },
  { id: "all", label: "1 tahun", phrase: "1 tahun terakhir", matches: () => true },
];

export const DEFAULT_COMPLETED_LATE_RANGE: CompletedLateRangeId = "30d";

function rangeById(id: CompletedLateRangeId) {
  return (
    COMPLETED_LATE_RANGES.find((r) => r.id === id) ??
    COMPLETED_LATE_RANGES[COMPLETED_LATE_RANGES.length - 1]
  );
}

function inCompletedRange(row: OverdueTaskRow, id: CompletedLateRangeId): boolean {
  return (
    row.completedAgoDays != null && rangeById(id).matches(row.completedAgoDays)
  );
}

function RangeChips({
  rows,
  active,
  onChange,
}: {
  rows: OverdueTaskRow[];
  active: CompletedLateRangeId;
  onChange: (id: CompletedLateRangeId) => void;
}) {
  const counts = React.useMemo(() => {
    const m = new Map<CompletedLateRangeId, number>();
    for (const r of COMPLETED_LATE_RANGES) {
      m.set(r.id, rows.filter((row) => inCompletedRange(row, r.id)).length);
    }
    return m;
  }, [rows]);
  return (
    <div
      role="group"
      aria-label="Filter waktu penyelesaian"
      className="flex flex-wrap items-center gap-1.5"
    >
      <span className="text-muted-foreground mr-0.5 inline-flex items-center gap-1 text-[11px]">
        <CalendarDays className="size-3" aria-hidden />
        Selesai
      </span>
      {COMPLETED_LATE_RANGES.map((r) => (
        <button
          key={r.id}
          type="button"
          onClick={() => onChange(r.id)}
          aria-pressed={active === r.id}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
            active === r.id
              ? "border-foreground/20 bg-foreground text-background"
              : "border-border bg-card text-muted-foreground hover:text-foreground",
          )}
        >
          {r.label}
          <span className="font-mono text-[10px] tabular-nums opacity-80">
            {counts.get(r.id) ?? 0}
          </span>
        </button>
      ))}
    </div>
  );
}

function matchesQuery(row: OverdueTaskRow, q: string): boolean {
  if (!q) return true;
  const hay = [
    row.title,
    row.room.name,
    row.contextLabel,
    row.phaseLabel,
    ...row.assignees.map((a) => a.name),
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

function useRoomFilter(rows: OverdueTaskRow[]) {
  const [roomId, setRoomId] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const rooms = React.useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    for (const r of rows) {
      const cur = map.get(r.room.id);
      if (cur) cur.count += 1;
      else map.set(r.room.id, { ...r.room, count: 1 });
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "id"));
  }, [rows]);
  const q = query.trim().toLowerCase();
  const filtered = React.useMemo(
    () =>
      rows.filter(
        (r) => (roomId ? r.room.id === roomId : true) && matchesQuery(r, q),
      ),
    [rows, roomId, q],
  );
  return { roomId, setRoomId, query, setQuery, rooms, filtered };
}

function RoomChips({
  rooms,
  active,
  onChange,
  total,
}: {
  rooms: { id: string; name: string; count: number }[];
  active: string | null;
  onChange: (id: string | null) => void;
  total: number;
}) {
  if (rooms.length <= 1) return null;
  const chip = (
    id: string | null,
    label: string,
    count: number,
  ) => (
    <button
      key={id ?? "__all"}
      type="button"
      onClick={() => onChange(id)}
      aria-pressed={active === id}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active === id
          ? "border-foreground/20 bg-foreground text-background"
          : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
      <span className="font-mono text-[10px] tabular-nums opacity-80">
        {count}
      </span>
    </button>
  );
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chip(null, "Semua ruangan", total)}
      {rooms.map((r) => chip(r.id, r.name, r.count))}
    </div>
  );
}

function TaskMeta({ row }: { row: OverdueTaskRow }) {
  const prio = PRIORITY_CHIP[row.priority];
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
      <span className="text-foreground/80 font-medium">{row.room.name}</span>
      <span aria-hidden>·</span>
      <span>{row.contextLabel}</span>
      <span aria-hidden>·</span>
      <span>{row.phaseLabel}</span>
      <Badge
        variant="outline"
        className={cn("h-5 px-1.5 text-[10px]", prio.className)}
      >
        {prio.label}
      </Badge>
      {row.needsApproval ? (
        <Badge
          variant="outline"
          className="h-5 gap-1 border-violet-500/30 bg-violet-500/10 px-1.5 text-[10px] text-violet-700 dark:text-violet-300"
        >
          <ShieldAlert className="size-3" aria-hidden />
          Butuh persetujuan
        </Badge>
      ) : null}
      {row.archived ? (
        <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
          Diarsipkan
        </Badge>
      ) : null}
    </div>
  );
}

function Assignees({ list }: { list: OverdueTaskRow["assignees"] }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
      <Users className="size-3" aria-hidden />
      {list.length === 0 ? "Tanpa PIC" : list.map((a) => a.name).join(", ")}
    </span>
  );
}

function OverdueList({
  rows,
  onCompleted,
}: {
  rows: OverdueTaskRow[];
  onCompleted: () => void;
}) {
  const { roomId, setRoomId, query, setQuery, rooms, filtered } =
    useRoomFilter(rows);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [confirmIds, setConfirmIds] = React.useState<string[] | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [busyIds, setBusyIds] = React.useState<Set<string>>(new Set());

  // Pilihan efektif = yang masih ada di daftar (id lama gugur sendiri setelah refresh).
  const activeSelected = React.useMemo(() => {
    const ids = new Set(rows.map((r) => r.id));
    return new Set([...selected].filter((id) => ids.has(id)));
  }, [rows, selected]);

  const visibleIds = filtered.map((r) => r.id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => activeSelected.has(id));
  const someVisibleSelected = visibleIds.some((id) => activeSelected.has(id));

  function toggleAllVisible(next: boolean) {
    setSelected((prev) => {
      const s = new Set(prev);
      for (const id of visibleIds) {
        if (next) s.add(id);
        else s.delete(id);
      }
      return s;
    });
  }

  function toggleOne(id: string, next: boolean) {
    setSelected((prev) => {
      const s = new Set(prev);
      if (next) s.add(id);
      else s.delete(id);
      return s;
    });
  }

  function runComplete(ids: string[]) {
    setBusyIds(new Set(ids));
    startTransition(async () => {
      try {
        const results: CeoCompleteOverdueResult[] =
          await completeOverdueTasksAsCeo({ taskIds: ids });
        const ok = results.filter((r) => r.ok).length;
        const failed = results.filter((r) => !r.ok);
        if (ok > 0) {
          toast.success(
            ok === 1
              ? "1 tugas ditandai selesai (terlambat)."
              : `${ok} tugas ditandai selesai (terlambat).`,
          );
        }
        for (const f of failed) {
          const title = rows.find((r) => r.id === f.taskId)?.title ?? f.taskId;
          toast.error(`${title}: ${f.error ?? "Gagal menyelesaikan tugas."}`);
        }
        setSelected((prev) => {
          const s = new Set(prev);
          for (const r of results) if (r.ok) s.delete(r.taskId);
          return s;
        });
        onCompleted();
      } catch (e) {
        toast.error(actionErrorMessage(e, "Gagal menyelesaikan tugas."));
      } finally {
        setBusyIds(new Set());
        setConfirmIds(null);
      }
    });
  }

  const confirmRows = confirmIds
    ? rows.filter((r) => confirmIds.includes(r.id))
    : [];
  const confirmNeedsApproval = confirmRows.filter((r) => r.needsApproval).length;

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle2}
        title="Tidak ada tugas overdue"
        description="Semua tugas di seluruh ruangan masih dalam tenggat."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari judul, ruangan, PIC…"
              aria-label="Cari tugas overdue"
              className="h-8 pl-8 text-sm"
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-muted-foreground text-xs tabular-nums">
              {activeSelected.size} dipilih
            </span>
            <Button
              size="sm"
              disabled={activeSelected.size === 0 || pending}
              onClick={() => setConfirmIds([...activeSelected])}
              className="gap-1.5"
            >
              <CheckCheck className="size-4" aria-hidden />
              Selesaikan yang dipilih
            </Button>
          </div>
        </div>
        <RoomChips
          rooms={rooms}
          active={roomId}
          onChange={setRoomId}
          total={rows.length}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Tidak ada yang cocok"
          description="Ubah kata kunci atau pilih ruangan lain."
        />
      ) : (
        <div className="border-border bg-card overflow-hidden rounded-xl border shadow-sm">
          <div className="border-border/70 bg-muted/40 flex items-center gap-3 border-b px-3 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            <Checkbox
              checked={allVisibleSelected}
              indeterminate={!allVisibleSelected && someVisibleSelected}
              onCheckedChange={(c) => toggleAllVisible(Boolean(c))}
              aria-label="Pilih semua tugas yang tampil"
              disabled={pending}
            />
            <span className="flex-1">Tugas</span>
            <span className="hidden w-32 sm:block">Tenggat</span>
            <span className="hidden w-32 sm:block">Keterlambatan</span>
            <span className="w-[150px] text-right">Aksi</span>
          </div>
          <ul className="divide-border/70 divide-y">
            {filtered.map((row) => {
              const busy = busyIds.has(row.id);
              return (
                <li
                  key={row.id}
                  className={cn(
                    "flex items-start gap-3 px-3 py-3 transition-colors",
                    activeSelected.has(row.id) && "bg-accent/5",
                  )}
                >
                  <Checkbox
                    checked={activeSelected.has(row.id)}
                    onCheckedChange={(c) => toggleOne(row.id, Boolean(c))}
                    aria-label={`Pilih ${row.title}`}
                    disabled={pending}
                    className="mt-0.5"
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex min-w-0 items-start gap-2">
                      <p className="text-foreground min-w-0 flex-1 text-sm font-medium leading-snug">
                        {row.title}
                      </p>
                    </div>
                    <TaskMeta row={row} />
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Assignees list={row.assignees} />
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground sm:hidden">
                        <CalendarDays className="size-3" aria-hidden />
                        {formatDate(row.dueDateIso)}
                      </span>
                      <span className="text-[11px] font-medium text-rose-600 sm:hidden dark:text-rose-400">
                        {lateLabel(row.lateDays)}
                      </span>
                    </div>
                  </div>
                  <span className="text-foreground/80 hidden w-32 shrink-0 pt-0.5 text-xs tabular-nums sm:block">
                    {formatDate(row.dueDateIso)}
                  </span>
                  <span className="hidden w-32 shrink-0 pt-0.5 text-xs font-medium text-rose-600 sm:block dark:text-rose-400">
                    {lateLabel(row.lateDays)}
                  </span>
                  <div className="flex w-[150px] shrink-0 flex-col items-end gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => setConfirmIds([row.id])}
                      className="h-7 gap-1.5 text-xs"
                    >
                      {busy ? (
                        <Loader2 className="size-3.5 animate-spin" aria-hidden />
                      ) : (
                        <CheckCircle2 className="size-3.5" aria-hidden />
                      )}
                      Selesai (terlambat)
                    </Button>
                    <Link
                      href={row.boardHref}
                      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5 text-[11px] underline-offset-2 hover:underline"
                    >
                      Buka papan
                      <ArrowUpRight className="size-3" aria-hidden />
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <Dialog
        open={confirmIds != null}
        onOpenChange={(open) => {
          if (!open && !pending) setConfirmIds(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {confirmRows.length === 1
                ? "Tandai selesai (terlambat)?"
                : `Tandai ${confirmRows.length} tugas selesai (terlambat)?`}
            </DialogTitle>
            <DialogDescription>
              Tugas akan berpindah ke kolom Selesai di papan ruangannya dan
              dicatat sebagai selesai melewati tenggat. Komentar sistem
              ditambahkan ke tiap tugas sebagai jejak audit.
              {confirmNeedsApproval > 0
                ? ` ${confirmNeedsApproval} tugas yang menunggu persetujuan Anda akan otomatis disetujui.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {confirmRows.length > 0 ? (
            <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border/70 bg-muted/30 p-2 text-xs">
              {confirmRows.slice(0, 20).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-foreground">{r.title}</span>
                  <span className="shrink-0 text-rose-600 dark:text-rose-400">
                    {lateLabel(r.lateDays)}
                  </span>
                </li>
              ))}
              {confirmRows.length > 20 ? (
                <li className="text-muted-foreground">
                  … dan {confirmRows.length - 20} tugas lain
                </li>
              ) : null}
            </ul>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => setConfirmIds(null)}
            >
              Batal
            </Button>
            <Button
              disabled={pending || !confirmIds}
              onClick={() => confirmIds && runComplete(confirmIds)}
              className="gap-1.5"
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <CheckCheck className="size-4" aria-hidden />
              )}
              Ya, tandai selesai
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CompletedLateList({
  allRows,
  rows,
  range,
  onRangeChange,
}: {
  /** Semua baris dalam jendela maksimum (untuk hitungan per chip rentang). */
  allRows: OverdueTaskRow[];
  /** Baris yang sudah lolos filter rentang aktif. */
  rows: OverdueTaskRow[];
  range: CompletedLateRangeId;
  onRangeChange: (id: CompletedLateRangeId) => void;
}) {
  const { roomId, setRoomId, query, setQuery, rooms, filtered } =
    useRoomFilter(rows);
  const rangePhrase = rangeById(range).phrase;

  if (allRows.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="Belum ada tugas yang diselesaikan terlambat"
        description={`Tidak ada tugas yang ditutup melewati tenggat dalam ${rangeById("all").phrase}.`}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <RangeChips rows={allRows} active={range} onChange={onRangeChange} />
        <div className="relative min-w-[220px] sm:max-w-xs">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari judul, ruangan, PIC…"
            aria-label="Cari tugas selesai terlambat"
            className="h-8 pl-8 text-sm"
          />
        </div>
        <RoomChips
          rooms={rooms}
          active={roomId}
          onChange={setRoomId}
          total={rows.length}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={History}
          title="Tidak ada di rentang ini"
          description={`Tidak ada tugas yang ditutup melewati tenggat ${rangePhrase}. Coba rentang waktu yang lebih panjang.`}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Tidak ada yang cocok"
          description="Ubah kata kunci atau pilih ruangan lain."
        />
      ) : (
        <div className="border-border bg-card overflow-hidden rounded-xl border shadow-sm">
          <div className="border-border/70 bg-muted/40 flex items-center gap-3 border-b px-3 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            <span className="flex-1">Tugas</span>
            <span className="hidden w-32 sm:block">Tenggat</span>
            <span className="hidden w-32 sm:block">Selesai</span>
            <span className="w-32 text-right sm:text-left">Keterlambatan</span>
          </div>
          <ul className="divide-border/70 divide-y">
            {filtered.map((row) => (
              <li key={row.id} className="flex items-start gap-3 px-3 py-3">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <Link
                    href={row.boardHref}
                    className="text-foreground hover:text-accent-foreground min-w-0 text-sm font-medium leading-snug underline-offset-2 hover:underline"
                  >
                    {row.title}
                  </Link>
                  <TaskMeta row={row} />
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Assignees list={row.assignees} />
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground sm:hidden">
                      <CalendarDays className="size-3" aria-hidden />
                      {formatDate(row.dueDateIso)} → {formatDate(row.completedAtIso)}
                    </span>
                  </div>
                </div>
                <span className="text-foreground/80 hidden w-32 shrink-0 pt-0.5 text-xs tabular-nums sm:block">
                  {formatDate(row.dueDateIso)}
                </span>
                <span className="text-foreground/80 hidden w-32 shrink-0 pt-0.5 text-xs tabular-nums sm:block">
                  {formatDate(row.completedAtIso)}
                </span>
                <span className="w-32 shrink-0 pt-0.5 text-right text-xs font-medium text-amber-600 sm:text-left dark:text-amber-400">
                  {row.lateDays} hari
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function MissingBadges({ row }: { row: OverdueTaskRow }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {row.dueDateIso == null ? (
        <Badge
          variant="outline"
          className="h-5 gap-1 border-amber-500/30 bg-amber-500/10 px-1.5 text-[10px] text-amber-700 dark:text-amber-300"
        >
          <CalendarX className="size-3" aria-hidden />
          Tanpa tenggat
        </Badge>
      ) : null}
      {row.assignees.length === 0 ? (
        <Badge
          variant="outline"
          className="h-5 gap-1 border-orange-500/30 bg-orange-500/10 px-1.5 text-[10px] text-orange-700 dark:text-orange-300"
        >
          <UserX className="size-3" aria-hidden />
          Tanpa PIC
        </Badge>
      ) : null}
    </div>
  );
}

function IncompleteList({ rows }: { rows: OverdueTaskRow[] }) {
  const [kind, setKind] = React.useState<IncompleteKind>("all");
  const kindDef =
    INCOMPLETE_KINDS.find((k) => k.id === kind) ?? INCOMPLETE_KINDS[0];
  const inKind = React.useMemo(
    () => rows.filter((r) => kindDef.matches(r)),
    [rows, kindDef],
  );
  const { roomId, setRoomId, query, setQuery, rooms, filtered } =
    useRoomFilter(inKind);
  const counts = React.useMemo(() => {
    const m = new Map<IncompleteKind, number>();
    for (const k of INCOMPLETE_KINDS) {
      m.set(k.id, rows.filter((r) => k.matches(r)).length);
    }
    return m;
  }, [rows]);

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle2}
        title="Semua tugas aktif sudah lengkap"
        description="Setiap tugas yang belum selesai sudah punya tenggat dan PIC."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div
          role="group"
          aria-label="Filter kekurangan tugas"
          className="flex flex-wrap items-center gap-1.5"
        >
          <span className="text-muted-foreground mr-0.5 inline-flex items-center gap-1 text-[11px]">
            <ListTodo className="size-3" aria-hidden />
            Kekurangan
          </span>
          {INCOMPLETE_KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => setKind(k.id)}
              aria-pressed={kind === k.id}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                kind === k.id
                  ? "border-foreground/20 bg-foreground text-background"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {k.label}
              <span className="font-mono text-[10px] tabular-nums opacity-80">
                {counts.get(k.id) ?? 0}
              </span>
            </button>
          ))}
        </div>
        <div className="relative min-w-[220px] sm:max-w-xs">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari judul, ruangan, PIC…"
            aria-label="Cari tugas belum lengkap"
            className="h-8 pl-8 text-sm"
          />
        </div>
        <RoomChips
          rooms={rooms}
          active={roomId}
          onChange={setRoomId}
          total={inKind.length}
        />
      </div>

      {inKind.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Tidak ada di kategori ini"
          description="Pilih kategori kekurangan lain untuk melihat tugas lainnya."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Tidak ada yang cocok"
          description="Ubah kata kunci atau pilih ruangan lain."
        />
      ) : (
        <div className="border-border bg-card overflow-hidden rounded-xl border shadow-sm">
          <div className="border-border/70 bg-muted/40 flex items-center gap-3 border-b px-3 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            <span className="flex-1">Tugas</span>
            <span className="hidden w-44 sm:block">Kekurangan</span>
            <span className="hidden w-32 sm:block">Dibuat</span>
            <span className="w-24 text-right">Aksi</span>
          </div>
          <ul className="divide-border/70 divide-y">
            {filtered.map((row) => (
              <li key={row.id} className="flex items-start gap-3 px-3 py-3">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <p className="text-foreground min-w-0 text-sm font-medium leading-snug">
                      {row.title}
                    </p>
                    <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                      {STATUS_LABEL[row.status]}
                    </Badge>
                  </div>
                  <TaskMeta row={row} />
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {row.assignees.length > 0 ? (
                      <Assignees list={row.assignees} />
                    ) : null}
                    {row.dueDateIso ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <CalendarDays className="size-3" aria-hidden />
                        Tenggat {formatDate(row.dueDateIso)}
                      </span>
                    ) : null}
                    <span className="text-[11px] text-muted-foreground sm:hidden">
                      {ageLabel(row.ageDays)}
                    </span>
                    <div className="sm:hidden">
                      <MissingBadges row={row} />
                    </div>
                  </div>
                </div>
                <div className="hidden w-44 shrink-0 pt-0.5 sm:block">
                  <MissingBadges row={row} />
                </div>
                <span className="text-foreground/80 hidden w-32 shrink-0 pt-0.5 text-xs tabular-nums sm:block">
                  {formatDate(row.createdAtIso)}
                  <span className="text-muted-foreground block text-[11px]">
                    {ageLabel(row.ageDays)}
                  </span>
                </span>
                <div className="flex w-24 shrink-0 justify-end pt-0.5">
                  <Link
                    href={row.boardHref}
                    className="text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5 text-[11px] underline-offset-2 hover:underline"
                  >
                    Buka papan
                    <ArrowUpRight className="size-3" aria-hidden />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function OverdueClient({
  overdue,
  completedLate,
  incomplete,
  initialTab = "overdue",
}: {
  overdue: OverdueTaskRow[];
  /** Tugas selesai terlambat dalam jendela maksimum (1 tahun); disaring per rentang di sini. */
  completedLate: OverdueTaskRow[];
  /** Tugas aktif tanpa tenggat dan/atau tanpa PIC. */
  incomplete: OverdueTaskRow[];
  /** Tab awal (dari `?tab=`), mis. tautan dari dashboard CEO. */
  initialTab?: OverdueTab;
}) {
  const router = useRouter();
  const roomCount = new Set(overdue.map((r) => r.room.id)).size;
  const [range, setRange] = React.useState<CompletedLateRangeId>(
    DEFAULT_COMPLETED_LATE_RANGE,
  );
  const completedInRange = React.useMemo(
    () => completedLate.filter((r) => inCompletedRange(r, range)),
    [completedLate, range],
  );
  const activeRange = rangeById(range);

  return (
    <div className="flex w-full flex-col gap-6">
      <PageHero
        icon={AlertOctagon}
        variant="compact"
        title="Tugas Overdue"
        subtitle="Semua tugas lintas ruangan yang melewati tenggat, plus tugas aktif yang belum punya tenggat atau PIC. Tandai selesai (terlambat) langsung dari sini, atau buka papan ruangannya."
        right={
          <>
            <PageHeroChip>
              <AlertOctagon className="size-3 text-rose-500" aria-hidden />
              <span className="text-foreground font-semibold tabular-nums">
                {overdue.length}
              </span>
              Overdue
            </PageHeroChip>
            <PageHeroChip>
              <Users className="size-3" aria-hidden />
              <span className="text-foreground font-semibold tabular-nums">
                {roomCount}
              </span>
              Ruangan
            </PageHeroChip>
            <PageHeroChip>
              <History className="size-3 text-amber-500" aria-hidden />
              <span className="text-foreground font-semibold tabular-nums">
                {completedInRange.length}
              </span>
              Selesai terlambat · {activeRange.label}
            </PageHeroChip>
            <PageHeroChip>
              <ListTodo className="size-3 text-orange-500" aria-hidden />
              <span className="text-foreground font-semibold tabular-nums">
                {incomplete.length}
              </span>
              Belum lengkap
            </PageHeroChip>
          </>
        }
      />

      <Tabs defaultValue={initialTab} className="gap-0">
        <div className="overflow-x-auto border-b border-border/70">
          <TabsList
            variant="line"
            aria-label="Navigasi tugas overdue"
            className="h-11 min-w-max justify-start gap-5"
          >
            <TabsTrigger value="overdue" className="px-1.5">
              <AlertOctagon className="size-4" aria-hidden />
              Overdue sekarang
              <span className="ml-1 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] tabular-nums">
                {overdue.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="completed" className="px-1.5">
              <History className="size-4" aria-hidden />
              Diselesaikan terlambat
              <span className="ml-1 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] tabular-nums">
                {completedInRange.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="incomplete" className="px-1.5">
              <ListTodo className="size-4" aria-hidden />
              Belum lengkap
              <span className="ml-1 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] tabular-nums">
                {incomplete.length}
              </span>
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="overdue" className="pt-5">
          <OverdueList rows={overdue} onCompleted={() => router.refresh()} />
        </TabsContent>
        <TabsContent value="completed" className="pt-5">
          <p className="text-muted-foreground mb-3 text-xs">
            Tugas berstatus Selesai yang ditutup melewati tenggatnya,{" "}
            {activeRange.phrase}. Riwayat tersedia hingga 1 tahun ke belakang.
          </p>
          <CompletedLateList
            allRows={completedLate}
            rows={completedInRange}
            range={range}
            onRangeChange={setRange}
          />
        </TabsContent>
        <TabsContent value="incomplete" className="pt-5">
          <p className="text-muted-foreground mb-3 text-xs">
            Tugas aktif (belum selesai, belum diarsipkan) yang belum diberi
            tenggat dan/atau PIC. Gunakan sebagai daftar pengingat agar tim
            melengkapinya lewat papan ruangan masing-masing.
          </p>
          <IncompleteList rows={incomplete} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
