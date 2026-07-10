"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  addDays,
  differenceInCalendarDays,
  max as maxDate,
  min as minDate,
  startOfDay,
  startOfWeek,
} from "date-fns";
import { TaskStatus } from "@prisma/client";
import {
  CalendarRange,
  FilterX,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { taskStatusLabel } from "@/lib/task-status-ui";
import type { SelectItemDef } from "@/lib/select-option-items";
import { cn } from "@/lib/utils";

export type GanttAssignee = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
};

export type GanttTask = {
  id: string;
  title: string;
  status: TaskStatus;
  /** ISO — start bar memakai tanggal dibuat (tidak ada startDate terpisah). */
  createdAt: string;
  /** ISO — tugas tanpa tenggat tidak digambar di timeline. */
  dueDate: string | null;
  projectId: string;
  projectName: string;
  /** Konteks brand/ruangan proyek (label sekunder). */
  projectContext: string;
  checklistDone: number;
  checklistTotal: number;
  assignees: GanttAssignee[];
};

/** Empat kategori warna bar: belum mulai / berjalan / selesai / telat. */
type GanttStatusKey = "notStarted" | "inProgress" | "done" | "late";

const GANTT_STATUS_META: Record<
  GanttStatusKey,
  {
    label: string;
    dot: string;
    barBase: string;
    barBorder: string;
    barFill: string;
    barText: string;
  }
> = {
  notStarted: {
    label: "Belum mulai",
    dot: "bg-slate-400",
    barBase: "bg-slate-500/10 dark:bg-slate-400/15",
    barBorder: "border-slate-500/30 dark:border-slate-400/30",
    barFill: "bg-slate-500/25 dark:bg-slate-400/30",
    barText: "text-slate-700 dark:text-slate-200",
  },
  inProgress: {
    label: "Berjalan",
    dot: "bg-sky-500",
    barBase: "bg-sky-500/10",
    barBorder: "border-sky-500/35",
    barFill: "bg-sky-500/30",
    barText: "text-sky-800 dark:text-sky-200",
  },
  done: {
    label: "Selesai",
    dot: "bg-emerald-500",
    barBase: "bg-emerald-500/10",
    barBorder: "border-emerald-500/35",
    barFill: "bg-emerald-500/30",
    barText: "text-emerald-800 dark:text-emerald-200",
  },
  late: {
    label: "Telat",
    dot: "bg-rose-500",
    barBase: "bg-rose-500/10",
    barBorder: "border-rose-500/40",
    barFill: "bg-rose-500/30",
    barText: "text-rose-800 dark:text-rose-200",
  },
};

const GANTT_STATUS_KEYS: GanttStatusKey[] = [
  "notStarted",
  "inProgress",
  "done",
  "late",
];

type ZoomKey = "day" | "week" | "month";

/** Lebar satu hari (px) per level zoom. */
const ZOOM_PX: Record<ZoomKey, number> = { day: 44, week: 20, month: 7 };

const ZOOM_ITEMS: { key: ZoomKey; label: string }[] = [
  { key: "day", label: "Hari" },
  { key: "week", label: "Minggu" },
  { key: "month", label: "Bulan" },
];

/** Lebar kolom daftar tugas (sidebar kiri). */
const SIDEBAR_PX = 264;
/** Tinggi satu baris tugas (px) — dipakai juga untuk content-visibility. */
const ROW_PX = 44;
/** Batas rentang hari yang digambar agar DOM tetap ringan. */
const MAX_RANGE_DAYS = 730;

const ALL_FILTER = "__all__";

const SMALL_SCREEN_QUERY = "(max-width: 640px)";

function subscribeSmallScreen(cb: () => void) {
  const m = window.matchMedia(SMALL_SCREEN_QUERY);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}

/** Layar sempit (mobile) — dipakai untuk default sidebar tertutup. */
function useIsSmallScreen() {
  return useSyncExternalStore(
    subscribeSmallScreen,
    () => window.matchMedia(SMALL_SCREEN_QUERY).matches,
    () => false,
  );
}

function resolveGanttStatus(
  status: TaskStatus,
  endDay: Date,
  today: Date,
): GanttStatusKey {
  if (status === TaskStatus.DONE) return "done";
  if (status === TaskStatus.OVERDUE || endDay < today) return "late";
  if (status === TaskStatus.IN_PROGRESS || status === TaskStatus.IN_REVIEW) {
    return "inProgress";
  }
  return "notStarted";
}

