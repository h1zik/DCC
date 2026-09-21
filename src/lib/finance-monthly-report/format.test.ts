import { describe, expect, it } from "vitest";
import { utcMonthEnd } from "@/lib/finance-dates";
import {
  cssString,
  escHtml,
  fmtDateUtc,
  fmtDeltaPct,
  fmtMoney,
  fmtPct,
  pctChange,
} from "./format";

describe("fmtMoney", () => {
  it("memakai pemisah ribuan id-ID, kurung untuk negatif, dash untuk nol", () => {
    expect(fmtMoney("1234567.49")).toBe("1.234.567");
    expect(fmtMoney("-2800000")).toBe("(2.800.000)");
    expect(fmtMoney("0")).toBe("–");
    expect(fmtMoney("0", { zeroDash: false })).toBe("0");
    expect(fmtMoney("-500", { withRp: true })).toBe("(Rp 500)");
  });

  it("tahan terhadap input tidak valid", () => {
    expect(fmtMoney("abc")).toBe("–");
    expect(fmtMoney(null)).toBe("–");
  });
});

describe("persentase", () => {
  it("memakai koma desimal Indonesia", () => {
    expect(fmtPct(12.44)).toBe("12,4%");
    expect(fmtDeltaPct(12.44)).toBe("+12,4%");
    expect(fmtDeltaPct(-3)).toBe("−3,0%");
  });

  it("menandai tanpa pembanding & meng-clamp lonjakan ekstrem", () => {
    expect(fmtDeltaPct(null)).toBe("baru");
    expect(fmtDeltaPct(4321)).toBe("+>999%");
  });

  it("pctChange: null bila pembanding 0, 0 bila keduanya 0", () => {
    expect(pctChange("110", "100")).toBeCloseTo(10);
    expect(pctChange("50", "0")).toBeNull();
    expect(pctChange("0", "0")).toBe(0);
    // Pembanding negatif: arah tetap benar (rugi → laba = naik).
    expect(pctChange("50", "-100")).toBeCloseTo(150);
  });
});

describe("fmtDateUtc", () => {
  it("akhir bulan tidak bergeser ke bulan berikutnya apa pun TZ server", () => {
    expect(fmtDateUtc(utcMonthEnd(2026, 9))).toBe("30 Sep 2026");
  });
});

describe("escaping", () => {
  it("escHtml aman untuk teks maupun atribut", () => {
    expect(escHtml(`<b a="1" b='2'>&`)).toBe(
      "&lt;b a=&quot;1&quot; b=&#39;2&#39;&gt;&amp;",
    );
    expect(escHtml(null)).toBe("");
  });

  it("cssString tidak bisa keluar dari literal atau menutup <style>", () => {
    const out = cssString(`a"b\c</style>\nd`);
    expect(out.startsWith('"') && out.endsWith('"')).toBe(true);
    expect(out).not.toContain("</style>");
    expect(out).not.toContain("\n");
    expect(out).toContain('\\"');
  });
});
