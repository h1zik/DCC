"use client";
import { actionErrorMessage } from "@/lib/action-error-message";

import { useEffect, useState } from "react";
import { RoomTaskProcess, TaskStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  addRoomKanbanColumn,
  deleteRoomKanbanColumn,
  listUnusedKanbanStatuses,
  reorderRoomKanbanColumns,
  updateRoomKanbanColumnTitle,
} from "@/actions/room-kanban-columns";
import type { RoomKanbanColumnDTO } from "@/lib/room-kanban-columns";
import { isDefaultKanbanLinkedStatus, taskStatusLabel } from "@/lib/task-status-ui";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowDown, ArrowUp, Settings2, Trash2 } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomId: string;
  roomProcess: RoomTaskProcess;
  columns: RoomKanbanColumnDTO[];
};

export function RoomKanbanSettingsDialog({
  open,
  onOpenChange,
  roomId,
  roomProcess,
  columns: initialColumns,
}: Props) {
  const router = useRouter();
  const [columns, setColumns] = useState<RoomKanbanColumnDTO[]>(initialColumns);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [unused, setUnused] = useState<TaskStatus[]>([]);
  const [addStatus, setAddStatus] = useState<TaskStatus | "">("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setColumns(initialColumns);
    const next: Record<string, string> = {};
    for (const c of initialColumns) next[c.id] = c.title;
    setTitles(next);
  }, [open, initialColumns]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const u = await listUnusedKanbanStatuses({ roomId, roomProcess });
        if (!cancelled) {
          setUnused(u);
          setAddStatus(u[0] ?? "");
        }
      } catch {
        if (!cancelled) toast.error("Gagal memuat status tersedia.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, roomId, roomProcess, initialColumns]);

  async function saveTitle(columnId: string) {
    const title = (titles[columnId] ?? "").trim();
    if (!title) {
      toast.error("Judul kolom tidak boleh kosong.");
      return;
    }
    setBusy(true);
    try {
      await updateRoomKanbanColumnTitle({ columnId, title });
      toast.success("Judul kolom disimpan.");
      router.refresh();
    } catch (e) {
      toast.error(actionErrorMessage(e, "Gagal menyimpan."));
    } finally {
      setBusy(false);
    }
  }

  async function saveOrder(next: RoomKanbanColumnDTO[]) {
    setBusy(true);
    try {
      await reorderRoomKanbanColumns({
        roomId,
        roomProcess,
        orderedColumnIds: next.map((c) => c.id),
      });
      toast.success("Urutan kolom disimpan.");
      router.refresh();
    } catch (e) {
      toast.error(actionErrorMessage(e, "Gagal menyimpan urutan."));
    } finally {
      setBusy(false);
    }
  }

  function move(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= columns.length) return;
    const next = [...columns];
    const [row] = next.splice(index, 1);
    next.splice(j, 0, row);
    setColumns(next);
    void saveOrder(next);
  }

  async function onAddColumn() {
    if (!addStatus) return;
    setBusy(true);
    try {
      await addRoomKanbanColumn({
        roomId,
        roomProcess,
        linkedStatus: addStatus,
      });
      toast.success("Kolom ditambahkan.");
      router.refresh();
    } catch (e) {
      toast.error(actionErrorMessage(e, "Gagal menambah kolom."));
    } finally {
      setBusy(false);
    }
  }

  async function onRemoveColumn(column: RoomKanbanColumnDTO) {
    if (isDefaultKanbanLinkedStatus(column.linkedStatus)) return;
    const ok = confirm(
      `Hapus kolom "${column.title}" (${taskStatusLabel(column.linkedStatus)}) dari papan? Kolom ini bisa ditambahkan lagi nanti.`,
    );
    if (!ok) return;
    setBusy(true);
    try {
      await deleteRoomKanbanColumn({ columnId: column.id });
      toast.success("Kolom dihapus.");
      router.refresh();
    } catch (e) {
      toast.error(actionErrorMessage(e, "Gagal menghapus kolom."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="size-4" aria-hidden />
            Atur kolom Kanban
          </DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground text-sm">
          Kolom default tetap memetakan status tugas (To‑Do, Berjalan, Overdue,
          Selesai) dan tidak dapat dihapus. Anda dapat mengganti judul tampilan,
          mengurutkan kolom, menambah kolom untuk status tambahan (mis. Diblokir,
          Dalam review), serta menghapus kolom tambahan yang tidak diperlukan
          (ikon tempat sampah) selama tidak ada tugas aktif dengan status tersebut.
        </p>
        <div className="space-y-3">
          <Label>Kolom saat ini</Label>
          <ul className="space-y-2">
            {columns.map((c, i) => (
              <li
                key={c.id}
                className="flex flex-col gap-2 rounded-md border border-border p-2 sm:flex-row sm:items-end"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                    Status: {taskStatusLabel(c.linkedStatus)}
                  </p>
                  <Input
                    value={titles[c.id] ?? c.title}
                    onChange={(e) =>
                      setTitles((prev) => ({ ...prev, [c.id]: e.target.value }))
                    }
                    maxLength={80}
                  />
                </div>
                <div className="flex shrink-0 flex-wrap gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    disabled={busy || i === 0}
                    aria-label="Naikkan"
                    onClick={() => move(i, -1)}
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    disabled={busy || i === columns.length - 1}
                    aria-label="Turunkan"
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void saveTitle(c.id)}
                  >
                    Simpan judul
                  </Button>
                  {!isDefaultKanbanLinkedStatus(c.linkedStatus) ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="text-destructive hover:bg-destructive/10"
                      disabled={busy}
                      aria-label={`Hapus kolom ${c.title}`}
                      title="Hapus kolom"
                      onClick={() => void onRemoveColumn(c)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
        {unused.length > 0 ? (
          <div className="space-y-2 border-t pt-3">
            <Label>Tambah kolom untuk status</Label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Select
                value={addStatus || undefined}
                onValueChange={(v) => {
                  if (v) setAddStatus(v as TaskStatus);
                }}
              >
                <SelectTrigger className="sm:max-w-xs">
                  <SelectValue placeholder="Pilih status" />
                </SelectTrigger>
                <SelectContent>
                  {unused.map((s) => (
                    <SelectItem key={s} value={s}>
                      {taskStatusLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                disabled={busy || !addStatus}
                onClick={() => void onAddColumn()}
              >
                Tambah kolom
              </Button>
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
