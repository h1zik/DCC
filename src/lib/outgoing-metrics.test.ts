import { describe, expect, it } from "vitest";
import {
  aggregateOutgoing,
  normalizeOutgoingCategory,
  wibWeekStartKey,
  type OutgoingLogInput,
} from "@/lib/outgoing-metrics";

const NOW = new Date("2026-09-20T05:00:00Z"); // Minggu 12:00 WIB

function log(
  id: string,
  partial: Partial<OutgoingLogInput> & { daysAgo?: number },
): OutgoingLogInput {
  const { daysAgo = 1, ...rest } = partial;
  return {
    id,
    amount: 10,
    type: "OUT",
    salesCategory: "penjualan",
    note: null,
    productId: "p1",
    createdAt: new Date(NOW.getTime() - daysAgo * 24 * 60 * 60 * 1000),
    product: { name: "Sabun A", sku: "SKU-A", brand: { name: "BrandX" } },
    ...rest,
  };
}

describe("normalizeOutgoingCategory", () => {
  it("memetakan null dan nilai tak dikenal ke other", () => {
    expect(normalizeOutgoingCategory(null)).toBe("other");
    expect(normalizeOutgoingCategory("bonus")).toBe("other");
    expect(normalizeOutgoingCategory("Retur")).toBe("retur");
  });
});

describe("wibWeekStartKey", () => {
  it("memakai batas minggu WIB, bukan UTC", () => {
    // Minggu 23:30 WIB = 16:30Z → minggu yang dimulai Senin 14 Sep.
    expect(wibWeekStartKey(new Date("2026-09-20T16:30:00Z"))).toBe("2026-09-14");
    // Senin 00:30 WIB = Minggu 17:30Z → minggu baru 21 Sep.
    expect(wibWeekStartKey(new Date("2026-09-20T17:30:00Z"))).toBe("2026-09-21");
  });
});

describe("aggregateOutgoing", () => {
  it("memecah 4 kategori + other, total konsisten", () => {
    const agg = aggregateOutgoing(
      [
        log("a", { salesCategory: "penjualan", amount: 100 }),
        log("b", { salesCategory: "sampling", amount: 20 }),
        log("c", { salesCategory: "retur", amount: 5 }),
        log("d", { salesCategory: "rusak", amount: 3 }),
        log("e", { salesCategory: null, amount: 2 }),
      ],
      { windowDays: 30, now: NOW },
    );
    expect(agg.totals).toEqual({
      penjualan: 100,
      sampling: 20,
      retur: 5,
      rusak: 3,
      other: 2,
    });
    expect(agg.totalPcs).toBe(130);
    expect(agg.brands[0]?.samplingToSalesPct).toBe(20);
    expect(agg.weekly.reduce((acc, w) => acc + w.totalPcs, 0)).toBe(130);
    expect(agg.previousTotalPcs).toBeNull();
  });

  it("membuang log yang di-VOID", () => {
    const agg = aggregateOutgoing(
      [
        log("a", { amount: 50 }),
        log("v", { note: "[SYS] | action=VOID | target=a | reason=salah input" }),
      ],
      { windowDays: 30, now: NOW },
    );
    expect(agg.totalPcs).toBe(0);
  });

  it("REPLACEMENT mengganti kategori tapi tetap di minggu log asli", () => {
    const agg = aggregateOutgoing(
      [
        log("a", { amount: 50, daysAgo: 20 }),
        log("r", {
          amount: 40,
          salesCategory: "rusak",
          daysAgo: 1,
          note: "[SYS] | action=REPLACEMENT | target=a | reason=koreksi",
        }),
      ],
      { windowDays: 30, now: NOW },
    );
    expect(agg.totals.penjualan).toBe(0);
    expect(agg.totals.rusak).toBe(40);
    const week = agg.weekly.find((w) => w.rusak > 0);
    expect(week?.weekStart).toBe(
      wibWeekStartKey(new Date(NOW.getTime() - 20 * 24 * 60 * 60 * 1000)),
    );
  });

  it("mengenali format [SYS] lama", () => {
    const agg = aggregateOutgoing(
      [
        log("a", { amount: 50 }),
        log("v", { note: "[SYS] VOID untuk a oleh Budi: salah input" }),
      ],
      { windowDays: 30, now: NOW },
    );
    expect(agg.totalPcs).toBe(0);
  });

  it("zero-fill minggu kosong dan menandai minggu parsial", () => {
    const agg = aggregateOutgoing([log("a", { daysAgo: 2 })], {
      windowDays: 30,
      now: NOW,
    });
    expect(agg.weekly.length).toBeGreaterThanOrEqual(5);
    expect(agg.weekly.filter((w) => w.totalPcs === 0).length).toBeGreaterThan(0);
    expect(agg.weekly[0]?.partial).toBe(true);
  });

  it("rasio sampling null saat penjualan 0, delta dari jendela sebelumnya", () => {
    const agg = aggregateOutgoing(
      [
        log("a", { salesCategory: "sampling", amount: 30, daysAgo: 3 }),
        log("old", { amount: 20, daysAgo: 45 }),
      ],
      { windowDays: 30, now: NOW, includesPreviousWindow: true },
    );
    expect(agg.brands[0]?.samplingToSalesPct).toBeNull();
    expect(agg.totalPcs).toBe(30);
    expect(agg.previousTotalPcs).toBe(20);
    expect(agg.deltaPct).toBe(50);
  });

  it("top loss diurutkan retur + rusak dengan lossRatePct", () => {
    const agg = aggregateOutgoing(
      [
        log("a", { amount: 90 }),
        log("b", { amount: 10, salesCategory: "rusak" }),
        log("c", {
          amount: 5,
          salesCategory: "retur",
          productId: "p2",
          product: { name: "Sabun B", sku: "SKU-B", brand: { name: "BrandX" } },
        }),
      ],
      { windowDays: 30, now: NOW },
    );
    expect(agg.topLoss.map((s) => s.productId)).toEqual(["p1", "p2"]);
    expect(agg.topLoss[0]?.lossRatePct).toBe(10);
    expect(agg.topSellers.map((s) => s.productId)).toEqual(["p1"]);
  });
});
