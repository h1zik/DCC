"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import {
  createRoomTaskGroup,
  deleteRoomTaskGroup,
  fetchRoomTaskGroups,
  renameRoomTaskGroup,
  reorderRoomTaskGroups,
} from "@/actions/room-task-groups";
import { actionErrorMessage } from "@/lib/action-error-message";
import type { RoomTaskGroupRef } from "@/lib/room-task-group";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomId: string;
};

export function RoomTaskGroupsDialog({ open, onOpenChange, roomId }: Props) {
  const [groups, setGroups] = useState<RoomTaskGroupRef[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    void (async () => {
      try {
        setGroups(await fetchRoomTaskGroups(roomId));
      } catch (e) {
        toast.error(actionErrorMessage(e, "Gagal memuat kelompok."));
      } finally {
        setLoaded(true);
      }
    })();
  }, [open, roomId]);

  function refresh() {
    void fetchRoomTaskGroups(roomId).then(setGroups);
  }

  async function saveOrder(next: RoomTaskGroupRef[]) {
    try {
      await reorderRoomTaskGroups({
        roomId,
        orderedGroupIds: next.map((g) => g.id),
      });
      router.refresh();
    } catch (e) {
      toast.error(actionErrorMessage(e, "Gagal menyimpan urutan."));
      refresh();
    }
  }

  function move(index: number, dir: -1 | 1) {
    if (editingId) return;
    const j = index + dir;
    if (j < 0 || j >= groups.length) return;
    const next = [...groups];
    const [row] = next.splice(index, 1);
    next.splice(j, 0, row);
    setGroups(next);
    startTransition(() => {
      void saveOrder(next);
    });
  }

  function handleCreate() {
    const name = newName.trim();
    if (!name) {
      toast.error("Nama kelompok wajib diisi.");
      return;
    }
    startTransition(async () => {
      try {
        await createRoomTaskGroup({ roomId, name });
        setNewName("");
        refresh();
        router.refresh();
        toast.success("Kelompok baru ditambahkan.");
      } catch (e) {
        toast.error(actionErrorMessage(e, "Gagal menambahkan kelompok."));
      }
    });
  }

  function handleSaveEdit() {
    if (!editingId) return;
    const name = editName.trim();
    if (!name) {
      toast.error("Nama kelompok wajib diisi.");
      return;
    }
    startTransition(async () => {
      try {
        await renameRoomTaskGroup({ groupId: editingId, name });
        setEditingId(null);
        setEditName("");
        refresh();
        router.refresh();
        toast.success("Kelompok diperbarui.");
      } catch (e) {
        toast.error(actionErrorMessage(e, "Gagal menyimpan."));
      }
    });
  }

  function handleDelete(groupId: string, name: string) {
    if (
      !window.confirm(
        `Hapus kelompok "${name}"? Tugas di dalamnya tidak ikut terhapus — semuanya kembali ke tab "Umum".`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      try {
        const moved = await deleteRoomTaskGroup(groupId);
        refresh();
        router.refresh();
        toast.success(
          moved > 0
            ? `Kelompok dihapus. ${moved} tugas dikembalikan ke "Umum".`
            : "Kelompok dihapus.",
        );
      } catch (e) {
        toast.error(actionErrorMessage(e, "Gagal menghapus kelompok."));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Kelola kelompok tugas</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <p className="text-muted-foreground text-xs leading-relaxed">
            Kelompok memisahkan tugas per urusan (mis. Rekrutmen, Acara kantor).
            Urutan daftar di bawah = urutan tab di halaman Tasks, setelah tab
            &ldquo;Umum&rdquo;. Semua kelompok memakai kolom papan yang sama,
            jadi tampilan List, Linimasa, dan Kalender tetap bisa menggabungkan
            seluruh tugas ruangan.
          </p>

          <div className="space-y-2">
            <Label className="text-xs font-semibold">Daftar kelompok</Label>
            {!loaded ? (
              <p className="text-muted-foreground text-xs">Memuat kelompok…</p>
            ) : groups.length === 0 ? (
              <p className="text-muted-foreground rounded-lg border border-dashed px-3 py-3 text-xs">
                Belum ada kelompok. Selama belum ada, papan tugas ruangan tampil
                seperti biasa tanpa tab.
              </p>
            ) : (
              <ul className="border-border max-h-64 space-y-1 overflow-y-auto rounded-lg border p-2">
                {groups.map((group, index) => (
                  <li
                    key={group.id}
                    className={cn(
                      "flex items-center gap-1 rounded-md px-1 py-1",
                      editingId === group.id && "bg-muted/50",
                    )}
                  >
                    {editingId === group.id ? (
                      <>
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-8 min-w-0 flex-1 text-sm"
                          disabled={pending}
                        />
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 shrink-0"
                          disabled={pending}
                          onClick={handleSaveEdit}
                        >
                          Simpan
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 shrink-0"
                          disabled={pending}
                          onClick={() => {
                            setEditingId(null);
                            setEditName("");
                          }}
                        >
                          Batal
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="flex shrink-0 flex-col gap-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            className="size-6"
                            disabled={pending || index === 0}
                            aria-label={`Naikkan ${group.name}`}
                            onClick={() => move(index, -1)}
                          >
                            <ArrowUp className="size-3" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            className="size-6"
                            disabled={pending || index === groups.length - 1}
                            aria-label={`Turunkan ${group.name}`}
                            onClick={() => move(index, 1)}
                          >
                            <ArrowDown className="size-3" />
                          </Button>
                        </div>
                        <span
                          className="text-muted-foreground w-5 shrink-0 text-center text-[10px] tabular-nums"
                          aria-hidden
                        >
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-medium">
                          {group.name}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="shrink-0"
                          aria-label={`Edit ${group.name}`}
                          disabled={pending}
                          onClick={() => {
                            setEditingId(group.id);
                            setEditName(group.name);
                          }}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive shrink-0"
                          aria-label={`Hapus ${group.name}`}
                          disabled={pending}
                          onClick={() => handleDelete(group.id, group.name)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nama kelompok baru…"
                className="h-9 flex-1 text-sm"
                disabled={pending}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCreate();
                  }
                }}
              />
              <Button
                type="button"
                size="sm"
                className="h-9 shrink-0 gap-1"
                disabled={pending}
                onClick={handleCreate}
              >
                <Plus className="size-3.5" />
                Tambah
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
