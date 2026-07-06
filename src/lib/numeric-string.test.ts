import { describe, expect, it } from "vitest";
import { normalizeNumericString } from "./numeric-string";

describe("normalizeNumericString", () => {
  it("angka polos diteruskan apa adanya", () => {
    expect(normalizeNumericString("18000000")).toBe("18000000");
    expect(normalizeNumericString("0")).toBe("0");
    expect(normalizeNumericString("-1234")).toBe("-1234");
  });

  it("string kosong menjadi 0", () => {
    expect(normalizeNumericString("")).toBe("0");
    expect(normalizeNumericString("   ")).toBe("0");
  });

  it("format id-ID: titik ribuan, koma desimal", () => {
    expect(normalizeNumericString("18.000.000")).toBe("18000000");
    expect(normalizeNumericString("18.000.000,50")).toBe("18000000.50");
    expect(normalizeNumericString("12,5")).toBe("12.5");
    expect(normalizeNumericString("-1.234,56")).toBe("-1234.56");
  });

  it("format US: koma ribuan, titik desimal", () => {
    expect(normalizeNumericString("18,000,000")).toBe("18000000");
    expect(normalizeNumericString("18,000,000.50")).toBe("18000000.50");
    expect(normalizeNumericString("1234.56")).toBe("1234.56");
    expect(normalizeNumericString("1,000.50")).toBe("1000.50");
  });

  it("satu separator dengan 3 digit dianggap ribuan", () => {
    expect(normalizeNumericString("18.000")).toBe("18000");
    expect(normalizeNumericString("18,000")).toBe("18000");
  });

  it("satu titik dengan 1-2 digit dianggap desimal", () => {
    expect(normalizeNumericString("1234.5")).toBe("1234.5");
    expect(normalizeNumericString("1234.56")).toBe("1234.56");
  });

  it("spasi di dalam angka dibuang", () => {
    expect(normalizeNumericString("1 234 567")).toBe("1234567");
  });
});