function fmtShort(d: Date) {
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

function fmtLong(d: Date) {
  return d.toLocaleDateString("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function assigneeInitials(a: GanttAssignee) {
  const name = a.name?.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  return a.email.slice(0, 2).toUpperCase();
}

const ASSIGNEE_AVATAR_COLORS = [
  "bg-rose-500",
  "bg-violet-500",
  "bg-sky-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-fuchsia-500",
] as const;

function assigneeAvatarColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash + id.charCodeAt(i)) % 997;
  return ASSIGNEE_AVATAR_COLORS[hash % ASSIGNEE_AVATAR_COLORS.length]!;
}

function AssigneeAvatars({
  assignees,
  max = 3,
}: {
  assignees: GanttAssignee[];
  max?: number;
}) {
  if (assignees.length === 0) return null;
  const shown = assignees.slice(0, max);
  const extra = assignees.length - shown.length;
  return (
    <div className="flex shrink-0 -space-x-1.5">
      {shown.map((a) =>
        a.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={a.id}
            src={a.image}
            alt={a.name ?? a.email}
            title={a.name ?? a.email}
            className="ring-card size-5 rounded-full object-cover ring-2"
          />
        ) : (
          <span
            key={a.id}
            title={a.name ?? a.email}
            className={cn(
              "ring-card flex size-5 items-center justify-center rounded-full text-[8px] font-semibold text-white ring-2",
              assigneeAvatarColor(a.id),
            )}
          >
            {assigneeInitials(a)}
          </span>
        ),
      )}
      {extra > 0 ? (
        <span className="bg-muted text-muted-foreground ring-card flex size-5 items-center justify-center rounded-full text-[8px] font-semibold ring-2">
          +{extra}
        </span>
      ) : null}
    </div>
  );
}

type GanttRowGeom = {
  task: GanttTask;
  statusKey: GanttStatusKey;
  startDay: Date;
  endDay: Date;
  lenDays: number;
  /** null = tanpa checklist & belum selesai → bar tanpa fill progres. */
  progressPct: number | null;
  /** Tugas 1 hari tanpa sub-tugas digambar sebagai diamond milestone. */
  isMilestone: boolean;
};

type TimeCell = {
  left: number;
  width: number;
  label: string;
  sub?: string;
  isWeekend?: boolean;
  isToday?: boolean;
};

/* ------------------------------------------------------------------ */
/* Baris tugas: sel sidebar sticky + bar draggable di track timeline.  */
/* ------------------------------------------------------------------ */

