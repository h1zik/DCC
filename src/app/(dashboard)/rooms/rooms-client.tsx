"use client";

import { useMemo, useState } from "react";
import {
  RoomMemberRole,
  RoomTaskProcess,
  RoomWorkspaceSection,
  type Brand,
  type Room,
  type User,
} from "@prisma/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createRoom, deleteRoom, updateRoom } from "@/actions/rooms";
import { removeRoomMember, upsertRoomMember } from "@/actions/room-members";
import { DataTable } from "@/components/data-table";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  ALL_ROOM_TASK_PROCESSES,
  ROOM_TASK_PROCESS_ORDER,
  roomTaskProcessLabel,
} from "@/lib/room-task-process";
import { roomWorkspaceSectionTitle } from "@/lib/room-workspace-section";
import { brandIdItems, type SelectItemDef } from "@/lib/select-option-items";
import { ROOM_PROJECT_MANAGER_ROLE } from "@/lib/room-member-process-access";
import { Checkbox } from "@/components/ui/checkbox";
import { MoreHorizontal, Pencil, Plus, Trash2, Users } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

type MemberWithUser = {
  id: string;
  userId: string;
  role: RoomMemberRole;
  allowedRoomProcesses?: RoomTaskProcess[];
  user: Pick<User, "id" | "name" | "email" | "role">;
};

type RoomRow = Room & { brand: Brand | null; members: MemberWithUser[] };

type StudioUserRow = Pick<User, "id" | "name" | "email" | "role">;

