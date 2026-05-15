"use client";
import { actionErrorMessage } from "@/lib/action-error-message";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Brand, Product, StockLog } from "@prisma/client";
import { StockLogType } from "@prisma/client";
import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Pencil, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createStockLog, deleteStockLog, updateStockLog } from "@/actions/stock";
import { getStockHealth } from "@/lib/stock-status";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Textarea } from "@/components/ui/textarea";
import type { SelectItemDef } from "@/lib/select-option-items";

type ProductRow = Product & { brand: Brand };
type LogRow = StockLog & { product: ProductRow };
type SystemMeta = {
  action: "REVERSAL" | "REPLACEMENT" | "VOID" | null;
  targetId: string | null;
  reason: string;
  extraNote: string;
};

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
  <td>${escapeHtml(formatLogNote(log))}</td>
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

/** Cetak laporan audit koreksi/void dalam jendela print browser. */
function printStockCorrectionReport(logs: LogRow[]) {
  const w = window.open("", "_blank");
  if (!w) {
    toast.error(
      "Pop-up diblokir. Izinkan pop-up untuk situs ini lalu coba lagi.",
    );
    return;
  }
  const title = "Laporan log koreksi & void stok";
  const generated = format(new Date(), "d MMMM yyyy, HH:mm", {
    locale: idLocale,
  });
  const rows = logs
    .map((log) => {
      const meta = parseSystemMeta(log);
      const actionLabel =
        meta.action === "REPLACEMENT"
          ? "Koreksi"
          : meta.action === "VOID"
            ? "Void"
            : "Pembalik";
      const shortRef = meta.targetId
        ? meta.targetId.length > 10
          ? `${meta.targetId.slice(0, 6)}...${meta.targetId.slice(-4)}`
          : meta.targetId
        : "-";
      const reason = [meta.reason, meta.extraNote].filter(Boolean).join(" - ") || "—";
      return `<tr>
  <td>${escapeHtml(format(log.createdAt, "dd/MM/yyyy HH:mm", { locale: idLocale }))}</td>
  <td>${escapeHtml(actionLabel)}</td>
  <td>${escapeHtml(log.product.brand.name)}</td>
  <td>${escapeHtml(log.product.name)}</td>
  <td>${escapeHtml(shortRef)}</td>
  <td>${escapeHtml(reason)}</td>
</tr>`;
    })
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
        <th>Aksi</th>
        <th>Brand</th>
        <th>Produk</th>
        <th>Ref mutasi</th>
        <th>Alasan</th>
      </tr>
    </thead>
    <tbody>${rows || `<tr><td colspan="6">Tidak ada data.</td></tr>`}</tbody>
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

function isSystemLog(log: LogRow): boolean {
  return (log.note ?? "").startsWith("[SYS]");
}

function parseSystemMeta(log: LogRow): SystemMeta {
  const raw = (log.note ?? "").trim();
  if (!raw.startsWith("[SYS]")) {
    return { action: null, targetId: null, reason: "", extraNote: "" };
  }
  if (raw.startsWith("[SYS] |")) {
    const parts = raw.split("|").map((x) => x.trim());
    const action = parts.find((p) => p.startsWith("action="))?.slice(7) ?? "";
    const targetId = parts.find((p) => p.startsWith("target="))?.slice(7) ?? "";
    const reason = parts.find((p) => p.startsWith("reason="))?.slice(7) ?? "";
    const extraNote = parts.find((p) => p.startsWith("note="))?.slice(5) ?? "";
    return {
      action:
        action === "REVERSAL" || action === "REPLACEMENT" || action === "VOID"
          ? action
          : null,
      targetId: targetId || null,
      reason,
      extraNote,
    };
  }
  const body = raw.replace(/^\[SYS\]\s*/i, "").trim();
  const m = body.match(
    /^(REVERSAL|REPLACEMENT|VOID)\s+untuk\s+(\S+)(?:\s+oleh\s+[^:]+:\s*)?([\s\S]*)$/i,
  );
  if (!m) return { action: null, targetId: null, reason: body, extraNote: "" };
  const rest = (m[3] ?? "").trim();
  const [reason, extraNote] = rest.split("|").map((x) => x.trim());
  return {
    action: m[1]!.toUpperCase() as "REVERSAL" | "REPLACEMENT" | "VOID",
    targetId: m[2]!.trim() || null,
    reason: reason ?? "",
    extraNote: extraNote ?? "",
  };
}

function formatSystemLogNote(raw: string): string {
  const parts = raw.split("|").map((x) => x.trim());
  const action = parts.find((p) => p.startsWith("action="))?.slice(7) ?? "";
  const reason = parts.find((p) => p.startsWith("reason="))?.slice(7) ?? "";
  const note = parts.find((p) => p.startsWith("note="))?.slice(5) ?? "";
  const actionLabel =
    action === "REVERSAL"
      ? "Pembalik otomatis"
      : action === "REPLACEMENT"
        ? "Koreksi data"
        : action === "VOID"
          ? "Void mutasi"
          : "Mutasi sistem";
  const detail = [reason, note].filter(Boolean).join(" - ");
  return detail ? `${actionLabel}: ${detail}` : actionLabel;
}

/** Format catatan sistem versi lama (sebelum key-value `action=|target=`). */
function formatLegacySystemLogNote(raw: string): string {
  const body = raw.replace(/^\[SYS\]\s*/i, "").trim();
  const m = body.match(
    /^(REVERSAL|REPLACEMENT|VOID)\s+untuk\s+(\S+)(?:\s+oleh\s+[^:]+:\s*)?([\s\S]*)$/i,
  );
  if (!m) {
    return body.replace(/\s+/g, " ").trim() || "Mutasi sistem";
  }
  const kind = m[1]!.toUpperCase();
  const targetId = m[2]!.trim();
  const rest = (m[3] ?? "").trim();
  const reason = rest.replace(/\s*\|\s*/g, " — ").trim();
  const shortRef =
    targetId.length > 10 ? `${targetId.slice(0, 6)}…${targetId.slice(-4)}` : targetId;
  const actionLabel =
    kind === "REVERSAL"
      ? "Pembalik otomatis"
      : kind === "REPLACEMENT"
        ? "Koreksi data"
        : kind === "VOID"
          ? "Void mutasi"
          : "Mutasi sistem";
  const detail = [reason ? `Alasan: ${reason}` : null, `Ref: ${shortRef}`]
    .filter(Boolean)
    .join(" · ");
  return `${actionLabel} · ${detail}`;
}

function formatLogNote(log: LogRow): string {
  const raw = (log.note ?? "").trim();
  if (!raw) return "—";
  if (raw.startsWith("[SYS] |")) return formatSystemLogNote(raw);
  if (raw.startsWith("[SYS]")) {
    return formatLegacySystemLogNote(raw);
  }
  return raw;
}

export function InventoryClient({
  products,
  logs,
}: {
  products: ProductRow[];
  logs: LogRow[];
}) {
  const router = useRouter();
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [amount, setAmount] = useState(1);
  const [type, setType] = useState<StockLogType>(StockLogType.IN);
  const [salesCategory, setSalesCategory] = useState<
    "" | "penjualan" | "sampling"
  >("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<LogRow | null>(null);
  const [editAmount, setEditAmount] = useState(1);
  const [editType, setEditType] = useState<StockLogType>(StockLogType.IN);
  const [editSalesCategory, setEditSalesCategory] = useState<
    "" | "penjualan" | "sampling"
  >("");
  const [editNote, setEditNote] = useState("");
  const [editReason, setEditReason] = useState("");
  const [editPending, setEditPending] = useState(false);
  const [deletePendingId, setDeletePendingId] = useState<string | null>(null);
  const [showCorrectionLogs, setShowCorrectionLogs] = useState(false);

  function openEditLog(log: LogRow) {
    if (isSystemLog(log)) {
      toast.error("Mutasi sistem tidak dapat dikoreksi ulang langsung.");
      return;
    }
    setEditingLog(log);
    setEditAmount(log.amount);
    setEditType(log.type);
    setEditSalesCategory(
      log.type === StockLogType.OUT && log.salesCategory
        ? (log.salesCategory as "penjualan" | "sampling")
        : "",
    );
    setEditNote(log.note ?? "");
    setEditReason("");
    setEditOpen(true);
  }

  async function onSaveEditLog(e: React.FormEvent) {
    e.preventDefault();
    if (!editingLog) return;
    if (editType === StockLogType.OUT && !editSalesCategory.trim()) {
      toast.error("Kategori stok keluar wajib dipilih.");
      return;
    }
    if (editReason.trim().length < 3) {
      toast.error("Alasan koreksi minimal 3 karakter.");
      return;
    }
    setEditPending(true);
    try {
      await updateStockLog({
        logId: editingLog.id,
        amount: editAmount,
        type: editType,
        salesCategory:
          editType === StockLogType.OUT &&
          (editSalesCategory === "penjualan" || editSalesCategory === "sampling")
            ? editSalesCategory
            : null,
        note: editNote || null,
        reason: editReason.trim(),
      });
      toast.success("Koreksi mutasi berhasil dicatat.");
      setEditOpen(false);
      setEditingLog(null);
      router.refresh();
    } catch (err) {
      const msg = actionErrorMessage(err, "Gagal memperbarui mutasi.");
      toast.error(msg);
    } finally {
      setEditPending(false);
    }
  }

  async function onDeleteLog(row: LogRow) {
    if (isSystemLog(row)) {
      toast.error("Mutasi sistem tidak dapat di-void langsung.");
      return;
    }
    const reason = prompt("Alasan void mutasi (minimal 3 karakter):")?.trim() ?? "";
    if (reason.length < 3) return;
    setDeletePendingId(row.id);
    try {
      await deleteStockLog({ logId: row.id, reason });
      toast.success("Mutasi di-void dengan jejak audit.");
      router.refresh();
    } catch (err) {
      const msg = actionErrorMessage(err, "Gagal mem-void mutasi.");
      toast.error(msg);
    } finally {
      setDeletePendingId(null);
    }
  }

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
        salesCategory:
          type === StockLogType.OUT
            ? salesCategory === ""
              ? null
              : salesCategory
            : null,
        note: note || null,
      });
      toast.success("Pergerakan stok tercatat.");
      setNote("");
      setSalesCategory("");
      setAmount(1);
      router.refresh();
    } catch (err) {
      const msg =
        actionErrorMessage(err, "Gagal mencatat stok.");
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

  const businessLogs = useMemo(
    () => logs.filter((l) => !isSystemLog(l)),
    [logs],
  );
  const correctionLogs = useMemo(
    () => logs.filter((l) => isSystemLog(l)),
    [logs],
  );
  const businessLogStatusById = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of correctionLogs) {
      const meta = parseSystemMeta(row);
      if (!meta.targetId || !meta.action) continue;
      const current = map.get(meta.targetId);
      const next =
        meta.action === "VOID"
          ? "Di-void"
          : meta.action === "REPLACEMENT"
            ? "Dikoreksi"
            : "Dibalik";
      if (current === "Di-void") continue;
      map.set(meta.targetId, next);
    }
    return map;
  }, [correctionLogs]);
  const replacementByTargetId = useMemo(() => {
    const map = new Map<string, LogRow>();
    for (const row of correctionLogs) {
      const meta = parseSystemMeta(row);
      if (meta.action !== "REPLACEMENT" || !meta.targetId) continue;
      const prev = map.get(meta.targetId);
      if (!prev || row.createdAt > prev.createdAt) {
        map.set(meta.targetId, row);
      }
    }
    return map;
  }, [correctionLogs]);

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
        cell: ({ row }) => {
          const effective = replacementByTargetId.get(row.original.id) ?? row.original;
          return effective.type === StockLogType.IN ? (
            <Badge className="bg-emerald-600 text-white hover:bg-emerald-600/90">
              Masuk
            </Badge>
          ) : (
            <Badge variant="secondary">Keluar</Badge>
          );
        },
      },
      {
        accessorKey: "amount",
        header: "Qty",
        cell: ({ row }) => {
          const effective = replacementByTargetId.get(row.original.id) ?? row.original;
          return <span className="tabular-nums">{effective.amount}</span>;
        },
      },
      {
        accessorKey: "note",
        header: "Catatan",
        cell: ({ row }) => (
          <div className="space-y-1">
            <span className="text-muted-foreground block max-w-[200px] truncate text-xs">
              {formatLogNote(row.original)}
            </span>
            {businessLogStatusById.get(row.original.id) ? (
              <Badge variant="outline" className="text-[10px]">
                {businessLogStatusById.get(row.original.id)}
              </Badge>
            ) : null}
          </div>
        ),
      },
      {
        id: "salesCategory",
        header: "Kategori keluar",
        cell: ({ row }) => {
          const effective = replacementByTargetId.get(row.original.id) ?? row.original;
          return (
          <span className="text-xs">
            {effective.type === StockLogType.OUT
              ? effective.salesCategory === "penjualan"
                ? "Penjualan"
                : effective.salesCategory === "sampling"
                  ? "Sampling"
                  : "—"
              : "—"}
          </span>
          );
        },
      },
      {
        id: "actions",
        header: "Aksi",
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="size-8"
              disabled={isSystemLog(row.original)}
              aria-label="Edit mutasi"
              title={isSystemLog(row.original) ? "Mutasi sistem" : "Koreksi mutasi"}
              onClick={() => openEditLog(row.original)}
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="text-destructive hover:bg-destructive/10 size-8"
              disabled={deletePendingId === row.original.id || isSystemLog(row.original)}
              aria-label="Void mutasi"
              title={isSystemLog(row.original) ? "Mutasi sistem" : "Void mutasi"}
              onClick={() => void onDeleteLog(row.original)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    [deletePendingId, businessLogStatusById, replacementByTargetId],
  );

  const correctionColumns = useMemo<ColumnDef<LogRow>[]>(
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
        id: "action",
        header: "Aksi",
        cell: ({ row }) => {
          const action = parseSystemMeta(row.original).action;
          const label =
            action === "VOID"
              ? "Void"
              : action === "REPLACEMENT"
                ? "Koreksi"
                : "Pembalik";
          return <Badge variant="secondary">{label}</Badge>;
        },
      },
      {
        id: "product",
        header: "Produk",
        cell: ({ row }) => row.original.product.name,
      },
      {
        id: "target",
        header: "Ref mutasi",
        cell: ({ row }) => {
          const targetId = parseSystemMeta(row.original).targetId ?? "-";
          const shortRef =
            targetId.length > 10
              ? `${targetId.slice(0, 6)}...${targetId.slice(-4)}`
              : targetId;
          return <span className="font-mono text-xs">{shortRef}</span>;
        },
      },
      {
        id: "reason",
        header: "Alasan",
        cell: ({ row }) => {
          const meta = parseSystemMeta(row.original);
          const parts = [meta.reason, meta.extraNote].filter(Boolean);
          return (
            <span className="text-muted-foreground max-w-[320px] text-xs">
              {parts.join(" - ") || formatLogNote(row.original)}
            </span>
          );
        },
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
            disabled={businessLogs.length === 0}
            onClick={() => printStockMutationReport(businessLogs)}
          >
            <Printer className="size-4" />
            Cetak laporan
          </Button>
        </div>
        <p className="text-muted-foreground mb-3 text-xs">
          Riwayat ini hanya menampilkan mutasi utama (IN/OUT). Koreksi dan void
          ditampilkan terpisah di tabel audit agar tidak membingungkan operasional.
        </p>
        <DataTable
          columns={logColumns}
          data={businessLogs}
          empty="Belum ada log stok."
        />
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-medium tracking-tight">Log koreksi & void</h2>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowCorrectionLogs((v) => !v)}
            >
              {showCorrectionLogs ? "Hide log" : "Show log"}
            </Button>
            {showCorrectionLogs ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={correctionLogs.length === 0}
                onClick={() => printStockCorrectionReport(correctionLogs)}
              >
                <Printer className="size-4" />
                Cetak log
              </Button>
            ) : null}
          </div>
        </div>
        {showCorrectionLogs ? (
          <>
            <p className="text-muted-foreground mb-3 text-xs">
              Jejak audit koreksi/void tersimpan sebagai entri sistem terpisah.
            </p>
            <DataTable
              columns={correctionColumns}
              data={correctionLogs}
              empty="Belum ada koreksi/void."
            />
          </>
        ) : (
          <p className="text-muted-foreground text-xs">
            Log audit disembunyikan. Klik <span className="font-medium">Show log</span> untuk melihat.
          </p>
        )}
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

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={onSaveEditLog} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Koreksi riwayat mutasi</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="edit-log-type">Tipe</Label>
                <Select
                  value={editType}
                  items={stockTypeSelectItems}
                  onValueChange={(v) => {
                    if (v) setEditType(v as StockLogType);
                  }}
                  disabled={editPending}
                >
                  <SelectTrigger id="edit-log-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={StockLogType.IN}>Masuk</SelectItem>
                    <SelectItem value={StockLogType.OUT}>Keluar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-log-qty">Jumlah unit</Label>
                <Input
                  id="edit-log-qty"
                  type="number"
                  min={1}
                  value={editAmount}
                  onChange={(e) => setEditAmount(Number(e.target.value))}
                  disabled={editPending}
                />
              </div>
            </div>
            {editType === StockLogType.OUT ? (
              <div className="space-y-2">
                <Label htmlFor="edit-log-sales-category">Kategori stok keluar</Label>
                <Select
                  value={editSalesCategory}
                  onValueChange={(v) => {
                    if (v) setEditSalesCategory(v as "penjualan" | "sampling");
                  }}
                  items={[
                    { value: "penjualan", label: "Penjualan" },
                    { value: "sampling", label: "Sampling" },
                  ]}
                  disabled={editPending}
                >
                  <SelectTrigger id="edit-log-sales-category">
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
              <Label htmlFor="edit-log-note">Catatan (opsional)</Label>
              <Textarea
                id="edit-log-note"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                rows={2}
                disabled={editPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-log-reason">Alasan koreksi</Label>
              <Textarea
                id="edit-log-reason"
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                rows={2}
                placeholder="Contoh: Salah input, harusnya stok keluar"
                disabled={editPending}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
                disabled={editPending}
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={
                  editPending ||
                  editAmount <= 0 ||
                  editReason.trim().length < 3 ||
                  (editType === StockLogType.OUT && !editSalesCategory.trim())
                }
              >
                {editPending ? "Menyimpan..." : "Simpan koreksi"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
