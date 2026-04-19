"use client";

import { useMemo, useState } from "react";
import type { Vendor } from "@prisma/client";
import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createVendor, deleteVendor, updateVendor } from "@/actions/vendors";
import { DataTable } from "@/components/data-table";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function VendorsClient({ vendors }: { vendors: Vendor[] }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [name, setName] = useState("");
  const [picName, setPicName] = useState("");
  const [contact, setContact] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [pending, setPending] = useState(false);

  function resetForm() {
    setEditing(null);
    setName("");
    setPicName("");
    setContact("");
    setSpecialty("");
  }

  function openCreate() {
    resetForm();
    setOpen(true);
  }

  function openEdit(v: Vendor) {
    setEditing(v);
    setName(v.name);
    setPicName(v.picName ?? "");
    setContact(v.contact ?? "");
    setSpecialty(v.specialty ?? "");
    setOpen(true);
  }

  async function onSave() {
    setPending(true);
    try {
      const payload = {
        name,
        picName: picName || null,
        contact: contact || null,
        specialty: specialty || null,
      };
      if (editing) {
        await updateVendor(editing.id, payload);
        toast.success("Vendor diperbarui.");
      } else {
        await createVendor(payload);
        toast.success("Vendor ditambahkan.");
      }
      setOpen(false);
      resetForm();
    } catch {
      toast.error("Gagal menyimpan vendor.");
    } finally {
      setPending(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Hapus vendor ini?")) return;
    try {
      await deleteVendor(id);
      toast.success("Vendor dihapus.");
    } catch {
      toast.error("Gagal menghapus vendor.");
    }
  }

  const columns = useMemo<ColumnDef<Vendor>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Nama pabrik / vendor",
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      { accessorKey: "picName", header: "PIC" },
      {
        accessorKey: "contact",
        header: "Kontak",
        cell: ({ row }) => (
          <span className="text-muted-foreground max-w-[220px] truncate text-sm">
            {row.original.contact ?? "—"}
          </span>
        ),
      },
      { accessorKey: "specialty", header: "Spesialisasi" },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon-sm" }),
                "size-8",
              )}
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openEdit(row.original)}>
                <Pencil className="size-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => onDelete(row.original.id)}
              >
                <Trash2 className="size-4" />
                Hapus
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap justify-end gap-2">
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Vendor baru
        </Button>
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) resetForm();
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit vendor" : "Vendor baru"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="v-name">Nama</Label>
                <Input
                  id="v-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="v-pic">PIC</Label>
                <Input
                  id="v-pic"
                  value={picName}
                  onChange={(e) => setPicName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="v-contact">Kontak</Label>
                <Textarea
                  id="v-contact"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="Telepon, email, alamat…"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="v-spec">Spesialisasi</Label>
                <Input
                  id="v-spec"
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  placeholder="Parfum, skincare…"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Batal
              </Button>
              <Button onClick={onSave} disabled={pending || !name.trim()}>
                Simpan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <DataTable columns={columns} data={vendors} empty="Belum ada vendor." />
    </div>
  );
}
