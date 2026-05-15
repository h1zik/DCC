"use client";
import { actionErrorMessage } from "@/lib/action-error-message";

import { useMemo, useState } from "react";
import type { Brand, Product } from "@prisma/client";
import { PipelineStage } from "@prisma/client";
import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createProduct, deleteProduct, updateProduct } from "@/actions/products";
import { getStockHealth } from "@/lib/stock-status";
import { PIPELINE_LABELS, PIPELINE_ORDER } from "@/lib/pipeline";
import { brandIdItems, type SelectItemDef } from "@/lib/select-option-items";
import { DataTable } from "@/components/data-table";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Row = Product & { brand: Brand };

function healthBadge(stock: number, min: number) {
  const h = getStockHealth(stock, min);
  if (h === "CRITICAL")
    return <Badge variant="destructive">Critical</Badge>;
  if (h === "LOW") return <Badge variant="secondary">Low stock</Badge>;
  return <Badge variant="outline">OK</Badge>;
}

export function ProductsClient({
  products,
  brands,
}: {
  products: Row[];
  brands: Brand[];
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [brandId, setBrandId] = useState("");
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [currentStock, setCurrentStock] = useState(0);
  const [minStock, setMinStock] = useState(0);
  const [category, setCategory] = useState("");
  const [pipelineStage, setPipelineStage] = useState<PipelineStage>(
    PipelineStage.MARKET_RESEARCH,
  );
  const [pending, setPending] = useState(false);

  const brandSelectItems = useMemo(() => brandIdItems(brands), [brands]);
  const pipelineSelectItems = useMemo((): SelectItemDef[] => {
    return PIPELINE_ORDER.map((s) => ({
      value: s,
      label: PIPELINE_LABELS[s],
    }));
  }, []);

  function resetForm() {
    setEditing(null);
    setBrandId(brands[0]?.id ?? "");
    setName("");
    setSku("");
    setCurrentStock(0);
    setMinStock(0);
    setCategory("");
    setPipelineStage(PipelineStage.MARKET_RESEARCH);
  }

  function openCreate() {
    resetForm();
    setOpen(true);
  }

  function openEdit(p: Row) {
    setEditing(p);
    setBrandId(p.brandId);
    setName(p.name);
    setSku(p.sku);
    setCurrentStock(p.currentStock);
    setMinStock(p.minStock);
    setCategory(p.category ?? "");
    setPipelineStage(p.pipelineStage);
    setOpen(true);
  }

  async function onSave() {
    setPending(true);
    try {
      const payload = {
        brandId,
        name,
        sku,
        currentStock,
        minStock,
        category: category || null,
        pipelineStage,
      };
      if (editing) {
        await updateProduct(editing.id, payload);
        toast.success("Produk diperbarui.");
      } else {
        await createProduct(payload);
        toast.success("Produk ditambahkan.");
      }
      setOpen(false);
      resetForm();
    } catch (e) {
      const msg = actionErrorMessage(e, "Gagal menyimpan produk.");
      toast.error(msg);
    } finally {
      setPending(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Hapus produk ini beserta riwayat stoknya?")) return;
    try {
      await deleteProduct(id);
      toast.success("Produk dihapus.");
    } catch {
      toast.error("Gagal menghapus produk.");
    }
  }

  const columns = useMemo<ColumnDef<Row>[]>(
    () => [
      { accessorKey: "name", header: "Produk", cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
      { accessorKey: "sku", header: "SKU", cell: ({ row }) => <code className="text-xs">{row.original.sku}</code> },
      {
        id: "brand",
        header: "Brand",
        cell: ({ row }) => row.original.brand.name,
      },
      {
        id: "stock",
        header: "Stok",
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.currentStock}</span>
        ),
      },
      {
        id: "min",
        header: "Min.",
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.minStock}</span>
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) =>
          healthBadge(row.original.currentStock, row.original.minStock),
      },
      {
        id: "pipeline",
        header: "Pipeline",
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">
            {PIPELINE_LABELS[row.original.pipelineStage]}
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
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap justify-end gap-2">
        <Button onClick={openCreate} disabled={brands.length === 0}>
          <Plus className="size-4" />
          Produk baru
        </Button>
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) resetForm();
          }}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit produk" : "Produk baru"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <Label>Brand</Label>
                <Select
                  value={brandId}
                  items={brandSelectItems}
                  onValueChange={(v) => {
                    if (v) setBrandId(v);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Pilih brand" />
                  </SelectTrigger>
                  <SelectContent>
                    {brands.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-name">Nama produk</Label>
                <Input
                  id="p-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-sku">SKU</Label>
                <Input
                  id="p-sku"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  disabled={!!editing}
                  className="font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="p-stock">Stok saat ini</Label>
                  <Input
                    id="p-stock"
                    type="number"
                    min={0}
                    value={currentStock}
                    onChange={(e) => setCurrentStock(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-min">Min. stok</Label>
                  <Input
                    id="p-min"
                    type="number"
                    min={0}
                    value={minStock}
                    onChange={(e) => setMinStock(Number(e.target.value))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-cat">Kategori</Label>
                <Input
                  id="p-cat"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Parfum, skincare…"
                />
              </div>
              <div className="space-y-2">
                <Label>Tahap pipeline</Label>
                <Select
                  value={pipelineStage}
                  items={pipelineSelectItems}
                  onValueChange={(v) => {
                    if (v) setPipelineStage(v as PipelineStage);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PIPELINE_ORDER.map((s) => (
                      <SelectItem key={s} value={s}>
                        {PIPELINE_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Batal
              </Button>
              <Button
                onClick={onSave}
                disabled={
                  pending ||
                  !name.trim() ||
                  !sku.trim() ||
                  !brandId
                }
              >
                Simpan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      {brands.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Tambahkan brand terlebih dahulu sebelum membuat produk.
        </p>
      ) : (
        <DataTable columns={columns} data={products} empty="Belum ada produk." />
      )}
    </div>
  );
}
