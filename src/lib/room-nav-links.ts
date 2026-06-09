import { RoomViewType } from "@prisma/client";
import {
  ClipboardList,
  Files,
  KanbanSquare,
  MessageCircle,
  Users,
  type LucideIcon,
} from "lucide-react";
import { roomViewTypeIcon } from "@/lib/room-view-icon";

export type RoomNavLink = {
  /** Kunci stabil untuk pencocokan menu (mis. "tasks", "view-<id>"). */
  key: string;
  href: string;
  label: string;
  icon: LucideIcon;
};

export type RoomNavCustomView = {
  id: string;
  type: RoomViewType;
  title: string;
};

/**
 * Satu sumber kebenaran untuk daftar menu di dalam sebuah ruangan.
 * Dipakai oleh navigasi hub ruangan (`room-hub-nav`) maupun dropdown sidebar
 * agar urutan & label tetap konsisten.
 */
export function getRoomNavLinks(
  roomId: string,
  options: { simpleHub: boolean; customViews?: RoomNavCustomView[] },
): RoomNavLink[] {
  const base = `/room/${roomId}`;
  const core: RoomNavLink[] = [
    { key: "tasks", href: `${base}/tasks`, label: "Tasks", icon: KanbanSquare },
  ];
  if (!options.simpleHub) {
    core.push({
      key: "content-planning",
      href: `${base}/content-planning`,
      label: "Content planning",
      icon: ClipboardList,
    });
  }
  core.push(
    { key: "members", href: `${base}/members`, label: "Anggota", icon: Users },
    { key: "chat", href: `${base}/chat`, label: "Grup", icon: MessageCircle },
    {
      key: "documents",
      href: `${base}/documents`,
      label: "Documents & file",
      icon: Files,
    },
  );

  const views: RoomNavLink[] = (options.customViews ?? []).map((v) => ({
    key: `view-${v.id}`,
    href: `${base}/view/${v.id}`,
    label: v.title,
    icon: roomViewTypeIcon(v.type),
  }));

  return [...core, ...views];
}
