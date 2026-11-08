"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { FileText, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { createProductBriefFromKeyword } from "@/actions/research-brief";
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
import type { KeywordDetailData } from "./keyword-detail-client";

function roomLabel(r: KeywordDetailData["rooms"][number]) {
  return r.brandName ? `${r.name} (${r.brandName})` : r.name;
}

/** Dialog "Buat brief": jadikan hasil analisis keyword proyek produk di room ber-brand. */
export function KeywordBriefDialog({
  queryId,
  category,
  rooms,
}: {
  queryId: string;
  category: string;
  rooms: KeywordDetailData["rooms"];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? "");
  const [projectName, setProjectName] = useState(`Keyword: ${category}`);

  const selectedRoom = rooms.find((r) => r.id === roomId);
  const roomItems = useMemo(
    (): SelectItemDef[] => rooms.map((r) => ({ value: r.id, label: roomLabel(r) })),
    [rooms],
  );

  function handleBrief() {
    const brandId = selectedRoom?.brandId;
    if (!brandId) {
      toast.error("Pilih room yang terhubung ke brand.");
      return;
    }
    if (!projectName.trim()) {
      toast.error("Isi nama proyek dulu.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await createProductBriefFromKeyword({
          queryId,
          roomId,
          brandId,
          projectName,
        });
        toast.success("Brief dibuat.");
        setOpen(false);
        router.push(`/projects/${result.projectId}`);
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
          <DialogTitle>Buat product brief dari analisis keyword</DialogTitle>
          <DialogDescription>
            Proyek baru dibuat di room terpilih dengan keyword, gap, dan saran
            naming dari analisis ini.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="kb-room">Room dan brand</Label>
            {rooms.length > 0 ? (
              <Select
                value={roomId}
                items={roomItems}
                onValueChange={(v) => setRoomId(v ?? "")}
              >
                <SelectTrigger id="kb-room">
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
            ) : (
              <p id="kb-room" className="rh-meta">
                Belum ada room yang terhubung ke brand. Hubungkan room ke brand
                dulu di pengaturan room.
              </p>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="kb-project">Nama proyek</Label>
            <Input
              id="kb-project"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              disabled={pending}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Batal
          </Button>
          <Button onClick={handleBrief} disabled={pending || rooms.length === 0}>
            {pending ? <RefreshCw className="animate-spin" aria-hidden /> : <FileText aria-hidden />}
            {pending ? "Membuat…" : "Buat brief"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
