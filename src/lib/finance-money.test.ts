import { describe, expect, it } from "vitest";
import {
  nonNegativeMoneyString,
  positiveMoneyString,
  toDecimal,
} from "./finance-money";

describe("toDecimal", () => {
  it("mem-parse format umum ke Decimal", () => {
    expect(toDecimal("18.000.000").toFixed(2)).toBe("18000000.00");
    expect(toDecimal("1234.56").toFixed(2)).toBe("1234.56");
    expect(toDecimal("12,5").toFixed(2)).toBe("12.50");
    expect(toDecimal(150.25).toFixed(2)).toBe("150.25");
    expect(toDecimal("-500").toFixed(2)).toBe("-500.00");
  });

  it("string kosong menjadi 0", () => {
    expect(toDecimal("").isZero()).toBe(true);
  });

  it("menolak NaN — decimal.js sendiri menerima string 'NaN'", () => {
    expect(() => toDecimal("NaN")).toThrow(/tidak valid/i);
    expect(() => toDecimal(Number.NaN)).toThrow(/tidak valid/i);
  });

  it("menolak Infinity", () => {
    expect(() => toDecimal("Infinity")).toThrow(/tidak valid/i);
    expect(() => toDecimal("-Infinity")).toThrow(/tidak valid/i);
    expect(() => toDecimal(Number.POSITIVE_INFINITY)).toThrow(/tidak valid/i);
  });

  it("menolak string yang bukan angka", () => {
    expect(() => toDecimal("abc")).toThrow(/tidak valid/i);
    expect(() => toDecimal("1x000")).toThrow(/tidak valid/i);
  });
});

describe("positiveMoneyString", () => {
  it("menerima nominal > 0 dalam berbagai format", () => {
    expect(positiveMoneyString.safeParse("125000").success).toBe(true);
    expect(positiveMoneyString.safeParse("18.000.000,50").success).toBe(true);
  });

  it("menolak 0, negatif, NaN, dan non-angka", () => {
    expect(positiveMoneyString.safeParse("0").success).toBe(false);
    expect(positiveMoneyString.safeParse("-5000").success).toBe(false);
    expect(positiveMoneyString.safeParse("NaN").success).toBe(false);
    expect(positiveMoneyString.safeParse("abc").success).toBe(false);
    expect(positiveMoneyString.safeParse("").success).toBe(false);
  });
});

describe("nonNegativeMoneyString", () => {
  it("menerima 0 dan nominal positif", () => {
    expect(nonNegativeMoneyString.safeParse("0").success).toBe(true);
    expect(nonNegativeMoneyString.safeParse("125000").success).toBe(true);
  });

  it("menolak negatif, NaN, dan non-angka", () => {
    expect(nonNegativeMoneyString.safeParse("-1").success).toBe(false);
    expect(nonNegativeMoneyString.safeParse("NaN").success).toBe(false);
    expect(nonNegativeMoneyString.safeParse("abc").success).toBe(false);
  });
});
