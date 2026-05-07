"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  type Brand,
  type RoomWorkspaceSection,
} from "@prisma/client";
import {
  ArrowRight,
  Building2,
  DoorOpen,
  Hash,
  KanbanSquare,
  Search,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  RoomMemberAvatarStack,
  type RoomMemberAvatarUser,
} from "@/components/room-member-avatar-stack";
import {
  ROOM_WORKSPACE_SECTION_ORDER,
  roomWorkspaceSectionBlurb,
  roomWorkspaceSectionTitle,
} from "@/lib/room-workspace-section";
import { cn } from "@/lib/utils";
import { SectionCreateRoomButton } from "./section-create-room-button";

export type RoomsPickerRoom = {
  id: string;
  name: string;
  workspaceSection: RoomWorkspaceSection;
  logoImage: string | null;
  brand: { id: string; name: string; colorCode: string | null } | null;
  members: RoomMemberAvatarUser[];
};

function roomNameInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/u).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

function sectionIcon(s: RoomWorkspaceSection) {
  switch (s) {
    case "HQ":
      return Sparkles;
    case "TEAM":
      return Users;
    default:
      return DoorOpen;
  }
}

function sectionTone(s: RoomWorkspaceSection): string {
  switch (s) {
    case "HQ":
      return "from-amber-500/20 via-amber-500/5 text-amber-600 dark:text-amber-300";
    case "TEAM":
      return "from-sky-500/20 via-sky-500/5 text-sky-600 dark:text-sky-300";
    default:
      return "from-violet-500/20 via-violet-500/5 text-violet-600 dark:text-violet-300";
  }
}

