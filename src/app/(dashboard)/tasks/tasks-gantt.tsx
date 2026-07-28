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
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  X,
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
  /** ISO — tanggal tugas dibuat; fallback ujung kiri bar bila belum ada mulai. */
  createdAt: string;
  /** ISO — tanggal mulai pilihan user; null = pakai `createdAt`. */
  startDate: string | null;
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
/**
 * Lapisan kolom sidebar dalam satu baris. Harus lebih tinggi dari seluruh isi
 * track (bar biasa z-10, bar saat drag z-30, handle z-30, tooltip z-40) supaya
 * bar yang ter-scroll ke kiri tidak menembus kolom daftar tugas.
 */
const SIDEBAR_Z = "z-50";
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

/**
 * Kanvas berhitung dalam tanggal lokal, tetapi tugas disimpan sebagai tengah
 * malam UTC — sama seperti input tanggal di dialog (`new Date("YYYY-MM-DD")`).
 * Tanpa normalisasi ini, tanggal di detail tugas & daftar meleset satu hari.
 */
function toStoredDate(d: Date) {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
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
  /** false = ujung kiri bar masih memakai tanggal dibuat (belum diisi user). */
  hasExplicitStart: boolean;
  /** null = tanpa checklist & belum selesai → bar tanpa fill progres. */
  progressPct: number | null;
  /** Tugas 1 hari tanpa sub-tugas digambar sebagai diamond milestone. */
  isMilestone: boolean;
};

/** Jadwal baru hasil drag bar — `startDate: null` = tanpa tanggal mulai. */
export type GanttSchedule = { startDate: Date | null; dueDate: Date };

/**
 * Tugas baru hasil tarik rentang langsung di kanvas Gantt. Tanggalnya sudah
 * dinormalkan ke tengah malam UTC (lihat `toStoredDate`).
 */
export type GanttDraftTask = {
  title: string;
  startDate: Date;
  dueDate: Date;
};

/**
 * Mode drag bar:
 * - `move`   — geser seluruh bar (mulai + tenggat ikut bergerak);
 * - `start`  — tarik ujung kiri (ubah tanggal mulai saja);
 * - `end`    — tarik ujung kanan (ubah tenggat saja).
 */
type DragMode = "move" | "start" | "end";

