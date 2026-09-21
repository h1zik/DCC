"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireFinance } from "@/lib/auth-helpers";
import { renderHtmlToPdfBuffer } from "@/lib/pdf/render-html-to-pdf";
import { composeMonthlyFinanceReport } from "@/lib/finance-monthly-report/compose";
import { buildMonthlyReportHtml } from "@/lib/finance-monthly-report/html";
import { jakartaToday, monthIndex } from "@/lib/finance-monthly-report/period";

const inputSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  brandId: z.string().min(1).nullable().optional(),
});

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/**
 * Laporan Keuangan Bulanan sebagai PDF vektor (headless Chromium), dikirim
 * balik sebagai base64 — pola yang sama dengan `getSeoReportPdfBase64`.
 */
export async function getFinanceMonthlyReportPdf(input: {
  year: number;
  month: number;
  brandId?: string | null;
}): Promise<{ base64: string; fileName: string }> {
  const session = await requireFinance();
  const q = inputSchema.parse(input);

  // Bulan menurut kalender Jakarta; periode yang belum dimulai ditolak.
  if (monthIndex(q) > monthIndex(jakartaToday())) {
    throw new Error("Periode laporan belum dimulai.");
  }

  const brandId = q.brandId ?? null;
  let brandSlug = "";
  if (brandId) {
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      select: { name: true },
    });
    if (!brand) throw new Error("Brand tidak ditemukan.");
    brandSlug = slugify(brand.name);
  }

  const data = await composeMonthlyFinanceReport(
    { year: q.year, month: q.month, brandId },
    { generatedByName: session.user.name ?? null },
  );
  const buffer = await renderHtmlToPdfBuffer(buildMonthlyReportHtml(data));

  const period = `${q.year}-${String(q.month).padStart(2, "0")}`;
  return {
    base64: buffer.toString("base64"),
    fileName: `laporan-keuangan-${period}${brandSlug ? `-${brandSlug}` : ""}.pdf`,
  };
}
