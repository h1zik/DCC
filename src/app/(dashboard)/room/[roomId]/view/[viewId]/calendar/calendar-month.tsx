"use client";

import { useId, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { AtSign, Check, Moon, Send } from "lucide-react";
import { formatWibTime } from "@/lib/kol/time";
import {
  CAMPAIGN_BAND_CLASS,
  CAMPAIGN_STATUS_LABEL,
  campaignStyle,
} from "@/lib/room-calendar/campaign-ui";
import {
  diffDays,
  formatDayLong,
  formatDayRange,
  monthGrid,
  monthKeyOf,
  type DayKey,
} from "@/lib/room-calendar/dates";
import { buildDayIndex, EMPTY_DAY_ITEMS } from "@/lib/room-calendar/day-index";
import { layoutWeek, type Span, type WeekSegment } from "@/lib/room-calendar/layout";
import {
  dayMomentsOf,
  indexMomentsByDay,
  type DayMoments,
  type Moment,
} from "@/lib/room-calendar/moments";
import {
  eventDays,
  type CalCampaign,
  type CalContentPost,
  type CalEvent,
  type CalKolPost,
} from "@/lib/room-calendar/types";
import { cn } from "@/lib/utils";
import { KindIcon } from "./calendar-parts";

const WEEK_DAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const MAX_CAMPAIGN_LANES = 3;
const MAX_EVENT_LANES = 2;
const MAX_CHIPS = 3;
const MAX_DOTS = 4;

type DragData = { eventId: string; originDay: DayKey };

export function CalendarMonth({
  month,
  today,
  campaigns,
  events,
  contentPosts,
  kolPosts,
  moments,
  campaignById,
  selectedDay,
  onSelectDay,
  onOpenEvent,
  onOpenCampaign,
  onMoveEvent,
}: {
  month: string;
  today: DayKey;
  campaigns: CalCampaign[];
  events: CalEvent[];
  contentPosts: CalContentPost[];
  kolPosts: CalKolPost[];
  moments: Moment[];
  campaignById: Map<string, CalCampaign>;
  selectedDay: DayKey | null;
  onSelectDay: (day: DayKey, anchor: HTMLElement) => void;
  onOpenEvent: (event: CalEvent) => void;
  onOpenCampaign: (campaign: CalCampaign) => void;
  onMoveEvent: (event: CalEvent, deltaDays: number) => void;
}) {
  const dndId = useId();
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
  );
  const [dragging, setDragging] = useState<CalEvent | null>(null);

  const weeks = useMemo(() => monthGrid(month), [month]);
  const days = useMemo(() => weeks.flat(), [weeks]);

  const momentIndex = useMemo(() => indexMomentsByDay(moments, days), [moments, days]);
  const dayIndex = useMemo(
    () => buildDayIndex({ campaigns, events, contentPosts, kolPosts }, days),
    [campaigns, events, contentPosts, kolPosts, days],
  );

  const campaignSpans = useMemo<Span[]>(
    () => campaigns.map((c) => ({ id: c.id, start: c.startDate, end: c.endDate })),
    [campaigns],
  );
  const eventById = useMemo(() => new Map(events.map((e) => [e.id, e] as const)), [events]);
  /** Aktivitas multi-hari digambar sebagai batang; sisanya chip per hari. */
  const eventSpans = useMemo<Span[]>(
    () =>
      events.flatMap((e) => {
        const d = eventDays(e);
        return d.start === d.end ? [] : [{ id: e.id, start: d.start, end: d.end }];
      }),
    [events],
  );
  const multiDayIds = useMemo(() => new Set(eventSpans.map((s) => s.id)), [eventSpans]);

  function onDragStart(e: DragStartEvent) {
    const data = e.active.data.current as DragData | undefined;
    setDragging(data ? (eventById.get(data.eventId) ?? null) : null);
  }

  function onDragEnd(e: DragEndEvent) {
    setDragging(null);
    const data = e.active.data.current as DragData | undefined;
    const target = e.over?.id;
    if (!data || typeof target !== "string") return;
    const ev = eventById.get(data.eventId);
    const delta = diffDays(data.originDay, target);
    if (ev && delta !== 0) onMoveEvent(ev, delta);
  }

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(null)}
    >
      <div className="bg-card overflow-hidden rounded-xl border">
        <div className="text-muted-foreground grid grid-cols-7 border-b text-xs">
          {WEEK_DAYS.map((d, i) => (
            <div key={d} className={cn("px-2 py-1.5", i >= 5 && "text-foreground/60")}>
              {d}
            </div>
          ))}
        </div>

        {weeks.map((week) => {
          const cl = layoutWeek(week, campaignSpans, MAX_CAMPAIGN_LANES);
          const el = layoutWeek(week, eventSpans, MAX_EVENT_LANES);
          const cLanes = Math.min(cl.laneCount, MAX_CAMPAIGN_LANES);
          const eLanes = Math.min(el.laneCount, MAX_EVENT_LANES);
          const lanes = cLanes + eLanes;
          const rows = [
            "1.75rem",
            ...(lanes > 0 ? [`repeat(${lanes}, 1.5rem)`] : []),
            "minmax(3.25rem, auto)",
          ].join(" ");

          return (
            <div
              key={week[0]}
              className="relative grid grid-cols-7 border-b last:border-b-0"
              style={{ gridTemplateRows: rows }}
            >
              {week.map((day, col) => {
                const items = dayIndex.get(day) ?? EMPTY_DAY_ITEMS;
                const dm = dayMomentsOf(momentIndex, day);
                return (
                  <DayCell
                    key={day}
                    day={day}
                    col={col}
                    inMonth={monthKeyOf(day) === month}
                    isToday={day === today}
                    isSelected={day === selectedDay}
                    payday={dm.payday}
                    label={dayLabel(day, dm, items.events.length, items.campaigns.length)}
                    onSelect={onSelectDay}
                  />
                );
              })}

              {week.map((day, col) => (
                <DayHeader
                  key={day}
                  day={day}
                  col={col}
                  inMonth={monthKeyOf(day) === month}
                  isToday={day === today}
                  moments={dayMomentsOf(momentIndex, day)}
                />
              ))}

              {cl.segments.map((seg) => {
                const c = campaignById.get(seg.id);
                return c ? (
                  <CampaignBand key={seg.id} campaign={c} seg={seg} onOpen={onOpenCampaign} />
                ) : null;
              })}

              {el.segments.map((seg) => {
                const ev = eventById.get(seg.id);
                return ev ? (
                  <EventBar
                    key={seg.id}
                    event={ev}
                    seg={seg}
                    row={cLanes + seg.lane + 2}
                    originDay={week[seg.colStart]!}
                    color={ev.campaignId ? campaignById.get(ev.campaignId)?.color : null}
                    onOpen={onOpenEvent}
                  />
                ) : null;
              })}

              {week.map((day, col) => {
                const items = dayIndex.get(day) ?? EMPTY_DAY_ITEMS;
                const singles = items.events.filter((e) => !multiDayIds.has(e.id));
                const hiddenSpans = cl.hiddenByCol[col]! + el.hiddenByCol[col]!;
                return (
                  <DayStack
                    key={day}
                    day={day}
                    col={col}
                    row={lanes + 2}
                    singles={singles}
                    hiddenSpans={hiddenSpans}
                    contentCount={items.content.length}
                    kolCount={items.kol.length}
                    campaignById={campaignById}
                    onOpenEvent={onOpenEvent}
                  />
                );
              })}
            </div>
          );
        })}
      </div>

      <DragOverlay dropAnimation={null}>
        {dragging ? (
          <div
            style={campaignStyle(
              dragging.campaignId ? campaignById.get(dragging.campaignId)?.color : null,
            )}
            className="bg-card flex w-40 items-center gap-1 rounded-sm border-l-2 border-[var(--cmp)] px-1.5 py-1 text-xs font-medium shadow-lg ring-1 ring-black/10"
          >
            <KindIcon kind={dragging.kind} className="text-muted-foreground size-3 shrink-0" />
            <span className="truncate">{dragging.title}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function dayLabel(day: DayKey, dm: DayMoments, eventCount: number, campaignCount: number) {
  const parts = [formatDayLong(day)];
  if (dm.holiday) parts.push(`libur ${dm.holiday.label}`);
  if (campaignCount > 0) parts.push(`${campaignCount} campaign`);
  parts.push(eventCount > 0 ? `${eventCount} aktivitas` : "belum ada aktivitas");
  return parts.join(", ");
}

/** Latar satu hari: sasaran klik (buka rincian hari) dan sasaran lepas saat menggeser. */
function DayCell({
  day,
  col,
  inMonth,
  isToday,
  isSelected,
  payday,
  label,
  onSelect,
}: {
  day: DayKey;
  col: number;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  payday: boolean;
  label: string;
  onSelect: (day: DayKey, anchor: HTMLElement) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: day });
  return (
    <button
      ref={setNodeRef}
      type="button"
      aria-label={label}
      aria-current={isToday ? "date" : undefined}
      aria-expanded={isSelected}
      onClick={(e) => onSelect(day, e.currentTarget)}
      style={{ gridColumn: col + 1, gridRow: "1 / -1" }}
      className={cn(
        "hover:bg-muted/40 focus-visible:ring-ring relative border-r outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset",
        col === 6 && "border-r-0",
        !inMonth && "bg-muted/30",
        isSelected && "bg-primary/5 ring-primary/40 ring-1 ring-inset",
        isOver && "bg-primary/10 ring-primary ring-2 ring-inset",
      )}
    >
      {payday ? (
        <span
          aria-hidden
          className="border-foreground/25 absolute inset-x-0 bottom-0 border-b-2 border-dotted"
        />
      ) : null}
    </button>
  );
}

/** Angka tanggal + penanda momen. Libur nasional = tanggal merah. */
function DayHeader({
  day,
  col,
  inMonth,
  isToday,
  moments,
}: {
  day: DayKey;
  col: number;
  inMonth: boolean;
  isToday: boolean;
  moments: DayMoments;
}) {
  const { holiday, points, season, seasonStarts, payday } = moments;
  const twin = points.find((m) => m.kind === "twin");
  const other = points.find((m) => m.kind === "cultural" || m.kind === "commerce");
  const paydayStarts = payday && day.endsWith("-25");

  return (
    <div
      style={{ gridColumn: col + 1, gridRow: 1 }}
      className="pointer-events-none relative z-[1] flex min-w-0 items-center gap-1 px-1 pt-1 sm:px-1.5"
    >
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full text-xs tabular-nums",
          isToday
            ? "bg-primary text-primary-foreground font-semibold"
            : holiday
              ? "font-semibold text-red-600 dark:text-red-400"
              : !inMonth && "text-muted-foreground/60",
        )}
      >
        {Number(day.slice(8))}
      </span>
      {season ? (
        <Moon className="text-muted-foreground/70 size-2.5 shrink-0" aria-hidden />
      ) : null}
      <span className="ml-auto flex min-w-0 items-center gap-1 text-[10px] leading-none">
        {holiday ? (
          <span
            className="hidden truncate text-red-700 sm:block dark:text-red-400"
            title={holiday.estimated ? `${holiday.label} (perkiraan)` : holiday.label}
          >
            {holiday.label}
            {holiday.estimated ? "*" : ""}
          </span>
        ) : other ? (
          <span className="text-muted-foreground hidden truncate md:block" title={other.label}>
            {other.label}
          </span>
        ) : seasonStarts && season ? (
          <span className="text-muted-foreground hidden truncate md:block">
            {season.label}
            {season.estimated ? "*" : ""}
          </span>
        ) : paydayStarts ? (
          <span className="text-muted-foreground hidden truncate md:block">Gajian</span>
        ) : null}
        {twin ? (
          <span
            title={twin.label}
            className={cn(
              "shrink-0 rounded-sm px-1 py-0.5 font-semibold tabular-nums",
              twin.major
                ? "bg-foreground text-background"
                : "text-muted-foreground ring-border ring-1",
            )}
          >
            {twin.label.split(" ")[0]}
          </span>
        ) : null}
      </span>
    </div>
  );
}