/** Lebar area tarik ujung bar (px). */
const HANDLE_PX = 8;
/** Handle ujung baru muncul bila bar cukup lebar untuk ditarik. */
const HANDLE_MIN_BAR_PX = 34;

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
  onReschedule?: (taskId: string, next: GanttSchedule) => void;
  onHover: (task: GanttTask | null, rect?: DOMRect) => void;
}) {
  const {
    task,
    statusKey,
    startDay,
    endDay,
    lenDays,
    hasExplicitStart,
    progressPct,
    isMilestone,
  } = geom;
  const meta = GANTT_STATUS_META[statusKey];
  const canDrag = !readOnly && !!onReschedule;

  const dragRef = useRef<{
    pointerId: number;
    mode: DragMode;
    startX: number;
    moved: boolean;
    delta: number;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const [drag, setDrag] = useState<{ mode: DragMode; delta: number } | null>(
    null,
  );

  const offsetDays = differenceInCalendarDays(startDay, new Date(rangeStartMs));

  // Geser bar tidak boleh keluar dari sisi kiri rentang yang digambar; ujung
  // kiri/kanan tidak boleh saling melewati (durasi minimal 1 hari).
  const deltaBounds = useCallback(
    (mode: DragMode) => {
      switch (mode) {
        case "move":
          return { min: -offsetDays, max: Number.POSITIVE_INFINITY };
        case "start":
          return { min: -offsetDays, max: lenDays - 1 };
        case "end":
          return { min: -(lenDays - 1), max: Number.POSITIVE_INFINITY };
      }
    },
    [lenDays, offsetDays],
  );

  const dStart = drag && drag.mode !== "end" ? drag.delta : 0;
  const dEnd = drag && drag.mode !== "start" ? drag.delta : 0;
  const previewStart = addDays(startDay, dStart);
  const previewEnd = addDays(endDay, dEnd);
  const previewLen = lenDays + dEnd - dStart;
  const leftPx = (offsetDays + dStart) * pxPerDay;
  const widthPx = Math.max(previewLen * pxPerDay - 2, 12);

  const labelInside = !isMilestone && widthPx >= 90;
  const showPctInside = !isMilestone && widthPx >= 150 && progressPct != null;
  // Tetap terpasang selama drag: bar yang menyempit saat ujung ditarik tidak
  // boleh melepas handle-nya (pointer capture ikut hilang → drag menggantung).
  const showHandles =
    canDrag &&
    !isMilestone &&
    (drag != null || widthPx >= HANDLE_MIN_BAR_PX);

  /** Kirim jadwal baru sesuai mode — bar yang tampak = jadwal yang disimpan. */
  const applyDelta = useCallback(
    (mode: DragMode, delta: number) => {
      if (!onReschedule || delta === 0) return;
      switch (mode) {
        case "move":
          onReschedule(task.id, {
            startDate: toStoredDate(addDays(startDay, delta)),
            dueDate: toStoredDate(addDays(endDay, delta)),
          });
          return;
        case "start":
          onReschedule(task.id, {
            startDate: toStoredDate(addDays(startDay, delta)),
            dueDate: toStoredDate(endDay),
          });
          return;
        case "end":
          onReschedule(task.id, {
            // Tanpa tanggal mulai eksplisit, ujung kiri tetap tanggal dibuat.
            startDate: hasExplicitStart ? toStoredDate(startDay) : null,
            dueDate: toStoredDate(addDays(endDay, delta)),
          });
      }
    },
    [endDay, hasExplicitStart, onReschedule, startDay, task.id],
  );

  function beginDrag(
    e: ReactPointerEvent<HTMLElement>,
    mode: DragMode,
  ) {
    if (!canDrag || e.button !== 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      mode,
      startX: e.clientX,
      moved: false,
      delta: 0,
    };
    setDrag({ mode, delta: 0 });
    onHover(null);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLElement>) {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    if (Math.abs(e.clientX - d.startX) > 3) d.moved = true;
    const { min, max } = deltaBounds(d.mode);
    const raw = Math.round((e.clientX - d.startX) / pxPerDay);
    const clamped = Math.min(Math.max(raw, min), max);
    if (clamped !== d.delta) {
      d.delta = clamped;
      setDrag({ mode: d.mode, delta: clamped });
    }
  }

  function onPointerUp(e: ReactPointerEvent<HTMLElement>) {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    dragRef.current = null;
    setDrag(null);
    if (!d.moved) return;
    // Hanya drag yang dimulai di bar (mode "move") memicu klik pada tombol —
    // klik itu ditelan agar tidak ikut membuka detail. Drag dari handle ujung
    // tidak boleh menyetel flag ini (kliknya jatuh di span, bukan tombol).
    if (d.mode === "move") suppressClickRef.current = true;
    applyDelta(d.mode, d.delta);
  }

  function onClick() {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    onOpen(task.id);
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLButtonElement>) {
    if (!canDrag) return;
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    // Alt = ubah tenggat saja, Ctrl/Cmd = ubah tanggal mulai saja, polos =
    // geser seluruh bar. Shift mengubah langkah jadi satu minggu.
    const mode: DragMode = e.altKey
      ? "end"
      : e.ctrlKey || e.metaKey
        ? "start"
        : "move";
    const step = (e.shiftKey ? 7 : 1) * (e.key === "ArrowRight" ? 1 : -1);
    const { min, max } = deltaBounds(mode);
    applyDelta(mode, Math.min(Math.max(step, min), max));
  }

  const progressLabel =
    progressPct != null
      ? task.checklistTotal > 0
        ? `progres ${progressPct}% (${task.checklistDone}/${task.checklistTotal} sub-tugas)`
        : `progres ${progressPct}%`
      : "tanpa progres terukur";
  const ariaLabel = `${task.title} — ${taskStatusLabel(task.status)}, ${fmtLong(startDay)} sampai ${fmtLong(endDay)}, ${lenDays} hari, ${progressLabel}.${canDrag ? " Panah kiri/kanan menggeser seluruh jadwal, Alt+panah mengubah tenggat, Ctrl+panah mengubah tanggal mulai, Shift untuk per minggu." : ""}`;

  const dragging = drag != null;

  const barButtonProps = {
    type: "button" as const,
    "aria-label": ariaLabel,
    onClick,
    onKeyDown,
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) =>
      beginDrag(e, "move"),
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
    onPointerEnter: (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (!dragRef.current) onHover(task, e.currentTarget.getBoundingClientRect());
    },
    onPointerLeave: () => onHover(null),
    // Pointer-down memfokuskan tombol; tanpa cek ini kartu hover terbuka lagi
    // tepat setelah `beginDrag` menutupnya, lalu menggantung selama drag.
    onFocus: (e: React.FocusEvent<HTMLButtonElement>) => {
      if (!dragRef.current) onHover(task, e.currentTarget.getBoundingClientRect());
    },
    onBlur: () => onHover(null),
  };

  /** Kelas handle tarik ujung bar — presentasional; keyboard lewat bar utama. */
  const handleClass = cn(
    "absolute inset-y-1 z-30 cursor-ew-resize touch-none rounded-sm bg-current",
    "opacity-0 transition-opacity group-hover:opacity-30 hover:opacity-60",
    meta.barText,
  );

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
          className={cn(
            "border-border bg-card sticky left-0 flex shrink-0 items-center gap-2 border-r px-3",
            // Di atas semua isi track (bar z-30, handle z-30, tooltip z-40)
            // supaya bar yang tergeser ke kiri tetap tersembunyi di baliknya.
            SIDEBAR_Z,
          )}
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
            <p
              className={cn(
                "truncate text-[10px] tabular-nums",
                hasExplicitStart
                  ? "text-muted-foreground"
                  : "text-muted-foreground/70 italic",
              )}
              title={
                hasExplicitStart
                  ? undefined
                  : "Belum ada tanggal mulai — memakai tanggal tugas dibuat."
              }
            >
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
            style={{ left: leftPx + pxPerDay / 2 - 14 }}
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
          </button>
        )}

        {/* Ujung kiri = tanggal mulai, ujung kanan = tenggat. */}
        {showHandles ? (
          <>
            <span
              aria-hidden
              className={cn(handleClass, drag?.mode === "start" && "opacity-70")}
              style={{ width: HANDLE_PX, left: leftPx + 1 }}
              onPointerDown={(e) => beginDrag(e, "start")}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            />
            <span
              aria-hidden
              className={cn(handleClass, drag?.mode === "end" && "opacity-70")}
              style={{
                width: HANDLE_PX,
                left: leftPx + widthPx - HANDLE_PX - 1,
              }}
              onPointerDown={(e) => beginDrag(e, "end")}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            />
          </>
        ) : null}

        {!labelInside ? (
          <span
            className="text-muted-foreground pointer-events-none absolute top-1/2 z-0 max-w-44 -translate-y-1/2 truncate text-[11px]"
            style={{
              left: isMilestone
                ? leftPx + pxPerDay / 2 + 12
                : leftPx + widthPx + 8,
            }}
            aria-hidden
          >
            {task.title}
          </span>
        ) : null}

        {drag ? (
          <span
            className="bg-foreground text-background pointer-events-none absolute -top-1 z-40 -translate-x-1/2 rounded-md px-2 py-0.5 text-[10px] font-medium whitespace-nowrap shadow-md"
            style={{
              left:
                drag.mode === "start"
                  ? leftPx
                  : isMilestone
                    ? leftPx + pxPerDay / 2
                    : leftPx + widthPx,
            }}
          >
            {drag.mode === "start"
              ? `Mulai: ${fmtLong(previewStart)}`
              : drag.mode === "end"
                ? `Tenggat: ${fmtLong(previewEnd)}`
                : `${fmtShort(previewStart)} – ${fmtLong(previewEnd)}`}
          </span>
        ) : null}
      </div>
    </div>
  );
});