const GanttRow = memo(function GanttRow({
  geom,
  rangeStartMs,
  pxPerDay,
  timelineWidth,
  sidebarOpen,
  readOnly,
  onOpen,
  onReschedule,
  onHover,
}: {
  geom: GanttRowGeom;
  rangeStartMs: number;
  pxPerDay: number;
  timelineWidth: number;
  sidebarOpen: boolean;
  readOnly: boolean;
  onOpen: (taskId: string) => void;
  onReschedule?: (taskId: string, nextDue: Date) => void;
  onHover: (task: GanttTask | null, rect?: DOMRect) => void;
}) {
  const { task, statusKey, startDay, endDay, lenDays, progressPct, isMilestone } =
    geom;
  const meta = GANTT_STATUS_META[statusKey];
  const canDrag = !readOnly && !!onReschedule;

  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    moved: boolean;
    delta: number;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [previewDelta, setPreviewDelta] = useState(0);

  // Tenggat tidak boleh mundur melewati hari mulai (durasi minimal 1 hari).
  const minDelta = -(lenDays - 1);

  const offsetDays = differenceInCalendarDays(startDay, new Date(rangeStartMs));
  const previewLen = lenDays + (dragging ? previewDelta : 0);
  const leftPx = offsetDays * pxPerDay;
  const widthPx = Math.max(previewLen * pxPerDay - 2, 12);
  const previewEnd = addDays(endDay, dragging ? previewDelta : 0);

  const labelInside = !isMilestone && widthPx >= 90;
  const showPctInside = !isMilestone && widthPx >= 150 && progressPct != null;

  function commitDrag() {
    const d = dragRef.current;
    dragRef.current = null;
    setDragging(false);
    setPreviewDelta(0);
    if (!d) return;
    if (d.moved && d.delta !== 0 && onReschedule) {
      suppressClickRef.current = true;
      onReschedule(task.id, addDays(new Date(task.dueDate!), d.delta));
    } else if (d.moved) {
      suppressClickRef.current = true;
    }
  }

  function onPointerDown(e: ReactPointerEvent<HTMLButtonElement>) {
    if (!canDrag || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      moved: false,
      delta: 0,
    };
    setDragging(true);
    setPreviewDelta(0);
    onHover(null);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLButtonElement>) {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    if (Math.abs(e.clientX - d.startX) > 3) d.moved = true;
    const raw = Math.round((e.clientX - d.startX) / pxPerDay);
    const clamped = Math.max(raw, minDelta);
    if (clamped !== d.delta) {
      d.delta = clamped;
      setPreviewDelta(clamped);
    }
  }

  function onPointerUp(e: ReactPointerEvent<HTMLButtonElement>) {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    commitDrag();
  }

  function onClick() {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    onOpen(task.id);
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLButtonElement>) {
    if (!canDrag || !onReschedule) return;
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const step = (e.shiftKey ? 7 : 1) * (e.key === "ArrowRight" ? 1 : -1);
    const clamped = Math.max(step, minDelta);
    if (clamped !== 0) {
      onReschedule(task.id, addDays(new Date(task.dueDate!), clamped));
    }
  }

  const progressLabel =
    progressPct != null
      ? task.checklistTotal > 0
        ? `progres ${progressPct}% (${task.checklistDone}/${task.checklistTotal} sub-tugas)`
        : `progres ${progressPct}%`
      : "tanpa progres terukur";
  const ariaLabel = `${task.title} — ${taskStatusLabel(task.status)}, ${fmtLong(startDay)} sampai ${fmtLong(endDay)}, ${lenDays} hari, ${progressLabel}.${canDrag ? " Tekan panah kiri/kanan untuk menggeser tenggat, Shift untuk per minggu." : ""}`;

  const barButtonProps = {
    type: "button" as const,
    "aria-label": ariaLabel,
    onClick,
    onKeyDown,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
    onPointerEnter: (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (!dragging) onHover(task, e.currentTarget.getBoundingClientRect());
    },
    onPointerLeave: () => onHover(null),
    onFocus: (e: React.FocusEvent<HTMLButtonElement>) =>
      onHover(task, e.currentTarget.getBoundingClientRect()),
    onBlur: () => onHover(null),
  };

  return (
    <div
      className="group hover:bg-muted/20 border-border/40 relative z-10 flex border-b last:border-b-0"
      style={
        {
          height: ROW_PX,
          contentVisibility: "auto",
          containIntrinsicSize: `auto ${ROW_PX}px`,
        } as CSSProperties
      }
    >
      {sidebarOpen ? (
        <div
          className="border-border bg-card sticky left-0 z-20 flex shrink-0 items-center gap-2 border-r px-3"
          style={{ width: SIDEBAR_PX }}
        >
          <span
            className={cn("size-2 shrink-0 rounded-full", meta.dot)}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="text-foreground truncate text-xs font-medium">
              {task.title}
            </p>
            <p className="text-muted-foreground truncate text-[10px] tabular-nums">
              {fmtShort(startDay)} – {fmtShort(endDay)} · {lenDays} hari
            </p>
          </div>
          <AssigneeAvatars assignees={task.assignees} />
        </div>
      ) : null}

      <div className="relative shrink-0" style={{ width: timelineWidth }}>
        {isMilestone ? (
          <button
            {...barButtonProps}
            className={cn(
              "absolute top-1/2 z-10 flex -translate-y-1/2 items-center justify-center rounded-md p-1.5 outline-none",
              "focus-visible:ring-ring/60 focus-visible:ring-2",
              canDrag && "cursor-grab touch-pan-y",
              dragging && "cursor-grabbing",
            )}
            style={{
              left: leftPx + (dragging ? previewDelta : 0) * pxPerDay + pxPerDay / 2 - 14,
            }}
          >
            <span
              className={cn(
                "block size-3 rotate-45 rounded-[3px] shadow-sm",
                meta.dot,
              )}
              aria-hidden
            />
          </button>
        ) : (
          <button
            {...barButtonProps}
            className={cn(
              "absolute top-1/2 z-10 h-7 -translate-y-1/2 overflow-hidden rounded-lg border text-left shadow-xs outline-none",
              "focus-visible:ring-ring/60 focus-visible:ring-2",
              meta.barBase,
              meta.barBorder,
              canDrag && "cursor-grab touch-pan-y",
              dragging && "z-30 cursor-grabbing shadow-md",
            )}
            style={{ left: leftPx, width: widthPx }}
          >
            {progressPct != null ? (
              <span
                className={cn("absolute inset-y-0 left-0", meta.barFill)}
                style={{ width: `${progressPct}%` }}
                aria-hidden
              />
            ) : null}
            {labelInside ? (
              <span
                className={cn(
                  "relative z-10 block truncate px-2 text-[11px] leading-[26px] font-medium",
                  meta.barText,
                )}
              >
                {task.title}
                {showPctInside ? (
                  <span className="opacity-70"> · {progressPct}%</span>
                ) : null}
              </span>
            ) : null}
            {canDrag ? (
              <span
                className="absolute inset-y-1 right-0.5 z-20 w-1 rounded-full bg-current opacity-0 transition-opacity group-hover:opacity-25"
                aria-hidden
              />
            ) : null}
          </button>
        )}

        {!labelInside ? (
          <span
            className="text-muted-foreground pointer-events-none absolute top-1/2 z-0 max-w-44 -translate-y-1/2 truncate text-[11px]"
            style={{
              left: isMilestone
                ? leftPx + (dragging ? previewDelta : 0) * pxPerDay + pxPerDay / 2 + 12
                : leftPx + widthPx + 8,
            }}
            aria-hidden
          >
            {task.title}
          </span>
        ) : null}

        {dragging ? (
          <span
            className="bg-foreground text-background pointer-events-none absolute -top-1 z-40 -translate-x-1/2 rounded-md px-2 py-0.5 text-[10px] font-medium whitespace-nowrap shadow-md"
            style={{
              left: isMilestone
                ? leftPx + previewDelta * pxPerDay + pxPerDay / 2
                : leftPx + widthPx,
            }}
          >
            Tenggat: {fmtLong(previewEnd)}
          </span>
        ) : null}
      </div>
    </div>
  );
});

