"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { FileText, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { createProductBriefFromUsp } from "@/actions/research-brief";
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
import type { SelectItemDef } from "@/lib/select-option-items";

export type BriefRoom = {
  id: string;
  name: string;
  brandId: string | null;
  brandName: string | null;
};

/** Dialog membuat product brief (proyek) dari satu kandidat USP. */
export function UspBriefDialog({
  open,
  onOpenChange,
  analysisId,
  category,
  uspIndex,
  uspText,
  rooms,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  analysisId: string;
  category: string;
  uspIndex: number;
  uspText: string | null;
  rooms: BriefRoom[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? "");
  const [projectName, setProjectName] = useState(`USP: ${category}`);

  const selectedRoom = rooms.find((r) => r.id === roomId);
  const roomItems = useMemo(
    (): SelectItemDef[] => rooms.map((r) => ({ value: r.id, label: r.name })),
    [rooms],
  );

  function handleBrief() {
    if (!selectedRoom?.brandId) {
      toast.error("Room ini belum terhubung ke brand. Pilih room yang punya brand.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await createProductBriefFromUsp({
          analysisId,
          uspIndex,
          roomId,
          brandId: selectedRoom.brandId!,
          projectName,
        });
        toast.success("Product brief dibuat.");
        onOpenChange(false);
        router.push(`/projects/${result.projectId}`);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Product brief gagal dibuat."));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Buat product brief dari USP</DialogTitle>
          <DialogDescription>
            Brief dibuat sebagai proyek baru di room yang kamu pilih.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <blockquote className="border-border border-l-2 pl-3 text-sm font-medium">
            {uspText ?? "—"}
          </blockquote>
          <div className="grid gap-1.5">
            <Label htmlFor="usp-brief-room">Room</Label>
            <Select
              value={roomId}
              items={roomItems}
              onValueChange={(v) => v && setRoomId(v)}
            >
              <SelectTrigger id="usp-brief-room" />
              <SelectContent>
                {rooms.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedRoom ? (
              <p className="rh-meta">
                {selectedRoom.brandName
                  ? `Brand: ${selectedRoom.brandName}`
                  : "Room ini belum terhubung ke brand."}
              </p>
            ) : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="usp-brief-project">Nama proyek</Label>
            <Input
              id="usp-brief-project"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Batal
          </Button>
          <Button onClick={handleBrief} disabled={pending || !projectName.trim()}>
            {pending ? <RefreshCw className="animate-spin" aria-hidden /> : <FileText aria-hidden />}
            {pending ? "Membuat…" : "Buat brief"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
