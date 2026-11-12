"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChartGantt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  CAMPAIGN_BAND_CLASS,
  CAMPAIGN_STATUS_LABEL,
  campaignStyle,
} from "@/lib/room-calendar/campaign-ui";
import {
  addDaysKey,
  diffDays,
  eachDayKey,
  firstDayOfMonth,
  formatDayRange,
  formatDayShort,
  formatMonthShort,
  lastDayOfMonth,
  maxKey,
  minKey,
  monthKeyOf,
  shiftMonth,
  weekdayIndex,
  type DayKey,
} from "@/lib/room-calendar/dates";
import { momentsBetween, type Moment } from "@/lib/room-calendar/moments";
import {
  eventDays,
  type CalCampaign,
  type CalEvent,
  type CampaignProgress,
} from "@/lib/room-calendar/types";
import { cn } from "@/lib/utils";
import { Segmented } from "./calendar-parts";
import type { TimelineZoom } from "./calendar-prefs";

const ZOOM_PX: Record<TimelineZoom, number> = { week: 34, month: 14, quarter: 6 };
const ROW_H = 56;
/** Di bawah ambang ini gerakan dianggap klik, bukan geser. */
const MIN_DRAG_PX = 6;

type DragMode = "move" | "start" | "end";

/**
 * Linimasa campaign: satu baris per campaign, batang dari mulai sampai selesai,
 * titik aktivitas di bawahnya. Batang bisa digeser dan ditarik ujungnya.
 */
