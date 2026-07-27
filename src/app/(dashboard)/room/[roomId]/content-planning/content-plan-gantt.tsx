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
import {
  ContentPlanJenis,
  ContentPlanStatusKerja,
  ContentPlanUsage,
  type User,
} from "@prisma/client";
import {
  CalendarRange,
  LocateFixed,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  JENIS_LABEL,
  STATUS_BAR_CLASS,
  STATUS_LABEL,
  STATUS_PROGRESS_PCT,
  USAGE_LABEL,
} from "@/lib/content-plan-ui";
import type { SelectItemDef } from "@/lib/select-option-items";
import { cn } from "@/lib/utils";

/** Bentuk baris minimal yang dibutuhkan Gantt (ContentPlanTableRow memenuhi ini). */
export type ContentPlanGanttRow = {
  id: string;
  konten: string;
  jenisKonten: ContentPlanJenis;
  usage: ContentPlanUsage;
  detailKonten: string | null;
  statusCopywriting: ContentPlanStatusKerja;
  statusDesign: ContentPlanStatusKerja;
  deadlineCopywriting: Date | string | null;
  deadlineDesign: Date | string | null;
  tanggalPosting: Date | string | null;
  jamPosting: string | null;
  createdAt?: Date | string | null;
  pics?: Pick<User, "id" | "name" | "email" | "image">[];
};

/** Tanggal yang bisa digeser langsung dari bar/milestone. */
export type ContentPlanGanttField =
  | "deadlineCopywriting"
  | "deadlineDesign"
  | "tanggalPosting";

type ZoomKey = "day" | "week" | "month";

/** Lebar satu hari (px) per level zoom. */
const ZOOM_PX: Record<ZoomKey, number> = { day: 40, week: 17, month: 6 };

const ZOOM_ITEMS: { key: ZoomKey; label: string }[] = [
  { key: "day", label: "Hari" },
  { key: "week", label: "Minggu" },
  { key: "month", label: "Bulan" },
];

type GroupKey = "none" | "pic" | "jenis" | "usage";

const GROUP_ITEMS: SelectItemDef[] = [
  { value: "none", label: "Tanpa grup" },
  { value: "pic", label: "Kelompokkan: PIC" },
  { value: "jenis", label: "Kelompokkan: Jenis" },
  { value: "usage", label: "Kelompokkan: Usage" },
];

/** Lebar kolom daftar konten (sidebar kiri). */
const SIDEBAR_PX = 288;
/** Tinggi satu baris konten (px) — dipakai juga untuk content-visibility. */
const ROW_PX = 46;
/** Tinggi baris judul grup. */
const GROUP_PX = 30;
/** Batas rentang hari yang digambar agar DOM tetap ringan. */
const MAX_RANGE_DAYS = 730;

/**
 * Baris tidak punya "tanggal mulai" tersendiri, jadi awal bar copywriting
 * diambil dari tanggal baris dibuat — dijepit ke jendela di bawah ini supaya
 * bar tidak pernah nol lebar maupun memanjang berbulan-bulan.
 */
const DEFAULT_LEAD_DAYS = 3;
const MAX_LEAD_DAYS = 21;

/**
 * Ambang geser (px). Di bawah ini gerakan dianggap klik biasa — penting karena
 * pada zoom Bulan satu hari cuma 6px, jadi getaran kursor saat klik tidak boleh
 * ikut menulis tanggal baru.
 */
const MIN_DRAG_PX = 12;

const SMALL_SCREEN_QUERY = "(max-width: 768px)";

function subscribeSmallScreen(cb: () => void) {
  const m = window.matchMedia(SMALL_SCREEN_QUERY);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}

function useIsSmallScreen() {
  return useSyncExternalStore(
    subscribeSmallScreen,
    () => window.matchMedia(SMALL_SCREEN_QUERY).matches,
    () => false,
  );
}

function toDay(v: Date | string | null | undefined): Date | null {
  if (!v) return null;
  const d = typeof v === "string" ? new Date(v) : v;
  return Number.isNaN(d.getTime()) ? null : startOfDay(d);
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

function picInitials(p: Pick<User, "name" | "email">) {
  const name = p.name?.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  return p.email.slice(0, 2).toUpperCase();
}

const PIC_AVATAR_COLORS = [
  "bg-rose-500",
  "bg-violet-500",
  "bg-sky-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-fuchsia-500",
] as const;

function picAvatarColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash + id.charCodeAt(i)) % 997;
  return PIC_AVATAR_COLORS[hash % PIC_AVATAR_COLORS.length]!;
}