/** Pita campaign: satu potong per minggu, menyambung di tepi yang berlanjut. */
function CampaignBand({
  campaign,
  seg,
  onOpen,
}: {
  campaign: CalCampaign;
  seg: WeekSegment;
  onOpen: (campaign: CalCampaign) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(campaign)}
      title={`${campaign.name}, ${formatDayRange(campaign.startDate, campaign.endDate)} (${CAMPAIGN_STATUS_LABEL[campaign.status]})`}
      style={{
        gridColumn: `${seg.colStart + 1} / ${seg.colEnd + 2}`,
        gridRow: seg.lane + 2,
        ...campaignStyle(campaign.color),
      }}
      className={cn(
        "focus-visible:ring-ring relative z-[1] mx-0.5 flex h-5 min-w-0 items-center self-center px-1.5 text-left text-[11px] leading-none font-semibold outline-none transition-[filter] hover:brightness-95 focus-visible:ring-2 dark:hover:brightness-125",
        CAMPAIGN_BAND_CLASS[campaign.status],
        seg.continuesBefore ? "ml-0 border-l-0" : "rounded-l-md",
        seg.continuesAfter ? "mr-0 border-r-0" : "rounded-r-md",
      )}
    >
      <span className="truncate">{campaign.name}</span>
    </button>
  );
}

