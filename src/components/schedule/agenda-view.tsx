"use client";

import { useMemo, useState } from "react";
import { addDays, addWeeks, format, isSameDay, startOfDay } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { CalendarDays, MapPin, Plus, Repeat, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import {
  dayKeyOf,
  displayName,
  eventToneFor,
  isMineEvent,
  type ScheduleEventRow,
} from "./schedule-types";

const INITIAL_WEEKS = 8;

type DayGroup = { day: Date; events: ScheduleEventRow[] };

/** Daftar acara dari hari ini ke depan, dikelompokkan per hari. */
export function AgendaView({
  events,
  currentUserId,
  onEventClick,
  onCreate,
}: {
  events: ScheduleEventRow[];
  currentUserId: string;
  onEventClick: (ev: ScheduleEventRow) => void;
  onCreate: () => void;
}) {
  const [limitWeeks, setLimitWeeks] = useState(INITIAL_WEEKS);

  const groups = useMemo<DayGroup[]>(() => {
    const todayStart = startOfDay(new Date()).getTime();
    const upcoming = events
      .filter((ev) => new Date(ev.startsAt).getTime() >= todayStart)
      .sort(
        (a, b) =>
          new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
      );
    const map = new Map<string, DayGroup>();
    for (const ev of upcoming) {
      const d = new Date(ev.startsAt);
      const key = dayKeyOf(d);
      const group = map.get(key);
      if (group) group.events.push(ev);
      else map.set(key, { day: startOfDay(d), events: [ev] });
    }
    return [...map.values()];
  }, [events]);

  const today = startOfDay(new Date());
  const cutoff = addWeeks(today, limitWeeks).getTime();
  const visible = groups.filter((g) => g.day.getTime() < cutoff);
  const hasMore = groups.length > visible.length;

  if (groups.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="Belum ada acara mendatang"
        description="Buat acara pertama dan pilih peserta yang mendapat pengingat."
        action={
          <Button type="button" onClick={onCreate}>
            <Plus className="size-4" aria-hidden />
            Buat acara
          </Button>
        }
      />
    );
  }

  return (
    <div className="animate-in fade-in flex flex-col gap-5 duration-200 motion-reduce:animate-none">
      {visible.map((group) => (
        <section key={dayKeyOf(group.day)} className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold capitalize">
              {format(group.day, "EEEE, dd MMMM", { locale: idLocale })}
            </h3>
            {isSameDay(group.day, today) ? (
              <Badge>Hari ini</Badge>
            ) : isSameDay(group.day, addDays(today, 1)) ? (
              <Badge variant="secondary">Besok</Badge>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            {group.events.map((ev) => {
              const tone = eventToneFor(ev.createdById);
              const mine = isMineEvent(ev, currentUserId);
              return (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => onEventClick(ev)}
                  className={cn(
                    "relative flex w-full items-start gap-3 overflow-hidden rounded-lg border border-border bg-card p-3 pl-4 text-left shadow-sm transition-colors hover:bg-muted/40",
                    mine && "ring-1 ring-accent/40",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn("absolute inset-y-0 left-0 w-1", tone.bar)}
                  />
                  <span className="text-muted-foreground shrink-0 pt-0.5 font-mono text-sm tabular-nums">
                    {format(new Date(ev.startsAt), "HH:mm")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium">
                        {ev.title}
                      </span>
                      {ev.seriesId ? (
                        <Repeat
                          className="text-muted-foreground size-3 shrink-0"
                          aria-label="Acara berulang"
                        />
                      ) : null}
                    </span>
                    <span className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                      {ev.location ? (
                        <span className="inline-flex min-w-0 items-center gap-1">
                          <MapPin className="size-3 shrink-0" aria-hidden />
                          <span className="max-w-[16rem] truncate">
                            {ev.location}
                          </span>
                        </span>
                      ) : null}
                      <span className="inline-flex items-center gap-1">
                        <Users className="size-3" aria-hidden />
                        {ev.participants.length} peserta
                      </span>
                      <span>{displayName(ev.createdBy)}</span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
      {hasMore ? (
        <Button
          type="button"
          variant="outline"
          className="self-center"
          onClick={() => setLimitWeeks((w) => w + INITIAL_WEEKS)}
        >
          Tampilkan lebih banyak
        </Button>
      ) : null}
    </div>
  );
}
