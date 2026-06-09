"use client";
import { actionErrorMessage } from "@/lib/action-error-message";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { RoomViewType } from "@prisma/client";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { createRoomView } from "@/actions/room-views";
import {
  ROOM_VIEW_TYPE_META,
  ROOM_VIEW_TYPE_ORDER,
} from "@/lib/room-view-meta";
import { roomViewTypeIcon } from "@/lib/room-view-icon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Dialog tambah custom view ruangan. Bisa dipakai dengan trigger sendiri
 * (mis. tombol di hub ruangan) atau dikendalikan dari luar (mis. dari item
 * menu sidebar) lewat `open`/`onOpenChange`.
 */
export function AddRoomViewDialog({
  roomId,
  trigger,
  open,
  onOpenChange,
  onCreated,
}: {
  roomId: string;
  trigger?: React.ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Efek tambahan setelah view dibuat (mis. tutup drawer mobile). */
  onCreated?: (viewId: string) => void;
}) {
  const router = useRouter();
  const isControlled = open !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const actualOpen = isControlled ? open : internalOpen;
  const [pending, startTransition] = useTransition();
  const [selectedType, setSelectedType] = useState<RoomViewType | null>(null);
  const [title, setTitle] = useState("");

  function reset() {
    setSelectedType(null);
    setTitle("");
  }

  function setOpen(next: boolean) {
    if (isControlled) onOpenChange?.(next);
    else setInternalOpen(next);
    if (!next) reset();
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedType) {
      toast.error("Pilih jenis view terlebih dahulu.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await createRoomView({
          roomId,
          type: selectedType,
          title: title.trim() || undefined,
        });
        toast.success("View berhasil ditambahkan.");
        setOpen(false);
        reset();
        onCreated?.(result.id);
        router.push(`/room/${roomId}/view/${result.id}`);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menambah view."));
      }
    });
  }

  return (
    <Dialog open={actualOpen} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger render={trigger} /> : null}
      <DialogContent className="max-h-[90vh] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Tambah view baru</DialogTitle>
          <DialogDescription>
            Pilih jenis view yang ingin ditambahkan ke ruangan ini. Hanya manager
            ruangan yang dapat menambah, mengubah, atau menghapus view.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {ROOM_VIEW_TYPE_ORDER.map((type) => {
              const meta = ROOM_VIEW_TYPE_META[type];
              const Icon = roomViewTypeIcon(type);
              const active = selectedType === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setSelectedType(type);
                    if (!title.trim()) setTitle(meta.defaultTitle);
                  }}
                  aria-pressed={active}
                  className={cn(
                    "border-border bg-card flex flex-col gap-1.5 rounded-xl border p-3 text-left transition-colors",
                    "hover:border-primary/40 hover:bg-muted/60",
                    active &&
                      "border-primary/60 bg-primary/5 ring-2 ring-primary/30",
                  )}
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Icon className="text-primary size-4 shrink-0" aria-hidden />
                    {meta.label}
                  </span>
                  <span className="text-muted-foreground text-xs leading-snug">
                    {meta.description}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="room-view-title">Judul view</Label>
            <Input
              id="room-view-title"
              value={title}
              maxLength={80}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                selectedType
                  ? ROOM_VIEW_TYPE_META[selectedType].defaultTitle
                  : "Mis. Kalender produksi"
              }
              disabled={!selectedType}
            />
            <p className="text-muted-foreground text-xs">
              Anda dapat mengubah judul nanti.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={!selectedType || pending}
              className="gap-1.5"
            >
              <Plus className="size-3.5" aria-hidden />
              Tambah view
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
