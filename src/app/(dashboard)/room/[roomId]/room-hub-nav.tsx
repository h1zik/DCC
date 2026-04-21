"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Files, KanbanSquare, MessageCircle, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { RoomBannerEditor } from "./room-banner-editor";
import {
  RoomMemberAvatarStack,
  type RoomMemberAvatarUser,
} from "@/components/room-member-avatar-stack";

export function RoomHubNav({
  roomId,
  roomName,
  simpleHub = false,
  bannerImage,
  canEditBanner = false,
  memberUsers = [],
}: {
  roomId: string;
  roomName: string;
  /** Ruangan HQ/Team tanpa brand: hanya tugas, chat, dokumen. */
  simpleHub?: boolean;
  bannerImage?: string | null;
  canEditBanner?: boolean;
  memberUsers?: RoomMemberAvatarUser[];
}) {
  const pathname = usePathname();
  const base = `/room/${roomId}`;
  const simpleLinks = [
    { href: `${base}/tasks`, label: "Tasks", icon: KanbanSquare },
    { href: `${base}/members`, label: "Anggota", icon: Users },
    { href: `${base}/chat`, label: "Grup", icon: MessageCircle },
    { href: `${base}/documents`, label: "Documents & file", icon: Files },
  ] as const;
  const fullLinks = [
    { href: `${base}/tasks`, label: "Tasks", icon: KanbanSquare },
    {
      href: `${base}/content-planning`,
      label: "Content planning",
      icon: ClipboardList,
    },
    { href: `${base}/members`, label: "Anggota", icon: Users },
    { href: `${base}/chat`, label: "Grup", icon: MessageCircle },
    { href: `${base}/documents`, label: "Documents & file", icon: Files },
  ] as const;
  const links = simpleHub ? simpleLinks : fullLinks;

  return (
    <div className="border-border bg-card/30 relative overflow-hidden rounded-xl border p-4">
      {bannerImage ? (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-75"
          style={{ backgroundImage: `url("${bannerImage}")` }}
          aria-hidden
        />
      ) : null}
      <div
        className={cn(
          "pointer-events-none absolute inset-0",
          bannerImage
            ? "bg-gradient-to-r from-background/25 via-background/15 to-background/25"
            : "bg-background/70",
        )}
        aria-hidden
      />
      <div className="relative flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Ruangan
            </p>
            <h1 className="text-xl font-semibold tracking-tight">{roomName}</h1>
            <div className="mt-2 space-y-1">
              <p className="text-muted-foreground text-[11px] font-medium">
                Anggota ruangan: {memberUsers.length} orang
              </p>
              <RoomMemberAvatarStack users={memberUsers} maxVisible={8} />
            </div>
          </div>
          {canEditBanner ? (
            <RoomBannerEditor roomId={roomId} hasBanner={!!bannerImage} />
          ) : null}
        </div>
        <nav className="flex flex-wrap gap-1 sm:justify-end" aria-label="Menu ruangan">
          {links.map((l) => {
            const active =
              pathname === l.href || pathname.startsWith(`${l.href}/`);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <l.icon className="size-4 shrink-0" />
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
