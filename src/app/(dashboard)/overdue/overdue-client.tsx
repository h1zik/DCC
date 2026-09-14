"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TaskPriority, TaskStatus, type RoomTaskProcess } from "@prisma/client";
import {
  AlertOctagon,
  ArrowUpRight,
  CalendarDays,
  CheckCheck,
  CheckCircle2,
  History,
  Loader2,
  Search,
  ShieldAlert,
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
  archived: boolean;
  /** Hari kalender WIB melewati tenggat (saat ini, atau saat selesai). */
  lateDays: number;
  /** Butuh persetujuan CEO & belum disetujui — akan otomatis disetujui saat CEO menutupnya. */
  needsApproval: boolean;
  phaseLabel: string;
  boardHref: string;
  room: { id: string; name: string };
  contextLabel: string;
  assignees: { id: string; name: string }[];
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
  rows,
  windowDays,
}: {
  rows: OverdueTaskRow[];
  windowDays: number;
}) {
  const { roomId, setRoomId, query, setQuery, rooms, filtered } =
    useRoomFilter(rows);

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="Belum ada tugas yang diselesaikan terlambat"
        description={`Tidak ada tugas yang ditutup melewati tenggat dalam ${windowDays} hari terakhir.`}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
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

      {filtered.length === 0 ? (
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

export function OverdueClient({
  overdue,
  completedLate,
  completedLateWindowDays,
}: {
  overdue: OverdueTaskRow[];
  completedLate: OverdueTaskRow[];
  completedLateWindowDays: number;
}) {
  const router = useRouter();
  const roomCount = new Set(overdue.map((r) => r.room.id)).size;

  return (
    <div className="flex w-full flex-col gap-6">
      <PageHero
        icon={AlertOctagon}
        variant="compact"
        title="Tugas Overdue"
        subtitle="Semua tugas lintas ruangan yang melewati tenggat. Tandai selesai (terlambat) langsung dari sini, atau buka papan ruangannya."
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
                {completedLate.length}
              </span>
              Selesai terlambat
            </PageHeroChip>
          </>
        }
      />

      <Tabs defaultValue="overdue" className="gap-0">
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
                {completedLate.length}
              </span>
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="overdue" className="pt-5">
          <OverdueList rows={overdue} onCompleted={() => router.refresh()} />
        </TabsContent>
        <TabsContent value="completed" className="pt-5">
          <p className="text-muted-foreground mb-3 text-xs">
            Tugas berstatus Selesai yang ditutup melewati tenggatnya, {completedLateWindowDays} hari terakhir.
          </p>
          <CompletedLateList
            rows={completedLate}
            windowDays={completedLateWindowDays}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
