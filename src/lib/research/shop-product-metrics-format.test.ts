import { describe, expect, it } from "vitest";
import { formatSoldThreshold } from "@/lib/research/shop-product-metrics";

describe("formatSoldThreshold", () => {
  it("renders guest threshold badges, not precise numbers", () => {
    expect(formatSoldThreshold(1000)).toBe("1RB+");
    expect(formatSoldThreshold(10000)).toBe("10RB+");
    expect(formatSoldThreshold(2_300_000)).toBe("2,3JT+");
    expect(formatSoldThreshold(100)).toBe("100+");
  });

  it("handles null / zero", () => {
    expect(formatSoldThreshold(null)).toBe("—");
    expect(formatSoldThreshold(undefined)).toBe("—");
    expect(formatSoldThreshold(0)).toBe("0");
  });
});