/** Aktivitas multi-hari: batang tipis berikon, bisa digeser ke tanggal lain. */
function EventBar({
  event,
  seg,
  row,
  originDay,
  color,
  onOpen,
}: {
  event: CalEvent;
  seg: WeekSegment;
  row: number;
  originDay: DayKey;
  color: string | null | undefined;
  onOpen: (event: CalEvent) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `bar:${event.id}:${originDay}`,
    data: { eventId: event.id, originDay } satisfies DragData,
  });
  const done = Boolean(event.doneAt);
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...listeners}
      {...attributes}
      onClick={() => onOpen(event)}
      title={event.title}
      style={{
        gridColumn: `${seg.colStart + 1} / ${seg.colEnd + 2}`,
        gridRow: row,
        ...campaignStyle(color),
      }}
      className={cn(
        "focus-visible:ring-ring relative z-[1] mx-0.5 flex h-5 min-w-0 cursor-grab items-center gap-1 self-center bg-[color-mix(in_oklab,var(--cmp)_14%,transparent)] px-1 text-left text-[11px] leading-none outline-none hover:bg-[color-mix(in_oklab,var(--cmp)_24%,transparent)] focus-visible:ring-2",
        seg.continuesBefore ? "ml-0" : "rounded-l-sm border-l-2 border-[var(--cmp)]",
        seg.continuesAfter ? "mr-0" : "rounded-r-sm",
        isDragging && "opacity-40",
      )}
    >
      {done ? (
        <Check className="text-muted-foreground size-3 shrink-0" aria-hidden />
      ) : (
        <KindIcon kind={event.kind} className="text-muted-foreground size-3 shrink-0" />
      )}
      <span className={cn("truncate font-medium", done && "text-muted-foreground line-through")}>
        {event.title}
      </span>
    </button>
  );
}

