"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Brand } from "@prisma/client";
import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createBrand, deleteBrand, updateBrand } from "@/actions/brands";
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

type BrandRow = Brand;

export function BrandsClient({ brands }: { brands: BrandRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BrandRow | null>(null);
  const [name, setName] = useState("");
  const [logo, setLogo] = useState("");
  const [colorCode, setColorCode] = useState("");
  const [pending, setPending] = useState(false);

  function resetForm() {
    setName("");
    setLogo("");
    setColorCode("");
    setEditing(null);
  }

  function openCreate() {
    resetForm();
    setOpen(true);
  }

  function openEdit(b: BrandRow) {
    setEditing(b);
    setName(b.name);
    setLogo(b.logo ?? "");
    setColorCode(b.colorCode ?? "");
    setOpen(true);
  }

  async function onSave() {
    setPending(true);
    try {
      if (editing) {
        await updateBrand(editing.id, {
          name,
          logo: logo || null,
          colorCode: colorCode || null,
        });
        toast.success("Brand diperbarui.");
      } else {
        await createBrand({
          name,
          logo: logo || null,
          colorCode: colorCode || null,
        });
        toast.success("Brand ditambahkan.");
      }
      setOpen(false);
      resetForm();
      router.refresh();
    } catch {
      toast.error("Gagal menyimpan brand.");
    } finally {
      setPending(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Hapus brand ini? Produk terkait ikut terhapus.")) return;
    try {
      await deleteBrand(id);
      toast.success("Brand dihapus.");
      router.refresh();
    } catch {
      toast.error("Gagal menghapus brand.");
    }
  }

  const columns = useMemo<ColumnDef<BrandRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Nama",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            {row.original.colorCode ? (
              <span
                className="size-3 shrink-0 rounded-full border border-border"
                style={{ backgroundColor: row.original.colorCode }}
                title={row.original.colorCode}
              />
            ) : null}
            <span className="font-medium">{row.original.name}</span>
          </div>
        ),
      },
      {
        accessorKey: "logo",
        header: "Logo (URL)",
        cell: ({ row }) =>
          row.original.logo ? (
            <span className="text-muted-foreground max-w-[200px] truncate text-xs font-mono">
              {row.original.logo}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: "colorCode",
        header: "Tema warna",
        cell: ({ row }) =>
          row.original.colorCode ? (
            <code className="text-xs">{row.original.colorCode}</code>
          ) : (
            <span className="text-muted-foreground">—</span>
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
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap justify-end gap-2">
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Brand baru
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
              <DialogTitle>{editing ? "Edit brand" : "Brand baru"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="b-name">Nama</Label>
                <Input
                  id="b-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Archipelago Scent"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="b-logo">Logo URL</Label>
                <Input
                  id="b-logo"
                  value={logo}
                  onChange={(e) => setLogo(e.target.value)}
                  placeholder="https://…"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="b-color">Kode warna tema</Label>
                <Input
                  id="b-color"
                  value={colorCode}
                  onChange={(e) => setColorCode(e.target.value)}
                  placeholder="#0ea5e9"
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
      <DataTable columns={columns} data={brands} empty="Belum ada brand." />
    </div>
  );
}
