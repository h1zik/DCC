"use client";

import { format } from "date-fns";
import { Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  eventToneFor,
  isMineEvent,
  type ScheduleEventRow,
} from "./schedule-types";

/**
 * Pill kecil untuk satu acara: jam + judul, bar kiri warna pembuat,
 * ikon Repeat untuk acara berulang, ring aksen bila milik pengguna.
 */
export function EventChip({
  event,
  currentUserId,
  onClick,
  className,
}: {
  event: ScheduleEventRow;
  currentUserId: string;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
}) {
  const tone = eventToneFor(event.createdById);
  const mine = isMineEvent(event, currentUserId);
  return (
    <button
      type="button"
      title={event.title}
      onClick={onClick}
      className={cn(
        "flex w-full min-w-0 items-center gap-1 rounded border-l-2 px-1 py-0.5 text-left text-[11px] leading-tight text-foreground transition-colors hover:bg-muted/60",
        tone.border,
        tone.chipBg,
        mine && "ring-1 ring-accent/40",
        className,
      )}
    >
      <span className="text-muted-foreground shrink-0 font-mono tabular-nums">
        {format(new Date(event.startsAt), "HH:mm")}
      </span>
      <span className="truncate font-medium">{event.title}</span>
      {event.seriesId ? (
        <Repeat
          className="text-muted-foreground ml-auto size-3 shrink-0"
          aria-label="Acara berulang"
        />
      ) : null}
    </button>
  );
}
