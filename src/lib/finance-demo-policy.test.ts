import { describe, expect, it } from "vitest";
import { resolveFinanceDemoResetAllowed } from "./finance-demo-policy";

describe("resolveFinanceDemoResetAllowed", () => {
  it("memblokir di produksi secara default", () => {
    expect(resolveFinanceDemoResetAllowed(undefined, "production")).toBe(false);
    expect(resolveFinanceDemoResetAllowed("", "production")).toBe(false);
    expect(resolveFinanceDemoResetAllowed("  ", "production")).toBe(false);
  });

  it("mengizinkan di luar produksi secara default", () => {
    expect(resolveFinanceDemoResetAllowed(undefined, "development")).toBe(true);
    expect(resolveFinanceDemoResetAllowed(undefined, "test")).toBe(true);
    expect(resolveFinanceDemoResetAllowed(undefined, undefined)).toBe(true);
  });

  it("override eksplisit true mengizinkan bahkan di produksi", () => {
    expect(resolveFinanceDemoResetAllowed("true", "production")).toBe(true);
    expect(resolveFinanceDemoResetAllowed("1", "production")).toBe(true);
    expect(resolveFinanceDemoResetAllowed("YES", "production")).toBe(true);
    expect(resolveFinanceDemoResetAllowed(" true ", "production")).toBe(true);
  });

  it("override eksplisit false memblokir bahkan di dev", () => {
    expect(resolveFinanceDemoResetAllowed("false", "development")).toBe(false);
    expect(resolveFinanceDemoResetAllowed("0", "development")).toBe(false);
    expect(resolveFinanceDemoResetAllowed("no", "development")).toBe(false);
  });

  it("nilai flag tidak dikenal jatuh ke default lingkungan", () => {
    expect(resolveFinanceDemoResetAllowed("banana", "production")).toBe(false);
    expect(resolveFinanceDemoResetAllowed("banana", "development")).toBe(true);
  });
});
