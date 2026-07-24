import { UserRole } from "@prisma/client";
import { format } from "date-fns";
import type { SelectItemDef } from "@/lib/select-option-items";

export type UserPick = { id: string; name: string | null; email: string };

export const RECURRENCE = {
  NONE: "NONE",
  DAILY: "DAILY",
  WEEKLY: "WEEKLY",
  MONTHLY: "MONTHLY",
} as const;

export type ScheduleRecurrenceValue =
  (typeof RECURRENCE)[keyof typeof RECURRENCE];

export const RECURRENCE_ITEMS: SelectItemDef[] = [
  { value: RECURRENCE.NONE, label: "Sekali saja" },
  { value: RECURRENCE.DAILY, label: "Setiap hari" },
  { value: RECURRENCE.WEEKLY, label: "Setiap minggu" },
  { value: RECURRENCE.MONTHLY, label: "Setiap bulan" },
];

/** Opsi pengulangan saat mengedit seluruh seri (tanpa "Sekali saja"). */
export const RECURRENCE_SERIES_ITEMS: SelectItemDef[] = RECURRENCE_ITEMS.filter(
  (item) => item.value !== RECURRENCE.NONE,
);

export const APPLY_TO_ITEMS: SelectItemDef[] = [
  { value: "SINGLE", label: "Acara ini saja" },
  { value: "SERIES", label: "Seluruh seri pengulangan" },
];

export type ScheduleEventRow = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  recurrence: ScheduleRecurrenceValue;
  recurrenceUntil: string | null;
  seriesId: string | null;
  createdById: string;
  createdBy: { name: string | null; email: string };
  participants: { user: UserPick }[];
};

export function canManageEvent(
  role: UserRole,
  currentUserId: string,
  createdById: string,
): boolean {
  return role === UserRole.CEO || currentUserId === createdById;
}

export function toDatetimeLocalValue(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Slot default saat membuat acara dari sebuah tanggal: jam 09:00. */
export function defaultSlotOnDay(day: Date): string {
  const d = new Date(day);
  d.setHours(9, 0, 0, 0);
  return toDatetimeLocalValue(d);
}

export type EventTone = { bar: string; chipBg: string; border: string };

const EVENT_TONES: EventTone[] = [
  { bar: "bg-chart-1", chipBg: "bg-chart-1/10", border: "border-chart-1/40" },
  { bar: "bg-chart-2", chipBg: "bg-chart-2/10", border: "border-chart-2/40" },
  { bar: "bg-chart-3", chipBg: "bg-chart-3/10", border: "border-chart-3/40" },
  { bar: "bg-chart-4", chipBg: "bg-chart-4/10", border: "border-chart-4/40" },
  { bar: "bg-chart-5", chipBg: "bg-chart-5/10", border: "border-chart-5/40" },
];

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** Warna deterministik per pembuat acara — stabil lintas render dan tema. */
export function eventToneFor(createdById: string): EventTone {
  return EVENT_TONES[hashString(createdById) % EVENT_TONES.length];
}

export function dayKeyOf(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function groupEventsByDay(
  events: ScheduleEventRow[],
): Map<string, ScheduleEventRow[]> {
  const map = new Map<string, ScheduleEventRow[]>();
  for (const ev of events) {
    const key = dayKeyOf(new Date(ev.startsAt));
    const list = map.get(key) ?? [];
    list.push(ev);
    map.set(key, list);
  }
  for (const [, list] of map) {
    list.sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    );
  }
  return map;
}

/** Acara "milik saya": saya pembuat atau termasuk peserta. */
export function isMineEvent(ev: ScheduleEventRow, userId: string): boolean {
  return (
    ev.createdById === userId ||
    ev.participants.some((p) => p.user.id === userId)
  );
}

export function displayName(u: { name: string | null; email: string }): string {
  return u.name?.trim() || u.email;
}
