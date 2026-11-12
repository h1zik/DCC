"use client";

import { useMemo } from "react";
import { Crosshair, Eye, EyeOff, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CAMPAIGN_STATUS_LABEL, campaignStyle } from "@/lib/room-calendar/campaign-ui";
import {
  countdownLabel,
  formatDayRange,
  formatDayShort,
  type DayKey,
} from "@/lib/room-calendar/dates";
import { upcomingMajorMoments } from "@/lib/room-calendar/moments";
import type {
  CalCampaign,
  CalMember,
  CampaignProgress,
} from "@/lib/room-calendar/types";
import { cn } from "@/lib/utils";
import { CampaignSwatch, MemberAvatars } from "./calendar-parts";

type Upcoming = {
  id: string;
  date: DayKey;
  title: string;
  note: string;
  campaign: CalCampaign | null;
};

/**
 * Panel samping: hitung mundur ke hal berikutnya dan daftar campaign dengan
 * progres. Dari sini campaign bisa disorot (fokus) atau disembunyikan.
 */
export function CalendarRail({
  today,
  campaigns,
  progress,
  memberById,
  hiddenIds,
  focusId,
  showMoments,
  onOpenCampaign,
  onNewCampaign,
  onToggleHidden,
  onFocus,
}: {
  today: DayKey;
  campaigns: CalCampaign[];
  progress: Map<string, CampaignProgress>;
  memberById: Map<string, CalMember>;
  hiddenIds: ReadonlySet<string>;
  focusId: string | null;
  showMoments: boolean;
  onOpenCampaign: (campaign: CalCampaign) => void;
  onNewCampaign: () => void;
  onToggleHidden: (id: string) => void;
  onFocus: (id: string | null) => void;
}) {
  const upcoming = useMemo<Upcoming[]>(() => {
    const list: Upcoming[] = [];
    for (const c of campaigns) {
      if (c.status === "DONE") continue;
      if (c.startDate > today) {
        list.push({ id: `c-${c.id}`, date: c.startDate, title: c.name, note: "Campaign mulai", campaign: c });
      } else if (c.endDate >= today) {
        list.push({ id: `e-${c.id}`, date: c.endDate, title: c.name, note: "Hari terakhir campaign", campaign: c });
      }
    }
    if (showMoments) {
      for (const m of upcomingMajorMoments(today)) {
        list.push({
          id: m.id,
          date: m.date,
          title: m.label,
          note: m.estimated ? "Perkiraan tanggal" : formatDayShort(m.date),
          campaign: null,
        });
      }
    }
    return list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)).slice(0, 5);
  }, [campaigns, today, showMoments]);

  return (
    <aside className="flex min-w-0 flex-col gap-4">
      <section aria-labelledby="rail-next" className="bg-card rounded-xl border p-3">
        <h2 id="rail-next" className="text-sm font-semibold">
          Berikutnya
        </h2>
        {upcoming.length === 0 ? (
          <p className="text-muted-foreground mt-1.5 text-xs">
            Belum ada campaign yang akan datang.
          </p>
        ) : (
          <ol className="mt-2 space-y-1.5">
            {upcoming.map((u) => {
              const inner = (
                <>
                  <span
                    className={cn(
                      "w-12 shrink-0 rounded-md py-1 text-center text-xs font-semibold tabular-nums",
                      u.campaign
                        ? "bg-[color-mix(in_oklab,var(--cmp)_18%,transparent)]"
                        : "bg-muted",
                    )}
                  >
                    {countdownLabel(today, u.date)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{u.title}</span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {u.campaign ? `${u.note}, ${formatDayShort(u.date)}` : u.note}
                    </span>
                  </span>
                </>
              );
              return (
                <li key={u.id} style={campaignStyle(u.campaign?.color)}>
                  {u.campaign ? (
                    <button
                      type="button"
                      onClick={() => onOpenCampaign(u.campaign!)}
                      className="hover:bg-muted/60 focus-visible:ring-ring -mx-1 flex w-[calc(100%+0.5rem)] items-center gap-2 rounded-md px-1 py-0.5 text-left outline-none focus-visible:ring-2"
                    >
                      {inner}
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 py-0.5">{inner}</div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section aria-labelledby="rail-campaigns" className="bg-card rounded-xl border p-3">
        <div className="flex items-center justify-between gap-2">
          <h2 id="rail-campaigns" className="text-sm font-semibold">
            Campaign
            {campaigns.length > 0 ? (
              <span className="text-muted-foreground ml-1.5 font-normal tabular-nums">
                {campaigns.length}
              </span>
            ) : null}
          </h2>
          <Button type="button" size="xs" variant="ghost" className="gap-1" onClick={onNewCampaign}>
            <Plus aria-hidden />
            Baru
          </Button>
        </div>

        {campaigns.length === 0 ? (
          <p className="text-muted-foreground mt-1.5 text-xs">
            Campaign menandai rentang tanggal di kalender dan mengelompokkan aktivitasnya.
          </p>
        ) : (
          <ul className="mt-2 space-y-1">
            {campaigns.map((c) => {
              const p = progress.get(c.id) ?? { total: 0, done: 0 };
              const hidden = focusId ? focusId !== c.id : hiddenIds.has(c.id);
              const pics = c.picUserIds.flatMap((id) => {
                const m = memberById.get(id);
                return m ? [m] : [];
              });
              const pct = p.total > 0 ? Math.round((p.done / p.total) * 100) : 0;
              return (
                <li
                  key={c.id}
                  style={campaignStyle(c.color)}
                  className={cn(
                    "group/c -mx-1 rounded-lg px-1 py-1.5 transition-opacity",
                    hidden && "opacity-50",
                  )}
                >
                  <div className="flex items-start gap-1">
                    <button
                      type="button"
                      onClick={() => onOpenCampaign(c)}
                      className="hover:bg-muted/60 focus-visible:ring-ring min-w-0 flex-1 rounded-md px-1 py-0.5 text-left outline-none focus-visible:ring-2"
                    >
                      <span className="flex items-center gap-2">
                        <CampaignSwatch color={c.color} status={c.status} />
                        <span className="truncate text-sm font-medium">{c.name}</span>
                      </span>
                      <span className="text-muted-foreground mt-0.5 flex justify-between gap-2 text-xs">
                        <span className="tabular-nums">
                          {formatDayRange(c.startDate, c.endDate)}
                        </span>
                        <span className="shrink-0">{CAMPAIGN_STATUS_LABEL[c.status]}</span>
                      </span>
                    </button>
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="ghost"
                      aria-pressed={focusId === c.id}
                      aria-label={
                        focusId === c.id
                          ? `Berhenti fokus pada ${c.name}`
                          : `Tampilkan hanya ${c.name}`
                      }
                      title={focusId === c.id ? "Tampilkan semua" : "Tampilkan hanya campaign ini"}
                      onClick={() => onFocus(focusId === c.id ? null : c.id)}
                      className={cn(
                        "text-muted-foreground mt-0.5",
                        focusId === c.id && "bg-primary/15 text-foreground",
                      )}
                    >
                      <Crosshair aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="ghost"
                      disabled={Boolean(focusId)}
                      aria-pressed={hiddenIds.has(c.id)}
                      aria-label={
                        hiddenIds.has(c.id) ? `Tampilkan ${c.name}` : `Sembunyikan ${c.name}`
                      }
                      title={hiddenIds.has(c.id) ? "Tampilkan di kalender" : "Sembunyikan dari kalender"}
                      onClick={() => onToggleHidden(c.id)}
                      className="text-muted-foreground mt-0.5"
                    >
                      {hiddenIds.has(c.id) ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                    </Button>
                  </div>

                  {p.total > 0 || pics.length > 0 ? (
                    <div className="mt-1 flex items-center gap-2 px-1">
                      {p.total > 0 ? (
                        <>
                          <span
                            role="progressbar"
                            aria-valuemin={0}
                            aria-valuemax={p.total}
                            aria-valuenow={p.done}
                            aria-label={`${p.done} dari ${p.total} aktivitas selesai`}
                            className="bg-muted h-1 flex-1 overflow-hidden rounded-full"
                          >
                            <span
                              className="block h-full rounded-full bg-[var(--cmp)]"
                              style={{ width: `${pct}%` }}
                            />
                          </span>
                          <span className="text-muted-foreground shrink-0 text-[11px] tabular-nums">
                            {p.done}/{p.total}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground flex-1 text-[11px]">
                          Belum ada aktivitas
                        </span>
                      )}
                      <MemberAvatars members={pics} />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </aside>
  );
}