/** Isi satu hari: chip aktivitas, penanda lapisan, dan hitungan yang tersembunyi. */
function DayStack({
  day,
  col,
  row,
  singles,
  hiddenSpans,
  contentCount,
  kolCount,
  campaignById,
  onOpenEvent,
}: {
  day: DayKey;
  col: number;
  row: number;
  singles: CalEvent[];
  hiddenSpans: number;
  contentCount: number;
  kolCount: number;
  campaignById: Map<string, CalCampaign>;
  onOpenEvent: (event: CalEvent) => void;
}) {
  const visible = singles.slice(0, MAX_CHIPS);
  const more = singles.length - visible.length + hiddenSpans;
  const colorOf = (ev: CalEvent) =>
    ev.campaignId ? campaignById.get(ev.campaignId)?.color : null;

  return (
    <div
      style={{ gridColumn: col + 1, gridRow: row }}
      className="pointer-events-none relative z-[1] flex min-w-0 flex-col gap-0.5 px-0.5 pt-0.5 pb-1.5 sm:px-1"
    >
      {visible.map((ev) => (
        <EventChip key={ev.id} event={ev} day={day} color={colorOf(ev)} onOpen={onOpenEvent} />
      ))}

      {/* Layar sempit: chip tidak terbaca di kolom 48px, jadi cukup titik warna campaign. */}
      {singles.length > 0 ? (
        <div className="flex flex-wrap items-center gap-0.5 px-0.5 sm:hidden">
          {singles.slice(0, MAX_DOTS).map((ev) => (
            <span
              key={ev.id}
              style={campaignStyle(colorOf(ev))}
              className={cn(
                "size-1.5 rounded-full bg-[var(--cmp)]",
                ev.doneAt && "opacity-40",
              )}
            />
          ))}
        </div>
      ) : null}

      {contentCount > 0 || kolCount > 0 ? (
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 px-0.5 text-[10px] tabular-nums">
          {contentCount > 0 ? (
            <span
              className="inline-flex items-center gap-0.5"
              title={`${contentCount} jadwal posting Content Plan`}
            >
              <Send className="size-2.5" aria-hidden />
              {contentCount}
            </span>
          ) : null}
          {kolCount > 0 ? (
            <span className="inline-flex items-center gap-0.5" title={`${kolCount} jadwal KOL`}>
              <AtSign className="size-2.5" aria-hidden />
              {kolCount}
            </span>
          ) : null}
        </div>
      ) : null}

      {more > 0 ? (
        <span className="text-muted-foreground px-0.5 text-[10px] font-medium">
          +{more}
          <span className="hidden sm:inline"> lainnya</span>
        </span>
      ) : null}
    </div>
  );
}

