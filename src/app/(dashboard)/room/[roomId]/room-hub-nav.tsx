"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RoomWorkspaceSection, type Brand } from "@prisma/client";
import {
  ClipboardList,
  Files,
  Hash,
  KanbanSquare,
  MessageCircle,
  Sparkles,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { roomWorkspaceSectionTitle } from "@/lib/room-workspace-section";
import { RoomBannerEditor } from "./room-banner-editor";
import { RoomLogoEditor } from "./room-logo-editor";
import { RoomEditorButton } from "./room-editor-button";
import {
  RoomMemberAvatarStack,
  type RoomMemberAvatarUser,
} from "@/components/room-member-avatar-stack";

function roomNameInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/u).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

export function RoomHubNav({
  roomId,
  roomName,
  simpleHub = false,
  bannerImage,
  logoImage = null,
  canEditBanner = false,
  canEditRoom = false,
  roomBrandId = null,
  roomWorkspaceSection = RoomWorkspaceSection.ROOMS,
  brands = [],
  brand = null,
  memberUsers = [],
}: {
  roomId: string;
  roomName: string;
  /** Ruangan HQ/Team tanpa brand: hanya tugas, chat, dokumen. */
  simpleHub?: boolean;
  bannerImage?: string | null;
  logoImage?: string | null;
  canEditBanner?: boolean;
  canEditRoom?: boolean;
  roomBrandId?: string | null;
  roomWorkspaceSection?: RoomWorkspaceSection;
  brands?: Brand[];
  brand?: Pick<Brand, "id" | "name"> | null;
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

  const sectionLabel = roomWorkspaceSectionTitle(roomWorkspaceSection);

  return (
    <div className="flex flex-col gap-4">
      <header
        className={cn(
          "border-border bg-card relative isolate overflow-hidden rounded-2xl border shadow-sm",
        )}
      >
        {/* Background: banner image or decorative gradient */}
        {bannerImage ? (
          <>
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url("${bannerImage}")` }}
              aria-hidden
            />
            {/* Stronger overlay so judul/teks selalu terbaca di atas banner */}
            <div
              className="bg-gradient-to-t from-background via-background/85 to-background/40 absolute inset-0"
              aria-hidden
            />
            <div
              className="bg-gradient-to-r from-background/55 via-transparent to-background/30 absolute inset-0"
              aria-hidden
            />
          </>
        ) : (
          <>
            <div
              className="bg-gradient-to-br from-primary/12 via-primary/4 absolute inset-0 to-transparent"
              aria-hidden
            />
            <div
              className="bg-primary/15 absolute -top-16 -right-16 size-56 rounded-full blur-3xl"
              aria-hidden
            />
            <div
              className="bg-primary/10 absolute -bottom-24 -left-10 size-48 rounded-full blur-3xl"
              aria-hidden
            />
          </>
        )}
        {/* Aksen garis tipis di atas */}
        <div
          className="bg-gradient-to-r from-transparent via-primary/40 to-transparent absolute inset-x-0 top-0 h-px"
          aria-hidden
        />

        <div className="relative flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6 sm:p-6">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="border-primary/25 bg-primary/12 text-primary inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium backdrop-blur-sm">
                <Hash className="size-3" aria-hidden />
                {sectionLabel}
              </span>
              {brand ? (
                <span className="border-border bg-background/85 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium backdrop-blur-sm">
                  <span className="bg-primary size-1.5 rounded-full" aria-hidden />
                  {brand.name}
                </span>
              ) : simpleHub ? (
                <span className="border-border bg-background/70 text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium backdrop-blur-sm">
                  <Sparkles className="size-3" aria-hidden />
                  Hub ringkas
                </span>
              ) : null}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-3 sm:gap-4">
                <div
                  className={cn(
                    "border-border bg-background/85 relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border shadow-sm backdrop-blur-sm sm:size-14",
                    !logoImage && "bg-primary/10",
                  )}
                >
                  {logoImage ? (
                    <Image
                      src={logoImage}
                      alt={`Logo ${roomName}`}
                      fill
                      sizes="(min-width: 640px) 56px, 48px"
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <span
                      className="text-primary text-base font-semibold tracking-tight sm:text-lg"
                      aria-hidden
                    >
                      {roomNameInitials(roomName)}
                    </span>
                  )}
                </div>
                <h1 className="text-foreground min-w-0 truncate text-2xl font-semibold tracking-tight sm:text-3xl">
                  {roomName}
                </h1>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <RoomMemberAvatarStack users={memberUsers} maxVisible={6} />
                <span className="text-muted-foreground text-xs font-medium">
                  {memberUsers.length} anggota
                </span>
              </div>
            </div>
          </div>

          {canEditBanner || canEditRoom ? (
            <div className="flex shrink-0 flex-wrap items-start gap-2 sm:flex-col sm:items-end sm:gap-1.5">
              {canEditBanner ? (
                <>
                  <RoomLogoEditor
                    roomId={roomId}
                    logoImage={logoImage}
                    roomName={roomName}
                  />
                  <RoomBannerEditor roomId={roomId} hasBanner={!!bannerImage} />
                </>
              ) : null}
              {canEditRoom ? (
                <RoomEditorButton
                  roomId={roomId}
                  initialName={roomName}
                  initialBrandId={roomBrandId}
                  initialWorkspaceSection={roomWorkspaceSection}
                  brands={brands}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </header>

      <nav
        aria-label="Menu ruangan"
        className="border-border bg-background/85 supports-backdrop-filter:bg-background/65 sticky top-14 z-20 rounded-xl border shadow-sm backdrop-blur-md"
      >
        <ul
          role="list"
          className="flex w-full items-center gap-0.5 overflow-x-auto p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {links.map((l) => {
            const active =
              pathname === l.href || pathname.startsWith(`${l.href}/`);
            return (
              <li key={l.href} className="shrink-0">
                <Link
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <l.icon className="size-4 shrink-0" aria-hidden />
                  <span className="whitespace-nowrap">{l.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
