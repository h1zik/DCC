"use client";

import { useMemo, useState } from "react";
import { RoomWorkspaceSection, type Brand } from "@prisma/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateRoom } from "@/actions/rooms";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { roomWorkspaceSectionTitle } from "@/lib/room-workspace-section";

export function RoomEditorButton({
  roomId,
  initialName,
  initialBrandId,
  initialWorkspaceSection,
  brands,
}: {
  roomId: string;
  initialName: string;
  initialBrandId: string | null;
  initialWorkspaceSection: RoomWorkspaceSection;
  brands: Brand[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initialName);
  const [brandId, setBrandId] = useState(initialBrandId ?? "");
  const [workspaceSection, setWorkspaceSection] = useState(initialWorkspaceSection);
  const [pending, setPending] = useState(false);

  const sectionOptions = useMemo(
    () => [RoomWorkspaceSection.HQ, RoomWorkspaceSection.TEAM, RoomWorkspaceSection.ROOMS],
    [],
  );

  function reset() {
    setName(initialName);
    setBrandId(initialBrandId ?? "");
    setWorkspaceSection(initialWorkspaceSection);
  }

  async function onSave() {
    if (!name.trim()) return;
    setPending(true);
    try {
      await updateRoom(roomId, {
        name: name.trim(),
        brandId: brandId || null,
        workspaceSection,
      });
      toast.success("Ruangan diperbarui.");
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal memperbarui ruangan.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger render={<Button type="button" variant="secondary" size="sm" />}>
        Edit ruang
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit ruang</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="space-y-2">
            <Label htmlFor={`room-name-edit-${roomId}`}>Nama ruangan</Label>
            <Input
              id={`room-name-edit-${roomId}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={pending}
            />
          </div>
          <div className="space-y-2">
            <Label>Brand terkait (opsional)</Label>
            <Select
              value={brandId || "__none__"}
              onValueChange={(v) => setBrandId(!v || v === "__none__" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tanpa brand" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Tanpa brand</SelectItem>
                {brands.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Bagian menu Tugas</Label>
            <Select
              value={workspaceSection}
              onValueChange={(v) => v && setWorkspaceSection(v as RoomWorkspaceSection)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sectionOptions.map((sec) => (
                  <SelectItem key={sec} value={sec}>
                    {roomWorkspaceSectionTitle(sec)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Batal
          </Button>
          <Button type="button" onClick={() => void onSave()} disabled={pending || !name.trim()}>
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

