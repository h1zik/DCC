import { describe, expect, it } from "vitest";
import { buildMonthlyHighlights } from "./highlights";
import { makeReportData } from "./test-fixtures";

const texts = (d = makeReportData()) =>
  buildMonthlyHighlights(d).map((h) => h.text);

describe("buildMonthlyHighlights", () => {
  it("deterministik & dibatasi 8 butir, peringatan lebih dulu", () => {
    const d = makeReportData();
    const a = buildMonthlyHighlights(d);
    expect(buildMonthlyHighlights(d)).toEqual(a);
    expect(a.length).toBeLessThanOrEqual(8);
    expect(a[0].tone).toBe("warning");
    expect(a[0].text).toContain("1 pos anggaran terlampaui");
    expect(a[0].text).toContain("6200 Iklan & promosi");
  });

  it("menulis pergerakan dengan koma desimal & nama bulan pembanding", () => {
    expect(texts()).toContain(
      "Pendapatan Rp 486.500.000, naik 12,4% dibanding Agustus 2026.",
    );
  });

  it("kenaikan beban bertone negatif, penurunan bertone positif", () => {
    const base = makeReportData();
    const up = buildMonthlyHighlights(base).find((h) =>
      h.text.startsWith("Beban "),
    );
    expect(up?.tone).toBe("negative");
    const down = buildMonthlyHighlights({
      ...base,
      kpis: {
        ...base.kpis,
        expense: { current: "90", previous: "100", deltaPct: -10 },
      },
    }).find((h) => h.text.startsWith("Beban "));
    expect(down?.tone).toBe("positive");
  });

  it("tanpa pembanding → tidak mengarang persentase", () => {
    const base = makeReportData();
    const out = buildMonthlyHighlights({
      ...base,
      kpis: {
        ...base.kpis,
        revenue: { current: "100", previous: "0", deltaPct: null },
      },
    });
    expect(out.find((h) => h.text.startsWith("Pendapatan"))?.text).toContain(
      "belum ada pembanding",
    );
  });

  it("laba berbalik rugi", () => {
    const base = makeReportData();
    const out = buildMonthlyHighlights({
      ...base,
      kpis: {
        ...base.kpis,
        net: { current: "-5000000", previous: "8000000", deltaPct: -162.5 },
        marginPct: null,
      },
    });
    const hit = out.find((h) => h.text.includes("berbalik rugi"));
    expect(hit?.tone).toBe("negative");
    expect(hit?.text).toContain("Rp 5.000.000");
  });

  it("neraca tidak seimbang jadi sorotan pertama — kecuali laporan per brand", () => {
    const base = makeReportData();
    const unbalanced = {
      ...base.balanceSheet,
      current: {
        ...base.balanceSheet.current,
        isBalanced: false,
        difference: "1500",
      },
    };
    const out = buildMonthlyHighlights({ ...base, balanceSheet: unbalanced });
    expect(out[0].text).toContain("Neraca tidak seimbang");
    expect(out[0].text).toContain("Rp 1.500");

    const branded = buildMonthlyHighlights({
      ...base,
      balanceSheet: unbalanced,
      meta: { ...base.meta, brand: { id: "b1", name: "Aurora Skin" } },
    });
    expect(branded.some((h) => h.text.includes("tidak seimbang"))).toBe(false);
    // Margin terbaik antar-brand tidak relevan untuk laporan satu brand.
    expect(branded.some((h) => h.text.includes("margin terbaik"))).toBe(false);
  });

  it("anggaran aman & piutang telat", () => {
    const base = makeReportData();
    const ok = buildMonthlyHighlights({
      ...base,
      budget: {
        rows: base.budget.rows.map((r) => ({ ...r, over: false })),
        overCount: 0,
      },
    });
    expect(
      ok.some((h) => h.text === "Seluruh 3 pos anggaran masih dalam batas."),
    ).toBe(true);
    expect(texts()).toContain(
      "1 piutang lewat jatuh tempo senilai Rp 38.400.000 perlu ditagih.",
    );
  });

  it("bulan tanpa jurnal → satu sorotan info saja", () => {
    const base = makeReportData();
    const out = buildMonthlyHighlights({
      ...base,
      meta: { ...base.meta, postedJournalCount: 0 },
    });
    expect(out).toHaveLength(1);
    expect(out[0].tone).toBe("info");
  });

  it("pos yang nol di kedua bulan tidak disorot", () => {
    const base = makeReportData();
    const zero = { current: "0", previous: "0", deltaPct: 0 };
    const out = buildMonthlyHighlights({
      ...base,
      kpis: {
        ...base.kpis,
        revenue: zero,
        expense: zero,
        net: zero,
        marginPct: null,
      },
    });
    expect(
      out.some((h) => /^(Pendapatan Rp|Beban Rp|Laba bersih)/.test(h.text)),
    ).toBe(false);
  });

  it("catatan draft & bulan berjalan selalu ikut walau butir penuh", () => {
    const base = makeReportData();
    const out = buildMonthlyHighlights({
      ...base,
      meta: { ...base.meta, isInProgress: true, draftJournalCount: 3 },
    });
    expect(out.length).toBeLessThanOrEqual(8);
    expect(out.some((h) => h.text.startsWith("3 jurnal berstatus draft"))).toBe(
      true,
    );
    expect(out[out.length - 1].text).toContain("Bulan masih berjalan");
  });
});
