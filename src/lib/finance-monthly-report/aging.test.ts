import { describe, expect, it } from "vitest";
import { bucketAging, daysOverdue } from "./aging";

const ref = new Date("2026-10-01T00:00:00.000Z");
const dueAgo = (days: number) => new Date(ref.getTime() - days * 86_400_000);
const doc = (days: number, remaining = "100") => ({
  name: `Doc ${days}`,
  docNumber: null,
  dueDate: dueAgo(days),
  remaining,
});

describe("bucketAging", () => {
  it("batas bucket: 0 | 1–30 | 31–60 | >60 hari", () => {
    const side = bucketAging(
      [0, 1, 30, 31, 60, 61].map((d) => doc(d)),
      ref,
    );
    expect(side.buckets).toEqual({
      current: "100",
      d1_30: "200",
      d31_60: "200",
      over60: "100",
    });
    expect(side.total).toBe("600");
    expect(side.overdueCount).toBe(5);
    expect(side.overdueTotal).toBe("500");
  });

  it("mengabaikan dokumen yang sudah lunas & mengurutkan paling telat dulu", () => {
    const side = bucketAging([doc(5), doc(90), doc(10, "0"), doc(-3)], ref);
    expect(side.count).toBe(3);
    expect(side.top.map((d) => d.daysOverdue)).toEqual([90, 5, -3]);
  });

  it("menghitung hari per tanggal UTC, bukan jam", () => {
    expect(
      daysOverdue(
        new Date("2026-09-30T00:00:00.000Z"),
        new Date("2026-10-01T23:59:00.000Z"),
      ),
    ).toBe(1);
  });
});