/* ------------------------------------------------------------------ */
/* Baris tambah tugas: tarik rentang di kanvas lalu ketik judulnya.    */
/* ------------------------------------------------------------------ */

/** Draf tugas baru sebagai indeks hari relatif terhadap awal rentang. */
type CreateDraft = { startIdx: number; endIdx: number };

/** Lebar minimal kotak isian judul agar tetap terbaca pada draf pendek. */
const DRAFT_BOX_MIN_PX = 240;

const GanttCreateRow = memo(function GanttCreateRow({
  rangeStartMs,
  totalDays,
  pxPerDay,
  timelineWidth,
  sidebarOpen,
  todayIdx,
  onCreate,
}: {
  rangeStartMs: number;
  totalDays: number;
  pxPerDay: number;
  timelineWidth: number;
  sidebarOpen: boolean;
  /** Indeks hari "hari ini" — dipakai tombol tambah di sidebar. */
  todayIdx: number;
  /** Reject/throw = draf dipertahankan supaya judul & rentang tidak hilang. */
  onCreate: (draft: GanttDraftTask) => Promise<void>;
}) {
  const [draft, setDraft] = useState<CreateDraft | null>(null);
  const [dragging, setDragging] = useState(false);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ pointerId: number; anchorIdx: number } | null>(null);

  /** Isian judul baru muncul setelah tarikan selesai. */
  const editing = draft != null && !dragging;

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const clampIdx = useCallback(
    (idx: number) => Math.min(Math.max(idx, 0), Math.max(totalDays - 1, 0)),
    [totalDays],
  );

  function idxFromPointer(e: ReactPointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return clampIdx(Math.floor((e.clientX - rect.left) / pxPerDay));
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.button !== 0 || pending) return;
    const idx = idxFromPointer(e);
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { pointerId: e.pointerId, anchorIdx: idx };
    setDragging(true);
    setHoverIdx(null);
    // Judul yang sudah diketik sengaja dipertahankan: menarik ulang rentang
    // hanya mengubah tanggal, bukan membatalkan draf.
    setDraft({ startIdx: idx, endIdx: idx });
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    if (!d) {
      if (!editing && !pending) setHoverIdx(idxFromPointer(e));
      return;
    }
    if (e.pointerId !== d.pointerId) return;
    const idx = idxFromPointer(e);
    setDraft({
      startIdx: Math.min(d.anchorIdx, idx),
      endIdx: Math.max(d.anchorIdx, idx),
    });
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    dragRef.current = null;
    setDragging(false);
  }

  function startDraftAt(idx: number) {
    setHoverIdx(null);
    setDraft({ startIdx: clampIdx(idx), endIdx: clampIdx(idx) });
  }

  function cancelDraft() {
    dragRef.current = null;
    setDragging(false);
    setDraft(null);
    setTitle("");
  }

  async function commitDraft() {
    if (!draft || pending) return;
    const trimmed = title.trim();
    if (!trimmed) return;
    const base = new Date(rangeStartMs);
    setPending(true);
    try {
      await onCreate({
        title: trimmed,
        startDate: toStoredDate(addDays(base, draft.startIdx)),
        dueDate: toStoredDate(addDays(base, draft.endIdx)),
      });
      setDraft(null);
      setTitle("");
    } catch {
      // Draf dibiarkan terbuka agar judul & rentang bisa dicoba simpan lagi.
    } finally {
      setPending(false);
    }
  }

  /** Alt+panah menggeser tenggat, Ctrl/Cmd+panah menggeser tanggal mulai. */
  function onInputKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      cancelDraft();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      void commitDraft();
      return;
    }
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const isEnd = e.altKey;
    const isStart = e.ctrlKey || e.metaKey;
    if (!isEnd && !isStart) return;
    e.preventDefault();
    const step = e.key === "ArrowRight" ? 1 : -1;
    setDraft((prev) => {
      if (!prev) return prev;
      if (isEnd) {
        return {
          ...prev,
          endIdx: clampIdx(Math.max(prev.endIdx + step, prev.startIdx)),
        };
      }
      return {
        ...prev,
        startIdx: clampIdx(Math.min(prev.startIdx + step, prev.endIdx)),
      };
    });
  }

  const base = new Date(rangeStartMs);
  const draftStartDay = draft ? addDays(base, draft.startIdx) : null;
  const draftEndDay = draft ? addDays(base, draft.endIdx) : null;
  const barLeft = draft ? draft.startIdx * pxPerDay : 0;
  const barWidth = draft
    ? Math.max((draft.endIdx - draft.startIdx + 1) * pxPerDay - 2, 12)
    : 0;
  const boxWidth = Math.max(barWidth, DRAFT_BOX_MIN_PX);
  // Kotak isian tidak boleh menjorok keluar timeline di ujung kanan rentang.
  const boxLeft = Math.min(barLeft, Math.max(0, timelineWidth - boxWidth));

  return (
    <div
      className="border-border/40 relative z-10 flex border-b last:border-b-0"
      style={{ height: ROW_PX }}
    >
      {sidebarOpen ? (
        <div
          className={cn(
            "border-border bg-card sticky left-0 flex shrink-0 items-center border-r px-3",
            SIDEBAR_Z,
          )}
          style={{ width: SIDEBAR_PX }}
        >
          <button
            type="button"
            onClick={() => startDraftAt(todayIdx)}
            disabled={pending}
            className="text-muted-foreground hover:text-foreground hover:bg-muted/60 -mx-1 flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1 py-1 text-xs font-medium transition-colors disabled:opacity-60"
          >
            <Plus className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">Tambah tugas</span>
          </button>
        </div>
      ) : null}

      <div
        className="relative shrink-0 touch-pan-y"
        style={{ width: timelineWidth, cursor: pending ? "wait" : "crosshair" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => setHoverIdx(null)}
      >
        {/* Bayangan sel hari di bawah kursor — penanda tempat tugas dibuat. */}
        {hoverIdx != null && !draft ? (
          <span
            aria-hidden
            className="border-primary/40 bg-primary/5 text-primary/70 absolute top-1/2 flex h-7 -translate-y-1/2 items-center justify-center rounded-lg border border-dashed"
            style={{
              left: hoverIdx * pxPerDay,
              width: Math.max(pxPerDay - 2, 12),
            }}
          >
            {pxPerDay >= 24 ? <Plus className="size-3" /> : null}
          </span>
        ) : null}

        {draft ? (
          <>
            <span
              aria-hidden
              className="border-primary/50 bg-primary/10 absolute top-1/2 h-7 -translate-y-1/2 rounded-lg border border-dashed"
              style={{ left: barLeft, width: barWidth }}
            />
            {draftStartDay && draftEndDay ? (
              <span
                className="bg-foreground text-background pointer-events-none absolute -top-1 z-40 rounded-md px-2 py-0.5 text-[10px] font-medium whitespace-nowrap shadow-md"
                style={{ left: boxLeft }}
              >
                {fmtShort(draftStartDay)} – {fmtLong(draftEndDay)} ·{" "}
                {draft.endIdx - draft.startIdx + 1} hari
              </span>
            ) : null}
          </>
        ) : null}

        {editing && draft ? (
          <div
            className="border-primary/60 bg-card absolute top-1/2 z-30 flex h-8 -translate-y-1/2 items-center gap-1 rounded-lg border px-1.5 shadow-md"
            style={{ left: boxLeft, width: boxWidth }}
            // Klik di dalam kotak tidak boleh memulai tarikan rentang baru.
            onPointerDown={(e) => e.stopPropagation()}
          >
            <input
              ref={inputRef}
              value={title}
              disabled={pending}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="Nama tugas — Enter simpan, Esc batal"
              aria-label="Judul tugas baru"
              className="placeholder:text-muted-foreground/70 min-w-0 flex-1 bg-transparent text-xs outline-none disabled:opacity-60"
            />
            {pending ? (
              <Loader2
                className="text-muted-foreground size-3.5 shrink-0 animate-spin"
                aria-hidden
              />
            ) : (
              <button
                type="button"
                onClick={cancelDraft}
                aria-label="Batalkan tugas baru"
                className="text-muted-foreground hover:text-foreground shrink-0 rounded p-0.5"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            )}
          </div>
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
  onTaskCreate,
  onAddTask,
  readOnly = false,
  loading = false,
}: {
  tasks: GanttTask[];
  onTaskClick?: (taskId: string) => void;
  /**
   * Dipanggil saat bar digeser/ditarik ujungnya (drag atau keyboard) — jadwal
   * baru sesuai bar yang tampak. `startDate: null` = tugas tetap tanpa tanggal
   * mulai (ujung kiri masih memakai tanggal dibuat).
   */
  onTaskReschedule?: (taskId: string, next: GanttSchedule) => void;
  /**
   * Buat tugas langsung di kanvas: tarik rentang di baris paling bawah lalu
   * ketik judulnya. Tugas dibuat dengan nilai default (proyek pertama, tahap
   * awal papan, prioritas sedang) — sisanya diatur lewat detail tugas.
   * Promise yang gagal menahan draf tetap terbuka.
   */
  onTaskCreate?: (draft: GanttDraftTask) => Promise<void>;
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
        const due = startOfDay(new Date(task.dueDate!));
        // Ujung kiri bar: tanggal mulai pilihan user, atau tanggal dibuat bila
        // belum diisi. Tenggat di masa lalu sebelum acuan itu: gambar
        // rentangnya saja agar bar tidak terbalik.
        const anchor = startOfDay(
          new Date(task.startDate ?? task.createdAt),
        );
        const startDay = minDate([anchor, due]);
        const endDay = maxDate([anchor, due]);
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
          hasExplicitStart: task.startDate != null,
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

  const canInlineCreate = !readOnly && !!onTaskCreate;
  const todayIdx = differenceInCalendarDays(today, rangeStart);
  // Kanvas tetap digambar walau tidak ada bar yang lolos filter, selama baris
  // "tambah tugas" masih berguna (tanpa filter aktif yang menyembunyikannya).
  const showCanvas =
    filteredGeoms.length > 0 || (canInlineCreate && !hasActiveFilter);

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

  // Papan kosong tetap digambar bila tugas bisa dibuat di kanvas — barisnya
  // sendiri yang jadi ajakan "tambah tugas".
  if (tasks.length === 0 && !canInlineCreate) {
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

  // Tanpa hak buat di kanvas, papan kosong tidak perlu digambar sama sekali.
  if (dated.length === 0 && !canInlineCreate) {
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

      {!showCanvas ? (
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
                    className={cn(
                      "border-border bg-card sticky left-0 flex shrink-0 items-end border-r px-3 pb-1.5",
                      SIDEBAR_Z,
                    )}
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

              {canInlineCreate && onTaskCreate ? (
                <GanttCreateRow
                  rangeStartMs={rangeStart.getTime()}
                  totalDays={totalDays}
                  pxPerDay={pxPerDay}
                  timelineWidth={timelineWidth}
                  sidebarOpen={sidebarOpen}
                  todayIdx={todayIdx}
                  onCreate={onTaskCreate}
                />
              ) : null}
            </div>
          </div>
        </div>
      )}

      {!readOnly && onTaskReschedule && filteredGeoms.length > 0 ? (
        <p className="text-muted-foreground text-xs">
          Geser bar untuk memindahkan seluruh jadwal; tarik ujung kiri/kanan
          untuk mengubah tanggal mulai atau tenggat saja.
        </p>
      ) : null}

      {canInlineCreate && showCanvas ? (
        <p className="text-muted-foreground text-xs">
          Tugas baru: tarik rentang tanggal di baris terbawah kanvas, ketik
          judulnya, lalu Enter. Saat mengetik, Ctrl+panah menggeser tanggal
          mulai dan Alt+panah menggeser tenggat.
        </p>
      ) : null}

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
          {!hoverGeom.hasExplicitStart ? (
            <p className="text-muted-foreground/70 mt-0.5 text-[10px]">
              Belum ada tanggal mulai — memakai tanggal dibuat.
            </p>
          ) : null}
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
