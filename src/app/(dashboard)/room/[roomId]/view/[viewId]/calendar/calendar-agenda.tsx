"use client";

import { useMemo } from "react";
import { CalendarDays, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  countdownLabel,
  eachDayKey,
  firstDayOfMonth,
  formatMonthLong,
  keyToUtcDate,
  lastDayOfMonth,
  monthKeyOf,
  shiftMonth,
  type DayKey,
} from "@/lib/room-calendar/dates";
import { buildDayIndex } from "@/lib/room-calendar/day-index";
import { indexMomentsByDay, type Moment } from "@/lib/room-calendar/moments";
import {
  eventDays,
  type CalCampaign,
  type CalContentPost,
  type CalEvent,
  type CalKolPost,
} from "@/lib/room-calendar/types";
import { cn } from "@/lib/utils";
import {
  CampaignSwatch,
  ContentPostRow,
  EventRow,
  KolPostRow,
  MomentRow,
} from "./calendar-parts";

const weekdayFmt = new Intl.DateTimeFormat("id-ID", { weekday: "short", timeZone: "UTC" });

type AgendaDay = {
  day: DayKey;
  /** Hari pertama yang tampil di bulannya → diberi judul bulan. */
  showMonth: boolean;
  moments: Moment[];
  holiday: boolean;
  /** Campaign yang mulai / selesai hari ini. */
  starts: CalCampaign[];
  ends: CalCampaign[];
  events: CalEvent[];
  content: CalContentPost[];
  kol: CalKolPost[];
};

/**
 * Daftar per hari untuk dua bulan sejak bulan terpilih. Bulan berjalan mulai
 * dari hari ini, karena yang dicari di agenda adalah "apa berikutnya".
 */
