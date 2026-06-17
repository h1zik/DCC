import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { StockLogType } from "@prisma/client";
import {
  formatSalesCategory,
  formatStockLogNote,
  parseSystemMeta,
} from "@/lib/stock-log-utils";

type PrintLog = {
  createdAt: Date;
  type: StockLogType;
  amount: number;
  salesCategory: string | null;
  note: string | null;
  product: {
    name: string;
    sku: string;
    brand: { name: string };
  };
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function printStockMutationReport(logs: PrintLog[]) {
  const w = window.open("", "_blank");
  if (!w) return false;
  const title = "Laporan riwayat mutasi stok";
  const generated = format(new Date(), "d MMMM yyyy, HH:mm", { locale: idLocale });
  const rows = logs
    .map(
      (log) => `<tr>
  <td>${escapeHtml(format(log.createdAt, "dd/MM/yyyy HH:mm", { locale: idLocale }))}</td>
  <td>${escapeHtml(log.product.brand.name)}</td>
  <td>${escapeHtml(log.product.name)}</td>
  <td>${escapeHtml(log.product.sku)}</td>
  <td>${log.type === StockLogType.IN ? "Masuk" : "Keluar"}</td>
  <td style="text-align:right">${log.amount}</td>
  <td>${log.type === StockLogType.OUT ? escapeHtml(formatSalesCategory(log.salesCategory)) : "—"}</td>
  <td>${escapeHtml(formatStockLogNote(log))}</td>
</tr>`,
    )
    .join("");

  w.document.write(`<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title>
<style>body{font-family:system-ui,sans-serif;padding:20px;color:#111}h1{font-size:20px;margin:0 0 6px}.meta{color:#444;font-size:12px;margin:0 0 18px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #bbb;padding:7px 9px}th{background:#eee;text-align:left}</style>
</head><body><h1>${escapeHtml(title)}</h1><p class="meta">DCC · ${escapeHtml(generated)} · ${logs.length} baris</p>
<table><thead><tr><th>Waktu</th><th>Brand</th><th>Produk</th><th>SKU</th><th>Tipe</th><th>Qty</th><th>Kategori</th><th>Catatan</th></tr></thead>
<tbody>${rows || `<tr><td colspan="8">Tidak ada data.</td></tr>`}</tbody></table></body></html>`);
  w.document.close();
  setTimeout(() => {
    w.focus();
    w.print();
  }, 200);
  return true;
}

export function printStockCorrectionReport(
  logs: Array<PrintLog & { note: string | null }>,
) {
  const w = window.open("", "_blank");
  if (!w) return false;
  const title = "Laporan log koreksi & void stok";
  const generated = format(new Date(), "d MMMM yyyy, HH:mm", { locale: idLocale });
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

  w.document.write(`<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title>
<style>body{font-family:system-ui,sans-serif;padding:20px}h1{font-size:20px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #bbb;padding:7px 9px}th{background:#eee}</style>
</head><body><h1>${escapeHtml(title)}</h1><p>DCC · ${escapeHtml(generated)} · ${logs.length} baris</p>
<table><thead><tr><th>Waktu</th><th>Aksi</th><th>Brand</th><th>Produk</th><th>Ref</th><th>Alasan</th></tr></thead>
<tbody>${rows || `<tr><td colspan="6">Tidak ada data.</td></tr>`}</tbody></table></body></html>`);
  w.document.close();
  setTimeout(() => {
    w.focus();
    w.print();
  }, 200);
  return true;
}
