"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { createProductBriefFromSocialInsight } from "@/actions/research-brief";
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
  SelectValue,
} from "@/components/ui/select";

type InsightType = "pain" | "wishlist" | "viral";

const INSIGHT_ITEMS: { value: InsightType; label: string }[] = [
  { value: "pain", label: "Pain point teratas" },
  { value: "wishlist", label: "Wishlist teratas" },
  { value: "viral", label: "Konten viral" },
];

/** Dialog "Buat brief": ubah insight sosial jadi product brief di sebuah room. */
export function SocialBriefDialog({
  monitorId,
  monitorName,
  rooms,
  disabled,
}: {
  monitorId: string;
  monitorName: string;
  rooms: { id: string; name: string; brandId: string | null }[];
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [insightType, setInsightType] = useState<InsightType>("pain");
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? "");
  const [projectName, setProjectName] = useState(`Social: ${monitorName}`);

  const selectedRoom = rooms.find((r) => r.id === roomId);

  function handleBrief() {
    const brandId = selectedRoom?.brandId;
    if (!brandId) {
      toast.error("Room ini belum terhubung ke brand. Pilih room yang punya brand.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await createProductBriefFromSocialInsight({
          monitorId,
          insightType,
          roomId,
          brandId,
          projectName,
        });
        toast.success("Product brief dibuat.");
        setOpen(false);
        router.push(`/projects/${result.projectId}`);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Product brief gagal dibuat."));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline" disabled={disabled}>
            <FileText aria-hidden />
            Buat brief
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Buat product brief dari insight sosial</DialogTitle>
          <DialogDescription>
            Brief dibuat sebagai proyek baru di room yang dipilih.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="sl-brief-insight">Jenis insight</Label>
            <Select
              value={insightType}
              items={INSIGHT_ITEMS}
              onValueChange={(v) => setInsightType(v as InsightType)}
            >
              <SelectTrigger id="sl-brief-insight">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INSIGHT_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="sl-brief-room">Room</Label>
            <Select
              value={roomId}
              items={rooms.map((r) => ({ value: r.id, label: r.name }))}
              onValueChange={(v) => v && setRoomId(v)}
            >
              <SelectTrigger id="sl-brief-room">
                <SelectValue placeholder="Pilih room" />
              </SelectTrigger>
              <SelectContent>
                {rooms.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="sl-brief-project">Nama proyek</Label>
            <Input
              id="sl-brief-project"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleBrief} disabled={pending}>
            {pending ? "Membuat…" : "Buat brief"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
