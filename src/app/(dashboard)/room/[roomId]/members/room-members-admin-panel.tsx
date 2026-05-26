"use client";
import { actionErrorMessage } from "@/lib/action-error-message";

import { useEffect, useMemo, useState } from "react";
import { RoomMemberRole, type User } from "@prisma/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { removeRoomMember, upsertRoomMember } from "@/actions/room-members";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import { Trash2 } from "lucide-react";

type MemberRow = {
  id: string;
  roomId: string;
  userId: string;
  role: RoomMemberRole;
  allowedRoomProcesses: import("@prisma/client").RoomTaskProcess[];
  allowedCustomProcessPhaseIds: string[];
  user: Pick<User, "id" | "name" | "email" | "role">;
};

type StudioUserRow = Pick<User, "id" | "name" | "email" | "role">;

function roomRoleLabel(role: RoomMemberRole): string {
  if (role === ROOM_PROJECT_MANAGER_ROLE) return "Project manager ruangan";
  return role === RoomMemberRole.ROOM_MANAGER ? "Administrator ruangan" : "Kontributor";
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

  useEffect(() => {
    setAddPhaseIds(allRoomPhaseIds(roomPhases));
  }, [roomPhases]);

  const addableUsers = useMemo(() => {
    const ids = new Set(members.map((m) => m.userId));
    return studioUsers.filter((u) => !ids.has(u.id));
  }, [members, studioUsers]);

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
      <div>
        <h2 className="text-base font-semibold">Kelola anggota & peran</h2>
        <p className="text-muted-foreground text-xs">
          Administrator dan kontributor memiliki pengaturan fase proses yang sama:
          centang fase mana saja yang boleh mereka akses di ruangan ini (sesuai fase
          yang dikonfigurasi di ruangan).
        </p>
      </div>

      <ul className="space-y-3">
        {members.map((m) => {
          const access = roomMemberToProcessAccess(m);
          const phaseIds = memberAllowedPhaseIds(access, roomPhases);
          return (
            <li key={m.id} className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex flex-col items-start justify-between gap-2 sm:flex-row">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{m.user.name ?? m.user.email}</p>
                  <p className="text-muted-foreground truncate text-xs">{m.user.email}</p>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                  <Select
                    value={m.role}
                    disabled={pending}
                    onValueChange={(v) => {
                      if (!v) return;
                      void onChangeRole(m.userId, v as RoomMemberRole, phaseIds);
                    }}
                  >
                    <SelectTrigger className="h-8 w-full sm:w-[240px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={RoomMemberRole.ROOM_MANAGER}>
                        {roomRoleLabel(RoomMemberRole.ROOM_MANAGER)}
                      </SelectItem>
                      <SelectItem value={RoomMemberRole.ROOM_CONTRIBUTOR}>
                        {roomRoleLabel(RoomMemberRole.ROOM_CONTRIBUTOR)}
                      </SelectItem>
                      <SelectItem value={ROOM_PROJECT_MANAGER_ROLE}>
                        {roomRoleLabel(ROOM_PROJECT_MANAGER_ROLE)}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="self-end sm:self-auto"
                    disabled={pending}
                    aria-label="Hapus anggota"
                    onClick={() => void onRemoveMember(m.userId)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>

              {access.role === ROOM_PROJECT_MANAGER_ROLE ? (
                <p className="text-muted-foreground text-xs">
                  Project manager ruangan: akses otomatis ke semua fase.
                </p>
              ) : simpleRoom ? (
                <p className="text-muted-foreground text-xs">
                  Ruangan HQ/Team sederhana: fase proses tidak dipisah.
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-muted-foreground text-xs font-medium">
                    Fase tugas yang dapat diakses
                  </p>
                  <RoomMemberPhaseCheckboxes
                    roomPhases={roomPhases}
                    selectedIds={phaseIds}
                    disabled={pending}
                    onChange={(next) => void onSavePhaseIds(m.userId, m.role, next)}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="border-border space-y-2 border-t pt-3">
        <Label>Tambah anggota</Label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <Select
              value={addUserId || "__pick__"}
              onValueChange={(v) => setAddUserId(!v || v === "__pick__" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih pengguna" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__pick__">Pilih pengguna…</SelectItem>
                {addableUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name ?? u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full sm:w-[240px]">
            <Select value={addRole} onValueChange={(v) => v && setAddRole(v as RoomMemberRole)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={RoomMemberRole.ROOM_MANAGER}>
                  {roomRoleLabel(RoomMemberRole.ROOM_MANAGER)}
                </SelectItem>
                <SelectItem value={RoomMemberRole.ROOM_CONTRIBUTOR}>
                  {roomRoleLabel(RoomMemberRole.ROOM_CONTRIBUTOR)}
                </SelectItem>
                <SelectItem value={ROOM_PROJECT_MANAGER_ROLE}>
                  {roomRoleLabel(ROOM_PROJECT_MANAGER_ROLE)}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            className="w-full sm:w-auto"
            disabled={
              pending ||
              !addUserId ||
              (!simpleRoom &&
                addRole !== ROOM_PROJECT_MANAGER_ROLE &&
                addPhaseIds.length === 0)
            }
            onClick={() => void onAddMember()}
          >
            Tambah
          </Button>
        </div>
        {addRole !== ROOM_PROJECT_MANAGER_ROLE && !simpleRoom ? (
          <div className="space-y-2">
            <Label className="text-xs">Fase tugas untuk anggota baru</Label>
            <RoomMemberPhaseCheckboxes
              roomPhases={roomPhases}
              selectedIds={addPhaseIds}
              disabled={pending}
              onChange={setAddPhaseIds}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
