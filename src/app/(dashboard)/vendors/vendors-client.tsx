"use client";

import { useMemo, useState } from "react";
import type { Vendor } from "@prisma/client";
import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createVendor, deleteVendor, updateVendor } from "@/actions/vendors";
import { DataTable } from "@/components/data-table";
import { LogisticsNav } from "@/components/logistics/logistics-nav";
import { Badge } from "@/components/ui/badge";
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

type VendorRow = Vendor & {
  _count: { preferredByProducts: number; stockLogs: number };
};

export function VendorsClient({ vendors }: { vendors: VendorRow[] }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [name, setName] = useState("");
  const [picName, setPicName] = useState("");
  const [contact, setContact] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [leadTimeDays, setLeadTimeDays] = useState<number | "">("");
  const [safetyStockDays, setSafetyStockDays] = useState(7);
  const [reviewPeriodDays, setReviewPeriodDays] = useState(14);
  const [pending, setPending] = useState(false);

  function resetForm() {
    setEditing(null);
    setName("");
    setPicName("");
    setContact("");
    setSpecialty("");
    setLeadTimeDays("");
    setSafetyStockDays(7);
    setReviewPeriodDays(14);
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
    setLeadTimeDays(v.leadTimeDays ?? "");
    setSafetyStockDays(v.safetyStockDays ?? 7);
    setReviewPeriodDays(v.reviewPeriodDays ?? 14);
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
        leadTimeDays: leadTimeDays === "" ? null : Number(leadTimeDays),
        safetyStockDays,
        reviewPeriodDays,
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return vendors;
    return vendors.filter((v) =>
      [v.name, v.picName, v.contact, v.specialty]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [vendors, search]);

  const columns = useMemo<ColumnDef<VendorRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Nama pabrik / vendor",
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      { accessorKey: "picName", header: "PIC", cell: ({ row }) => row.original.picName ?? "—" },
      {
        accessorKey: "contact",
        header: "Kontak",
        cell: ({ row }) => (
          <span className="text-muted-foreground max-w-[220px] truncate text-sm">
            {row.original.contact ?? "—"}
          </span>
        ),
      },
      { accessorKey: "specialty", header: "Spesialisasi", cell: ({ row }) => row.original.specialty ?? "—" },
      {
        id: "leadTime",
        header: "Lead time",
        cell: ({ row }) =>
          row.original.leadTimeDays != null ? (
            <span className="tabular-nums">{row.original.leadTimeDays} hari</span>
          ) : (
            <Badge variant="secondary">Belum diset</Badge>
          ),
      },
      {
        id: "products",
        header: "SKU terhubung",
        cell: ({ row }) => (
          <Badge variant="outline">{row.original._count.preferredByProducts}</Badge>
        ),
      },
      {
        id: "receipts",
        header: "Penerimaan",
        cell: ({ row }) => (
          <span className="text-muted-foreground tabular-nums text-sm">
            {row.original._count.stockLogs} log
          </span>
        ),
      },
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
    <div className="flex flex-col gap-6">
      <LogisticsNav />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
          <Input
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari vendor, PIC, spesialisasi…"
          />
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Vendor baru
        </Button>
      </div>

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
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="v-lead">Lead time (hari)</Label>
                  <Input
                    id="v-lead"
                    type="number"
                    min={0}
                    value={leadTimeDays}
                    onChange={(e) =>
                      setLeadTimeDays(e.target.value === "" ? "" : Number(e.target.value))
                    }
                    placeholder="14"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="v-safety">Safety buffer (hari)</Label>
                  <Input
                    id="v-safety"
                    type="number"
                    min={0}
                    value={safetyStockDays}
                    onChange={(e) => setSafetyStockDays(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="v-review">Review PO (hari)</Label>
                  <Input
                    id="v-review"
                    type="number"
                    min={1}
                    value={reviewPeriodDays}
                    onChange={(e) => setReviewPeriodDays(Number(e.target.value))}
                  />
                </div>
              </div>
              <p className="text-muted-foreground text-xs">
                Lead time dipakai untuk forecast reorder point & tanggal PO.
              </p>
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
      <DataTable
        columns={columns}
        data={filtered}
        empty="Belum ada vendor."
        sortable
        viewportMaxHeight="calc(100dvh - 300px)"
        stickyHeader
      />
    </div>
  );
}
