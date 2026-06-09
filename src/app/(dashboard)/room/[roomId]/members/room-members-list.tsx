"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { RoomMemberRole, RoomTaskProcess } from "@prisma/client";
import { Search, ShieldCheck, UserCog, UserRound, Users, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  phaseLabelsForMember,
  type RoomPhaseOption,
} from "@/lib/room-member-phase-access";
import {
  ROOM_PROJECT_MANAGER_ROLE,
  roomMemberToProcessAccess,
} from "@/lib/room-member-process-access";
import { cn } from "@/lib/utils";

type MemberRow = {
  id: string;
  roomId: string;
  userId: string;
  role: RoomMemberRole;
  allowedRoomProcesses: RoomTaskProcess[];
  allowedCustomProcessPhaseIds: string[];
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
};

function userInitial(name: string | null, email: string): string {
  return (name?.trim() || email).slice(0, 1).toUpperCase() || "?";
}

function roomRoleLabel(role: RoomMemberRole): string {
  if (role === ROOM_PROJECT_MANAGER_ROLE) return "Project manager ruangan";
  switch (role) {
    case RoomMemberRole.ROOM_MANAGER:
      return "Manager ruangan";
    case RoomMemberRole.ROOM_CONTRIBUTOR:
      return "Kontributor";
    default:
      return role;
  }
}

const ROLE_ORDER: RoomMemberRole[] = [
  ROOM_PROJECT_MANAGER_ROLE,
  RoomMemberRole.ROOM_MANAGER,
  RoomMemberRole.ROOM_CONTRIBUTOR,
];

type RoleMeta = {
  label: string;
  description: string;
  Icon: React.ComponentType<{ className?: string }>;
  tone: string;
};

const ROLE_META: Record<RoomMemberRole, RoleMeta> = {
  ROOM_PROJECT_MANAGER: {
    label: "Project manager",
    description: "Akses penuh seluruh fase proses ruangan.",
    Icon: ShieldCheck,
    tone:
      "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  ROOM_MANAGER: {
    label: "Manager ruangan",
    description: "Mengelola tugas pada fase yang ditetapkan administrator.",
    Icon: UserCog,
    tone: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  },
  ROOM_CONTRIBUTOR: {
    label: "Kontributor",
    description: "Bekerja di fase proses sesuai akses yang diberikan.",
    Icon: UserRound,
    tone:
      "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
};

export function RoomMembersList({
  members,
  roomPhases,
  toolbarEnd,
}: {
  members: MemberRow[];
  roomPhases: RoomPhaseOption[];
  /** Tombol/aksi tambahan di toolbar (mis. kelola anggota). */
  toolbarEnd?: React.ReactNode;
}) {
  const [query, setQuery] = useState("");

  const counts = useMemo(() => {
    const total = members.length;
    const byRole = new Map<RoomMemberRole, number>();
    for (const m of members) {
      const role = roomMemberToProcessAccess(m).role;
      byRole.set(role, (byRole.get(role) ?? 0) + 1);
    }
    return { total, byRole };
  }, [members]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => {
      const name = m.user.name?.toLowerCase() ?? "";
      const email = m.user.email.toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [members, query]);

  const grouped = useMemo(() => {
    const map = new Map<RoomMemberRole, MemberRow[]>();
    for (const role of ROLE_ORDER) map.set(role, []);
    for (const m of filtered) {
      const role = roomMemberToProcessAccess(m).role;
      const list = map.get(role) ?? [];
      list.push(m);
      map.set(role, list);
    }
    return ROLE_ORDER
      .map((role) => ({ role, items: map.get(role) ?? [] }))
      .filter((g) => g.items.length > 0);
  }, [filtered]);

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-card flex flex-wrap items-center gap-2 rounded-xl border p-1.5 shadow-sm">
        <div className="relative min-w-0 flex-1 sm:min-w-[16rem]">
          <Search
            className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari anggota berdasarkan nama atau email…"
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
        <div className="flex flex-wrap items-center gap-1.5 px-1">
          <Chip>
            <span className="text-foreground font-semibold tabular-nums">
              {counts.total}
            </span>
            total
          </Chip>
          {ROLE_ORDER.map((role) => {
            const c = counts.byRole.get(role) ?? 0;
            if (c === 0) return null;
            const meta = ROLE_META[role];
            const Icon = meta.Icon;
            return (
              <Chip key={role}>
                <Icon className="size-3" aria-hidden />
                <span className="text-foreground font-semibold tabular-nums">
                  {c}
                </span>
                {meta.label}
              </Chip>
            );
          })}
        </div>
        {toolbarEnd ? (
          <div className="flex shrink-0 items-center px-1">{toolbarEnd}</div>
        ) : null}
      </div>

      {members.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Belum ada anggota di ruangan ini."
          description="Tambahkan anggota lewat tombol Kelola Anggota & Peran di atas."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Tidak ada anggota cocok."
          description="Coba kata kunci lain atau bersihkan pencarian."
        />
      ) : (
        <div className="flex flex-col gap-5">
          {grouped.map(({ role, items }) => {
            const meta = ROLE_META[role];
            const Icon = meta.Icon;
            return (
              <section
                key={role}
                aria-label={meta.label}
                className="flex flex-col gap-3"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                      meta.tone,
                    )}
                  >
                    <Icon className="size-3" aria-hidden />
                    {meta.label}
                    <span className="text-foreground/80 ml-1 tabular-nums">
                      {items.length}
                    </span>
                  </span>
                  <span className="text-muted-foreground hidden text-xs sm:inline">
                    {meta.description}
                  </span>
                </div>
                <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {items.map((member) => {
                    const access = roomMemberToProcessAccess(member);
                    const fullAccess = access.role === ROOM_PROJECT_MANAGER_ROLE;
                    const phaseLabels = phaseLabelsForMember(access, roomPhases);
                    const displayName = member.user.name ?? member.user.email;
                    return (
                      <li
                        key={member.id}
                        className="bg-card hover:border-primary/30 hover:shadow-md transition-shadow rounded-xl border border-border p-3 shadow-sm"
                      >
                        <div className="flex items-start gap-3">
                          {member.user.image ? (
                            <Image
                              src={member.user.image}
                              alt={displayName}
                              width={44}
                              height={44}
                              className="border-border size-11 shrink-0 rounded-full border object-cover"
                              unoptimized
                            />
                          ) : (
                            <div
                              className="border-border bg-muted text-muted-foreground flex size-11 shrink-0 items-center justify-center rounded-full border text-sm font-semibold"
                              aria-hidden
                            >
                              {userInitial(member.user.name, member.user.email)}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <Link
                              href={`/profile/${member.user.id}`}
                              className="block truncate text-sm font-semibold underline-offset-4 hover:underline focus-visible:underline"
                            >
                              {displayName}
                            </Link>
                            <p className="text-muted-foreground truncate text-xs">
                              {member.user.email}
                            </p>
                          </div>
                          <Badge variant="outline" className="shrink-0 text-[10px]">
                            {roomRoleLabel(access.role)}
                          </Badge>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {fullAccess ? (
                            <Badge variant="secondary" className="text-[10px]">
                              Semua fase proses
                            </Badge>
                          ) : phaseLabels.length === 0 ? (
                            <Badge variant="outline" className="text-[10px]">
                              Belum ada fase aktif
                            </Badge>
                          ) : (
                            phaseLabels.map((label) => (
                              <Badge
                                key={label}
                                variant="secondary"
                                className="text-[10px]"
                              >
                                {label}
                              </Badge>
                            ))
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="border-border bg-background text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium shadow-sm">
      {children}
    </span>
  );
}

