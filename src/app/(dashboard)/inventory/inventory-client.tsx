"use client";

import { useMemo, useState } from "react";
import type { Brand, Product, StockLog } from "@prisma/client";
import { StockLogType } from "@prisma/client";
import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Printer } from "lucide-react";
import { toast } from "sonner";
import { createStockLog } from "@/actions/stock";
import { getStockHealth } from "@/lib/stock-status";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { SelectItemDef } from "@/lib/select-option-items";

type ProductRow = Product & { brand: Brand };
type LogRow = StockLog & { product: ProductRow };

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Buka jendela ringkas lalu dialog cetak browser (laporan mutasi). */
function printStockMutationReport(logs: LogRow[]) {
  const w = window.open("", "_blank");
  if (!w) {
    toast.error(
      "Pop-up diblokir. Izinkan pop-up untuk situs ini lalu coba lagi.",
    );
    return;
  }
  const title = "Laporan riwayat mutasi stok";
  const generated = format(new Date(), "d MMMM yyyy, HH:mm", {
    locale: idLocale,
  });
  const rows = logs
    .map(
      (log) => `<tr>
  <td>${escapeHtml(format(log.createdAt, "dd/MM/yyyy HH:mm", { locale: idLocale }))}</td>
  <td>${escapeHtml(log.product.brand.name)}</td>
  <td>${escapeHtml(log.product.name)}</td>
  <td>${escapeHtml(log.product.sku)}</td>
  <td>${log.type === StockLogType.IN ? "Masuk" : "Keluar"}</td>
  <td style="text-align:right">${log.amount}</td>
  <td>${
    log.type === StockLogType.OUT
      ? log.salesCategory === "penjualan"
        ? "Penjualan"
        : log.salesCategory === "sampling"
          ? "Sampling"
          : "—"
      : "—"
  }</td>
  <td>${escapeHtml(log.note ?? "—")}</td>
</tr>`,
    )
    .join("");

  w.document.write(`<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: system-ui, Segoe UI, sans-serif; padding: 20px; color: #111; }
  h1 { font-size: 20px; margin: 0 0 6px; }
  .meta { color: #444; font-size: 12px; margin: 0 0 18px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { border: 1px solid #bbb; padding: 7px 9px; vertical-align: top; }
  th { background: #eee; text-align: left; }
  @media print {
    body { padding: 12px; }
    @page { margin: 12mm; }
  }
</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p class="meta">Dominatus Control Center · Dicetak: ${escapeHtml(generated)} · ${logs.length} baris</p>
  <table>
    <thead>
      <tr>
        <th>Waktu</th>
        <th>Brand</th>
        <th>Produk</th>
        <th>SKU</th>
        <th>Tipe</th>
        <th>Qty</th>
        <th>Kategori jual</th>
        <th>Catatan</th>
      </tr>
    </thead>
    <tbody>${rows || `<tr><td colspan="8">Tidak ada data.</td></tr>`}</tbody>
  </table>
</body>
</html>`);
  w.document.close();
  setTimeout(() => {
    w.focus();
    w.print();
  }, 200);
}

function statusBadge(stock: number, min: number) {
  const h = getStockHealth(stock, min);
  if (h === "CRITICAL")
    return <Badge variant="destructive">Critical</Badge>;
  if (h === "LOW") return <Badge variant="secondary">Low stock</Badge>;
  return <Badge variant="outline">OK</Badge>;
}

