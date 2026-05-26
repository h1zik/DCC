"use client";

import { actionErrorMessage } from "@/lib/action-error-message";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createRoomCustomProcessPhase,
  deleteRoomCustomProcessPhase,
  listRoomCustomProcessPhases,
  reorderRoomCustomProcessPhases,
  updateRoomCustomProcessPhase,
  type RoomCustomProcessPhaseDTO,
} from "@/actions/room-custom-process-phases";
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
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomId: string;
};

export function RoomCustomProcessPhasesDialog({
  open,
  onOpenChange,
  roomId,
}: Props) {
  const [phases, setPhases] = useState<RoomCustomProcessPhaseDTO[]>([]);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    void (async () => {
      try {
        const rows = await listRoomCustomProcessPhases(roomId);
        setPhases(rows);
      } catch (e) {
        toast.error(actionErrorMessage(e, "Gagal memuat fase proses."));
      }
    })();
  }, [open, roomId]);

  function refresh() {
    void listRoomCustomProcessPhases(roomId).then(setPhases);
  }

  async function saveOrder(next: RoomCustomProcessPhaseDTO[]) {
    try {
      await reorderRoomCustomProcessPhases({
        roomId,
        orderedPhaseIds: next.map((p) => p.id),
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
    if (j < 0 || j >= phases.length) return;
    const next = [...phases];
    const [row] = next.splice(index, 1);
    next.splice(j, 0, row);
    setPhases(next);
    startTransition(() => {
      void saveOrder(next);
    });
  }

  function handleCreate() {
    const name = newName.trim();
    if (!name) {
      toast.error("Nama fase wajib diisi.");
      return;
    }
    startTransition(async () => {
      try {
        await createRoomCustomProcessPhase({ roomId, name });
        setNewName("");
        refresh();
        router.refresh();
        toast.success("Fase proses baru ditambahkan.");
      } catch (e) {
        toast.error(actionErrorMessage(e, "Gagal menambahkan fase."));
      }
    });
  }

  function handleSaveEdit() {
    if (!editingId) return;
    const name = editName.trim();
    if (!name) {
      toast.error("Nama fase wajib diisi.");
      return;
    }
    startTransition(async () => {
      try {
        await updateRoomCustomProcessPhase({ phaseId: editingId, name });
        setEditingId(null);
        setEditName("");
        refresh();
        router.refresh();
        toast.success("Fase diperbarui.");
      } catch (e) {
        toast.error(actionErrorMessage(e, "Gagal menyimpan."));
      }
    });
  }

  function handleDelete(phaseId: string, name: string) {
    if (
      !window.confirm(
        `Hapus fase "${name}"? Hanya bisa dihapus jika tidak ada tugas di fase ini.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      try {
        await deleteRoomCustomProcessPhase(phaseId);
        refresh();
        router.refresh();
        toast.success("Fase dihapus.");
      } catch (e) {
        toast.error(actionErrorMessage(e, "Gagal menghapus fase."));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Kelola fase proses</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <p className="text-muted-foreground text-xs leading-relaxed">
            Urutan daftar di bawah = urutan tab fase di halaman Tasks (kiri ke
            kanan). Gunakan panah untuk mengubah urutan. Fase yang masih punya
            tugas tidak bisa dihapus.
          </p>

          <div className="space-y-2">
            <Label className="text-xs font-semibold">Daftar fase</Label>
            {phases.length === 0 ? (
              <p className="text-muted-foreground text-xs">Memuat fase…</p>
            ) : (
              <ul className="border-border max-h-64 space-y-1 overflow-y-auto rounded-lg border p-2">
                {phases.map((phase, index) => (
                  <li
                    key={phase.id}
                    className={cn(
                      "flex items-center gap-1 rounded-md px-1 py-1",
                      editingId === phase.id && "bg-muted/50",
                    )}
                  >
                    {editingId === phase.id ? (
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
                            aria-label={`Naikkan ${phase.name}`}
                            onClick={() => move(index, -1)}
                          >
                            <ArrowUp className="size-3" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            className="size-6"
                            disabled={pending || index === phases.length - 1}
                            aria-label={`Turunkan ${phase.name}`}
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
                          {phase.name}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="shrink-0"
                          aria-label={`Edit ${phase.name}`}
                          disabled={pending}
                          onClick={() => {
                            setEditingId(phase.id);
                            setEditName(phase.name);
                          }}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive shrink-0"
                          aria-label={`Hapus ${phase.name}`}
                          disabled={pending}
                          onClick={() => handleDelete(phase.id, phase.name)}
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
                placeholder="Nama fase baru…"
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
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
