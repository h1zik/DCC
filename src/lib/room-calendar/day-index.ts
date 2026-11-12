import type { DayKey } from "./dates";
import {
  compareEvents,
  eventDays,
  type CalCampaign,
  type CalContentPost,
  type CalEvent,
  type CalKolPost,
} from "./types";

/** Semua yang jatuh di satu hari, siap ditampilkan sebagai daftar. */
export type DayItems = {
  /** Campaign yang sedang berjalan di hari ini. */
  campaigns: CalCampaign[];
  /** Aktivitas yang menyentuh hari ini (termasuk yang multi-hari). */
  events: CalEvent[];
  content: CalContentPost[];
  kol: CalKolPost[];
};

export const EMPTY_DAY_ITEMS: DayItems = { campaigns: [], events: [], content: [], kol: [] };

export function buildDayIndex(
  source: {
    campaigns: readonly CalCampaign[];
    events: readonly CalEvent[];
    contentPosts: readonly CalContentPost[];
    kolPosts: readonly CalKolPost[];
  },
  days: readonly DayKey[],
): Map<DayKey, DayItems> {
  const map = new Map<DayKey, DayItems>();
  if (days.length === 0) return map;
  for (const day of days) map.set(day, { campaigns: [], events: [], content: [], kol: [] });
  const first = days[0]!;
  const last = days[days.length - 1]!;

  for (const c of source.campaigns) {
    if (c.endDate < first || c.startDate > last) continue;
    for (const day of days) {
      if (day >= c.startDate && day <= c.endDate) map.get(day)!.campaigns.push(c);
    }
  }
  for (const ev of source.events) {
    const d = eventDays(ev);
    if (d.end < first || d.start > last) continue;
    for (const day of days) {
      if (day >= d.start && day <= d.end) map.get(day)!.events.push(ev);
    }
  }
  for (const p of source.contentPosts) map.get(p.day)?.content.push(p);
  for (const p of source.kolPosts) map.get(p.day)?.kol.push(p);

  for (const items of map.values()) {
    items.events.sort(compareEvents);
    items.content.sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
    items.kol.sort((a, b) => a.time.localeCompare(b.time));
  }
  return map;
}

export function dayItemCount(items: DayItems): number {
  return items.events.length + items.content.length + items.kol.length;
}