export function InventoryClient({
  products,
  logs,
}: {
  products: ProductRow[];
  logs: LogRow[];
}) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [amount, setAmount] = useState(1);
  const [type, setType] = useState<StockLogType>(StockLogType.IN);
  const [salesCategory, setSalesCategory] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmitLog(e: React.FormEvent) {
    e.preventDefault();
    if (!productId) {
      toast.error("Pilih produk.");
      return;
    }
    setPending(true);
    try {
      await createStockLog({
        productId,
        amount,
        type,
        salesCategory: type === StockLogType.OUT ? salesCategory : null,
        note: note || null,
      });
      toast.success("Pergerakan stok tercatat.");
      setNote("");
      setSalesCategory("");
      setAmount(1);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Gagal mencatat stok.";
      toast.error(msg);
    } finally {
      setPending(false);
    }
  }

  const productSelectItems = useMemo((): SelectItemDef[] => {
    return products.map((p) => ({
      value: p.id,
      label: `${p.brand.name} — ${p.name} (${p.sku})`,
    }));
  }, [products]);
  const stockTypeSelectItems = useMemo((): SelectItemDef[] => {
    return [
      { value: StockLogType.IN, label: "Masuk" },
      { value: StockLogType.OUT, label: "Keluar" },
    ];
  }, []);

  const stockColumns = useMemo<ColumnDef<ProductRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Produk",
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
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
          statusBadge(row.original.currentStock, row.original.minStock),
      },
    ],
    [],
  );

  const logColumns = useMemo<ColumnDef<LogRow>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: "Waktu",
        cell: ({ row }) =>
          format(row.original.createdAt, "d MMM yyyy, HH:mm", {
            locale: idLocale,
          }),
      },
      {
        id: "brand",
        header: "Brand",
        cell: ({ row }) => row.original.product.brand.name,
      },
      {
        id: "product",
        header: "Produk",
        cell: ({ row }) => row.original.product.name,
      },
      {
        id: "sku",
        header: "SKU",
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.product.sku}</span>
        ),
      },
      {
        id: "type",
        header: "Tipe",
        cell: ({ row }) =>
          row.original.type === StockLogType.IN ? (
            <Badge className="bg-emerald-600 text-white hover:bg-emerald-600/90">
              Masuk
            </Badge>
          ) : (
            <Badge variant="secondary">Keluar</Badge>
          ),
      },
      {
        accessorKey: "amount",
        header: "Qty",
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.amount}</span>
        ),
      },
      {
        accessorKey: "note",
        header: "Catatan",
        cell: ({ row }) => (
          <span className="text-muted-foreground max-w-[200px] truncate text-xs">
            {row.original.note ?? "—"}
          </span>
        ),
      },
      {
        id: "salesCategory",
        header: "Kategori keluar",
        cell: ({ row }) => (
          <span className="text-xs">
            {row.original.type === StockLogType.OUT
              ? row.original.salesCategory === "penjualan"
                ? "Penjualan"
                : row.original.salesCategory === "sampling"
                  ? "Sampling"
                  : "—"
              : "—"}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="flex flex-col gap-10">
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-medium tracking-tight">Riwayat mutasi</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={logs.length === 0}
            onClick={() => printStockMutationReport(logs)}
          >
            <Printer className="size-4" />
            Cetak laporan
          </Button>
        </div>
        <p className="text-muted-foreground mb-3 text-xs">
          Laporan berisi tabel yang sama seperti di bawah (hingga 1.000 entri
          terakhir). Setelah klik, gunakan dialog cetak browser untuk PDF atau
          kertas.
        </p>
        <DataTable
          columns={logColumns}
          data={logs}
          empty="Belum ada log stok."
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Stok masuk / keluar</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmitLog} className="flex flex-col gap-4">
              <div className="space-y-2">
                <Label>Produk</Label>
                <Select
                  value={productId}
                  items={productSelectItems}
                  onValueChange={(v) => {
                    if (v) setProductId(v);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih SKU" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.brand.name} — {p.name} ({p.sku})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Tipe</Label>
                  <Select
                    value={type}
                    items={stockTypeSelectItems}
                    onValueChange={(v) => {
                      if (v) setType(v as StockLogType);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={StockLogType.IN}>Masuk</SelectItem>
                      <SelectItem value={StockLogType.OUT}>Keluar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="qty">Jumlah unit</Label>
                  <Input
                    id="qty"
                    type="number"
                    min={1}
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                  />
                </div>
              </div>
              {type === StockLogType.OUT ? (
                <div className="space-y-2">
                  <Label htmlFor="sales-category">Kategori stok keluar</Label>
                  <Select
                    value={salesCategory}
                    onValueChange={(v) => {
                      if (v) setSalesCategory(v);
                    }}
                    items={[
                      { value: "penjualan", label: "Penjualan" },
                      { value: "sampling", label: "Sampling" },
                    ]}
                  >
                    <SelectTrigger id="sales-category">
                      <SelectValue placeholder="Pilih kategori keluar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="penjualan">Penjualan</SelectItem>
                      <SelectItem value="sampling">Sampling</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="note">Catatan (opsional)</Label>
                <Textarea
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="Referensi PO, channel penjualan…"
                />
              </div>
              <Button
                type="submit"
                disabled={
                  pending ||
                  products.length === 0 ||
                  (type === StockLogType.OUT && !salesCategory.trim())
                }
              >
                Simpan ke buku stok
              </Button>
            </form>
          </CardContent>
        </Card>

        <div>
          <h2 className="mb-3 text-lg font-medium tracking-tight">Daftar stok</h2>
          {products.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Belum ada produk. Tambahkan di menu Produk & SKU.
            </p>
          ) : (
            <DataTable columns={stockColumns} data={products} />
          )}
        </div>
      </section>
    </div>
  );
}
