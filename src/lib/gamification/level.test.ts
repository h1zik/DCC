import { describe, expect, it } from "vitest";
import {
  cumXp,
  levelDelta,
  levelFromXp,
  levelProgress,
  MAX_LEVEL,
} from "./level";

describe("level curve", () => {
  it("matches the design-doc threshold table", () => {
    const expected: Record<number, number> = {
      1: 0,
      2: 100,
      3: 250,
      4: 460,
      5: 740,
      6: 1100,
      7: 1550,
      8: 2100,
      9: 2760,
      10: 3540,
      15: 9590,
      20: 20140,
    };
    for (const [lvl, xp] of Object.entries(expected)) {
      expect(cumXp(Number(lvl))).toBe(xp);
    }
  });

  it("cumXp(1) is 0 and levelDelta(1) is 0", () => {
    expect(cumXp(1)).toBe(0);
    expect(levelDelta(1)).toBe(0);
    expect(levelDelta(2)).toBe(100);
    expect(levelDelta(3)).toBe(150);
  });

  it("levelFromXp is the inverse at thresholds and just below", () => {
    for (let lvl = 1; lvl <= 25; lvl++) {
      expect(levelFromXp(cumXp(lvl))).toBe(lvl);
      if (lvl > 1) expect(levelFromXp(cumXp(lvl) - 1)).toBe(lvl - 1);
    }
  });

  it("is monotonic in xp", () => {
    let prev = 1;
    for (let xp = 0; xp <= 30000; xp += 137) {
      const l = levelFromXp(xp);
      expect(l).toBeGreaterThanOrEqual(prev);
      prev = l;
    }
  });

  it("caps at MAX_LEVEL", () => {
    expect(levelFromXp(9_999_999)).toBe(MAX_LEVEL);
    expect(cumXp(MAX_LEVEL + 10)).toBe(cumXp(MAX_LEVEL));
  });

  it("levelProgress reports the fill toward the next level", () => {
    const p = levelProgress(cumXp(5) + 140); // 140 into the 280-wide L5→L6 band
    expect(p.level).toBe(5);
    expect(p.into).toBe(140);
    expect(p.span).toBe(cumXp(6) - cumXp(5));
    expect(p.ratio).toBeCloseTo(140 / (cumXp(6) - cumXp(5)));
  });

  it("levelProgress saturates at MAX_LEVEL", () => {
    const p = levelProgress(cumXp(MAX_LEVEL) + 5000);
    expect(p.level).toBe(MAX_LEVEL);
    expect(p.ratio).toBe(1);
    expect(p.span).toBe(0);
  });
});
