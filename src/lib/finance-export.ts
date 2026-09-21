import "server-only";

import { Prisma } from "@prisma/client";
import { queryGeneralLedger } from "@/actions/finance-ledger";
import {
  reportBalanceSheet,
  reportProfitLoss,
  reportTrialBalance,
} from "@/actions/finance-reports";
import { csvDate, toCsv, type CsvValue } from "@/lib/finance-csv";
import { utcDateOnly, utcEndOfDay } from "@/lib/finance-dates";
import { prisma } from "@/lib/prisma";

/**
 * Ekspor CSV laporan keuangan. Angka diambil dari fungsi laporan yang sama
 * dengan layar (bukan hitungan ulang), sehingga file = yang terlihat di UI.
 * Otorisasi dilakukan pemanggil (route) dan sekali lagi oleh fungsi laporan.
 */

export const FINANCE_EXPORT_KINDS = [
  "trial-balance",
  "profit-loss",
  "balance-sheet",
  "general-ledger",
  "journals",
  "ap-bills",
  "ar-invoices",
  "audit-log",
] as const;
export type FinanceExportKind = (typeof FINANCE_EXPORT_KINDS)[number];

export type FinanceExportParams = {
  from: Date;
  to: Date;
  brandId: string | null;
  accountId: string | null;
};

export type FinanceExportFile = { filename: string; csv: string };

const money = (d: Prisma.Decimal) => d.toFixed(2);
const sumPaid = (payments: { amount: Prisma.Decimal }[]) =>
  payments.reduce((s, p) => s.plus(p.amount), new Prisma.Decimal(0));
const who = (u: { name: string | null; email: string } | null) =>
  u ? u.name?.trim() || u.email : "";