function roomRoleLabel(role: RoomMemberRole) {
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

function isSimpleCoachingRoom(r: Pick<Room, "brandId" | "workspaceSection">) {
  return (
    !r.brandId &&
    (r.workspaceSection === RoomWorkspaceSection.HQ ||
      r.workspaceSection === RoomWorkspaceSection.TEAM)
  );
}

export function RoomsClient({
  rooms,
  brands,
  studioUsers,
}: {
  rooms: RoomRow[];
  brands: Brand[];
  studioUsers: StudioUserRow[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RoomRow | null>(null);
  const [name, setName] = useState("");
  const [brandId, setBrandId] = useState<string>("");
  const [workspaceSection, setWorkspaceSection] =
    useState<RoomWorkspaceSection>(RoomWorkspaceSection.ROOMS);
  const [pending, setPending] = useState(false);

  const [membersRoom, setMembersRoom] = useState<RoomRow | null>(null);
  const [addUserId, setAddUserId] = useState("");
  const [addRole, setAddRole] = useState<RoomMemberRole>(
    RoomMemberRole.ROOM_CONTRIBUTOR,
  );
  const [addProcesses, setAddProcesses] = useState<RoomTaskProcess[]>(() => [
    ...ALL_ROOM_TASK_PROCESSES,
  ]);
  const [memberPending, setMemberPending] = useState(false);

  function reset() {
    setEditing(null);
    setName("");
    setBrandId("");
    setWorkspaceSection(RoomWorkspaceSection.ROOMS);
  }

  function openCreate() {
    reset();
    setOpen(true);
  }

  function openEdit(r: RoomRow) {
    setEditing(r);
    setName(r.name);
    setBrandId(r.brandId ?? "");
    setWorkspaceSection(r.workspaceSection);
    setOpen(true);
  }

  function openMembers(r: RoomRow) {
    setMembersRoom(r);
    setAddUserId("");
    setAddRole(RoomMemberRole.ROOM_CONTRIBUTOR);
    setAddProcesses([...ALL_ROOM_TASK_PROCESSES]);
  }

  async function onSave() {
    if (!name.trim()) return;
    setPending(true);
    try {
      const payload = {
        name: name.trim(),
        brandId: brandId || null,
        workspaceSection,
      };
      if (editing) {
        await updateRoom(editing.id, payload);
        toast.success("Ruangan diperbarui.");
      } else {
        await createRoom(payload);
        toast.success("Ruangan dibuat.");
      }
      setOpen(false);
      reset();
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gagal menyimpan.";
      toast.error(msg);
    } finally {
      setPending(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Hapus ruangan ini?")) return;
    try {
      await deleteRoom(id);
      toast.success("Ruangan dihapus.");
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gagal menghapus.";
      toast.error(msg);
    }
  }

  async function onMemberRoleChange(
    roomId: string,
    userId: string,
    role: RoomMemberRole,
    existingAllowed: RoomTaskProcess[],
  ) {
    setMemberPending(true);
    try {
      const processes =
        role === ROOM_PROJECT_MANAGER_ROLE
          ? undefined
          : existingAllowed.length > 0
            ? existingAllowed
            : [...ALL_ROOM_TASK_PROCESSES];
      await upsertRoomMember(roomId, userId, role, processes);
      toast.success("Peran diperbarui.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setMemberPending(false);
    }
  }

  async function onSaveMemberProcesses(
    roomId: string,
    userId: string,
    role: RoomMemberRole,
    next: RoomTaskProcess[],
  ) {
    if (role === ROOM_PROJECT_MANAGER_ROLE) return;
    if (next.length === 0) {
      toast.error("Minimal satu fase harus tetap aktif.");
      return;
    }
    setMemberPending(true);
    try {
      await upsertRoomMember(roomId, userId, role, next);
      toast.success("Akses fase diperbarui.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setMemberPending(false);
    }
  }

  async function onAddMember() {
    if (!membersRoom || !addUserId) return;
    const simple = isSimpleCoachingRoom(membersRoom);
    if (
      !simple &&
      addRole !== ROOM_PROJECT_MANAGER_ROLE &&
      addProcesses.length === 0
    ) {
      toast.error("Pilih minimal satu fase proses.");
      return;
    }
    setMemberPending(true);
    try {
      const processesForContributor =
        simple && addRole !== ROOM_PROJECT_MANAGER_ROLE
          ? [...ALL_ROOM_TASK_PROCESSES]
          : addProcesses;
      await upsertRoomMember(
        membersRoom.id,
        addUserId,
        addRole,
        addRole === ROOM_PROJECT_MANAGER_ROLE
          ? undefined
          : processesForContributor,
      );
      toast.success("Anggota ditambahkan.");
      setAddUserId("");
      setAddProcesses([...ALL_ROOM_TASK_PROCESSES]);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menambah.");
    } finally {
      setMemberPending(false);
    }
  }

  async function onRemoveMember(roomId: string, userId: string) {
    if (!confirm("Hapus pengguna ini dari ruangan?")) return;
    setMemberPending(true);
    try {
      await removeRoomMember(roomId, userId);
      toast.success("Anggota dihapus.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus.");
    } finally {
      setMemberPending(false);
    }
  }

  const addableUsers = useMemo(() => {
    if (!membersRoom) return studioUsers;
    const ids = new Set(membersRoom.members.map((m) => m.userId));
    return studioUsers.filter((u) => !ids.has(u.id));
  }, [membersRoom, studioUsers]);

  const roomFormBrandItems = useMemo((): SelectItemDef[] => {
    return [{ value: "__none__", label: "Tanpa brand" }, ...brandIdItems(brands)];
  }, [brands]);

  const workspaceSectionItems = useMemo((): SelectItemDef[] => {
    return [
      {
        value: RoomWorkspaceSection.HQ,
        label: roomWorkspaceSectionTitle(RoomWorkspaceSection.HQ),
      },
      {
        value: RoomWorkspaceSection.TEAM,
        label: roomWorkspaceSectionTitle(RoomWorkspaceSection.TEAM),
      },
      {
        value: RoomWorkspaceSection.ROOMS,
        label: roomWorkspaceSectionTitle(RoomWorkspaceSection.ROOMS),
      },
    ];
  }, []);

  const roomMemberRoleItems = useMemo((): SelectItemDef[] => {
    return [
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
  }, []);

  const addMemberUserItems = useMemo((): SelectItemDef[] => {
    return [
      { value: "__pick__", label: "Pilih pengguna…" },
      ...addableUsers.map((u) => ({ value: u.id, label: u.name ?? u.email })),
    ];
  }, [addableUsers]);

  const columns = useMemo<ColumnDef<RoomRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Nama ruangan",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name}</span>
        ),
      },
      {
        id: "brand",
        header: "Brand (opsional)",
        cell: ({ row }) => row.original.brand?.name ?? "—",
      },
      {
        id: "workspaceSection",
        header: "Bagian (Tugas)",
        cell: ({ row }) =>
          roomWorkspaceSectionTitle(row.original.workspaceSection),
      },
      {
        id: "members",
        header: "Anggota",
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">
            {row.original.members.length} orang
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon-sm" }),
                "size-8",
              )}
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openMembers(row.original)}>
                <Users className="size-4" />
                Anggota & peran
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openEdit(row.original)}>
                <Pencil className="size-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => onDelete(row.original.id)}
              >
                <Trash2 className="size-4" />
                Hapus
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap justify-end gap-2">
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Ruangan baru
        </Button>
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) reset();
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit ruangan" : "Ruangan baru"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="space-y-2">
                <Label htmlFor="rn">Nama</Label>
                <Input
                  id="rn"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Room Archipelago"
                />
              </div>
              <div className="space-y-2">
                <Label>Brand terkait (opsional)</Label>
                <Select
                  value={brandId || "__none__"}
                  items={roomFormBrandItems}
                  onValueChange={(v) => {
                    if (!v || v === "__none__") setBrandId("");
                    else setBrandId(v);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tanpa brand" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Tanpa brand</SelectItem>
                    {brands.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Bagian di menu Tugas</Label>
                <Select
                  value={workspaceSection}
                  items={workspaceSectionItems}
                  onValueChange={(v) => {
                    if (v) setWorkspaceSection(v as RoomWorkspaceSection);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={RoomWorkspaceSection.HQ}>
                      {roomWorkspaceSectionTitle(RoomWorkspaceSection.HQ)}
                    </SelectItem>
                    <SelectItem value={RoomWorkspaceSection.TEAM}>
                      {roomWorkspaceSectionTitle(RoomWorkspaceSection.TEAM)}
                    </SelectItem>
                    <SelectItem value={RoomWorkspaceSection.ROOMS}>
                      {roomWorkspaceSectionTitle(RoomWorkspaceSection.ROOMS)}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">
                  Mengelompokkan kartu ruangan di halaman Tugas & Kanban.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Batal
              </Button>
              <Button onClick={onSave} disabled={pending || !name.trim()}>
                Simpan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={!!membersRoom}
          onOpenChange={(v) => {
            if (!v) setMembersRoom(null);
          }}
        >
          <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Anggota ruangan
                {membersRoom ? ` — ${membersRoom.name}` : ""}
              </DialogTitle>
            </DialogHeader>
            {membersRoom ? (
              <div className="grid gap-4 py-2">
                <p className="text-muted-foreground text-sm">
                  {isSimpleCoachingRoom(membersRoom) ? (
                    <>
                      Ruangan HQ/Team tanpa brand memakai tugas sederhana (tanpa
                      tab fase proses). Tetap atur peran di sini; anggota dapat
                      mengakses tugas, chat, dan dokumen ruangan.
                    </>
                  ) : (
                    <>
                      Administrator menetapkan peran dan fase proses tugas (Market
                      Research → Produksi) yang boleh diakses manager dan
                      kontributor. Project manager ruangan melihat semua fase dan
                      dapat mengelola tugas seperti manager.
                    </>
                  )}
                </p>
                <ul className="space-y-3">
                  {membersRoom.members.map((m) => (
                    <li
                      key={m.id}
                      className="flex flex-col gap-2 rounded-md border border-border p-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {m.user.name ?? m.user.email}
                          </p>
                          <p className="text-muted-foreground truncate text-xs">
                            {m.user.email}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          <Select
                            value={m.role}
                            items={roomMemberRoleItems}
                            disabled={memberPending}
                            onValueChange={(v) => {
                              if (!v) return;
                              void onMemberRoleChange(
                                membersRoom.id,
                                m.userId,
                                v as RoomMemberRole,
                                m.allowedRoomProcesses ?? [],
                              );
                            }}
                          >
                            <SelectTrigger className="h-8 w-[200px]">
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
                            disabled={memberPending}
                            aria-label="Hapus anggota"
                            onClick={() =>
                              void onRemoveMember(membersRoom.id, m.userId)
                            }
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                      {m.role === ROOM_PROJECT_MANAGER_ROLE ? (
                        <p className="text-muted-foreground text-xs">
                          Akses tugas: semua fase proses di ruangan ini.
                        </p>
                      ) : isSimpleCoachingRoom(membersRoom) ? (
                        <p className="text-muted-foreground text-xs">
                          Ruangan sederhana: tidak ada pembagian fase di menu Tugas.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-muted-foreground text-xs font-medium">
                            Fase tugas yang dapat diakses
                          </p>
                          <div className="flex flex-wrap gap-x-3 gap-y-2">
                            {ROOM_TASK_PROCESS_ORDER.map((proc) => (
                              <label
                                key={proc}
                                className="flex cursor-pointer items-center gap-2 text-xs"
                              >
                                <Checkbox
                                  checked={(m.allowedRoomProcesses ?? []).includes(
                                    proc,
                                  )}
                                  disabled={memberPending}
                                  onCheckedChange={(c) => {
                                    const cur = m.allowedRoomProcesses ?? [];
                                    const next =
                                      c === true
                                        ? Array.from(
                                            new Set([...cur, proc]),
                                          )
                                        : cur.filter((x) => x !== proc);
                                    if (next.length === 0) {
                                      toast.error(
                                        "Minimal satu fase harus tetap aktif.",
                                      );
                                      return;
                                    }
                                    void onSaveMemberProcesses(
                                      membersRoom.id,
                                      m.userId,
                                      m.role,
                                      next,
                                    );
                                  }}
                                />
                                <span>{roomTaskProcessLabel(proc)}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
                {membersRoom.members.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    Belum ada anggota. Tambahkan pengguna di bawah agar mereka
                    dapat membuka ruangan dari menu Tugas.
                  </p>
                ) : null}
                <div className="border-border space-y-2 border-t pt-3">
                  <Label>Tambah anggota</Label>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <div className="min-w-0 flex-1 space-y-1">
                      <Select
                        value={addUserId || "__pick__"}
                        items={addMemberUserItems}
                        onValueChange={(v) => {
                          if (!v || v === "__pick__") setAddUserId("");
                          else setAddUserId(v);
                        }}
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
                    <Select
                      value={addRole}
                      items={roomMemberRoleItems}
                      onValueChange={(v) => {
                        if (v) setAddRole(v as RoomMemberRole);
                      }}
                    >
                      <SelectTrigger className="sm:w-[200px]">
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
                      disabled={
                        memberPending ||
                        !addUserId ||
                        (!isSimpleCoachingRoom(membersRoom) &&
                          addRole !== ROOM_PROJECT_MANAGER_ROLE &&
                          addProcesses.length === 0)
                      }
                      onClick={() => void onAddMember()}
                    >
                      Tambah
                    </Button>
                  </div>
                  {addRole !== ROOM_PROJECT_MANAGER_ROLE ? (
                    isSimpleCoachingRoom(membersRoom) ? (
                      <p className="text-muted-foreground text-xs">
                        Fase proses tidak digunakan di ruangan ini; anggota baru
                        langsung dapat berkolaborasi di tugas & chat.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        <Label className="text-xs">
                          Fase tugas untuk anggota baru
                        </Label>
                        <div className="flex flex-wrap gap-x-3 gap-y-2">
                          {ROOM_TASK_PROCESS_ORDER.map((proc) => (
                            <label
                              key={proc}
                              className="flex cursor-pointer items-center gap-2 text-xs"
                            >
                              <Checkbox
                                checked={addProcesses.includes(proc)}
                                disabled={memberPending}
                                onCheckedChange={(c) => {
                                  setAddProcesses((prev) => {
                                    if (c === true)
                                      return Array.from(new Set([...prev, proc]));
                                    const next = prev.filter((x) => x !== proc);
                                    if (next.length === 0) {
                                      toast.error(
                                        "Minimal satu fase harus dipilih.",
                                      );
                                      return prev;
                                    }
                                    return next;
                                  });
                                }}
                              />
                              <span>{roomTaskProcessLabel(proc)}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )
                  ) : (
                    <p className="text-muted-foreground text-xs">
                      Project manager ruangan: akses otomatis ke semua fase.
                    </p>
                  )}
                  {addableUsers.length === 0 ? (
                    <p className="text-muted-foreground text-xs">
                      Semua pengguna yang memenuhi syarat sudah ada di ruangan ini.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
            <DialogFooter>
              <Button variant="outline" onClick={() => setMembersRoom(null)}>
                Tutup
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <DataTable columns={columns} data={rooms} empty="Belum ada ruangan." />
    </div>
  );
}