function PicAvatars({
  pics,
  max = 3,
}: {
  pics: Pick<User, "id" | "name" | "email" | "image">[];
  max?: number;
}) {
  if (pics.length === 0) return null;
  const shown = pics.slice(0, max);
  const extra = pics.length - shown.length;
  return (
    <div className="flex shrink-0 -space-x-1.5">
      {shown.map((p) =>
        p.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={p.id}
            src={p.image}
            alt={p.name ?? p.email}
            title={p.name ?? p.email}
            className="ring-card size-5 rounded-full object-cover ring-2"
          />
        ) : (
          <span
            key={p.id}
            title={p.name ?? p.email}
            className={cn(
              "ring-card flex size-5 items-center justify-center rounded-full text-[8px] font-semibold text-white ring-2",
              picAvatarColor(p.id),
            )}
          >
            {picInitials(p)}
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

/** Satu fase (copywriting / design) pada linimasa. */
type Phase = {
  field: Extract<
    ContentPlanGanttField,
    "deadlineCopywriting" | "deadlineDesign"
  >;
  label: string;
  status: ContentPlanStatusKerja;
  startDay: Date;
  endDay: Date;
  lenDays: number;
  late: boolean;
};

type GanttGeom = {
  row: ContentPlanGanttRow;
  startDay: Date;
  endDay: Date;
  copy: Phase | null;
  design: Phase | null;
  /** Milestone posting; null bila tanggal posting belum diisi. */
  post: Date | null;
  postLate: boolean;
  progressPct: number;
};

type TimeCell = {
  left: number;
  width: number;
  label: string;
  sub?: string;
  isWeekend?: boolean;
  isToday?: boolean;
};

type ListItem =
  | { kind: "group"; key: string; label: string; count: number }
  | { kind: "row"; key: string; geom: GanttGeom };

/** Fase belum selesai yang tenggatnya sudah lewat. */
function isLate(status: ContentPlanStatusKerja, endDay: Date, today: Date) {
  return (
    status !== ContentPlanStatusKerja.DIPUBLIKASIKAN && endDay.getTime() < today.getTime()
  );
}

function buildGeom(row: ContentPlanGanttRow, today: Date): GanttGeom | null {
  const dc = toDay(row.deadlineCopywriting);
  const dd = toDay(row.deadlineDesign);
  const tp = toDay(row.tanggalPosting);
  const known = [dc, dd, tp].filter((d): d is Date => d !== null);
  if (known.length === 0) return null;

  const earliest = minDate(known);
  const created = toDay(row.createdAt);
  const leadFrom = created ?? addDays(earliest, -DEFAULT_LEAD_DAYS);
  const anchor = maxDate([
    minDate([leadFrom, earliest]),
    addDays(earliest, -MAX_LEAD_DAYS),
  ]);

  const copy: Phase | null = dc
    ? {
        field: "deadlineCopywriting",
        label: "Copywriting",
        status: row.statusCopywriting,
        startDay: anchor,
        endDay: dc,
        lenDays: differenceInCalendarDays(dc, anchor) + 1,
        late: isLate(row.statusCopywriting, dc, today),
      }
    : null;

  let design: Phase | null = null;
  if (dd) {
    // Design mulai saat copywriting jatuh tempo; kalau urutannya terbalik
    // (design lebih awal), bar design jatuh kembali ke anchor.
    const designStart = dc && dc.getTime() <= dd.getTime() ? dc : minDate([anchor, dd]);
    design = {
      field: "deadlineDesign",
      label: "Design",
      status: row.statusDesign,
      startDay: designStart,
      endDay: dd,
      lenDays: differenceInCalendarDays(dd, designStart) + 1,
      late: isLate(row.statusDesign, dd, today),
    };
  }

  const spanStarts = [copy?.startDay, design?.startDay, tp].filter(
    (d): d is Date => Boolean(d),
  );
  const spanEnds = [copy?.endDay, design?.endDay, tp].filter((d): d is Date =>
    Boolean(d),
  );

  const progressPct = Math.round(
    (STATUS_PROGRESS_PCT[row.statusCopywriting] +
      STATUS_PROGRESS_PCT[row.statusDesign]) /
      2,
  );

  return {
    row,
    startDay: minDate(spanStarts),
    endDay: maxDate(spanEnds),
    copy,
    design,
    post: tp,
    postLate: tp
      ? row.statusDesign !== ContentPlanStatusKerja.DIPUBLIKASIKAN &&
        tp.getTime() < today.getTime()
      : false,
    progressPct,
  };
}

/* ------------------------------------------------------------------ */
/* Baris konten: sel sidebar sticky + bar/milestone draggable.         */
/* ------------------------------------------------------------------ */

type DragState = { field: ContentPlanGanttField; delta: number };

/** Parameter geser dibaca dari `data-*` agar handler-nya bisa dipakai bersama. */
function markerTarget(el: HTMLButtonElement) {
  return {
    field: el.dataset.field as ContentPlanGanttField,
    minDelta: Number(el.dataset.minDelta ?? "0"),
  };
}

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
  geom: GanttGeom;
  rangeStartMs: number;
  pxPerDay: number;
  timelineWidth: number;
  sidebarOpen: boolean;
  readOnly: boolean;
  onOpen: (rowId: string) => void;
  onReschedule: (rowId: string, field: ContentPlanGanttField, next: Date) => void;
  onHover: (rowId: string | null, rect?: DOMRect) => void;
}) {
  const { row, copy, design, post, progressPct } = geom;

  const dragRef = useRef<{
    pointerId: number;
    field: ContentPlanGanttField;
    startX: number;
    minDelta: number;
    moved: boolean;
    delta: number;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const [drag, setDrag] = useState<DragState | null>(null);

  const dayX = useCallback(
    (d: Date) => differenceInCalendarDays(d, new Date(rangeStartMs)) * pxPerDay,
    [rangeStartMs, pxPerDay],
  );

  const deltaFor = (field: ContentPlanGanttField) =>
    drag?.field === field ? drag.delta : 0;

  function dateOfField(field: ContentPlanGanttField) {
    if (field === "deadlineCopywriting") return row.deadlineCopywriting;
    if (field === "deadlineDesign") return row.deadlineDesign;
    return row.tanggalPosting;
  }

  function commitDrag() {
    const d = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!d || !d.moved) return;
    // Drag apa pun menelan klik berikutnya agar sheet edit tidak ikut terbuka.
    suppressClickRef.current = true;
    if (d.delta === 0) return;
    const current = dateOfField(d.field);
    if (!current) return;
    onReschedule(row.id, d.field, addDays(new Date(current), d.delta));
  }

  function onPointerDown(e: ReactPointerEvent<HTMLButtonElement>) {
    if (readOnly || e.button !== 0) return;
    const { field, minDelta } = markerTarget(e.currentTarget);
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      field,
      startX: e.clientX,
      minDelta,
      moved: false,
      delta: 0,
    };
    setDrag({ field, delta: 0 });
    onHover(null);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLButtonElement>) {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const dx = e.clientX - d.startX;
    if (Math.abs(dx) < MIN_DRAG_PX) return;
    d.moved = true;
    const clamped = Math.max(Math.round(dx / pxPerDay), d.minDelta);
    if (clamped !== d.delta) {
      d.delta = clamped;
      setDrag({ field: d.field, delta: clamped });
    }
  }

  function onPointerUp(e: ReactPointerEvent<HTMLButtonElement>) {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    commitDrag();
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLButtonElement>) {
    if (readOnly) return;
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const { field, minDelta } = markerTarget(e.currentTarget);
    const step = (e.shiftKey ? 7 : 1) * (e.key === "ArrowRight" ? 1 : -1);
    const clamped = Math.max(step, minDelta);
    if (clamped === 0) return;
    const current = dateOfField(field);
    if (!current) return;
    onReschedule(row.id, field, addDays(new Date(current), clamped));
  }

  function onClick() {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    onOpen(row.id);
  }

  function onPointerEnter(e: ReactPointerEvent<HTMLButtonElement>) {
    if (!dragRef.current) onHover(row.id, e.currentTarget.getBoundingClientRect());
  }

  function onPointerLeave() {
    onHover(null);
  }

  function onFocus(e: React.FocusEvent<HTMLButtonElement>) {
    onHover(row.id, e.currentTarget.getBoundingClientRect());
  }

  function onBlur() {
    onHover(null);
  }

  /** Props seragam untuk semua bar/milestone; parameter geser dibawa `data-*`. */
  const markerProps = {
    type: "button" as const,
    onClick,
    onKeyDown,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
    onPointerEnter,
    onPointerLeave,
    onFocus,
    onBlur,
  };

  const title = row.konten?.trim() || "Tanpa judul";

  /** Bar fase: lebar mengikuti tenggat (kanan) yang bisa digeser. */
  function renderPhase(phase: Phase, top: number) {
    const meta = STATUS_BAR_CLASS[phase.status];
    const delta = deltaFor(phase.field);
    const dragging = drag?.field === phase.field;
    const left = dayX(phase.startDay);
    const widthPx = Math.max((phase.lenDays + delta) * pxPerDay - 2, 10);
    const pct = STATUS_PROGRESS_PCT[phase.status];
    return (
      <button
        {...markerProps}
        aria-label={`${title} — ${phase.label} ${STATUS_LABEL[phase.status]}, tenggat ${fmtLong(phase.endDay)}.${
          readOnly
            ? ""
            : " Seret atau tekan panah kiri/kanan untuk menggeser tenggat, Shift untuk per minggu."
        }`}
        data-field={phase.field}
        data-min-delta={-(phase.lenDays - 1)}
        className={cn(
          "absolute z-10 h-[11px] overflow-hidden rounded-full border text-left shadow-xs outline-none transition-shadow",
          "focus-visible:ring-ring/60 focus-visible:ring-2",
          meta.base,
          meta.border,
          phase.late && "ring-1 ring-rose-500/50",
          !readOnly && "cursor-grab touch-pan-y",
          dragging && "z-30 cursor-grabbing shadow-md",
        )}
        style={{ top, left, width: widthPx }}
      >
        {pct > 0 ? (
          <span
            className={cn("absolute inset-y-0 left-0", meta.fill)}
            style={{ width: `${pct}%` }}
            aria-hidden
          />
        ) : null}
        {!readOnly ? (
          <span
            className="absolute inset-y-0.5 right-0.5 z-20 w-[3px] rounded-full bg-current opacity-0 transition-opacity group-hover:opacity-30"
            aria-hidden
          />
        ) : null}
      </button>
    );
  }

  const copyDelta = deltaFor("deadlineCopywriting");
  const designDelta = deltaFor("deadlineDesign");
  const postDelta = deltaFor("tanggalPosting");

  const postX = post ? dayX(post) + postDelta * pxPerDay + pxPerDay / 2 : 0;
  const lastPhaseEnd = design ?? copy;
  const connectorFrom = lastPhaseEnd
    ? dayX(lastPhaseEnd.endDay) +
      (deltaFor(lastPhaseEnd.field) + 1) * pxPerDay -
      2
    : null;

  /**
   * Label ekor saat sidebar ditutup: menempel di ujung bar terakhir — bukan di
   * milestone posting, yang bisa berjarak berbulan-bulan dari bar.
   */
  const barEndX = Math.max(
    copy ? dayX(copy.startDay) + (copy.lenDays + copyDelta) * pxPerDay : 0,
    design ? dayX(design.startDay) + (design.lenDays + designDelta) * pxPerDay : 0,
  );
  const tailX = barEndX > 0 ? barEndX + 8 : postX + 14;

  const dragPreview = (() => {
    if (!drag) return null;
    if (drag.field === "tanggalPosting" && post) {
      return { x: postX, text: `Posting: ${fmtLong(addDays(post, drag.delta))}` };
    }
    const phase = drag.field === "deadlineCopywriting" ? copy : design;
    if (!phase) return null;
    return {
      x: dayX(phase.startDay) + (phase.lenDays + drag.delta) * pxPerDay,
      text: `${phase.label}: ${fmtLong(addDays(phase.endDay, drag.delta))}`,
    };
  })();

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
          <span className="flex shrink-0 flex-col gap-[3px]" aria-hidden>
            <span
              className={cn(
                "size-1.5 rounded-full",
                STATUS_BAR_CLASS[row.statusCopywriting].dot,
              )}
              title={`Copywriting: ${STATUS_LABEL[row.statusCopywriting]}`}
            />
            <span
              className={cn(
                "size-1.5 rounded-full",
                STATUS_BAR_CLASS[row.statusDesign].dot,
              )}
              title={`Design: ${STATUS_LABEL[row.statusDesign]}`}
            />
          </span>
          <button
            type="button"
            onClick={() => onOpen(row.id)}
            className="min-w-0 flex-1 text-left outline-none focus-visible:ring-0"
          >
            <p className="text-foreground truncate text-xs font-medium group-hover:underline">
              {title}
            </p>
            <p className="text-muted-foreground truncate text-[10px] tabular-nums">
              {JENIS_LABEL[row.jenisKonten]}
              {post ? ` · terbit ${fmtShort(post)}` : " · belum ada tanggal terbit"}
              {row.jamPosting ? ` ${row.jamPosting}` : ""}
            </p>
          </button>
          <span
            className="bg-muted h-1 w-8 shrink-0 overflow-hidden rounded-full"
            title={`Progres ${progressPct}%`}
            aria-hidden
          >
            <span
              className="bg-primary/70 block h-full rounded-full"
              style={{ width: `${progressPct}%` }}
            />
          </span>
          <PicAvatars pics={row.pics ?? []} max={2} />
        </div>
      ) : null}

      <div className="relative shrink-0" style={{ width: timelineWidth }}>
        {/* Penghubung dari tenggat terakhir ke tanggal posting */}
        {post && connectorFrom !== null && postX - 6 > connectorFrom ? (
          <span
            className="border-muted-foreground/30 pointer-events-none absolute top-1/2 z-0 border-t border-dashed"
            style={{ left: connectorFrom, width: postX - 6 - connectorFrom }}
            aria-hidden
          />
        ) : null}

        {copy ? renderPhase(copy, 8) : null}
        {design ? renderPhase(design, 27) : null}

        {post ? (
          <>
            <span
              className={cn(
                "pointer-events-none absolute inset-y-1 z-0 w-px border-l border-dashed",
                geom.postLate
                  ? "border-rose-500/50"
                  : "border-foreground/20 dark:border-foreground/25",
              )}
              style={{ left: postX }}
              aria-hidden
            />
            <button
              {...markerProps}
              aria-label={`${title} — tanggal posting ${fmtLong(post)}${row.jamPosting ? ` pukul ${row.jamPosting}` : ""}.${
                readOnly
                  ? ""
                  : " Seret atau tekan panah kiri/kanan untuk menggeser tanggal posting."
              }`}
              data-field="tanggalPosting"
              data-min-delta={-MAX_RANGE_DAYS}
              className={cn(
                "absolute top-1/2 z-20 flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md outline-none",
                "focus-visible:ring-ring/60 focus-visible:ring-2",
                !readOnly && "cursor-grab touch-pan-y",
                drag?.field === "tanggalPosting" && "z-30 cursor-grabbing",
              )}
              style={{ left: postX }}
            >
              <span
                className={cn(
                  "ring-card block size-[13px] rotate-45 rounded-[3px] shadow-sm ring-2",
                  geom.postLate
                    ? "bg-rose-500"
                    : row.statusDesign === ContentPlanStatusKerja.DIPUBLIKASIKAN
                      ? "bg-emerald-500"
                      : "bg-fuchsia-500",
                )}
                aria-hidden
              />
            </button>
          </>
        ) : null}

        {!sidebarOpen ? (
          <span
            className="text-muted-foreground pointer-events-none absolute top-1/2 z-0 max-w-52 -translate-y-1/2 truncate text-[11px]"
            style={{ left: tailX }}
            aria-hidden
          >
            {title}
          </span>
        ) : null}

        {dragPreview ? (
          <span
            className="bg-foreground text-background pointer-events-none absolute -top-1 z-40 -translate-x-1/2 rounded-md px-2 py-0.5 text-[10px] font-medium whitespace-nowrap shadow-md"
            style={{ left: dragPreview.x }}
          >
            {dragPreview.text}
          </span>
        ) : null}
      </div>
    </div>
  );
});

