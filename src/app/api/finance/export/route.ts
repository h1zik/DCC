import { NextResponse } from "next/server";
import { requireFinance } from "@/lib/auth-helpers";
import { jakartaCurrentMonthRange, utcDateOnly } from "@/lib/finance-dates";
import {
  buildFinanceExport,
  FINANCE_EXPORT_KINDS,
  type FinanceExportKind,
} from "@/lib/finance-export";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/finance/export?report=<jenis>&from=yyyy-mm-dd&to=yyyy-mm-dd[&brandId=&accountId=]
 * Unduh laporan keuangan sebagai CSV. Khusus peran Finance. Laporan posisi
 * (neraca saldo, neraca) memakai `to` sebagai tanggal cut-off.
 */
export async function GET(req: Request) {
  try {
    await requireFinance();
  } catch (err) {
    // requireFinance melempar Error biasa — tanpa ini respons jadi 500.
    const message = err instanceof Error ? err.message : "Forbidden";
    const status = message.includes("Belum masuk") ? 401 : 403;
    return new NextResponse(message, { status });
  }

  const sp = new URL(req.url).searchParams;
  const kind = sp.get("report") as FinanceExportKind | null;
  if (!kind || !FINANCE_EXPORT_KINDS.includes(kind)) {
    return new NextResponse("Jenis laporan tidak dikenal.", { status: 400 });
  }

  const current = jakartaCurrentMonthRange();
  const parse = (raw: string | null, fallback: Date) =>
    raw && DATE_RE.test(raw) && !Number.isNaN(Date.parse(raw))
      ? new Date(raw)
      : fallback;
  const from = parse(sp.get("from"), current.from);
  const to = parse(sp.get("to"), utcDateOnly(current.to));
  if (from > to) {
    return new NextResponse("Tanggal awal melewati tanggal akhir.", {
      status: 400,
    });
  }

  const file = await buildFinanceExport(kind, {
    from,
    to,
    brandId: sp.get("brandId") || null,
    accountId: sp.get("accountId") || null,
  });

  return new NextResponse(file.csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${file.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
