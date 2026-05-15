"use client";
import { actionErrorMessage } from "@/lib/action-error-message";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { clearRoomBanner, uploadRoomBanner } from "@/actions/rooms";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RoomBannerEditor({
  roomId,
  hasBanner,
}: {
  roomId: string;
  hasBanner: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSave() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("Pilih file gambar terlebih dahulu.");
      return;
    }
    setPending(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await uploadRoomBanner(roomId, fd);
      toast.success("Banner ruangan diperbarui.");
      setOpen(false);
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch (e) {
      toast.error(actionErrorMessage(e, "Gagal menyimpan banner."));
    } finally {
      setPending(false);
    }
  }

  async function onRemove() {
    if (!hasBanner) return;
    if (!confirm("Hapus banner ruangan ini?")) return;
    setPending(true);
    try {
      await clearRoomBanner(roomId);
      toast.success("Banner ruangan dihapus.");
      setOpen(false);
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch (e) {
      toast.error(actionErrorMessage(e, "Gagal menghapus banner."));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="secondary" size="sm" />}>
        Edit banner
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Banner ruangan</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor={`room-banner-${roomId}`}>Pilih gambar banner</Label>
          <Input
            id={`room-banner-${roomId}`}
            ref={fileRef}
            type="file"
            accept="image/*"
            disabled={pending}
          />
          <p className="text-muted-foreground text-xs">
            Rekomendasi ukuran banner: 1600 x 400 px (rasio 4:1), format JPG/PNG/WebP.
            Gunakan gambar horizontal agar tampilan header lebih rapi.
          </p>
        </div>
        <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => void onRemove()}
            disabled={pending || !hasBanner}
          >
            Hapus banner
          </Button>
          <Button type="button" onClick={() => void onSave()} disabled={pending}>
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
