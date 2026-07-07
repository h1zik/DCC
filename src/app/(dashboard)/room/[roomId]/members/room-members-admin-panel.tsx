"use client";
import { actionErrorMessage } from "@/lib/action-error-message";

import { useMemo, useState } from "react";
import Image from "next/image";
import { RoomMemberRole, type User } from "@prisma/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { removeRoomMember, upsertRoomMember } from "@/actions/room-members";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RoomMemberPhaseCheckboxes } from "@/components/room/room-member-phase-checkboxes";
import {
  allRoomPhaseIds,
  memberAllowedPhaseIds,
  type RoomPhaseOption,
} from "@/lib/room-member-phase-access";
import {
  ROOM_PROJECT_MANAGER_ROLE,
  roomMemberToProcessAccess,
} from "@/lib/room-member-process-access";
import type { SelectItemDef } from "@/lib/select-option-items";
import {
  ListChecks,
  Loader2,
  Plus,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

type MemberRow = {
  id: string;
  roomId: string;
  userId: string;
  role: RoomMemberRole;
  allowedRoomProcesses: import("@prisma/client").RoomTaskProcess[];
  allowedCustomProcessPhaseIds: string[];
  user: Pick<User, "id" | "name" | "email" | "image" | "role">;
};

type StudioUserRow = Pick<User, "id" | "name" | "email" | "role">;

const PICK_SENTINEL = "__pick__";

function roomRoleLabel(role: RoomMemberRole): string {
  if (role === ROOM_PROJECT_MANAGER_ROLE) return "Project manager ruangan";
  return role === RoomMemberRole.ROOM_MANAGER ? "Administrator ruangan" : "Kontributor";
}

/** Warna badge per peran ruangan (PM amber, administrator sky, kontributor netral). */
function roomRoleTone(role: RoomMemberRole): { chip: string; dot: string } {
  if (role === ROOM_PROJECT_MANAGER_ROLE) {
    return {
      chip: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      dot: "bg-amber-500",
    };
  }
  if (role === RoomMemberRole.ROOM_MANAGER) {
    return {
      chip: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
      dot: "bg-sky-500",
    };
  }
  return {
    chip: "border-border bg-muted/60 text-muted-foreground",
    dot: "bg-slate-400",
  };
}

const ROLE_ITEMS: SelectItemDef[] = [
  {
    value: RoomMemberRole.ROOM_MANAGER,
    label: roomRoleLabel(RoomMemberRole.ROOM_MANAGER),
  },
  {
    value: RoomMemberRole.ROOM_CONTRIBUTOR,
    label: roomRoleLabel(RoomMemberRole.ROOM_CONTRIBUTOR),
  },
  {
    value: ROOM_PROJECT_MANAGER_ROLE,
    label: roomRoleLabel(ROOM_PROJECT_MANAGER_ROLE),
  },
];

function initialsOf(label: string): string {
  const parts = label.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function MemberAvatar({
  user,
  size = 36,
}: {
  user: Pick<User, "name" | "email" | "image">;
  size?: number;
}) {
  const label = user.name?.trim() || user.email;
  return user.image ? (
    <Image
      src={user.image}
      alt={label}
      width={size}
      height={size}
      unoptimized
      className="shrink-0 rounded-full border border-border object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      className="bg-muted text-muted-foreground flex shrink-0 items-center justify-center rounded-full border border-border text-[11px] font-semibold"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {initialsOf(label)}
    </span>
  );
}

function PhaseSectionHeader({
  selectedCount,
  totalCount,
  disabled,
  onSelectAll,
}: {
  selectedCount: number;
  totalCount: number;
  disabled: boolean;
  onSelectAll: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
        Fase tugas yang dapat diakses
      </p>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-[10px] tabular-nums">
          {selectedCount}/{totalCount} fase
        </span>
        {selectedCount < totalCount ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-2 text-[11px]"
            disabled={disabled}
            onClick={onSelectAll}
          >
            <ListChecks className="size-3" aria-hidden />
            Pilih semua
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function RoomMembersAdminPanel({
  roomId,
  members,
  studioUsers,
  simpleRoom,
  roomPhases,
}: {
  roomId: string;
  members: MemberRow[];
  studioUsers: StudioUserRow[];
  simpleRoom: boolean;
  roomPhases: RoomPhaseOption[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [addUserId, setAddUserId] = useState("");
  const [addRole, setAddRole] = useState<RoomMemberRole>(RoomMemberRole.ROOM_CONTRIBUTOR);
  const [addPhaseIds, setAddPhaseIds] = useState<string[]>(() =>
    allRoomPhaseIds(roomPhases),
  );

  // Reset pilihan fase untuk anggota baru saat daftar fase ruangan berubah
  // (pola "adjust state when props change" — tanpa effect, dan tidak mereset
  // saat refresh menghasilkan array baru berisi fase yang sama).
  const phasesKey = roomPhases.map((p) => p.id).join("|");
  const [prevPhasesKey, setPrevPhasesKey] = useState(phasesKey);
  if (prevPhasesKey !== phasesKey) {
    setPrevPhasesKey(phasesKey);
    setAddPhaseIds(allRoomPhaseIds(roomPhases));
  }

  const addableUsers = useMemo(() => {
    const ids = new Set(members.map((m) => m.userId));
    return studioUsers.filter((u) => !ids.has(u.id));
  }, [members, studioUsers]);

  const addUserItems = useMemo((): SelectItemDef[] => {
    return [
      { value: PICK_SENTINEL, label: "Pilih pengguna…" },
      ...addableUsers.map((u) => ({
        value: u.id,
        label: u.name?.trim() || u.email,
      })),
    ];
  }, [addableUsers]);

  const roleCounts = useMemo(() => {
    const map = new Map<RoomMemberRole, number>();
    for (const m of members) {
      map.set(m.role, (map.get(m.role) ?? 0) + 1);
    }
    return [...map.entries()];
  }, [members]);

  async function onChangeRole(
    userId: string,
    role: RoomMemberRole,
    currentPhaseIds: string[],
  ) {
    setPending(true);
    try {
      const phaseIds =
        role === ROOM_PROJECT_MANAGER_ROLE
          ? undefined
          : simpleRoom
            ? allRoomPhaseIds(roomPhases)
            : currentPhaseIds.length > 0
              ? currentPhaseIds
              : allRoomPhaseIds(roomPhases);
      await upsertRoomMember(roomId, userId, role, phaseIds);
      toast.success("Peran diperbarui.");
      router.refresh();
    } catch (e) {
      toast.error(actionErrorMessage(e, "Gagal menyimpan peran."));
    } finally {
      setPending(false);
    }
  }

  async function onSavePhaseIds(
    userId: string,
    role: RoomMemberRole,
    next: string[],
  ) {
    if (
      simpleRoom ||
      (role !== RoomMemberRole.ROOM_MANAGER &&
        role !== RoomMemberRole.ROOM_CONTRIBUTOR)
    )
      return;
    if (next.length === 0) {
      toast.error("Minimal satu fase harus aktif.");
      return;
    }
    setPending(true);
    try {
      await upsertRoomMember(roomId, userId, role, next);
      toast.success("Akses fase diperbarui.");
      router.refresh();
    } catch (e) {
      toast.error(actionErrorMessage(e, "Gagal menyimpan akses fase."));
    } finally {
      setPending(false);
    }
  }

  async function onAddMember() {
    if (!addUserId) return;
    if (
      !simpleRoom &&
      addRole !== ROOM_PROJECT_MANAGER_ROLE &&
      addPhaseIds.length === 0
    ) {
      toast.error("Pilih minimal satu fase proses.");
      return;
    }
    setPending(true);
    try {
      await upsertRoomMember(
        roomId,
        addUserId,
        addRole,
        addRole === ROOM_PROJECT_MANAGER_ROLE
          ? undefined
          : simpleRoom
            ? allRoomPhaseIds(roomPhases)
            : addPhaseIds,
      );
      toast.success("Anggota ditambahkan.");
      setAddUserId("");
      setAddPhaseIds(allRoomPhaseIds(roomPhases));
      router.refresh();
    } catch (e) {
      toast.error(actionErrorMessage(e, "Gagal menambah anggota."));
    } finally {
      setPending(false);
    }
  }

  async function onRemoveMember(userId: string) {
    if (!confirm("Hapus pengguna ini dari ruangan?")) return;
    setPending(true);
    try {
      await removeRoomMember(roomId, userId);
      toast.success("Anggota dihapus.");
      router.refresh();
    } catch (e) {
      toast.error(actionErrorMessage(e, "Gagal menghapus anggota."));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2.5">
        <p className="text-muted-foreground text-xs leading-relaxed">
          Administrator dan kontributor memiliki pengaturan fase proses yang sama:
          centang fase mana saja yang boleh mereka akses di ruangan ini (sesuai fase
          yang dikonfigurasi di ruangan).
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="border-border bg-muted/40 text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium">
            <Users className="size-3" aria-hidden />
            <span className="text-foreground font-semibold tabular-nums">
              {members.length}
            </span>
            anggota
          </span>
          {roleCounts.map(([role, count]) => {
            const tone = roomRoleTone(role);
            return (
              <span
                key={role}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
                  tone.chip,
                )}
              >
                <span className={cn("size-1.5 rounded-full", tone.dot)} aria-hidden />
                <span className="font-semibold tabular-nums">{count}</span>
                {roomRoleLabel(role)}
              </span>
            );
          })}
        </div>
      </div>

      {members.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Belum ada anggota"
          description="Tambahkan pengguna lewat formulir di bawah agar mereka dapat membuka ruangan ini."
        />
      ) : (
        <ul className="space-y-3">
          {members.map((m) => {
            const access = roomMemberToProcessAccess(m);
            const phaseIds = memberAllowedPhaseIds(access, roomPhases);
            const tone = roomRoleTone(m.role);
            return (
              <li
                key={m.id}
                className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm"
              >
                <div className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <MemberAvatar user={m.user} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-sm font-medium text-foreground">
                          {m.user.name?.trim() || m.user.email}
                        </p>
                        <span
                          className={cn(
                            "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                            tone.chip,
                          )}
                        >
                          <span
                            className={cn("size-1.5 rounded-full", tone.dot)}
                            aria-hidden
                          />
                          {roomRoleLabel(m.role)}
                        </span>
                      </div>
                      <p className="text-muted-foreground truncate font-mono text-xs">
                        {m.user.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex w-full items-center gap-1.5 sm:w-auto">
                    <Select
                      value={m.role}
                      items={ROLE_ITEMS}
                      disabled={pending}
                      onValueChange={(v) => {
                        if (!v) return;
                        void onChangeRole(m.userId, v as RoomMemberRole, phaseIds);
                      }}
                    >
                      <SelectTrigger
                        className="h-8 w-full sm:w-[230px]"
                        aria-label={`Peran ${m.user.name ?? m.user.email}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_ITEMS.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive hover:bg-destructive/10 shrink-0"
                      disabled={pending}
                      aria-label={`Keluarkan ${m.user.name ?? m.user.email} dari ruangan`}
                      title="Keluarkan dari ruangan"
                      onClick={() => void onRemoveMember(m.userId)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>

                <div className="border-t border-border/50 bg-muted/20 px-3.5 py-3">
                  {access.role === ROOM_PROJECT_MANAGER_ROLE ? (
                    <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                      <ShieldCheck
                        className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400"
                        aria-hidden
                      />
                      Project manager ruangan — akses otomatis ke semua fase.
                    </p>
                  ) : simpleRoom ? (
                    <p className="text-muted-foreground text-xs">
                      Ruangan HQ/Team sederhana: fase proses tidak dipisah.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <PhaseSectionHeader
                        selectedCount={phaseIds.length}
                        totalCount={roomPhases.length}
                        disabled={pending}
                        onSelectAll={() =>
                          void onSavePhaseIds(
                            m.userId,
                            m.role,
                            allRoomPhaseIds(roomPhases),
                          )
                        }
                      />
                      <RoomMemberPhaseCheckboxes
                        roomPhases={roomPhases}
                        selectedIds={phaseIds}
                        disabled={pending}
                        onChange={(next) => void onSavePhaseIds(m.userId, m.role, next)}
                      />
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Tambah anggota baru */}
      <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-4">
        <div className="mb-3 flex items-center gap-2.5">
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
            aria-hidden
          >
            <UserPlus className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Tambah anggota</p>
            <p className="text-muted-foreground text-xs">
              Pilih pengguna dan perannya, lalu atur fase yang boleh diakses.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <Select
              value={addUserId || PICK_SENTINEL}
              items={addUserItems}
              disabled={pending || addableUsers.length === 0}
              onValueChange={(v) =>
                setAddUserId(!v || v === PICK_SENTINEL ? "" : v)
              }
            >
              <SelectTrigger className="w-full" aria-label="Pilih pengguna">
                <SelectValue placeholder="Pilih pengguna…" />
              </SelectTrigger>
              <SelectContent>
                {addUserItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full sm:w-[230px]">
            <Select
              value={addRole}
              items={ROLE_ITEMS}
              disabled={pending}
              onValueChange={(v) => v && setAddRole(v as RoomMemberRole)}
            >
              <SelectTrigger className="w-full" aria-label="Peran anggota baru">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            className="w-full shrink-0 sm:w-auto"
            disabled={
              pending ||
              !addUserId ||
              (!simpleRoom &&
                addRole !== ROOM_PROJECT_MANAGER_ROLE &&
                addPhaseIds.length === 0)
            }
            onClick={() => void onAddMember()}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Plus className="size-4" aria-hidden />
            )}
            Tambah
          </Button>
        </div>

        {addRole === ROOM_PROJECT_MANAGER_ROLE ? (
          <p className="text-muted-foreground mt-2.5 flex items-center gap-1.5 text-xs">
            <ShieldCheck
              className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400"
              aria-hidden
            />
            Project manager ruangan: akses otomatis ke semua fase.
          </p>
        ) : simpleRoom ? (
          <p className="text-muted-foreground mt-2.5 text-xs">
            Fase proses tidak digunakan di ruangan ini; anggota baru langsung dapat
            berkolaborasi di tugas & chat.
          </p>
        ) : (
          <div className="mt-3 space-y-2 border-t border-border/50 pt-3">
            <PhaseSectionHeader
              selectedCount={addPhaseIds.length}
              totalCount={roomPhases.length}
              disabled={pending}
              onSelectAll={() => setAddPhaseIds(allRoomPhaseIds(roomPhases))}
            />
            <RoomMemberPhaseCheckboxes
              roomPhases={roomPhases}
              selectedIds={addPhaseIds}
              disabled={pending}
              onChange={setAddPhaseIds}
            />
          </div>
        )}

        {addableUsers.length === 0 ? (
          <p className="text-muted-foreground mt-2.5 text-xs">
            Semua pengguna yang memenuhi syarat sudah menjadi anggota ruangan ini.
          </p>
        ) : null}
      </div>
    </div>
  );
}
