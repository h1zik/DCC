import { describe, expect, it } from "vitest";
import { validateStrategyCitations } from "@/lib/brand-research/strategy/strategy-citation-validator";
import type { EvidenceSnapshot } from "@/lib/brand-research/strategy/evidence-types";

function snapshot(input: Record<string, unknown>): EvidenceSnapshot {
  return {
    gatheredAt: "2026-01-01T00:00:00.000Z",
    ownerBrandId: null,
    readiness: { canGenerate: true, checks: [], warnings: [], demoFlags: [] },
    sourceRefs: [],
    input,
  };
}

describe("validateStrategyCitations grounding", () => {
  const evidence = snapshot({
    reviews: [
      "Teksturnya terlalu lengket dan bikin kulit berminyak sepanjang hari",
      "Wanginya enak tapi cepat habis, kurang awet di kulit",
    ],
  });

  it("marks a snippet that reflects real evidence text as valid", () => {
    const report = validateStrategyCitations({
      evidenceRefs: [
        {
          field: "brandUsp",
          source: "review",
          snippet: "konsumen mengeluh tekstur lengket dan kulit berminyak",
        },
      ],
      snapshot: evidence,
    });
    expect(report.validRefs).toBe(1);
    expect(report.passed).toBe(true);
  });

  it("rejects a hallucinated snippet absent from the evidence", () => {
    const report = validateStrategyCitations({
      evidenceRefs: [
        {
          field: "brandUsp",
          source: "review",
          snippet: "konsumen memuji kandungan retinol premium impor jepang eksklusif",
        },
      ],
      snapshot: evidence,
    });
    expect(report.validRefs).toBe(0);
    expect(report.passed).toBe(false);
    expect(report.invalidRefs[0]?.reason).toMatch(/tidak ditemukan/);
  });

  it("does not auto-pass when invalidRefs is empty but score is low", () => {
    const report = validateStrategyCitations({
      evidenceRefs: [
        // 1 grounded, 2 hallucinated → score 0.33 < 0.65 threshold
        { field: "a", source: "review", snippet: "tekstur lengket berminyak" },
        { field: "b", source: "review", snippet: "harga sangat mahal kemasan mewah eksklusif" },
        { field: "c", source: "review", snippet: "aroma vanilla cokelat karamel manis berlebihan" },
      ],
      snapshot: evidence,
    });
    expect(report.passed).toBe(false);
  });
});
