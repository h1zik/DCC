"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { createProductBriefFromTrend } from "@/actions/research-brief";
import { actionErrorMessage } from "@/lib/action-error-message";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
} from "@/components/ui/select";

type Room = { id: string; name: string; brandId: string | null; brandName: string | null };

function roomLabel(r: Room) {
  return r.brandName ? `${r.name} (${r.brandName})` : r.name;
}

/** Dialog "Jadikan ide produk": buat product brief dari satu tren. */
export function TrendBriefDialog({
  open,
  onOpenChange,
  item,
  canExplore,
  rooms,
  roomId,
  onRoomChange,
  projectName,
  onProjectNameChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: { id: string; name: string } | undefined;
  canExplore: boolean;
  rooms: Room[];
  roomId: string;
  onRoomChange: (id: string) => void;
  projectName: string;
  onProjectNameChange: (v: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const selectedRoom = rooms.find((r) => r.id === roomId);

  function handleBrief() {
    const brandId = selectedRoom?.brandId;
    if (!brandId) {
      toast.error("Room ini belum terhubung ke brand. Pilih room yang punya brand.");
      return;
    }
    if (!item) return;
    startTransition(async () => {
      try {
        const result = await createProductBriefFromTrend({
          trendItemId: item.id,
          roomId,
          brandId,
          projectName: projectName || `Trend: ${item.name}`,
        });
        toast.success("Product brief dibuat.");
        onOpenChange(false);
        window.location.href = `/projects/${result.projectId}`;
      } catch (err) {
        toast.error(actionErrorMessage(err, "Product brief gagal dibuat."));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Jadikan ide produk</DialogTitle>
          <DialogDescription>
            Tren <strong className="text-foreground">{item?.name}</strong> dibuat
            menjadi product brief di room yang dipilih.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="trend-brief-room">Room dan brand</Label>
            <Select
              value={roomId}
              items={rooms.map((r) => ({ value: r.id, label: roomLabel(r) }))}
              onValueChange={(v) => onRoomChange(v ?? "")}
            >
              <SelectTrigger id="trend-brief-room">
                {selectedRoom ? roomLabel(selectedRoom) : "Pilih room"}
              </SelectTrigger>
              <SelectContent>
                {rooms.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {roomLabel(r)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="trend-brief-project">Nama proyek</Label>
            <Input
              id="trend-brief-project"
              value={projectName}
              onChange={(e) => onProjectNameChange(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleBrief} disabled={pending || !canExplore}>
            {pending ? "Membuat…" : "Buat brief"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
