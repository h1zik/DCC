"use client";

import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { MapPin, Plus, Repeat } from "lucide-react";
import { InitialsAvatar } from "@/components/initials-avatar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  displayName,
  eventToneFor,
  isMineEvent,
  type ScheduleEventRow,
} from "./schedule-types";

const MAX_AVATARS = 6;

/** Panel detail satu hari: semua acara terurut jam + aksi buat acara. */
export function DayDetailSheet({
  open,
  onOpenChange,
  day,
  events,
  currentUserId,
  onEventClick,
  onCreateAt,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  day: Date | null;
  events: ScheduleEventRow[];
  currentUserId: string;
  onEventClick: (ev: ScheduleEventRow) => void;
  onCreateAt: (day: Date) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="data-[side=right]:w-full data-[side=right]:sm:max-w-md"
      >
        <SheetHeader>
          <SheetTitle className="capitalize">
            {day
              ? format(day, "EEEE, dd MMMM yyyy", { locale: idLocale })
              : "Detail hari"}
          </SheetTitle>
          <SheetDescription>
            {events.length > 0
              ? `${events.length} acara pada hari ini`
              : "Belum ada acara pada tanggal ini."}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-2 overflow-y-auto px-4">
          {events.map((ev) => {
            const tone = eventToneFor(ev.createdById);
            const mine = isMineEvent(ev, currentUserId);
            return (
              <button
                key={ev.id}
                type="button"
                onClick={() => onEventClick(ev)}
                className={cn(
                  "relative w-full overflow-hidden rounded-lg border border-border bg-card p-3 pl-4 text-left shadow-sm transition-colors hover:bg-muted/40",
                  mine && "ring-1 ring-accent/40",
                )}
              >
                <span
                  aria-hidden
                  className={cn("absolute inset-y-0 left-0 w-1", tone.bar)}
                />
                <span className="flex items-center gap-1.5">
                  <span className="text-muted-foreground shrink-0 font-mono text-sm tabular-nums">
                    {format(new Date(ev.startsAt), "HH:mm")}
                  </span>
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
                {ev.location ? (
                  <span className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
                    <MapPin className="size-3 shrink-0" aria-hidden />
                    <span className="truncate">{ev.location}</span>
                  </span>
                ) : null}
                <span className="mt-1.5 flex items-center gap-1">
                  {ev.participants.slice(0, MAX_AVATARS).map((p) => (
                    <InitialsAvatar
                      key={p.user.id}
                      name={displayName(p.user)}
                      seed={p.user.id}
                      size="sm"
                    />
                  ))}
                  {ev.participants.length > MAX_AVATARS ? (
                    <span className="text-muted-foreground text-xs">
                      +{ev.participants.length - MAX_AVATARS}
                    </span>
                  ) : null}
                </span>
                <span className="text-muted-foreground mt-1.5 block text-xs">
                  Dibuat oleh {displayName(ev.createdBy)}
                </span>
              </button>
            );
          })}
        </div>
        <SheetFooter>
          <Button
            type="button"
            className="w-full"
            disabled={!day}
            onClick={() => {
              if (day) onCreateAt(day);
            }}
          >
            <Plus className="size-4" aria-hidden />
            Buat acara pada tanggal ini
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
