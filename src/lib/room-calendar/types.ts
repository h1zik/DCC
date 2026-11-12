import type {
  ContentPlanJenis,
  ContentPlanPlatform,
  ContentPlanUsage,
  RoomCalendarEventKind,
  RoomCampaignStatus,
} from "@prisma/client";
import { formatWibTime, wibDayKey } from "@/lib/kol/time";
import type { DayKey } from "./dates";

/**
 * Bentuk data kalender ruangan setelah diserialisasi server → klien.
 * Tanggal acara berupa ISO string; tanggal campaign berupa kunci hari.
 */

export type CalEvent = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  campaignId: string | null;
  kind: RoomCalendarEventKind;
  doneAt: string | null;
};

export type CalCampaign = {
  id: string;
  name: string;
  description: string | null;
  startDate: DayKey;
  endDate: DayKey;
  color: string;
  status: RoomCampaignStatus;
  objective: ContentPlanUsage | null;
  channels: string[];
  picUserIds: string[];
  budget: number | null;
  kpiTarget: string | null;
};

export type CalMember = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
};

/** Jadwal posting dari Content Plan ruangan (baca-saja). */
export type CalContentPost = {
  id: string;
  title: string;
  day: DayKey;
  /** "HH:mm" WIB, bila diisi. */
  time: string | null;
  jenis: ContentPlanJenis;
  platforms: ContentPlanPlatform[];
  published: boolean;
  /** Halaman Content Plan asal baris ini. */
  href: string;
  /** Nama view asal; null = Content Plan bawaan ruangan. */
  planTitle: string | null;
};

/** Jadwal tayang KOL untuk brand ruangan (baca-saja, butuh akses KOL Hub). */
export type CalKolPost = {
  id: string;
  day: DayKey;
  time: string;
  handle: string;
  kolName: string;
  campaignTitle: string;
  posted: boolean;
  tentative: boolean;
};

export type CalendarData = {
  events: CalEvent[];
  campaigns: CalCampaign[];
  members: CalMember[];
  contentPosts: CalContentPost[];
  /** null = lapisan tidak tersedia (ruangan tanpa brand atau tanpa akses KOL Hub). */
  kolPosts: CalKolPost[] | null;
};

export type EventDays = { start: DayKey; end: DayKey };

/**
 * Hari (WIB) yang disinggung satu acara. Acara yang berakhir tepat tengah
 * malam tidak dihitung menyentuh hari berikutnya.
 */
export function eventDays(ev: Pick<CalEvent, "startsAt" | "endsAt">): EventDays {
  const start = wibDayKey(ev.startsAt);
  if (!ev.endsAt) return { start, end: start };
  const endMs = new Date(ev.endsAt).getTime();
  const startMs = new Date(ev.startsAt).getTime();
  if (endMs <= startMs) return { start, end: start };
  const end = wibDayKey(new Date(endMs - 1));
  return { start, end: end < start ? start : end };
}

export function isMultiDay(ev: Pick<CalEvent, "startsAt" | "endsAt">): boolean {
  const d = eventDays(ev);
  return d.start !== d.end;
}

/** "19.00" atau "19.00–21.00" (WIB); kosong untuk acara sepanjang hari. */
export function eventTimeLabel(ev: Pick<CalEvent, "startsAt" | "endsAt" | "allDay">): string {
  if (ev.allDay) return "";
  const start = formatWibTime(ev.startsAt);
  if (!ev.endsAt) return start;
  const d = eventDays(ev);
  if (d.start !== d.end) return start;
  const end = formatWibTime(ev.endsAt);
  return end === start ? start : `${start}–${end}`;
}

/** Urutan dalam satu hari: sepanjang hari dulu, lalu jam mulai, lalu judul. */
export function compareEvents(a: CalEvent, b: CalEvent): number {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  if (a.startsAt !== b.startsAt) return a.startsAt < b.startsAt ? -1 : 1;
  return a.title.localeCompare(b.title);
}

export type CampaignProgress = { total: number; done: number };

export function campaignProgress(
  events: readonly CalEvent[],
): Map<string, CampaignProgress> {
  const map = new Map<string, CampaignProgress>();
  for (const ev of events) {
    if (!ev.campaignId) continue;
    const p = map.get(ev.campaignId) ?? { total: 0, done: 0 };
    p.total += 1;
    if (ev.doneAt) p.done += 1;
    map.set(ev.campaignId, p);
  }
  return map;
}

export function memberName(m: Pick<CalMember, "name" | "email">): string {
  return m.name?.trim() || m.email;
}

export function memberInitials(m: Pick<CalMember, "name" | "email">): string {
  const name = m.name?.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  return m.email.slice(0, 2).toUpperCase();
}