/* ------------------------------------------------------------------ */
/* Komponen utama                                                      */
/* ------------------------------------------------------------------ */

export function ContentPlanGantt({
  rows,
  onOpenRow,
  onReschedule,
  onAddRow,
  hasActiveFilters = false,
  readOnly = false,
}: {
  rows: ContentPlanGanttRow[];
  /** Klik bar / judul — biasanya membuka sheet edit baris. */
  onOpenRow: (rowId: string) => void;
  /** Dipanggil saat bar atau milestone digeser (drag / keyboard). */
  onReschedule: (
    rowId: string,
    field: ContentPlanGanttField,
    next: Date,
  ) => void;
  onAddRow?: () => void;
  hasActiveFilters?: boolean;
  readOnly?: boolean;
}) {
  const [today] = useState(() => startOfDay(new Date()));
  const [zoom, setZoom] = useState<ZoomKey>("day");
  const [group, setGroup] = useState<GroupKey>("none");
  const isSmallScreen = useIsSmallScreen();
  // null = ikut default perangkat (layar sempit tertutup); toggle meng-override.
  const [sidebarOverride, setSidebarOverride] = useState<boolean | null>(null);
  const sidebarOpen = sidebarOverride ?? !isSmallScreen;
  const [hoverCard, setHoverCard] = useState<{
    rowId: string;
    x: number;
    y: number;
    place: "top" | "bottom";
  } | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const geoms = useMemo(() => {
    return rows
      .map((row) => buildGeom(row, today))
      .filter((g): g is GanttGeom => g !== null)
      .sort(
        (a, b) =>
          a.startDay.getTime() - b.startDay.getTime() ||
          a.endDay.getTime() - b.endDay.getTime() ||
          a.row.konten.localeCompare(b.row.konten),
      );
  }, [rows, today]);

  const unscheduled = useMemo(
    () =>
      rows.filter(
        (r) => !r.deadlineCopywriting && !r.deadlineDesign && !r.tanggalPosting,
      ),
    [rows],
  );

  /** Baris + judul grup dalam satu daftar datar agar mudah dirender. */
  const listItems = useMemo<ListItem[]>(() => {
    if (group === "none") {
      return geoms.map((geom) => ({ kind: "row", key: geom.row.id, geom }));
    }
    const buckets = new Map<string, { label: string; geoms: GanttGeom[] }>();
    for (const geom of geoms) {
      let key: string;
      let label: string;
      if (group === "jenis") {
        key = geom.row.jenisKonten;
        label = JENIS_LABEL[geom.row.jenisKonten];
      } else if (group === "usage") {
        key = geom.row.usage ?? ContentPlanUsage.AWARENESS;
        label = USAGE_LABEL[geom.row.usage ?? ContentPlanUsage.AWARENESS];
      } else {
        const first = geom.row.pics?.[0];
        key = first?.id ?? "__none__";
        label = first ? (first.name?.trim() || first.email) : "Tanpa PIC";
      }
      const bucket = buckets.get(key) ?? { label, geoms: [] };
      bucket.geoms.push(geom);
      buckets.set(key, bucket);
    }
    return [...buckets.entries()]
      .sort(([, a], [, b]) => a.label.localeCompare(b.label))
      .flatMap(([key, bucket]): ListItem[] => [
        {
          kind: "group",
          key: `group:${key}`,
          label: bucket.label,
          count: bucket.geoms.length,
        },
        ...bucket.geoms.map(
          (geom): ListItem => ({ kind: "row", key: geom.row.id, geom }),
        ),
      ]);
  }, [geoms, group]);

  const { rangeStart, totalDays } = useMemo(() => {
    const min = minDate([...geoms.map((g) => g.startDay), today]);
    const max = maxDate([...geoms.map((g) => g.endDay), today]);
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
        t2.push({
          left: differenceInCalendarDays(from, rangeStart) * pxPerDay,
          width: (differenceInCalendarDays(to, from) + 1) * pxPerDay,
          label: cursor.toLocaleDateString("id-ID", { month: "short" }),
          isToday: today >= from && today <= to,
        });
        cursor = next;
      }
    }

    if (zoom === "month") {
      for (let y = rangeStart.getFullYear(); y <= rangeEnd.getFullYear(); y++) {
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

  const scrollToX = useCallback(
    (x: number, smooth: boolean) => {
      const el = scrollRef.current;
      if (!el) return;
      const viewport = Math.max(
        el.clientWidth - (sidebarOpen ? SIDEBAR_PX : 0),
        160,
      );
      el.scrollTo({
        left: Math.max(0, x - viewport / 3),
        behavior: smooth ? "smooth" : "auto",
      });
    },
    [sidebarOpen],
  );

  /**
   * Titik fokus awal: "hari ini", kecuali seluruh jadwal sudah lewat — di situ
   * layar mendarat di konten terakhir supaya tidak membuka linimasa kosong.
   */
  const focusX = useMemo(() => {
    if (geoms.length === 0) return todayX;
    const lastEnd = maxDate(geoms.map((g) => g.endDay));
    const lastEndX = differenceInCalendarDays(lastEnd, rangeStart) * pxPerDay;
    return lastEndX < todayX ? lastEndX : todayX;
  }, [geoms, rangeStart, pxPerDay, todayX]);

  // Saat mount / ganti zoom: posisikan titik fokus di sepertiga kiri viewport.
  useEffect(() => {
    scrollToX(focusX, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, focusX]);

  const onBarHover = useCallback((rowId: string | null, rect?: DOMRect) => {
    if (!rowId || !rect || !wrapRef.current) {
      setHoverCard(null);
      return;
    }
    const w = wrapRef.current.getBoundingClientRect();
    const rawX = rect.left - w.left + rect.width / 2;
    const x = Math.min(Math.max(rawX, 150), Math.max(150, w.width - 150));
    const yTop = rect.top - w.top;
    const place: "top" | "bottom" = yTop < 190 ? "bottom" : "top";
    setHoverCard({
      rowId,
      x,
      y: place === "top" ? yTop - 8 : yTop + rect.height + 8,
      place,
    });
  }, []);

  const hoverGeom = hoverCard
    ? geoms.find((g) => g.row.id === hoverCard.rowId)
    : undefined;

  /* ----------------------------- states ----------------------------- */

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={CalendarRange}
        title={
          hasActiveFilters
            ? "Tidak ada konten yang cocok dengan filter"
            : "Belum ada baris content planning"
        }
        description={
          hasActiveFilters
            ? "Longgarkan filter atau pencarian untuk melihat linimasa."
            : "Tambahkan konten lewat tombol Baris baru untuk mulai menyusun linimasa."
        }
        action={
          !hasActiveFilters && onAddRow ? (
            <Button type="button" size="sm" onClick={onAddRow}>
              Baris baru
            </Button>
          ) : undefined
        }
      />
    );
  }

  if (geoms.length === 0) {
    return (
      <EmptyState
        icon={CalendarRange}
        title="Belum ada konten yang dijadwalkan"
        description={`${rows.length} baris belum punya deadline copywriting, deadline design, maupun tanggal posting. Isi salah satunya agar muncul di Gantt.`}
      />
    );
  }

  /* ----------------------------- render ----------------------------- */

  return (
    <div ref={wrapRef} className="relative flex min-h-0 flex-1 flex-col gap-3">
      {/* Toolbar: legenda, grup, zoom, sidebar */}
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="text-muted-foreground inline-flex items-center gap-1.5">
            <span
              className="bg-muted-foreground/40 h-[7px] w-6 rounded-full"
              aria-hidden
            />
            Copywriting
          </span>
          <span className="text-muted-foreground inline-flex items-center gap-1.5">
            <span
              className="bg-muted-foreground/40 h-[7px] w-6 rounded-full"
              aria-hidden
            />
            Design
          </span>
          <span className="text-muted-foreground inline-flex items-center gap-1.5">
            <span
              className="block size-2.5 rotate-45 rounded-[2px] bg-fuchsia-500"
              aria-hidden
            />
            Posting
          </span>
          <span className="text-muted-foreground/70 hidden lg:inline">
            Warna bar = status kerja · seret ujung bar untuk menggeser tenggat
          </span>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Select
            value={group}
            items={GROUP_ITEMS}
            onValueChange={(v) => setGroup((v ?? "none") as GroupKey)}
          >
            <SelectTrigger size="sm" aria-label="Kelompokkan baris">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GROUP_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

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
            size="sm"
            onClick={() => scrollToX(todayX, true)}
          >
            <LocateFixed className="size-3.5" aria-hidden />
            Hari ini
          </Button>

          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={
              sidebarOpen ? "Sembunyikan daftar konten" : "Tampilkan daftar konten"
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

      <div
        ref={scrollRef}
        onScroll={() => setHoverCard(null)}
        className="border-border bg-card relative min-h-56 flex-1 overflow-auto overscroll-x-contain rounded-xl border"
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
                    {geoms.length} konten terjadwal
                  </p>
                </div>
              ) : null}
              <div className="relative shrink-0" style={{ width: timelineWidth }}>
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

          {/* Body: layer grid + garis hari ini + baris konten */}
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

            {listItems.map((item) =>
              item.kind === "group" ? (
                <div
                  key={item.key}
                  className="border-border/40 bg-muted/40 relative z-10 flex items-center border-b"
                  style={{ height: GROUP_PX }}
                >
                  <div
                    className="bg-muted/60 sticky left-0 z-20 flex h-full shrink-0 items-center gap-2 px-3"
                    style={{ width: sidebarOpen ? SIDEBAR_PX : 200 }}
                  >
                    <p className="text-foreground truncate text-[11px] font-semibold">
                      {item.label}
                    </p>
                    <span className="text-muted-foreground text-[10px] tabular-nums">
                      {item.count}
                    </span>
                  </div>
                </div>
              ) : (
                <GanttRow
                  key={item.key}
                  geom={item.geom}
                  rangeStartMs={rangeStart.getTime()}
                  pxPerDay={pxPerDay}
                  timelineWidth={timelineWidth}
                  sidebarOpen={sidebarOpen}
                  readOnly={readOnly}
                  onOpen={onOpenRow}
                  onReschedule={onReschedule}
                  onHover={onBarHover}
                />
              ),
            )}
          </div>
        </div>
      </div>

      {unscheduled.length > 0 ? (
        <div className="border-border bg-muted/20 shrink-0 rounded-xl border border-dashed p-3">
          <p className="text-muted-foreground text-[11px] font-medium">
            {unscheduled.length} konten belum terjadwal — isi deadline atau
            tanggal posting agar muncul di linimasa.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {unscheduled.slice(0, 12).map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onOpenRow(r.id)}
                className="border-border bg-card hover:bg-muted inline-flex max-w-56 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors"
              >
                <Pencil className="size-3 shrink-0 opacity-60" aria-hidden />
                <span className="truncate">
                  {r.konten?.trim() || "Tanpa judul"}
                </span>
              </button>
            ))}
            {unscheduled.length > 12 ? (
              <span className="text-muted-foreground self-center text-[11px]">
                +{unscheduled.length - 12} lainnya
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Kartu detail saat hover/fokus bar */}
      {hoverGeom && hoverCard ? (
        <div
          className="border-border bg-popover text-popover-foreground pointer-events-none absolute z-40 w-72 rounded-lg border p-3 shadow-md"
          style={{
            left: hoverCard.x,
            top: hoverCard.y,
            transform: `translate(-50%, ${hoverCard.place === "top" ? "-100%" : "0"})`,
          }}
          role="presentation"
        >
          <p className="text-xs font-semibold text-pretty">
            {hoverGeom.row.konten?.trim() || "Tanpa judul"}
          </p>
          <p className="text-muted-foreground mt-1 text-[11px]">
            {JENIS_LABEL[hoverGeom.row.jenisKonten]} ·{" "}
            {USAGE_LABEL[hoverGeom.row.usage ?? ContentPlanUsage.AWARENESS]}
          </p>

          <dl className="mt-2 space-y-1 text-[11px]">
            <PhaseLine
              label="Copywriting"
              status={hoverGeom.row.statusCopywriting}
              date={hoverGeom.copy?.endDay ?? null}
              late={hoverGeom.copy?.late ?? false}
            />
            <PhaseLine
              label="Design"
              status={hoverGeom.row.statusDesign}
              date={hoverGeom.design?.endDay ?? null}
              late={hoverGeom.design?.late ?? false}
            />
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">Posting</dt>
              <dd
                className={cn(
                  "tabular-nums",
                  hoverGeom.postLate && "text-rose-600 dark:text-rose-400",
                )}
              >
                {hoverGeom.post ? fmtLong(hoverGeom.post) : "—"}
                {hoverGeom.row.jamPosting ? ` · ${hoverGeom.row.jamPosting}` : ""}
              </dd>
            </div>
          </dl>

          <div className="mt-2">
            <div className="text-muted-foreground flex items-center justify-between text-[10px]">
              <span>Progres</span>
              <span className="tabular-nums">{hoverGeom.progressPct}%</span>
            </div>
            <div className="bg-muted mt-1 h-1.5 overflow-hidden rounded-full">
              <div
                className="bg-primary/70 h-full rounded-full"
                style={{ width: `${hoverGeom.progressPct}%` }}
              />
            </div>
          </div>

          {(hoverGeom.row.pics?.length ?? 0) > 0 ? (
            <div className="mt-2 flex items-center gap-1.5">
              <PicAvatars pics={hoverGeom.row.pics ?? []} />
              <span className="text-muted-foreground min-w-0 truncate text-[10px]">
                {(hoverGeom.row.pics ?? [])
                  .map((p) => p.name ?? p.email)
                  .join(", ")}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function PhaseLine({
  label,
  status,
  date,
  late,
}: {
  label: string;
  status: ContentPlanStatusKerja;
  date: Date | null;
  late: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted-foreground flex min-w-0 flex-1 items-center gap-1.5">
        <span
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            STATUS_BAR_CLASS[status].dot,
          )}
          aria-hidden
        />
        <span className="shrink-0">{label}</span>
        <span className="truncate opacity-70">· {STATUS_LABEL[status]}</span>
      </dt>
      <dd
        className={cn(
          "shrink-0 tabular-nums",
          late && "text-rose-600 dark:text-rose-400",
        )}
      >
        {date ? fmtLong(date) : "—"}
      </dd>
    </div>
  );
}
