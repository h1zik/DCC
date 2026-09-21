import { describe, expect, it } from "vitest";
import { buildMonthlyReportHtml } from "./html";
import { makeReportData } from "./test-fixtures";

describe("buildMonthlyReportHtml", () => {
  it("memuat semua bagian laporan, tanpa skrip/aset eksternal/nilai rusak", () => {
    const html = buildMonthlyReportHtml(makeReportData());
    for (const heading of [
      "Ringkasan Eksekutif",
      "Laporan Laba Rugi",
      "Neraca (Laporan Posisi Keuangan)",
      "Laporan Arus Kas",
      "Laba Rugi per Brand",
      "Anggaran vs Realisasi",
      "Umur Piutang &amp; Hutang",
      "Rekap Pajak",
      "Status Periode &amp; Catatan",
      "Lembar Pengesahan",
      "Lampiran — Neraca Saldo",
    ]) {
      expect(html).toContain(heading);
    }
    // Renderer mematikan JS & container bisa tanpa egress: tak boleh ada
    // skrip maupun aset jaringan (namespace SVG w3.org bukan fetch).
    expect(html).not.toMatch(/<script|<link|https?:\/\/(?!www\.w3\.org)/i);
    expect(html).not.toMatch(/NaN|undefined|Infinity|\[object/);
    expect(html).toContain('counter(page) " dari " counter(pages)');
  });

  it("status FINAL vs DRAFT mengikuti kunci periode", () => {
    const base = makeReportData();
    const final = buildMonthlyReportHtml(base);
    expect(final).toContain("badge-final");
    expect(final).not.toContain("DRAFT — periode belum dikunci");

    const draft = buildMonthlyReportHtml(
      makeReportData({ meta: { ...base.meta, lock: null } }),
    );
    expect(draft).toContain("badge-draft");
    expect(draft).toContain("DRAFT — periode belum dikunci");
  });

  it("filter brand: tanpa bagian per-brand, dengan keterangan cakupan", () => {
    const base = makeReportData();
    const html = buildMonthlyReportHtml(
      makeReportData({
        meta: { ...base.meta, brand: { id: "b1", name: "Aurora Skin" } },
      }),
    );
    expect(html).not.toContain("Laba Rugi per Brand");
    expect(html).toContain("Brand: Aurora Skin");
    expect(html).toContain("Tampilan segmen brand");
    expect(html).toContain("anggaran tidak mengikuti filter brand");
    // Penomoran bagian tetap berurutan setelah satu bagian dilewati.
    expect(html).toMatch(
      /<span class="sec-no">5<\/span>\s*<h2>Anggaran vs Realisasi<\/h2>/,
    );
  });

  it("nama dari DB di-escape di HTML maupun footer CSS", () => {
    const base = makeReportData();
    const evil = '</style><script>alert(1)</script> "A&B"';
    const html = buildMonthlyReportHtml(
      makeReportData({
        meta: {
          ...base.meta,
          brand: { id: "b1", name: evil },
          generatedByName: evil,
        },
        profitLoss: {
          ...base.profitLoss,
          rows: [
            {
              code: "4000",
              name: evil,
              type: "REVENUE",
              current: "1",
              previous: "0",
            },
          ],
        },
      }),
    );
    expect(html).not.toContain("<script>");
    expect(html.match(/<\/style>/g)).toHaveLength(1);
    expect(html).toContain("&lt;script&gt;");
  });

  it("neraca tidak seimbang memunculkan callout", () => {
    const base = makeReportData();
    const html = buildMonthlyReportHtml(
      makeReportData({
        balanceSheet: {
          ...base.balanceSheet,
          current: {
            ...base.balanceSheet.current,
            isBalanced: false,
            difference: "2500",
          },
        },
      }),
    );
    expect(html).toContain("Neraca tidak seimbang.");
    expect(html).toContain("Rp 2.500");
  });

  it("bulan kosong tetap ter-render", () => {
    const base = makeReportData();
    const zero = { current: "0", previous: "0", deltaPct: 0 };
    const html = buildMonthlyReportHtml(
      makeReportData({
        meta: { ...base.meta, postedJournalCount: 0, lock: null },
        kpis: {
          ...base.kpis,
          revenue: zero,
          expense: zero,
          net: zero,
          marginPct: null,
          prevMarginPct: null,
        },
        profitLoss: { rows: [], revenue: zero, expense: zero, netIncome: zero },
        brandPnl: [],
        budget: { rows: [], overCount: 0 },
        topExpenses: [],
        trend: base.trend.map((t) => ({
          ...t,
          revenue: "0",
          expense: "0",
          net: "0",
        })),
      }),
    );
    expect(html).toContain("Tidak ada jurnal terposting");
    expect(html).toContain("Belum ada anggaran");
    expect(html).toContain("chart-empty");
    expect(html).not.toMatch(/NaN|undefined/);
  });
});
