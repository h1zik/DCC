"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { RoomWorkspaceSection, type Brand } from "@prisma/client";
import { Hash, ImagePlus, Pencil, Settings2, Sparkles } from "lucide-react";
import { roomWorkspaceSectionTitle } from "@/lib/room-workspace-section";
import { RoomLogoEditor } from "./room-logo-editor";
import { RoomEditorButton } from "./room-editor-button";
import {
  RoomMemberAvatarStack,
  type RoomMemberAvatarUser,
} from "@/components/room-member-avatar-stack";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  logoImage = null,
  canEditAssets = false,
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
  logoImage?: string | null;
  canEditAssets?: boolean;
  canEditRoom?: boolean;
  roomBrandId?: string | null;
  roomWorkspaceSection?: RoomWorkspaceSection;
  brands?: Brand[];
  brand?: Pick<Brand, "id" | "name"> | null;
  memberUsers?: RoomMemberAvatarUser[];
}) {
  const sectionLabel = roomWorkspaceSectionTitle(roomWorkspaceSection);
  const pathname = usePathname();
  const [logoDialogOpen, setLogoDialogOpen] = useState(false);
  const [roomDialogOpen, setRoomDialogOpen] = useState(false);

  if (pathname?.endsWith("/chat")) return null;

  const showSettings = canEditAssets || canEditRoom;

  return (
    <header className="border-border flex items-center gap-2.5 border-b pb-3 sm:gap-3">
      {logoImage ? (
        <span className="border-border size-9 shrink-0 overflow-hidden rounded-lg border shadow-sm">
          <Image
            src={logoImage}
            alt={`Logo ${roomName}`}
            width={36}
            height={36}
            className="size-full object-cover"
            unoptimized
          />
        </span>
      ) : (
        <div className="bg-primary/10 flex size-9 shrink-0 items-center justify-center rounded-lg">
          <span
            className="text-primary text-sm font-semibold tracking-tight"
            aria-hidden
          >
            {roomNameInitials(roomName)}
          </span>
        </div>
      )}

      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
          <h1 className="text-foreground min-w-0 truncate text-base font-semibold tracking-tight">
            {roomName}
          </h1>
          <span className="border-primary/25 bg-primary/12 text-primary hidden shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium sm:inline-flex">
            <Hash className="size-2.5" aria-hidden />
            {sectionLabel}
          </span>
          {brand ? (
            <span className="border-border bg-background hidden shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium sm:inline-flex">
              <span className="bg-primary size-1.5 rounded-full" aria-hidden />
              {brand.name}
            </span>
          ) : simpleHub ? (
            <span className="border-border bg-background text-muted-foreground hidden shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium sm:inline-flex">
              <Sparkles className="size-2.5" aria-hidden />
              Hub ringkas
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <RoomMemberAvatarStack
            users={memberUsers}
            maxVisible={4}
            size="responsive"
          />
          <Link
            href={`/room/${roomId}/members`}
            className="text-muted-foreground hover:text-foreground shrink-0 text-[11px] font-medium underline-offset-2 hover:underline"
          >
            <span className="sm:hidden">{memberUsers.length}</span>
            <span className="hidden sm:inline">{memberUsers.length} anggota</span>
          </Link>
        </div>
      </div>

      {showSettings ? (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Pengaturan ruangan"
                  title="Pengaturan ruangan"
                >
                  <Settings2 className="size-4" aria-hidden />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              {canEditAssets ? (
                <DropdownMenuItem onClick={() => setLogoDialogOpen(true)}>
                  <ImagePlus className="size-3.5" aria-hidden />
                  Edit logo
                </DropdownMenuItem>
              ) : null}
              {canEditRoom ? (
                <DropdownMenuItem onClick={() => setRoomDialogOpen(true)}>
                  <Pencil className="size-3.5" aria-hidden />
                  Edit ruang
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
          {canEditAssets ? (
            <RoomLogoEditor
              roomId={roomId}
              logoImage={logoImage}
              roomName={roomName}
              open={logoDialogOpen}
              onOpenChange={setLogoDialogOpen}
            />
          ) : null}
          {canEditRoom ? (
            <RoomEditorButton
              roomId={roomId}
              initialName={roomName}
              initialBrandId={roomBrandId}
              initialWorkspaceSection={roomWorkspaceSection}
              brands={brands}
              open={roomDialogOpen}
              onOpenChange={setRoomDialogOpen}
            />
          ) : null}
        </>
      ) : null}
    </header>
  );
}
