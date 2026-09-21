import { describe, expect, it } from "vitest";
import { htmlBarList, htmlBudgetMeter, svgTrendChart } from "./charts";
import { fillTrendMonths } from "./trend";
import { makeReportData } from "./test-fixtures";

const clean = (s: string) => {
  expect(s).not.toMatch(/NaN|Infinity|undefined/);
  return s;
};

describe("svgTrendChart", () => {
  it("menghasilkan SVG valid dengan legenda tiga seri", () => {
    const svg = clean(svgTrendChart(makeReportData().trend));
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("Pendapatan");
    expect(svg).toContain("Laba/rugi bersih");
    // 6 titik data + 1 penanda legenda
    expect(svg.match(/<circle /g)?.length).toBe(7);
  });

  it("semua nol → placeholder, bukan pembagian nol", () => {
    const out = clean(svgTrendChart(fillTrendMonths([], 2026, 9, 6)));
    expect(out).toContain("chart-empty");
  });

  it("hasil bersih negatif tetap di dalam kanvas", () => {
    const svg = clean(
      svgTrendChart(
        fillTrendMonths(
          [
            { ym: "2026-09", type: "REVENUE", debit: "0", credit: "100" },
            { ym: "2026-09", type: "EXPENSE", debit: "900", credit: "0" },
          ],
          2026,
          9,
          3,
        ),
      ),
    );
    const ys = [...svg.matchAll(/cy="([\d.]+)"/g)].map((m) => Number(m[1]));
    expect(Math.max(...ys)).toBeLessThanOrEqual(250);
  });
});

describe("bar & meter", () => {
  it("meng-escape label", () => {
    const out = clean(
      htmlBarList([{ label: '<img src=x onerror="1">', value: "10" }]),
    );
    expect(out).not.toContain("<img");
  });

  it("placeholder bila tak ada nilai positif", () => {
    expect(htmlBarList([{ label: "A", value: "0" }])).toContain("chart-empty");
  });

  it("meter di-clamp pada skala 125% & tanpa limit → dash", () => {
    expect(clean(htmlBudgetMeter(400, true))).toContain("width:100%");
    expect(htmlBudgetMeter(null, false)).toContain("–");
  });
});
