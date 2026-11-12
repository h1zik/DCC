import type { RoomCalendarEventKind } from "@prisma/client";
import {
  AtSign,
  BadgePercent,
  Camera,
  CalendarDays,
  Flag,
  MessagesSquare,
  Radio,
  Rocket,
  Send,
  Store,
  type LucideIcon,
} from "lucide-react";

/** Ikon per jenis aktivitas. Jenis dibaca dari bentuk, bukan warna. */
export const EVENT_KIND_ICON: Record<RoomCalendarEventKind, LucideIcon> = {
  GENERAL: CalendarDays,
  SHOOT: Camera,
  CONTENT: Send,
  LIVE: Radio,
  PROMO: BadgePercent,
  KOL: AtSign,
  LAUNCH: Rocket,
  OFFLINE: Store,
  MEETING: MessagesSquare,
  DEADLINE: Flag,
};