export function CalendarTimeline({
  month,
  today,
  jumpNonce,
  zoom,
  campaigns,
  events,
  progress,
  showMoments,
  showLoose,
  onZoomChange,
  onOpenCampaign,
  onOpenEvent,
  onReschedule,
  onNewCampaign,
}: {
  month: string;
  today: DayKey;
  /** Berubah saat "Hari ini" diklik, supaya linimasa menggulir lagi. */
  jumpNonce: number;
  zoom: TimelineZoom;
  campaigns: CalCampaign[];
  /** Aktivitas yang sedang tampil (sudah disaring fokus/lapisan). */
  events: CalEvent[];
  progress: Map<string, CampaignProgress>;
  showMoments: boolean;
  showLoose: boolean;
  onZoomChange: (zoom: TimelineZoom) => void;
  onOpenCampaign: (campaign: CalCampaign) => void;
  onOpenEvent: (event: CalEvent) => void;
  onReschedule: (campaign: CalCampaign, startDate: DayKey, endDate: DayKey) => void;
  onNewCampaign: () => void;
}) {
  const px = ZOOM_PX[zoom];
  const scrollerRef = useRef<HTMLDivElement>(null);

  const range = useMemo(() => {
    const cursor = firstDayOfMonth(month);
    let start = minKey(addDaysKey(today, -21), cursor);
    let end = maxKey(addDaysKey(today, 150), lastDayOfMonth(shiftMonth(month, 3)));
    for (const c of campaigns) {
      start = minKey(start, c.startDate);
      end = maxKey(end, c.endDate);
    }
    // Tanggal salah ketik (mis. tahun 2099) tidak boleh membuat linimasa selebar itu.
    start = maxKey(start, addDaysKey(minKey(cursor, today), -400));
    end = minKey(end, addDaysKey(maxKey(cursor, today), 800));
    start = firstDayOfMonth(monthKeyOf(start));
    end = lastDayOfMonth(monthKeyOf(end));
    return { start, end, days: diffDays(start, end) + 1 };
  }, [month, today, campaigns]);

  const totalW = range.days * px;
  const dayX = (key: DayKey) => diffDays(range.start, key) * px;

  const months = useMemo(() => {
    const out: { key: string; x: number; w: number }[] = [];
    for (let m = monthKeyOf(range.start); m <= monthKeyOf(range.end); m = shiftMonth(m, 1)) {
      const first = firstDayOfMonth(m);
      const last = lastDayOfMonth(m);
      out.push({
        key: m,
        x: diffDays(range.start, first) * px,
        w: (diffDays(first, last) + 1) * px,
      });
    }
    return out;
  }, [range.start, range.end, px]);

  const ticks = useMemo(() => {
    if (zoom === "quarter") return [];
    return eachDayKey(range.start, range.end).filter((d) => zoom === "week" || weekdayIndex(d) === 0);
  }, [range.start, range.end, zoom]);

  const moments = useMemo<Moment[]>(() => {
    if (!showMoments) return [];
    return momentsBetween(range.start, range.end).filter(
      (m) => (m.kind === "holiday" || m.major) && m.kind !== "season" && m.kind !== "payday",
    );
  }, [showMoments, range.start, range.end]);

  /**
   * Label momen yang muat tanpa bertumpuk. Momen besar memilih tempat lebih
   * dulu; sisanya hanya titik (nama tetap ada di tooltip).
   */
  const momentLabels = useMemo(() => {
    const out = new Map<string, string>();
    if (zoom === "quarter") return out;
    const taken: [number, number][] = [];
    const ordered = [...moments].sort((a, b) => Number(Boolean(b.major)) - Number(Boolean(a.major)));
    for (const m of ordered) {
      const text = m.kind === "twin" ? m.label.split(" ")[0]! : m.label;
      const from = diffDays(range.start, m.date) * px;
      const to = from + text.length * 5.8 + 18;
      if (taken.some(([a, b]) => from < b && a < to)) continue;
      taken.push([from, to]);
      out.set(m.id, text);
    }
    return out;
  }, [moments, zoom, px, range.start]);

  const eventsByCampaign = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const ev of events) {
      const key = ev.campaignId ?? "";
      const list = map.get(key) ?? [];
      list.push(ev);
      map.set(key, list);
    }
    return map;
  }, [events]);
  const looseEvents = showLoose ? (eventsByCampaign.get("") ?? []) : [];

  const jumpDay = monthKeyOf(today) === month ? addDaysKey(today, -4) : firstDayOfMonth(month);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollLeft = Math.max(0, diffDays(range.start, jumpDay) * px - 8);
  }, [jumpDay, jumpNonce, px, range.start]);

  if (campaigns.length === 0) {
    return (
      <EmptyState
        icon={ChartGantt}
        title="Belum ada campaign untuk digambar"
        description="Linimasa menampilkan rentang tiap campaign berdampingan, supaya terlihat mana yang bertabrakan dan kapan ada jeda."
        action={
          <Button type="button" size="sm" onClick={onNewCampaign}>
            Buat campaign
          </Button>
        }
      />
    );
  }

  const todayX = today >= range.start && today <= range.end ? dayX(today) + px / 2 : null;

  return (
    <div className="bg-card overflow-hidden rounded-xl border [--side:8.5rem] sm:[--side:14rem]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-3 py-2">
        <Segmented
          label="Zoom linimasa"
          value={zoom}
          onChange={onZoomChange}
          options={[
            { value: "week", label: "Minggu" },
            { value: "month", label: "Bulan" },
            { value: "quarter", label: "Kuartal" },
          ]}
        />
        <p className="text-muted-foreground hidden text-xs md:block">
          Geser pita untuk memindahkan campaign, tarik ujungnya untuk mengubah durasi.
        </p>
      </div>

      <div ref={scrollerRef} className="overflow-x-auto">
        <div className="relative" style={{ width: `calc(var(--side) + ${totalW}px)` }}>
          {/* Garis vertikal: batas bulan, momen besar, hari ini. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0"
            style={{ left: "var(--side)", width: totalW }}
          >
            {months.map((m) => (
              <span
                key={m.key}
                className="border-border/70 absolute inset-y-0 border-l"
                style={{ left: m.x }}
              />
            ))}
            {moments.map((m) => (
              <span
                key={m.id}
                className={cn(
                  "absolute top-[2.75rem] bottom-0 border-l border-dashed",
                  m.kind === "holiday" ? "border-red-500/40" : "border-foreground/25",
                )}
                style={{ left: dayX(m.date) + px / 2 }}
              />
            ))}
            {todayX !== null ? (
              <span className="bg-primary absolute inset-y-0 w-0.5" style={{ left: todayX - 1 }} />
            ) : null}
          </div>

          {/* Kepala: bulan, tanggal, momen. */}
          <div className="flex border-b">
            <div
              className="bg-card text-muted-foreground sticky left-0 z-20 flex shrink-0 items-end border-r px-2.5 pb-1.5 text-xs"
              style={{ width: "var(--side)" }}
            >
              Campaign
            </div>
            <div className="relative h-[4.25rem]" style={{ width: totalW }}>
              {/* Label bulan menempel di tepi kiri selama bulannya masih terlihat. */}
              <div className="absolute inset-x-0 top-0 flex h-6">
                {months.map((m) => (
                  <div key={m.key} className="shrink-0" style={{ width: m.w }}>
                    <span
                      className="sticky inline-block px-1.5 pt-1.5 text-xs font-medium whitespace-nowrap"
                      style={{ left: "var(--side)" }}
                    >
                      {formatMonthShort(m.key, m.key.endsWith("-01") || m.x === 0)}
                    </span>
                  </div>
                ))}
              </div>
              {ticks.map((d) => (
                <span
                  key={d}
                  className={cn(
                    "absolute top-[1.625rem] text-center text-[10px] tabular-nums",
                    d === today
                      ? "text-foreground font-semibold"
                      : weekdayIndex(d) >= 5
                        ? "text-muted-foreground/50"
                        : "text-muted-foreground",
                  )}
                  style={{ left: dayX(d), width: zoom === "week" ? px : px * 2 }}
                >
                  {Number(d.slice(8))}
                </span>
              ))}
              {moments.map((m) => (
                <span
                  key={m.id}
                  title={`${m.label}, ${formatDayShort(m.date)}${m.estimated ? " (perkiraan)" : ""}`}
                  className={cn(
                    "absolute bottom-1 flex items-center gap-1 text-[10px] leading-none whitespace-nowrap",
                    m.kind === "holiday" ? "text-red-700 dark:text-red-400" : "text-foreground/80",
                  )}
                  style={{ left: dayX(m.date) + px / 2 - 3 }}
                >
                  <span
                    className={cn(
                      "size-1.5 shrink-0 rounded-full",
                      m.kind === "holiday" ? "bg-red-600 dark:bg-red-400" : "bg-foreground/60",
                    )}
                  />
                  {momentLabels.get(m.id) ?? null}
                </span>
              ))}
            </div>
          </div>

          {campaigns.map((c) => (
            <div key={c.id} className="flex border-b" style={{ height: ROW_H }}>
              <div
                className="bg-card sticky left-0 z-20 flex shrink-0 flex-col justify-center border-r px-2.5"
                style={{ width: "var(--side)" }}
              >
                <button
                  type="button"
                  onClick={() => onOpenCampaign(c)}
                  className="focus-visible:ring-ring truncate rounded text-left text-sm font-medium outline-none hover:underline focus-visible:ring-2"
                >
                  {c.name}
                </button>
                <span className="text-muted-foreground flex justify-between gap-2 text-xs">
                  <span className="truncate tabular-nums">
                    {formatDayRange(c.startDate, c.endDate)}
                  </span>
                  <ProgressText progress={progress.get(c.id)} />
                </span>
              </div>
              <div className="relative" style={{ width: totalW }}>
                <TimelineBar
                  campaign={c}
                  rangeStart={range.start}
                  rangeEnd={range.end}
                  px={px}
                  onOpen={onOpenCampaign}
                  onReschedule={onReschedule}
                />
                <ActivityDots
                  events={eventsByCampaign.get(c.id) ?? []}
                  color={c.color}
                  rangeStart={range.start}
                  rangeEnd={range.end}
                  px={px}
                  onOpen={onOpenEvent}
                />
              </div>
            </div>
          ))}

          {looseEvents.length > 0 ? (
            <div className="flex" style={{ height: ROW_H - 12 }}>
              <div
                className="bg-card text-muted-foreground sticky left-0 z-20 flex shrink-0 items-center border-r px-2.5 text-xs"
                style={{ width: "var(--side)" }}
              >
                Tanpa campaign
              </div>
              <div className="relative" style={{ width: totalW }}>
                <ActivityDots
                  events={looseEvents}
                  color={null}
                  rangeStart={range.start}
                  rangeEnd={range.end}
                  px={px}
                  top={16}
                  onOpen={onOpenEvent}
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ProgressText({ progress }: { progress: CampaignProgress | undefined }) {
  if (!progress || progress.total === 0) return null;
  return (
    <span
      className="hidden shrink-0 tabular-nums sm:inline"
      title={`${progress.done} dari ${progress.total} aktivitas selesai`}
    >
      {progress.done}/{progress.total}
    </span>
  );
}

function TimelineBar({
  campaign,
  rangeStart,
  rangeEnd,
  px,
  onOpen,
  onReschedule,
}: {
  campaign: CalCampaign;
  rangeStart: DayKey;
  rangeEnd: DayKey;
  px: number;
  onOpen: (campaign: CalCampaign) => void;
  onReschedule: (campaign: CalCampaign, startDate: DayKey, endDate: DayKey) => void;
}) {
  const dragRef = useRef<{
    pointerId: number;
    mode: DragMode;
    startX: number;
    delta: number;
    moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false);
  const [drag, setDrag] = useState<{ mode: DragMode; delta: number } | null>(null);

  const length = diffDays(campaign.startDate, campaign.endDate);

  function shifted(mode: DragMode, delta: number): { start: DayKey; end: DayKey } {
    if (mode === "move") {
      return {
        start: addDaysKey(campaign.startDate, delta),
        end: addDaysKey(campaign.endDate, delta),
      };
    }
    if (mode === "start") {
      return { start: addDaysKey(campaign.startDate, Math.min(delta, length)), end: campaign.endDate };
    }
    return { start: campaign.startDate, end: addDaysKey(campaign.endDate, Math.max(delta, -length)) };
  }

  const shown = drag ? shifted(drag.mode, drag.delta) : { start: campaign.startDate, end: campaign.endDate };
  // Batang yang keluar dari jendela linimasa dipotong di tepinya.
  const visStart = maxKey(shown.start, rangeStart);
  const visEnd = minKey(shown.end, rangeEnd);
  if (visEnd < visStart) return null;
  const left = diffDays(rangeStart, visStart) * px;
  const width = (diffDays(visStart, visEnd) + 1) * px;

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    // Di layar sentuh geser horizontal dipakai untuk menggulir; tanggal diubah lewat form.
    if (e.pointerType === "touch" || e.button !== 0) return;
    const handle = (e.target as HTMLElement).closest<HTMLElement>("[data-handle]");
    const mode = (handle?.dataset.handle as DragMode | undefined) ?? "move";
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { pointerId: e.pointerId, mode, startX: e.clientX, delta: 0, moved: false };
  }

  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const dx = e.clientX - d.startX;
    if (!d.moved && Math.abs(dx) < MIN_DRAG_PX) return;
    d.moved = true;
    const delta = Math.round(dx / px);
    if (delta !== d.delta || !drag) {
      d.delta = delta;
      setDrag({ mode: d.mode, delta });
    }
  }

  function finish(e: React.PointerEvent<HTMLButtonElement>, commit: boolean) {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    dragRef.current = null;
    setDrag(null);
    if (!d.moved) return;
    suppressClick.current = true;
    if (!commit || d.delta === 0) return;
    const next = shifted(d.mode, d.delta);
    if (next.start !== campaign.startDate || next.end !== campaign.endDate) {
      onReschedule(campaign, next.start, next.end);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const step = (e.shiftKey ? 7 : 1) * (e.key === "ArrowRight" ? 1 : -1);
    const next = shifted("move", step);
    onReschedule(campaign, next.start, next.end);
  }

  return (
    <>
      <button
        type="button"
        aria-label={`${campaign.name}, ${formatDayRange(campaign.startDate, campaign.endDate)}, ${CAMPAIGN_STATUS_LABEL[campaign.status]}. Panah kiri atau kanan untuk menggeser satu hari.`}
        title={`${campaign.name} (${CAMPAIGN_STATUS_LABEL[campaign.status]})`}
        onClick={() => {
          if (suppressClick.current) {
            suppressClick.current = false;
            return;
          }
          onOpen(campaign);
        }}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => finish(e, true)}
        onPointerCancel={(e) => finish(e, false)}
        style={{ left, width, ...campaignStyle(campaign.color) }}
        className={cn(
          "focus-visible:ring-ring group/bar absolute top-2 flex h-6 cursor-grab items-center rounded-md text-left text-xs font-semibold outline-none focus-visible:ring-2 active:cursor-grabbing",
          CAMPAIGN_BAND_CLASS[campaign.status],
          drag && "z-10 shadow-md",
        )}
      >
        <span
          data-handle="start"
          aria-hidden
          className="absolute inset-y-0 left-0 w-2 cursor-ew-resize rounded-l-md group-hover/bar:bg-[color-mix(in_oklab,var(--cmp)_45%,transparent)]"
        />
        <span className="min-w-0 truncate px-2.5">{width >= 56 ? campaign.name : null}</span>
        <span
          data-handle="end"
          aria-hidden
          className="absolute inset-y-0 right-0 w-2 cursor-ew-resize rounded-r-md group-hover/bar:bg-[color-mix(in_oklab,var(--cmp)_45%,transparent)]"
        />
      </button>
      {drag ? (
        <span
          aria-hidden
          className="bg-foreground text-background pointer-events-none absolute top-[2.125rem] z-10 rounded px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap tabular-nums"
          style={{ left }}
        >
          {formatDayRange(shown.start, shown.end)}
        </span>
      ) : null}
    </>
  );
}

function ActivityDots({
  events,
  color,
  rangeStart,
  rangeEnd,
  px,
  top = 38,
  onOpen,
}: {
  events: CalEvent[];
  color: string | null;
  rangeStart: DayKey;
  rangeEnd: DayKey;
  px: number;
  top?: number;
  onOpen: (event: CalEvent) => void;
}) {
  const perDay = new Map<DayKey, number>();
  return (
    <>
      {events.map((ev) => {
        const day = eventDays(ev).start;
        if (day < rangeStart || day > rangeEnd) return null;
        const nth = perDay.get(day) ?? 0;
        perDay.set(day, nth + 1);
        if (nth >= 3) return null;
        const done = Boolean(ev.doneAt);
        return (
          <button
            key={ev.id}
            type="button"
            onClick={() => onOpen(ev)}
            title={`${ev.title}, ${formatDayShort(day)}${done ? " (selesai)" : ""}`}
            aria-label={`${ev.title}, ${formatDayShort(day)}${done ? ", selesai" : ""}`}
            style={{
              left: diffDays(rangeStart, day) * px + px / 2 - 5 + nth * 4,
              top,
              ...campaignStyle(color),
            }}
            className={cn(
              "focus-visible:ring-ring absolute size-2.5 rounded-full border-2 border-[var(--cmp)] outline-none transition-transform hover:scale-150 focus-visible:ring-2",
              done ? "bg-[var(--cmp)]" : "bg-card",
            )}
          />
        );
      })}
    </>
  );
}
