"use client";
import { actionErrorMessage } from "@/lib/action-error-message";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { RoomViewType } from "@prisma/client";
import { toast } from "sonner";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { deleteRoomView, renameRoomView } from "@/actions/room-views";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
type Props = {
  view: {
    id: string;
    roomId: string;
    type: RoomViewType;
    title: string;
    subtitle: string | null;
  };
  canManage: boolean;
};

export function RoomViewHeader({ view, canManage }: Props) {
  const router = useRouter();
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [title, setTitle] = useState(view.title);
  const [subtitle, setSubtitle] = useState(view.subtitle ?? "");
  const [pending, startTransition] = useTransition();
  function onRename(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await renameRoomView({
          viewId: view.id,
          title,
          subtitle: subtitle.trim() || null,
        });
        toast.success("View diperbarui.");
        setRenameOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal memperbarui."));
      }
    });
  }

  function onDelete() {
    startTransition(async () => {
      try {
        await deleteRoomView(view.id);
        toast.success("View dihapus.");
        setDeleteOpen(false);
        router.push(`/room/${view.roomId}/tasks`);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menghapus."));
      }
    });
  }

  if (!canManage) return null;

  return (
    <>
      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                aria-label="Pengaturan view"
              >
                <MoreHorizontal className="size-3.5" aria-hidden />
                Atur view
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setRenameOpen(true)}>
              <Pencil className="size-3.5" aria-hidden />
              Ubah judul / deskripsi
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="size-3.5" aria-hidden />
              Hapus view
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ubah judul view</DialogTitle>
          </DialogHeader>
          <form onSubmit={onRename} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="room-view-title-edit">Judul</Label>
              <Input
                id="room-view-title-edit"
                value={title}
                maxLength={80}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="room-view-subtitle-edit">
                Deskripsi singkat (opsional)
              </Label>
              <Input
                id="room-view-subtitle-edit"
                value={subtitle}
                maxLength={160}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="Mis. catatan rapat & keputusan strategis"
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                Simpan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus view “{view.title}”?</DialogTitle>
            <DialogDescription>
              Semua data di view ini (entri, baris, halaman, dst.) akan ikut
              dihapus permanen. Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={pending}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={onDelete}
              disabled={pending}
              className="gap-1.5"
            >
              <Trash2 className="size-3.5" aria-hidden />
              Hapus permanen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
