"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { StockLogType } from "@prisma/client";
import { toast } from "sonner";
import { createStockLog } from "@/actions/stock";
import { actionErrorMessage } from "@/lib/action-error-message";
import {
  labeledItems,
  productSelectItems,
  STOCK_LOG_TYPE_ITEMS,
  vendorSelectItems,
} from "@/lib/select-option-items";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

type MovementProduct = {
  id: string;
  name: string;
  sku: string;
  currentStock: number;
  minStock: number;
  brand: { name: string };
};

type MovementVendor = { id: string; name: string };

type SalesCategory = "penjualan" | "sampling" | "retur" | "rusak";

const OUT_CATEGORIES: { value: SalesCategory; label: string }[] = [
  { value: "penjualan", label: "Penjualan" },
  { value: "sampling", label: "Sampling" },
  { value: "retur", label: "Retur" },
  { value: "rusak", label: "Rusak / expired" },
];

/**
 * Satu-satunya form pencatatan mutasi stok — dipanggil dari CTA "Catat
 * mutasi" di hero /inventory dan toolbar tab Mutasi. Menggantikan form inline
 * yang dulu dirender dobel di dua tab.
 */
export function StockMovementSheet({
  products,
  vendors,
  trigger,
}: {
  products: MovementProduct[];
  vendors: MovementVendor[];
  /** Elemen tombol pembuka; dibungkus SheetTrigger via render prop. */
  trigger: React.ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [amount, setAmount] = useState(1);
  const [type, setType] = useState<StockLogType>(StockLogType.IN);
  const [salesCategory, setSalesCategory] = useState<SalesCategory | "">("");
  const [note, setNote] = useState("");
  const [reference, setReference] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [pending, setPending] = useState(false);

  const productSelectItemsList = useMemo(
    () => productSelectItems(products),
    [products],
  );
  const vendorSelectItemsList = useMemo(
    () => vendorSelectItems(vendors, "none", "— Tanpa vendor —"),
    [vendors],
  );
  const salesCategorySelectItems = useMemo(() => labeledItems(OUT_CATEGORIES), []);

  const selectedProduct = products.find((p) => p.id === productId);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!productId) {
      toast.error("Pilih produk.");
      return;
    }
    if (type === StockLogType.OUT && !salesCategory) {
      toast.error("Kategori stok keluar wajib dipilih.");
      return;
    }
    setPending(true);
    try {
      await createStockLog({
        productId,
        amount,
        type,
        salesCategory: type === StockLogType.OUT ? salesCategory || null : null,
        note: note || null,
        reference: reference || null,
        vendorId: type === StockLogType.IN && vendorId ? vendorId : null,
      });
      toast.success("Pergerakan stok tercatat.");
      setNote("");
      setReference("");
      setSalesCategory("");
      setVendorId("");
      setAmount(1);
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(actionErrorMessage(err, "Gagal mencatat stok."));
    } finally {
      setPending(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={trigger} />
      <SheetContent side="right" className="gap-0 overflow-x-hidden sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>Catat stok masuk / keluar</SheetTitle>
          <SheetDescription>
            Tercatat permanen di buku stok (ledger) — koreksi lewat tab Mutasi.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            <div className="space-y-2">
              <Label>Produk</Label>
              <Select
                value={productId}
                items={productSelectItemsList}
                onValueChange={(v) => v && setProductId(v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih SKU" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem
                      key={p.id}
                      value={p.id}
                      className="overflow-hidden py-1.5"
                    >
                      <span className="block min-w-0">
                        <span className="block truncate font-medium">
                          {p.name}
                        </span>
                        <span className="text-muted-foreground block truncate text-xs">
                          {p.brand.name} · {p.sku} · stok {p.currentStock}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedProduct ? (
                <p className="text-muted-foreground text-xs">
                  Stok saat ini:{" "}
                  <span className="text-foreground font-semibold">
                    {selectedProduct.currentStock}
                  </span>{" "}
                  unit · min {selectedProduct.minStock}
                </p>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipe</Label>
                <Select
                  value={type}
                  items={STOCK_LOG_TYPE_ITEMS}
                  onValueChange={(v) => v && setType(v as StockLogType)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={StockLogType.IN}>Masuk</SelectItem>
                    <SelectItem value={StockLogType.OUT}>Keluar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="movement-qty">Jumlah (unit)</Label>
                <Input
                  id="movement-qty"
                  type="number"
                  min={1}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                />
              </div>
            </div>
            {type === StockLogType.OUT ? (
              <div className="space-y-2">
                <Label>Kategori keluar</Label>
                <Select
                  value={salesCategory}
                  items={salesCategorySelectItems}
                  onValueChange={(v) => v && setSalesCategory(v as SalesCategory)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Pilih kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    {OUT_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Vendor / sumber (opsional)</Label>
                <Select
                  value={vendorId || "none"}
                  items={vendorSelectItemsList}
                  onValueChange={(v) => setVendorId(!v || v === "none" ? "" : v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Pilih vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Tanpa vendor —</SelectItem>
                    {vendors.map((v) => (
                      <SelectItem
                        key={v.id}
                        value={v.id}
                        className="overflow-hidden"
                      >
                        <span className="block min-w-0 truncate">{v.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="movement-ref">Referensi (PO / invoice)</Label>
              <Input
                id="movement-ref"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="PO-2026-001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="movement-note">Catatan</Label>
              <Textarea
                id="movement-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Channel penjualan, batch…"
              />
            </div>
          </div>
          <SheetFooter className="flex-row justify-end border-t bg-muted/30">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={
                pending ||
                products.length === 0 ||
                (type === StockLogType.OUT && !salesCategory)
              }
            >
              {pending ? "Menyimpan…" : "Simpan ke buku stok"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
