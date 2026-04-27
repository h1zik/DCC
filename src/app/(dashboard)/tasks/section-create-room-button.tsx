"use client";

import { useMemo, useState } from "react";
import { RoomWorkspaceSection, type Brand } from "@prisma/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createRoom } from "@/actions/rooms";
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
import { Plus } from "lucide-react";

export function SectionCreateRoomButton({
  section,
  brands,
}: {
  section: RoomWorkspaceSection;
  brands: Brand[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [brandId, setBrandId] = useState<string>("");
  const [pending, setPending] = useState(false);

  const title = useMemo(() => roomWorkspaceSectionTitle(section), [section]);

  function reset() {
    setName("");
    setBrandId("");
  }

  async function onSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setPending(true);
    try {
      await createRoom({
        name: trimmed,
        brandId: brandId || null,
        workspaceSection: section,
      });
      toast.success(`Ruangan baru ditambahkan ke ${title}.`);
      setOpen(false);
      reset();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal membuat ruangan.");
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
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="secondary"
            size="icon-sm"
            className="size-8 rounded-full bg-orange-500 text-white hover:bg-orange-400"
            aria-label={`Tambah ruangan ${title}`}
            title={`Tambah ruangan ${title}`}
          />
        }
      >
        <Plus className="size-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ruangan baru · {title}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="space-y-2">
            <Label htmlFor={`create-room-name-${section}`}>Nama ruangan</Label>
            <Input
              id={`create-room-name-${section}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Room Archipelago"
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