export function CalendarAgenda({
  month,
  today,
  campaigns,
  events,
  contentPosts,
  kolPosts,
  moments,
  campaignById,
  hasAnything,
  onOpenEvent,
  onToggleDone,
  onOpenCampaign,
  onAddEvent,
  onAddCampaign,
}: {
  month: string;
  today: DayKey;
  campaigns: CalCampaign[];
  events: CalEvent[];
  contentPosts: CalContentPost[];
  kolPosts: CalKolPost[];
  moments: Moment[];
  campaignById: Map<string, CalCampaign>;
  /** false = kalender ini benar-benar kosong (belum ada campaign maupun aktivitas). */
  hasAnything: boolean;
  onOpenEvent: (event: CalEvent) => void;
  onToggleDone: (event: CalEvent, done: boolean) => void;
  onOpenCampaign: (campaign: CalCampaign) => void;
  onAddEvent: (day: DayKey) => void;
  onAddCampaign: (day: DayKey) => void;
}) {
  const from = monthKeyOf(today) === month ? today : firstDayOfMonth(month);
  const to = lastDayOfMonth(shiftMonth(month, 1));

  const agenda = useMemo<AgendaDay[]>(() => {
    const days = eachDayKey(from, to);
    const index = buildDayIndex({ campaigns, events, contentPosts, kolPosts }, days);
    const momentIndex = indexMomentsByDay(moments, days);
    const out: AgendaDay[] = [];
    let lastMonth = "";

    for (const day of days) {
      const items = index.get(day)!;
      const dm = momentIndex.get(day);
      // Aktivitas multi-hari cukup tampil sekali: di hari mulainya, atau di hari
      // pertama agenda bila sudah berjalan sebelum itu.
      const dayEvents = items.events.filter((ev) => {
        const start = eventDays(ev).start;
        return start === day || (day === from && start < from);
      });
      const dayMoments = [
        ...(dm?.points ?? []),
        ...(dm?.season && dm.seasonStarts ? [dm.season] : []),
        ...moments.filter((m) => m.kind === "payday" && m.date === day),
      ];
      const starts = items.campaigns.filter((c) => c.startDate === day);
      const ends = items.campaigns.filter((c) => c.endDate === day && c.startDate !== day);

      if (
        dayEvents.length === 0 &&
        dayMoments.length === 0 &&
        starts.length === 0 &&
        ends.length === 0 &&
        items.content.length === 0 &&
        items.kol.length === 0 &&
        day !== today
      ) {
        continue;
      }
      const showMonth = monthKeyOf(day) !== lastMonth;
      lastMonth = monthKeyOf(day);
      out.push({
        day,
        showMonth,
        moments: dayMoments,
        holiday: Boolean(dm?.holiday),
        starts,
        ends,
        events: dayEvents,
        content: items.content,
        kol: items.kol,
      });
    }
    return out;
  }, [from, to, today, campaigns, events, contentPosts, kolPosts, moments]);

  if (!hasAnything) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="Kalender ini masih kosong"
        description="Mulai dari campaign untuk menandai rentang tanggalnya, lalu isi dengan aktivitas seperti shoot, posting, dan live."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button type="button" size="sm" onClick={() => onAddCampaign(today)}>
              Buat campaign
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => onAddEvent(today)}>
              Tambah aktivitas
            </Button>
          </div>
        }
      />
    );
  }

  return (
    <div className="bg-card overflow-hidden rounded-xl border">
      <ol>
        {agenda.map((d) => {
          const monthKey = monthKeyOf(d.day);
          const isToday = d.day === today;
          const quiet =
            d.events.length === 0 &&
            d.starts.length === 0 &&
            d.ends.length === 0 &&
            d.content.length === 0 &&
            d.kol.length === 0 &&
            d.moments.length === 0;

          return (
            <li key={d.day}>
              {d.showMonth ? (
                <h3 className="bg-muted/40 text-muted-foreground border-b px-3 py-1.5 text-xs font-medium">
                  {formatMonthLong(monthKey)}
                </h3>
              ) : null}
              <div className="flex gap-3 border-b px-3 py-2.5">
                <div className="w-11 shrink-0 text-center">
                  <p className="text-muted-foreground text-[11px] leading-none">
                    {weekdayFmt.format(keyToUtcDate(d.day))}
                  </p>
                  <p
                    className={cn(
                      "mx-auto mt-1 flex size-8 items-center justify-center rounded-full text-base font-semibold tabular-nums",
                      isToday
                        ? "bg-primary text-primary-foreground"
                        : d.holiday && "text-red-600 dark:text-red-400",
                    )}
                  >
                    {Number(d.day.slice(8))}
                  </p>
                  {d.day > today ? (
                    <p className="text-muted-foreground mt-0.5 text-[10px] tabular-nums">
                      {countdownLabel(today, d.day)}
                    </p>
                  ) : null}
                </div>

                <div className="min-w-0 flex-1 space-y-0.5">
                  {d.moments.map((m) => (
                    <MomentRow key={m.id} moment={m} />
                  ))}
                  {d.starts.map((c) => (
                    <CampaignEdge key={`s-${c.id}`} campaign={c} label="Mulai" onOpen={onOpenCampaign} />
                  ))}
                  {d.ends.map((c) => (
                    <CampaignEdge key={`e-${c.id}`} campaign={c} label="Hari terakhir" onOpen={onOpenCampaign} />
                  ))}
                  {d.events.map((ev) => (
                    <EventRow
                      key={ev.id}
                      event={ev}
                      campaign={ev.campaignId ? (campaignById.get(ev.campaignId) ?? null) : null}
                      onOpen={onOpenEvent}
                      onToggleDone={onToggleDone}
                    />
                  ))}
                  {d.content.map((p) => (
                    <ContentPostRow key={p.id} post={p} />
                  ))}
                  {d.kol.map((p) => (
                    <KolPostRow key={p.id} post={p} />
                  ))}
                  {quiet ? (
                    <p className="text-muted-foreground px-1.5 py-1 text-sm">
                      Belum ada jadwal hari ini.
                    </p>
                  ) : null}
                </div>

                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Tambah aktivitas pada tanggal ${Number(d.day.slice(8))}`}
                  onClick={() => onAddEvent(d.day)}
                  className="text-muted-foreground shrink-0"
                >
                  <Plus aria-hidden />
                </Button>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="text-muted-foreground px-3 py-2.5 text-xs">
        Menampilkan sampai akhir {formatMonthLong(monthKeyOf(to))}. Pindah bulan untuk melihat
        jadwal berikutnya.
      </p>
    </div>
  );
}

function CampaignEdge({
  campaign,
  label,
  onOpen,
}: {
  campaign: CalCampaign;
  label: string;
  onOpen: (campaign: CalCampaign) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(campaign)}
      className="hover:bg-muted/60 focus-visible:ring-ring flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left outline-none focus-visible:ring-2"
    >
      <CampaignSwatch color={campaign.color} status={campaign.status} />
      <span className="min-w-0 truncate text-sm font-semibold">{campaign.name}</span>
      <span className="text-muted-foreground shrink-0 text-xs">{label}</span>
    </button>
  );
}