/* ------------------------------------------------------------------ */
/* Komponen utama                                                      */
/* ------------------------------------------------------------------ */

export function TasksGantt({
  tasks,
  onTaskClick,
  onTaskReschedule,
  onAddTask,
  readOnly = false,
  loading = false,
}: {
  tasks: GanttTask[];
  onTaskClick?: (taskId: string) => void;
  /** Dipanggil saat bar digeser/diresize (drag atau keyboard) — tenggat baru. */
  onTaskReschedule?: (taskId: string, nextDue: Date) => void;
  /** Tombol "Tugas baru" di empty state (khusus manager). */
  onAddTask?: () => void;
  readOnly?: boolean;
  loading?: boolean;
}) {
  const [today] = useState(() => startOfDay(new Date()));
  const [zoom, setZoom] = useState<ZoomKey>("day");
  const isSmallScreen = useIsSmallScreen();
  // null = ikut default perangkat (mobile tertutup); toggle user meng-override.
  const [sidebarOverride, setSidebarOverride] = useState<boolean | null>(null);
  const sidebarOpen = sidebarOverride ?? !isSmallScreen;
  const [hiddenStatuses, setHiddenStatuses] = useState<GanttStatusKey[]>([]);
  const [assigneeFilter, setAssigneeFilter] = useState(ALL_FILTER);
  const [projectFilter, setProjectFilter] = useState(ALL_FILTER);
  const [hoverCard, setHoverCard] = useState<{
    taskId: string;
    x: number;
    y: number;
    place: "top" | "bottom";
  } | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const dated = useMemo(() => tasks.filter((t) => t.dueDate), [tasks]);
  const undatedCount = tasks.length - dated.length;

  const geoms = useMemo<GanttRowGeom[]>(() => {
    return dated
      .map((task) => {
        const created = startOfDay(new Date(task.createdAt));
        const due = startOfDay(new Date(task.dueDate!));
        // Tenggat di masa lalu sebelum tanggal dibuat: gambar rentangnya saja.
        const startDay = minDate([created, due]);
        const endDay = maxDate([created, due]);
        const lenDays = differenceInCalendarDays(endDay, startDay) + 1;
        const progressPct =
          task.status === TaskStatus.DONE
            ? 100
            : task.checklistTotal > 0
              ? Math.round((task.checklistDone / task.checklistTotal) * 100)
              : null;
        return {
          task,
          statusKey: resolveGanttStatus(task.status, endDay, today),
          startDay,
          endDay,
          lenDays,
          progressPct,
          isMilestone: lenDays === 1 && task.checklistTotal === 0,
        };
      })
      .sort(
        (a, b) =>
          a.startDay.getTime() - b.startDay.getTime() ||
          a.endDay.getTime() - b.endDay.getTime(),
      );
  }, [dated, today]);

  const statusCounts = useMemo(() => {
    const counts: Record<GanttStatusKey, number> = {
      notStarted: 0,
      inProgress: 0,
      done: 0,
      late: 0,
    };
    for (const g of geoms) counts[g.statusKey] += 1;
    return counts;
  }, [geoms]);

  const assigneeItems = useMemo<SelectItemDef[]>(() => {
    const seen = new Map<string, string>();
    for (const g of geoms) {
      for (const a of g.task.assignees) {
        if (!seen.has(a.id)) seen.set(a.id, a.name ?? a.email);
      }
    }
    return [
      { value: ALL_FILTER, label: "Semua PIC" },
      ...[...seen.entries()]
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(([value, label]) => ({ value, label })),
    ];
  }, [geoms]);

  const projectItems = useMemo<SelectItemDef[]>(() => {
    const seen = new Map<string, string>();
    for (const g of geoms) {
      if (!seen.has(g.task.projectId)) {
        seen.set(g.task.projectId, g.task.projectName);
      }
    }
    return [
      { value: ALL_FILTER, label: "Semua proyek" },
      ...[...seen.entries()]
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(([value, label]) => ({ value, label })),
    ];
  }, [geoms]);

  const filteredGeoms = useMemo(
    () =>
      geoms.filter(
        (g) =>
          !hiddenStatuses.includes(g.statusKey) &&
          (assigneeFilter === ALL_FILTER ||
            g.task.assignees.some((a) => a.id === assigneeFilter)) &&
          (projectFilter === ALL_FILTER || g.task.projectId === projectFilter),
      ),
    [geoms, hiddenStatuses, assigneeFilter, projectFilter],
  );

  // Rentang timeline dari SEMUA tugas bertenggat (stabil saat filter berubah).
  const { rangeStart, totalDays } = useMemo(() => {
    const starts = geoms.map((g) => g.startDay);
    const ends = geoms.map((g) => g.endDay);
    const min = minDate([...starts, today]);
    const max = maxDate([...ends, today]);
    const start = startOfWeek(addDays(min, -7), { weekStartsOn: 1 });
    const end = addDays(max, 21);
    const days = Math.min(
      MAX_RANGE_DAYS,
      differenceInCalendarDays(end, start) + 1,
    );
    return { rangeStart: start, totalDays: days };
  }, [geoms, today]);

  const pxPerDay = ZOOM_PX[zoom];
  const timelineWidth = totalDays * pxPerDay;
  const todayX = differenceInCalendarDays(today, rangeStart) * pxPerDay;

  const { tier1, tier2 } = useMemo(() => {
    const rangeEnd = addDays(rangeStart, totalDays - 1);
    const t1: TimeCell[] = [];
    const t2: TimeCell[] = [];

    if (zoom === "day") {
      for (let i = 0; i < totalDays; i++) {
        const d = addDays(rangeStart, i);
        const dow = d.getDay();
        t2.push({
          left: i * pxPerDay,
          width: pxPerDay,
          label: String(d.getDate()),
          sub: d.toLocaleDateString("id-ID", { weekday: "narrow" }),
          isWeekend: dow === 0 || dow === 6,
          isToday: d.getTime() === today.getTime(),
        });
      }
    } else if (zoom === "week") {
      for (let i = 0; i < totalDays; i += 7) {
        const d = addDays(rangeStart, i);
        const days = Math.min(7, totalDays - i);
        t2.push({
          left: i * pxPerDay,
          width: days * pxPerDay,
          label: fmtShort(d),
          isToday: today >= d && today < addDays(d, days),
        });
      }
    } else {
      let cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
      while (cursor <= rangeEnd) {
        const next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
        const from = maxDate([cursor, rangeStart]);
        const to = minDate([addDays(next, -1), rangeEnd]);
        const left = differenceInCalendarDays(from, rangeStart) * pxPerDay;
        t2.push({
          left,
          width: (differenceInCalendarDays(to, from) + 1) * pxPerDay,
          label: cursor.toLocaleDateString("id-ID", { month: "short" }),
          isToday: today >= from && today <= to,
        });
        cursor = next;
      }
    }

    if (zoom === "month") {
      for (
        let y = rangeStart.getFullYear();
        y <= rangeEnd.getFullYear();
        y++
      ) {
        const from = maxDate([new Date(y, 0, 1), rangeStart]);
        const to = minDate([new Date(y, 11, 31), rangeEnd]);
        t1.push({
          left: differenceInCalendarDays(from, rangeStart) * pxPerDay,
          width: (differenceInCalendarDays(to, from) + 1) * pxPerDay,
          label: String(y),
        });
      }
    } else {
      let cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
      while (cursor <= rangeEnd) {
        const next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
        const from = maxDate([cursor, rangeStart]);
        const to = minDate([addDays(next, -1), rangeEnd]);
        t1.push({
          left: differenceInCalendarDays(from, rangeStart) * pxPerDay,
          width: (differenceInCalendarDays(to, from) + 1) * pxPerDay,
          label: cursor.toLocaleDateString("id-ID", {
            month: "long",
            year: "numeric",
          }),
        });
        cursor = next;
      }
    }

    return { tier1: t1, tier2: t2 };
  }, [zoom, rangeStart, totalDays, pxPerDay, today]);

  // Saat mount / ganti zoom: posisikan "hari ini" di sepertiga kiri viewport.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const viewport = Math.max(
      el.clientWidth - (sidebarOpen ? SIDEBAR_PX : 0),
      160,
    );
    el.scrollLeft = Math.max(0, todayX - viewport / 3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, todayX]);

  const onBarHover = useCallback(
    (task: GanttTask | null, rect?: DOMRect) => {
      if (!task || !rect || !wrapRef.current) {
        setHoverCard(null);
        return;
      }
      const w = wrapRef.current.getBoundingClientRect();
      const rawX = rect.left - w.left + rect.width / 2;
      const x = Math.min(Math.max(rawX, 150), Math.max(150, w.width - 150));
      const yTop = rect.top - w.top;
      const place: "top" | "bottom" = yTop < 170 ? "bottom" : "top";
      setHoverCard({
        taskId: task.id,
        x,
        y: place === "top" ? yTop - 8 : yTop + rect.height + 8,
        place,
      });
    },
    [],
  );

  const openTask = useCallback(
    (taskId: string) => onTaskClick?.(taskId),
    [onTaskClick],
  );

  const hasActiveFilter =
    hiddenStatuses.length > 0 ||
    assigneeFilter !== ALL_FILTER ||
    projectFilter !== ALL_FILTER;

  function resetFilters() {
    setHiddenStatuses([]);
    setAssigneeFilter(ALL_FILTER);
    setProjectFilter(ALL_FILTER);
  }

  const hoverGeom = hoverCard
    ? filteredGeoms.find((g) => g.task.id === hoverCard.taskId)
    : undefined;

  /* ----------------------------- states ----------------------------- */

  if (loading) {
    const bars = [
      { o: 6, w: 22 },
      { o: 14, w: 34 },
      { o: 24, w: 18 },
      { o: 32, w: 40 },
      { o: 48, w: 26 },
      { o: 58, w: 20 },
    ];
    return (
      <div className="bg-card rounded-xl border">
        <div className="border-border/60 flex items-center gap-3 border-b px-3 py-2.5">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="ml-auto h-4 w-24" />
        </div>
        {bars.map((b, i) => (
          <div
            key={i}
            className="border-border/40 flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0"
          >
            <div className="w-48 shrink-0 space-y-1.5">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-2 w-1/2" />
            </div>
            <div className="relative h-6 flex-1">
              <Skeleton
                className="absolute inset-y-0 rounded-lg"
                style={{ left: `${b.o}%`, width: `${b.w}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={CalendarRange}
        title="Belum ada tugas"
        description="Buat tugas untuk mulai menyusun linimasa pekerjaan ruangan ini."
        action={
          onAddTask ? (
            <Button type="button" size="sm" className="gap-1.5" onClick={onAddTask}>
              <Plus className="size-3.5" aria-hidden />
              Tugas baru
            </Button>
          ) : undefined
        }
      />
    );
  }

  if (dated.length === 0) {
    return (
      <EmptyState
        icon={CalendarRange}
        title="Belum ada tugas dengan tenggat"
        description={`${tasks.length} tugas belum punya tanggal tenggat. Tambahkan tenggat agar tugas muncul di Gantt.`}
      />
    );
  }

  /* ----------------------------- render ----------------------------- */

  return (
    <div ref={wrapRef} className="relative flex flex-col gap-3">
      {/* Toolbar: filter status (sekaligus legenda), PIC, proyek, zoom */}
      <div className="flex flex-wrap items-center gap-2">
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label="Filter status tugas"
        >
          {GANTT_STATUS_KEYS.map((key) => {
            const meta = GANTT_STATUS_META[key];
            const active = !hiddenStatuses.includes(key);
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  setHiddenStatuses((prev) =>
                    prev.includes(key)
                      ? prev.filter((k) => k !== key)
                      : [...prev, key],
                  )
                }
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  active
                    ? "border-border bg-card text-foreground shadow-xs"
                    : "text-muted-foreground/70 hover:text-foreground border-transparent",
                )}
              >
                <span
                  className={cn(
                    "size-2 rounded-full",
                    meta.dot,
                    !active && "opacity-30",
                  )}
                  aria-hidden
                />
                {meta.label}
                <span className="text-muted-foreground tabular-nums">
                  {statusCounts[key]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {assigneeItems.length > 1 ? (
            <Select
              value={assigneeFilter}
              items={assigneeItems}
              onValueChange={(v) => setAssigneeFilter(v as string)}
            >
              <SelectTrigger size="sm" aria-label="Filter PIC">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {assigneeItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          {projectItems.length > 2 ? (
            <Select
              value={projectFilter}
              items={projectItems}
              onValueChange={(v) => setProjectFilter(v as string)}
            >
              <SelectTrigger size="sm" aria-label="Filter proyek">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {projectItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}

          <div
            className="bg-muted/50 flex items-center rounded-lg p-0.5"
            role="group"
            aria-label="Skala waktu"
          >
            {ZOOM_ITEMS.map((z) => (
              <button
                key={z.key}
                type="button"
                aria-pressed={zoom === z.key}
                onClick={() => setZoom(z.key)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  zoom === z.key
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {z.label}
              </button>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={
              sidebarOpen ? "Sembunyikan daftar tugas" : "Tampilkan daftar tugas"
            }
            onClick={() => setSidebarOverride(!sidebarOpen)}
          >
            {sidebarOpen ? (
              <PanelLeftClose className="size-3.5" aria-hidden />
            ) : (
              <PanelLeftOpen className="size-3.5" aria-hidden />
            )}
          </Button>
        </div>
      </div>

      {filteredGeoms.length === 0 ? (
        <EmptyState
          icon={FilterX}
          title="Tidak ada tugas yang cocok dengan filter"
          action={
            hasActiveFilter ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={resetFilters}
              >
                Reset filter
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div
          ref={scrollRef}
          onScroll={() => setHoverCard(null)}
          className="border-border bg-card relative max-h-[70vh] overflow-auto overscroll-x-contain rounded-xl border"
        >
          <div
            className="min-w-full"
            style={{ width: (sidebarOpen ? SIDEBAR_PX : 0) + timelineWidth }}
          >
            {/* Header tanggal — sticky saat scroll vertikal */}
            <div className="bg-card border-border sticky top-0 z-30 border-b">
              <div className="flex">
                {sidebarOpen ? (
                  <div
                    className="border-border bg-card sticky left-0 z-20 flex shrink-0 items-end border-r px-3 pb-1.5"
                    style={{ width: SIDEBAR_PX }}
                  >
                    <p className="text-muted-foreground text-[11px] font-medium">
                      {filteredGeoms.length} tugas
                    </p>
                  </div>
                ) : null}
                <div
                  className="relative shrink-0"
                  style={{ width: timelineWidth }}
                >
                  <div className="relative h-6">
                    {tier1.map((c) => (
                      <span
                        key={`${c.label}-${c.left}`}
                        className="text-muted-foreground border-border/60 absolute inset-y-0 flex items-center truncate border-r px-2 text-[11px] font-medium"
                        style={{ left: c.left, width: c.width }}
                      >
                        {c.label}
                      </span>
                    ))}
                  </div>
                  <div className="relative h-7">
                    {tier2.map((c) => (
                      <span
                        key={c.left}
                        className={cn(
                          "border-border/40 absolute inset-y-0 flex flex-col items-center justify-center border-r leading-none",
                          c.isWeekend && "bg-muted/40",
                          c.isToday && "bg-primary/10",
                        )}
                        style={{ left: c.left, width: c.width }}
                      >
                        {c.sub ? (
                          <span
                            className={cn(
                              "text-[9px]",
                              c.isToday
                                ? "text-primary font-semibold"
                                : "text-muted-foreground/60",
                            )}
                          >
                            {c.sub}
                          </span>
                        ) : null}
                        <span
                          className={cn(
                            "text-[11px] tabular-nums",
                            c.isToday
                              ? "text-primary font-semibold"
                              : "text-muted-foreground",
                          )}
                        >
                          {c.label}
                        </span>
                      </span>
                    ))}
                    {todayX >= 0 && todayX <= timelineWidth ? (
                      <span
                        className="bg-primary text-primary-foreground absolute bottom-0.5 z-10 -translate-x-1/2 rounded-full px-1.5 py-px text-[9px] font-semibold whitespace-nowrap"
                        style={{ left: todayX }}
                      >
                        Hari ini
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            {/* Body: layer grid + garis hari ini + baris tugas */}
            <div className="relative">
              <div
                aria-hidden
                className="absolute inset-y-0 z-0"
                style={{
                  left: sidebarOpen ? SIDEBAR_PX : 0,
                  width: timelineWidth,
                }}
              >
                {tier2.map((c) => (
                  <span
                    key={c.left}
                    className={cn(
                      "border-border/30 absolute inset-y-0 border-r",
                      c.isWeekend && "bg-muted/30",
                      c.isToday && "bg-primary/5",
                    )}
                    style={{ left: c.left, width: c.width }}
                  />
                ))}
                {todayX >= 0 && todayX <= timelineWidth ? (
                  <span
                    className="bg-primary/70 absolute inset-y-0 z-10 w-px"
                    style={{ left: todayX }}
                  />
                ) : null}
              </div>

              {filteredGeoms.map((g) => (
                <GanttRow
                  key={g.task.id}
                  geom={g}
                  rangeStartMs={rangeStart.getTime()}
                  pxPerDay={pxPerDay}
                  timelineWidth={timelineWidth}
                  sidebarOpen={sidebarOpen}
                  readOnly={readOnly}
                  onOpen={openTask}
                  onReschedule={onTaskReschedule}
                  onHover={onBarHover}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {undatedCount > 0 ? (
        <p className="text-muted-foreground text-xs">
          {undatedCount} tugas tanpa tenggat tidak ditampilkan — tambahkan
          tanggal tenggat agar muncul di Gantt.
        </p>
      ) : null}

      {/* Kartu detail saat hover/fokus bar */}
      {hoverGeom && hoverCard ? (
        <div
          className="border-border bg-popover text-popover-foreground pointer-events-none absolute z-40 w-64 rounded-lg border p-3 shadow-md"
          style={{
            left: hoverCard.x,
            top: hoverCard.y,
            transform: `translate(-50%, ${hoverCard.place === "top" ? "-100%" : "0"})`,
          }}
          role="presentation"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 flex-1 text-xs font-semibold text-pretty">
              {hoverGeom.task.title}
            </p>
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                GANTT_STATUS_META[hoverGeom.statusKey].barBorder,
                GANTT_STATUS_META[hoverGeom.statusKey].barText,
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  GANTT_STATUS_META[hoverGeom.statusKey].dot,
                )}
                aria-hidden
              />
              {taskStatusLabel(hoverGeom.task.status)}
            </span>
          </div>
          <p className="text-muted-foreground mt-1 truncate text-[11px]">
            {hoverGeom.task.projectContext} — {hoverGeom.task.projectName}
          </p>
          <p className="text-muted-foreground mt-1.5 text-[11px] tabular-nums">
            {fmtLong(hoverGeom.startDay)} – {fmtLong(hoverGeom.endDay)} ·{" "}
            {hoverGeom.lenDays} hari
          </p>
          {hoverGeom.progressPct != null ? (
            <div className="mt-2">
              <div className="text-muted-foreground flex items-center justify-between text-[10px]">
                <span>
                  {hoverGeom.task.checklistTotal > 0
                    ? `${hoverGeom.task.checklistDone}/${hoverGeom.task.checklistTotal} sub-tugas`
                    : "Progres"}
                </span>
                <span className="tabular-nums">{hoverGeom.progressPct}%</span>
              </div>
              <div className="bg-muted mt-1 h-1.5 overflow-hidden rounded-full">
                <div
                  className={cn(
                    "h-full rounded-full",
                    GANTT_STATUS_META[hoverGeom.statusKey].dot,
                  )}
                  style={{ width: `${hoverGeom.progressPct}%` }}
                />
              </div>
            </div>
          ) : null}
          {hoverGeom.task.assignees.length > 0 ? (
            <div className="mt-2 flex items-center gap-1.5">
              <AssigneeAvatars assignees={hoverGeom.task.assignees} />
              <span className="text-muted-foreground min-w-0 truncate text-[10px]">
                {hoverGeom.task.assignees
                  .map((a) => a.name ?? a.email)
                  .join(", ")}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
