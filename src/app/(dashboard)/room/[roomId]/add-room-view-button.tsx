"use client";

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

export function AddRoomViewButton({ roomId }: { roomId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [selectedType, setSelectedType] = useState<RoomViewType | null>(null);
  const [title, setTitle] = useState("");

  function reset() {
    setSelectedType(null);
    setTitle("");
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
        router.push(`/room/${roomId}/view/${result.id}`);
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Gagal menambah view.",
        );
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Tambah view ruangan"
          >
            <Plus className="size-3.5" aria-hidden />
            <span className="hidden whitespace-nowrap sm:inline">
              Tambah view
            </span>
          </Button>
        }
      />
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