export function RoomsPicker({
  rooms,
  brands,
  canManageRooms,
  showAllRooms,
  isCeo,
}: {
  rooms: RoomsPickerRoom[];
  brands: Brand[];
  canManageRooms: boolean;
  showAllRooms: boolean;
  isCeo: boolean;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rooms;
    return rooms.filter((r) => {
      const nameMatch = r.name.toLowerCase().includes(q);
      const brandMatch = r.brand?.name.toLowerCase().includes(q) ?? false;
      return nameMatch || brandMatch;
    });
  }, [rooms, query]);

  const counts = useMemo(() => {
    const total = rooms.length;
    const bySection = new Map<RoomWorkspaceSection, number>();
    for (const r of rooms) {
      bySection.set(
        r.workspaceSection,
        (bySection.get(r.workspaceSection) ?? 0) + 1,
      );
    }
    return { total, bySection };
  }, [rooms]);

  return (
    <div className="flex flex-col gap-6">
      {/* Hero */}
      <header className="border-border bg-card relative isolate overflow-hidden rounded-2xl border shadow-sm">
        <div
          className="bg-gradient-to-br from-primary/10 via-primary/5 absolute inset-0 to-transparent"
          aria-hidden
        />
        <div
          className="bg-primary/15 absolute -top-16 -right-16 size-56 rounded-full blur-3xl"
          aria-hidden
        />
        <div
          className="bg-gradient-to-r from-transparent via-primary/40 to-transparent absolute inset-x-0 top-0 h-px"
          aria-hidden
        />
        <div className="relative flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between sm:gap-6 sm:p-6">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className="border-primary/30 bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl border"
              aria-hidden
            >
              <KanbanSquare className="size-5" />
            </span>
            <div className="min-w-0 space-y-1">
              <h1 className="text-foreground text-2xl font-semibold tracking-tight sm:text-3xl">
                Pilih ruangan kerja
              </h1>
              <p className="text-muted-foreground text-pretty text-sm leading-relaxed">
                {showAllRooms
                  ? isCeo
                    ? "Ruangan dikelompokkan ke HQ, Team, atau Ruangan. CEO menetapkan administrator di menu Pengguna."
                    : "Ruangan dikelompokkan ke HQ, Team, atau Ruangan. Tambah ruangan langsung dari tombol per bagian."
                  : "Hanya ruangan tempat Anda ditetapkan sebagai manager atau kontributor yang muncul di sini."}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip>
              <span className="text-foreground font-semibold tabular-nums">
                {counts.total}
              </span>
              ruangan
            </Chip>
            {ROOM_WORKSPACE_SECTION_ORDER.map((s) => {
              const c = counts.bySection.get(s) ?? 0;
              if (c === 0) return null;
              const Icon = sectionIcon(s);
              return (
                <Chip key={s}>
                  <Icon className="size-3" aria-hidden />
                  <span className="text-foreground font-semibold tabular-nums">
                    {c}
                  </span>
                  {roomWorkspaceSectionTitle(s)}
                </Chip>
              );
            })}
          </div>
        </div>
      </header>

      {/* Search */}
      <div className="bg-card flex items-center gap-2 rounded-xl border p-1.5 shadow-sm">
        <div className="relative flex-1">
          <Search
            className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari ruangan berdasarkan nama atau brand…"
            className="border-transparent bg-transparent pl-9 shadow-none focus-visible:bg-background"
          />
          {query ? (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="absolute right-1 top-1/2 size-7 -translate-y-1/2"
              aria-label="Bersihkan pencarian"
              onClick={() => setQuery("")}
            >
              <X className="size-3.5" />
            </Button>
          ) : null}
        </div>
      </div>

      {/* Sections */}
      {!showAllRooms && rooms.length === 0 ? (
        <EmptyState
          title="Belum ada akses ruangan"
          description="Hubungi administrator agar menambahkan Anda ke ruangan kerja dengan peran manager atau kontributor."
        />
      ) : query.trim() && filtered.length === 0 ? (
        <EmptyState
          title="Tidak ada ruangan cocok"
          description="Coba kata kunci lain atau bersihkan pencarian."
        />
      ) : (
        <div className="flex flex-col gap-8">
          {ROOM_WORKSPACE_SECTION_ORDER.map((section) => {
            const list = filtered.filter(
              (r) => r.workspaceSection === section,
            );
            if (!showAllRooms && list.length === 0) return null;
            const Icon = sectionIcon(section);
            const tone = sectionTone(section);

            return (
              <section key={section} className="space-y-4">
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm font-semibold",
                      "bg-gradient-to-br border-transparent",
                      tone,
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                    {roomWorkspaceSectionTitle(section)}
                    <span className="text-foreground/80 ml-1 inline-flex items-center justify-center rounded-md bg-background/70 px-1.5 py-0.5 text-[11px] tabular-nums">
                      {list.length}
                    </span>
                  </span>
                  <span className="bg-border h-px flex-1" aria-hidden />
                  {canManageRooms ? (
                    <SectionCreateRoomButton
                      section={section as RoomWorkspaceSection}
                      brands={brands}
                    />
                  ) : null}
                </div>
                <p className="text-muted-foreground -mt-2 text-xs sm:text-sm">
                  {roomWorkspaceSectionBlurb(section)}
                </p>

                {list.length === 0 ? (
                  <p className="text-muted-foreground border-border/60 rounded-md border border-dashed px-3 py-3 text-xs">
                    Belum ada ruangan di bagian ini.
                  </p>
                ) : (
                  <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {list.map((room) => (
                      <li key={room.id}>
                        <RoomCard room={room} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RoomCard({ room }: { room: RoomsPickerRoom }) {
  const initials = roomNameInitials(room.name);
  return (
    <Link
      href={`/room/${room.id}/tasks`}
      className={cn(
        "group bg-card hover:border-primary/40 hover:shadow-md focus-visible:border-primary",
        "flex h-full flex-col gap-3 rounded-xl border border-border p-4 shadow-sm transition-all",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "border-border bg-background/85 relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border shadow-sm",
            !room.logoImage && "bg-primary/10",
          )}
          aria-hidden
        >
          {room.logoImage ? (
            <Image
              src={room.logoImage}
              alt={`Logo ${room.name}`}
              fill
              sizes="48px"
              className="object-cover transition-transform group-hover:scale-105"
              unoptimized
            />
          ) : (
            <span className="text-primary text-base font-semibold tracking-tight">
              {initials}
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="text-foreground group-hover:text-primary line-clamp-1 text-base font-semibold tracking-tight transition-colors">
            {room.name}
          </h3>
          <div className="flex flex-wrap items-center gap-1.5">
            {room.brand ? (
              <span className="border-border bg-muted/60 text-foreground inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium">
                <span
                  className="size-1.5 rounded-full"
                  style={{
                    backgroundColor: room.brand.colorCode ?? "#94a3b8",
                  }}
                  aria-hidden
                />
                <Building2 className="size-3 opacity-60" aria-hidden />
                {room.brand.name}
              </span>
            ) : (
              <span className="border-border bg-muted/40 text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium">
                <Hash className="size-3" aria-hidden />
                Tanpa brand
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="border-border/60 mt-auto flex items-center justify-between gap-3 border-t pt-3">
        <div className="flex items-center gap-2">
          {room.members.length > 0 ? (
            <RoomMemberAvatarStack
              users={room.members}
              maxVisible={4}
              linkProfiles={false}
            />
          ) : (
            <span className="text-muted-foreground text-xs">
              Belum ada anggota
            </span>
          )}
        </div>
        <span
          className="text-primary inline-flex items-center gap-1 text-xs font-semibold opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden
        >
          Buka
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="border-border bg-background text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium shadow-sm">
      {children}
    </span>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="border-border bg-card text-muted-foreground rounded-xl border border-dashed p-10 text-center text-sm">
      <KanbanSquare
        className="text-muted-foreground/50 mx-auto mb-3 size-8"
        aria-hidden
      />
      <p className="text-foreground font-medium">{title}</p>
      <p className="mt-1 text-xs">{description}</p>
    </div>
  );
}
