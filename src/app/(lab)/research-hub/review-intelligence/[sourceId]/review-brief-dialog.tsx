"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { FileText, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { createProductBriefFromInsight } from "@/actions/research-brief";
import { actionErrorMessage } from "@/lib/action-error-message";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import type { SelectItemDef } from "@/lib/select-option-items";

export type RoomOption = {
  id: string;
  name: string;
  brandId: string | null;
  brandName: string | null;
};

function roomLabel(r: RoomOption) {
  return r.brandName ? `${r.name} (${r.brandName})` : r.name;
}

/** Dialog "Buat brief": jadikan insight review tugas di pipeline room ber-brand. */
export function ReviewBriefDialog({
  sourceId,
  productName,
  rooms,
}: {
  sourceId: string;
  productName: string;
  rooms: RoomOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [projectName, setProjectName] = useState(`Riset: ${productName}`);
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? "");

  const selectedRoom = rooms.find((r) => r.id === roomId);
  const roomItems = useMemo(
    (): SelectItemDef[] => rooms.map((r) => ({ value: r.id, label: roomLabel(r) })),
    [rooms],
  );

  function handleBrief() {
    const brandId = selectedRoom?.brandId;
    if (!projectName.trim()) {
      toast.error("Isi nama proyek dulu.");
      return;
    }
    if (!brandId) {
      toast.error("Pilih ruangan yang terhubung ke brand.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await createProductBriefFromInsight({
          sourceId,
          roomId,
          brandId,
          projectName,
        });
        toast.success("Brief dibuat di pipeline.");
        setOpen(false);
        router.push(`/room/${result.roomId}/tasks`);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Brief gagal dibuat."));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <FileText aria-hidden />
            Buat brief
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Buat product brief</DialogTitle>
          <DialogDescription>
            Keluhan, pujian, dan gap opportunity dari review ini dijadikan brief
            di pipeline ruangan terpilih.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="rb-project">Nama proyek</Label>
            <Input
              id="rb-project"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              disabled={pending}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="rb-room">Ruangan</Label>
            {rooms.length > 0 ? (
              <Select
                value={roomId}
                items={roomItems}
                onValueChange={(v) => setRoomId(v ?? "")}
              >
                <SelectTrigger id="rb-room">
                  {selectedRoom ? roomLabel(selectedRoom) : "Pilih ruangan"}
                </SelectTrigger>
                <SelectContent>
                  {rooms.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {roomLabel(r)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p id="rb-room" className="rh-meta">
                Belum ada ruangan. Buat ruangan yang terhubung ke brand dulu.
              </p>
            )}
            {selectedRoom && !selectedRoom.brandId ? (
              <p className="text-xs text-rose-700 dark:text-rose-300" aria-live="polite">
                Ruangan ini belum terhubung ke brand. Pilih ruangan lain.
              </p>
            ) : null}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Batal
          </Button>
          <Button
            onClick={handleBrief}
            disabled={pending || !selectedRoom?.brandId}
          >
            {pending ? <RefreshCw className="animate-spin" aria-hidden /> : <FileText aria-hidden />}
            {pending ? "Membuat…" : "Buat di pipeline"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
