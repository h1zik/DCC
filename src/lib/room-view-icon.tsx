import {
  BookMarked,
  BookOpen,
  CalendarDays,
  Link as LinkIcon,
  Milestone,
  Table,
  type LucideIcon,
} from "lucide-react";
import { RoomViewType } from "@prisma/client";

export function roomViewTypeIcon(type: RoomViewType): LucideIcon {
  switch (type) {
    case RoomViewType.CALENDAR:
      return CalendarDays;
    case RoomViewType.TIMELINE:
      return Milestone;
    case RoomViewType.WIKI:
      return BookOpen;
    case RoomViewType.LINKS:
      return LinkIcon;
    case RoomViewType.LIST:
      return Table;
    case RoomViewType.GLOSSARY:
      return BookMarked;
    default:
      return Table;
  }
}
