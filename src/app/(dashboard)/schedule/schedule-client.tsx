"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import type { UserRole } from "@prisma/client";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { AgendaView } from "@/components/schedule/agenda-view";
import { BulkDeleteDialog } from "@/components/schedule/bulk-delete-dialog";
import { DayDetailSheet } from "@/components/schedule/day-detail-sheet";
import { EventFormDialog } from "@/components/schedule/event-form-dialog";
import { MonthGrid } from "@/components/schedule/month-grid";
import {
  ScheduleToolbar,
  type ScheduleView,
} from "@/components/schedule/schedule-toolbar";
import {
  canManageEvent,
  dayKeyOf,
  groupEventsByDay,
  isMineEvent,
  type ScheduleEventRow,
  type UserPick,
} from "@/components/schedule/schedule-types";

export type { ScheduleEventRow } from "@/components/schedule/schedule-types";

const VIEW_STORAGE_KEY = "schedule:view";
const WEEK_STARTS_ON = 1 as const; // Senin

// Default tampilan dibaca sekali di klien (localStorage → matchMedia).
// useSyncExternalStore menjaga SSR aman tanpa setState di dalam effect.
let cachedDefaultView: ScheduleView | null = null;
const emptySubscribe = () => () => {};
const getServerView = (): ScheduleView => "month";

function getDefaultView(): ScheduleView {
  if (cachedDefaultView === null) {
    try {
      const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
      if (stored === "month" || stored === "agenda") {
        cachedDefaultView = stored;
        return cachedDefaultView;
      }
    } catch {
      // localStorage bisa diblokir — lanjut ke matchMedia.
    }
    cachedDefaultView = window.matchMedia("(max-width: 639px)").matches
      ? "agenda"
      : "month";
  }
  return cachedDefaultView;
}

function chunkWeeks(days: Date[]): Date[][] {
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
}

/** Orkestrator tipis: state tampilan + membuka sheet/dialog. Logika form ada di komponen schedule/*. */
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
  const defaultView = useSyncExternalStore(
    emptySubscribe,
    getDefaultView,
    getServerView,
  );
  const [viewOverride, setViewOverride] = useState<ScheduleView | null>(null);
  const view = viewOverride ?? defaultView;

  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));
  const [filterMine, setFilterMine] = useState(false);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formSession, setFormSession] = useState(0);
  const [editing, setEditing] = useState<ScheduleEventRow | null>(null);
  const [prefillDay, setPrefillDay] = useState<Date | null>(null);

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSession, setBulkSession] = useState(0);

  function changeView(next: ScheduleView) {
    setViewOverride(next);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // localStorage bisa diblokir — abaikan.
    }
  }

  const filteredEvents = useMemo(
    () =>
      filterMine
        ? initialEvents.filter((ev) => isMineEvent(ev, currentUserId))
        : initialEvents,
    [filterMine, initialEvents, currentUserId],
  );

  const eventsByDayKey = useMemo(
    () => groupEventsByDay(filteredEvents),
    [filteredEvents],
  );

  const weeks = useMemo(() => {
    const days = eachDayOfInterval({
      start: startOfWeek(startOfMonth(viewMonth), {
        weekStartsOn: WEEK_STARTS_ON,
      }),
      end: endOfWeek(endOfMonth(viewMonth), { weekStartsOn: WEEK_STARTS_ON }),
    });
    return chunkWeeks(days);
  }, [viewMonth]);

  const manageableEvents = useMemo(
    () =>
      initialEvents
        .filter((ev) =>
          canManageEvent(currentRole, currentUserId, ev.createdById),
        )
        .sort(
          (a, b) =>
            new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
        ),
    [currentRole, currentUserId, initialEvents],
  );

  const dayEvents = selectedDay
    ? (eventsByDayKey.get(dayKeyOf(selectedDay)) ?? [])
    : [];

  function openCreate(day?: Date) {
    setEditing(null);
    setPrefillDay(day ?? null);
    setFormSession((s) => s + 1);
    setFormOpen(true);
  }

  function openEvent(ev: ScheduleEventRow) {
    setEditing(ev);
    setPrefillDay(null);
    setFormSession((s) => s + 1);
    setFormOpen(true);
  }

  function openDay(day: Date) {
    setSelectedDay(day);
    setSheetOpen(true);
  }

  function openBulk() {
    setBulkSession((s) => s + 1);
    setBulkOpen(true);
  }

  const monthLabel =
    view === "agenda"
      ? "Mendatang"
      : format(viewMonth, "MMMM yyyy", { locale: idLocale });

  return (
    <div className="flex flex-col gap-4">
      <ScheduleToolbar
        view={view}
        onViewChange={changeView}
        monthLabel={monthLabel}
        onPrev={() => setViewMonth((m) => addMonths(m, -1))}
        onNext={() => setViewMonth((m) => addMonths(m, 1))}
        onToday={() => setViewMonth(startOfMonth(new Date()))}
        filterMine={filterMine}
        onToggleMine={() => setFilterMine((v) => !v)}
        onCreate={() => openCreate()}
        onBulkDelete={openBulk}
        bulkDisabled={manageableEvents.length === 0}
      />

      {view === "month" ? (
        <>
          <div className="max-sm:hidden">
            <MonthGrid
              weeks={weeks}
              viewMonth={viewMonth}
              eventsByDayKey={eventsByDayKey}
              currentUserId={currentUserId}
              onDayClick={openDay}
              onEventClick={openEvent}
            />
            <p className="text-muted-foreground mt-3 text-center text-xs">
              Klik tanggal untuk lihat detail hari · klik acara untuk buka
              detail/edit
            </p>
          </div>
          <div className="sm:hidden">
            <AgendaView
              events={filteredEvents}
              currentUserId={currentUserId}
              onEventClick={openEvent}
              onCreate={() => openCreate()}
            />
          </div>
        </>
      ) : (
        <AgendaView
          events={filteredEvents}
          currentUserId={currentUserId}
          onEventClick={openEvent}
          onCreate={() => openCreate()}
        />
      )}

      <DayDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        day={selectedDay}
        events={dayEvents}
        currentUserId={currentUserId}
        onEventClick={openEvent}
        onCreateAt={(day) => openCreate(day)}
      />
      <EventFormDialog
        key={`form-${formSession}`}
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={editing ? "edit" : "create"}
        editing={editing}
        prefillDay={prefillDay}
        users={users}
        currentUserId={currentUserId}
        currentRole={currentRole}
      />
      <BulkDeleteDialog
        key={`bulk-${bulkSession}`}
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        events={manageableEvents}
      />
    </div>
  );
}