export async function buildFinanceExport(
  kind: FinanceExportKind,
  p: FinanceExportParams,
): Promise<FinanceExportFile> {
  const range = `${csvDate(p.from)}_${csvDate(p.to)}`;
  const asOf = csvDate(p.to);
  const dateRange = { gte: utcDateOnly(p.from), lte: utcEndOfDay(p.to) };
  const brandWhere = p.brandId ? { brandId: p.brandId } : {};

  switch (kind) {
    case "trial-balance": {
      const tb = await reportTrialBalance({
        asOf: p.to,
        brandId: p.brandId,
        hideZero: true,
      });
      const rows: CsvValue[][] = tb.rows.map((r) => [
        r.code,
        r.name,
        r.type,
        money(r.debit),
        money(r.credit),
      ]);
      rows.push(["", "TOTAL", "", money(tb.totals.debit), money(tb.totals.credit)]);
      return {
        filename: `neraca-saldo_${asOf}.csv`,
        csv: toCsv(["Kode", "Nama akun", "Tipe", "Debit", "Kredit"], rows),
      };
    }

    case "profit-loss": {
      const pl = await reportProfitLoss({
        from: p.from,
        to: p.to,
        brandId: p.brandId,
      });
      const sorted = [...pl.rows].sort((a, b) => a.code.localeCompare(b.code));
      const rows: CsvValue[][] = sorted.map((r) => [
        r.code,
        r.name,
        r.type,
        money(r.amount),
      ]);
      rows.push(
        ["", "TOTAL PENDAPATAN", "", money(pl.revenue)],
        ["", "TOTAL BEBAN", "", money(pl.expense)],
        ["", "LABA BERSIH", "", money(pl.netIncome)],
      );
      return {
        filename: `laba-rugi_${range}.csv`,
        csv: toCsv(["Kode", "Nama akun", "Tipe", "Jumlah"], rows),
      };
    }

    case "balance-sheet": {
      const bs = await reportBalanceSheet(p.to, p.brandId);
      const section = (label: string, items: typeof bs.assets): CsvValue[][] =>
        [...items]
          .sort((a, b) => a.code.localeCompare(b.code))
          .map((r) => [label, r.code, r.name, money(r.amount)]);
      const rows: CsvValue[][] = [
        ...section("Aset", bs.assets),
        ...section("Liabilitas", bs.liabilities),
        ...section("Ekuitas", bs.equity),
        ["Ekuitas", "", "Laba ditahan & tahun berjalan (dihitung)", money(bs.retainedEarnings)],
        ["", "", "TOTAL ASET", money(bs.totalAssets)],
        ["", "", "TOTAL LIABILITAS", money(bs.totalLiabilities)],
        ["", "", "TOTAL EKUITAS", money(bs.totalEquity)],
        ["", "", "SELISIH (harus 0)", money(bs.difference)],
      ];
      return {
        filename: `neraca_${asOf}.csv`,
        csv: toCsv(["Kelompok", "Kode", "Nama akun", "Jumlah"], rows),
      };
    }

    case "general-ledger": {
      const gl = await queryGeneralLedger({
        from: p.from,
        to: p.to,
        accountId: p.accountId ?? undefined,
        brandId: p.brandId,
      });
      const rows: CsvValue[][] = [];
      const seenOpening = new Set<string>();
      for (const l of gl.lines) {
        if (!seenOpening.has(l.accountId)) {
          seenOpening.add(l.accountId);
          const opening =
            gl.openingByAccount.get(l.accountId) ?? new Prisma.Decimal(0);
          rows.push([
            l.account.code,
            l.account.name,
            csvDate(p.from),
            "",
            "SALDO AWAL",
            "",
            "",
            "",
            money(opening),
          ]);
        }
        rows.push([
          l.account.code,
          l.account.name,
          csvDate(l.entry.entryDate),
          l.entry.reference,
          l.memo ?? l.entry.memo,
          l.brand?.name,
          money(l.debitBase),
          money(l.creditBase),
          "",
        ]);
      }
      return {
        filename: `buku-besar_${range}.csv`,
        csv: toCsv(
          [
            "Kode",
            "Nama akun",
            "Tanggal",
            "Referensi",
            "Keterangan",
            "Brand",
            "Debit",
            "Kredit",
            "Saldo awal",
          ],
          rows,
        ),
      };
    }

    case "journals": {
      const lines = await prisma.financeJournalLine.findMany({
        where: { entry: { status: "POSTED", entryDate: dateRange }, ...brandWhere },
        orderBy: [
          { entry: { entryDate: "asc" } },
          { entry: { entryNumber: "asc" } },
          { id: "asc" },
        ],
        include: {
          account: { select: { code: true, name: true } },
          brand: { select: { name: true } },
          entry: {
            select: {
              entryNumber: true,
              entryDate: true,
              reference: true,
              memo: true,
              postedAt: true,
              reversesEntry: { select: { entryNumber: true } },
              createdBy: { select: { name: true, email: true } },
              postedBy: { select: { name: true, email: true } },
            },
          },
        },
      });
      return {
        filename: `jurnal_${range}.csv`,
        csv: toCsv(
          [
            "No. jurnal",
            "Tanggal",
            "Referensi",
            "Memo jurnal",
            "Kode akun",
            "Nama akun",
            "Keterangan baris",
            "Brand",
            "Debit",
            "Kredit",
            "Mata uang",
            "Nominal asing",
            "Kurs",
            "Membalik jurnal",
            "Dibuat oleh",
            "Diposting oleh",
            "Waktu posting (UTC)",
          ],
          lines.map((l) => [
            l.entry.entryNumber,
            csvDate(l.entry.entryDate),
            l.entry.reference,
            l.entry.memo,
            l.account.code,
            l.account.name,
            l.memo,
            l.brand?.name,
            money(l.debitBase),
            money(l.creditBase),
            l.currencyCode,
            l.amountForeign ? l.amountForeign.toFixed(2) : "",
            l.fxRateSnapshot ? l.fxRateSnapshot.toString() : "",
            l.entry.reversesEntry?.entryNumber,
            who(l.entry.createdBy),
            who(l.entry.postedBy),
            l.entry.postedAt?.toISOString(),
          ]),
        ),
      };
    }

    case "ap-bills": {
      const bills = await prisma.financeApBill.findMany({
        where: { billDate: dateRange, ...brandWhere },
        orderBy: [{ billDate: "asc" }, { id: "asc" }],
        include: { payments: true, brand: { select: { name: true } } },
      });
      return {
        filename: `hutang-usaha_${range}.csv`,
        csv: toCsv(
          [
            "Vendor",
            "No. tagihan",
            "Tanggal",
            "Jatuh tempo",
            "Brand",
            "Status",
            "Jumlah",
            "Terbayar",
            "Sisa",
            "Memo",
          ],
          bills.map((b) => {
            const paid = sumPaid(b.payments);
            return [
              b.vendorName,
              b.billNumber,
              csvDate(b.billDate),
              csvDate(b.dueDate),
              b.brand?.name,
              b.status,
              money(b.amount),
              money(paid),
              money(b.amount.minus(paid)),
              b.memo,
            ];
          }),
        ),
      };
    }

    case "ar-invoices": {
      const invoices = await prisma.financeArInvoice.findMany({
        where: { invoiceDate: dateRange, ...brandWhere },
        orderBy: [{ invoiceDate: "asc" }, { id: "asc" }],
        include: { payments: true, brand: { select: { name: true } } },
      });
      return {
        filename: `piutang-usaha_${range}.csv`,
        csv: toCsv(
          [
            "Pelanggan",
            "No. invoice",
            "Tanggal",
            "Jatuh tempo",
            "Brand",
            "Status",
            "Jumlah",
            "Diterima",
            "Sisa",
            "Memo",
          ],
          invoices.map((i) => {
            const paid = sumPaid(i.payments);
            return [
              i.customerName,
              i.invoiceNumber,
              csvDate(i.invoiceDate),
              csvDate(i.dueDate),
              i.brand?.name,
              i.status,
              money(i.amount),
              money(paid),
              money(i.amount.minus(paid)),
              i.memo,
            ];
          }),
        ),
      };
    }

    case "audit-log": {
      const events = await prisma.financeAuditEvent.findMany({
        where: { createdAt: dateRange },
        orderBy: { createdAt: "asc" },
        include: { actor: { select: { name: true, email: true } } },
      });
      return {
        filename: `jejak-audit_${range}.csv`,
        csv: toCsv(
          ["Waktu (UTC)", "Aksi", "Pelaku", "Objek", "Detail"],
          events.map((e) => [
            e.createdAt.toISOString(),
            e.action,
            who(e.actor),
            e.entityId,
            e.detail,
          ]),
        ),
      };
    }
  }
}
