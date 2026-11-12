"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDayLong, formatDayRange, type DayKey } from "@/lib/room-calendar/dates";
import type { DayItems } from "@/lib/room-calendar/day-index";
import type { Moment } from "@/lib/room-calendar/moments";
import type { CalCampaign, CalEvent } from "@/lib/room-calendar/types";
import {
  CampaignSwatch,
  ContentPostRow,
  EventRow,
  KolPostRow,
  MomentRow,
} from "./calendar-parts";

/**
 * Rincian satu hari, menempel pada sel tanggal yang diklik. Menggantikan
 * "+N lainnya" yang dulu tidak bisa dibuka, sekaligus jalan masuk untuk
 * menambah aktivitas atau campaign mulai tanggal itu.
 */
export function DayPopover({
  day,
  anchor,
  items,
  moments,
  campaignById,
  onClose,
  onOpenEvent,
  onToggleDone,
  onOpenCampaign,
  onAddEvent,
  onAddCampaign,
}: {
  day: DayKey | null;
  anchor: HTMLElement | null;
  items: DayItems;
  moments: Moment[];
  campaignById: Map<string, CalCampaign>;
  onClose: () => void;
  onOpenEvent: (event: CalEvent) => void;
  onToggleDone: (event: CalEvent, done: boolean) => void;
  onOpenCampaign: (campaign: CalCampaign) => void;
  onAddEvent: (day: DayKey) => void;
  onAddCampaign: (day: DayKey) => void;
}) {
  const open = Boolean(day && anchor);
  const empty =
    items.campaigns.length === 0 &&
    items.events.length === 0 &&
    items.content.length === 0 &&
    items.kol.length === 0 &&
    moments.length === 0;

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          anchor={anchor}
          side="bottom"
          align="start"
          sideOffset={4}
          collisionPadding={12}
          className="isolate z-50"
        >
          <PopoverPrimitive.Popup className="bg-popover text-popover-foreground ring-foreground/10 flex max-h-[min(28rem,var(--available-height))] w-80 max-w-[calc(100vw-1.5rem)] origin-(--transform-origin) flex-col rounded-lg text-sm shadow-md ring-1 outline-hidden duration-100 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95">
            {day ? (
              <>
                <div className="border-b px-3 py-2.5">
                  <PopoverPrimitive.Title className="font-medium">
                    {formatDayLong(day)}
                  </PopoverPrimitive.Title>
                </div>

                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-1.5 py-2">
                  {empty ? (
                    <p className="text-muted-foreground px-1.5 py-1 text-xs">
                      Belum ada apa-apa di tanggal ini.
                    </p>
                  ) : null}

                  {moments.length > 0 ? (
                    <div>
                      {moments.map((m) => (
                        <MomentRow key={m.id} moment={m} />
                      ))}
                    </div>
                  ) : null}

                  {items.campaigns.length > 0 ? (
                    <Section title="Campaign berjalan">
                      {items.campaigns.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => onOpenCampaign(c)}
                          className="hover:bg-muted/60 focus-visible:ring-ring flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left outline-none focus-visible:ring-2"
                        >
                          <CampaignSwatch color={c.color} status={c.status} />
                          <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
                          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                            {formatDayRange(c.startDate, c.endDate)}
                          </span>
                        </button>
                      ))}
                    </Section>
                  ) : null}

                  {items.events.length > 0 ? (
                    <Section title="Aktivitas">
                      {items.events.map((ev) => (
                        <EventRow
                          key={ev.id}
                          event={ev}
                          campaign={ev.campaignId ? (campaignById.get(ev.campaignId) ?? null) : null}
                          onOpen={onOpenEvent}
                          onToggleDone={onToggleDone}
                        />
                      ))}
                    </Section>
                  ) : null}

                  {items.content.length > 0 ? (
                    <Section title="Posting Content Plan">
                      {items.content.map((p) => (
                        <ContentPostRow key={p.id} post={p} />
                      ))}
                    </Section>
                  ) : null}

                  {items.kol.length > 0 ? (
                    <Section title="Jadwal KOL">
                      {items.kol.map((p) => (
                        <KolPostRow key={p.id} post={p} />
                      ))}
                    </Section>
                  ) : null}
                </div>

                <div className="bg-muted/40 flex flex-wrap gap-2 rounded-b-lg border-t p-2">
                  <Button type="button" size="sm" className="gap-1" onClick={() => onAddEvent(day)}>
                    <Plus className="size-3.5" aria-hidden />
                    Tambah aktivitas
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onAddCampaign(day)}
                  >
                    Campaign mulai hari ini
                  </Button>
                </div>
              </>
            ) : null}
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-muted-foreground px-1.5 pb-0.5 text-xs">{title}</h3>
      {children}
    </section>
  );
}