function EventChip({
  event,
  day,
  color,
  onOpen,
}: {
  event: CalEvent;
  day: DayKey;
  color: string | null | undefined;
  onOpen: (event: CalEvent) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `chip:${event.id}:${day}`,
    data: { eventId: event.id, originDay: day } satisfies DragData,
  });
  const done = Boolean(event.doneAt);
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...listeners}
      {...attributes}
      onClick={() => onOpen(event)}
      title={event.title}
      style={campaignStyle(color)}
      className={cn(
        "focus-visible:ring-ring pointer-events-auto hidden w-full min-w-0 cursor-grab items-center gap-1 rounded-sm border-l-2 border-[var(--cmp)] bg-[color-mix(in_oklab,var(--cmp)_9%,transparent)] px-1 py-0.5 text-left text-[11px] leading-tight outline-none hover:bg-[color-mix(in_oklab,var(--cmp)_20%,transparent)] focus-visible:ring-2 sm:flex",
        isDragging && "opacity-40",
      )}
    >
      {done ? (
        <Check className="text-muted-foreground size-3 shrink-0" aria-hidden />
      ) : (
        <KindIcon kind={event.kind} className="text-muted-foreground size-3 shrink-0" />
      )}
      {!event.allDay ? (
        <span className="text-muted-foreground shrink-0 tabular-nums">
          {formatWibTime(event.startsAt)}
        </span>
      ) : null}
      <span className={cn("truncate font-medium", done && "text-muted-foreground line-through")}>
        {event.title}
      </span>
    </button>
  );
}
