"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";
import { sendConceptToRdTask } from "@/actions/research-concept-lab";
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

/** Dialog membuat proyek/task R&D dari konsep. */
export function SendToRdDialog({
  open,
  onOpenChange,
  conceptId,
  conceptTitle,
  rooms,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conceptId: string;
  conceptTitle: string;
  rooms: { id: string; name: string; brandId: string | null }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? "");
  const [projectName, setProjectName] = useState(`R&D: ${conceptTitle}`);

  const selectedRoom = rooms.find((r) => r.id === roomId);
  const roomItems = useMemo(
    (): SelectItemDef[] => rooms.map((r) => ({ value: r.id, label: r.name })),
    [rooms],
  );

  function handleRd() {
    if (!selectedRoom?.brandId) {
      toast.error("Room ini belum terhubung ke brand. Pilih room yang punya brand.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await sendConceptToRdTask({
          conceptId,
          roomId,
          brandId: selectedRoom.brandId!,
          projectName,
        });
        toast.success("Task R&D dibuat.");
        onOpenChange(false);
        router.push(`/projects/${result.projectId}`);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Task R&D gagal dibuat."));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kirim konsep ke R&D</DialogTitle>
          <DialogDescription>
            Konsep dikirim sebagai proyek baru berisi task R&D di room yang kamu pilih.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="concept-rd-room">Room</Label>
            <Select value={roomId} items={roomItems} onValueChange={(v) => v && setRoomId(v)}>
              <SelectTrigger id="concept-rd-room" />
              <SelectContent>
                {rooms.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedRoom && !selectedRoom.brandId ? (
              <p className="rh-meta">Room ini belum terhubung ke brand.</p>
            ) : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="concept-rd-project">Nama proyek</Label>
            <Input
              id="concept-rd-project"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Batal
          </Button>
          <Button onClick={handleRd} disabled={pending || !projectName.trim()}>
            {pending ? <RefreshCw className="animate-spin" aria-hidden /> : <Send aria-hidden />}
            {pending ? "Membuat…" : "Buat task R&D"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
