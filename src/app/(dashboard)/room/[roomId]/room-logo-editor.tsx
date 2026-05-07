"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ImagePlus } from "lucide-react";
import { clearRoomLogo, uploadRoomLogo } from "@/actions/rooms";
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

export function RoomLogoEditor({
  roomId,
  logoImage,
  roomName,
}: {
  roomId: string;
  logoImage: string | null;
  roomName: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setPreview(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPreview(typeof reader.result === "string" ? reader.result : null);
    };
    reader.readAsDataURL(file);
  }

  async function onSave() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("Pilih file logo terlebih dahulu.");
      return;
    }
    setPending(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await uploadRoomLogo(roomId, fd);
      toast.success("Logo ruangan diperbarui.");
      setOpen(false);
      setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan logo.");
    } finally {
      setPending(false);
    }
  }

  async function onRemove() {
    if (!logoImage) return;
    if (!confirm("Hapus logo ruangan ini?")) return;
    setPending(true);
    try {
      await clearRoomLogo(roomId);
      toast.success("Logo ruangan dihapus.");
      setOpen(false);
      setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus logo.");
    } finally {
      setPending(false);
    }
  }

  const previewSrc = preview ?? logoImage;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setPreview(null);
      }}
    >
      <DialogTrigger
        render={
          <Button type="button" variant="secondary" size="sm">
            <ImagePlus className="size-3.5" aria-hidden />
            Edit logo
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Logo ruangan</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex items-center gap-4">
            <div className="border-border bg-muted relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border">
              {previewSrc ? (
                <Image
                  src={previewSrc}
                  alt={`Logo ${roomName}`}
                  fill
                  sizes="80px"
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <span
                  className="text-muted-foreground text-xl font-semibold"
                  aria-hidden
                >
                  {roomName.slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium leading-snug">
                Tampil di samping nama ruangan, daftar ruangan, dan navigasi.
              </p>
              <p className="text-muted-foreground text-xs">
                Gunakan gambar persegi (1:1). Format JPG/PNG/WebP/SVG.
                Rekomendasi minimal 256×256 px agar tetap tajam.
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`room-logo-${roomId}`}>Pilih gambar logo</Label>
            <Input
              id={`room-logo-${roomId}`}
              ref={fileRef}
              type="file"
              accept="image/*"
              disabled={pending}
              onChange={onPickFile}
            />
          </div>
        </div>
        <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => void onRemove()}
            disabled={pending || !logoImage}
          >
            Hapus logo
          </Button>
          <Button type="button" onClick={() => void onSave()} disabled={pending}>
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
