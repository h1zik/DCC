import { describe, expect, it } from "vitest";
import { applyKeywordDiff } from "@/lib/research/keyword-intel/compute-keyword-diff";
import type { KeywordDiffStatus } from "@/lib/research/keyword-intel/keyword-signal-types";

type Row = { keyword: string; koiScore: number; diffStatus?: KeywordDiffStatus };

describe("applyKeywordDiff", () => {
  it("marks keywords absent from prior run as NEW", () => {
    const current: Row[] = [{ keyword: "body serum brightening", koiScore: 0.6 }];
    const prior = [{ keyword: "sunscreen spf 50", koiScore: 0.5 }];
    const result = applyKeywordDiff(current, prior);
    expect(result[0]?.diffStatus).toBe("NEW");
  });

  it("marks rising KOI delta above 0.1 as RISING", () => {
    const current: Row[] = [{ keyword: "deodorant natural", koiScore: 0.7 }];
    const prior = [{ keyword: "deodorant natural", koiScore: 0.5 }];
    const result = applyKeywordDiff(current, prior);
    expect(result[0]?.diffStatus).toBe("RISING");
  });

  it("marks falling KOI delta below -0.1 as FADING", () => {
    const current: Row[] = [{ keyword: "deodorant natural", koiScore: 0.3 }];
    const prior = [{ keyword: "deodorant natural", koiScore: 0.55 }];
    const result = applyKeywordDiff(current, prior);
    expect(result[0]?.diffStatus).toBe("FADING");
  });

  it("marks small KOI changes as STABLE", () => {
    const current: Row[] = [{ keyword: "lip balm", koiScore: 0.52 }];
    const prior = [{ keyword: "lip balm", koiScore: 0.5 }];
    const result = applyKeywordDiff(current, prior);
    expect(result[0]?.diffStatus).toBe("STABLE");
  });
});
