import { describe, expect, it } from "vitest";
import { detectCannibalization } from "@/lib/seo/rank-tracker/cannibalization";

describe("detectCannibalization", () => {
  it("detects URL flip-flop across snapshots", () => {
    const findings = detectCannibalization([
      {
        keyword: "serum niacinamide",
        snapshots: [
          { foundUrl: "https://a.com/blog" },
          { foundUrl: "https://a.com/produk" },
          { foundUrl: "https://a.com/blog" },
        ],
      },
    ]);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("high");
    expect(findings[0].urls).toHaveLength(2);
  });

  it("detects multiple own URLs in top-20 of latest snapshot", () => {
    const findings = detectCannibalization([
      {
        keyword: "toner",
        snapshots: [
          {
            foundUrl: "https://a.com/toner",
            ownMatches: [
              { position: 5, url: "https://a.com/toner" },
              { position: 12, url: "https://a.com/blog/toner" },
              { position: 55, url: "https://a.com/arsip" },
            ],
          },
        ],
      },
    ]);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("medium");
    expect(findings[0].urls).toHaveLength(2);
  });

  it("stable single URL yields nothing", () => {
    expect(
      detectCannibalization([
        {
          keyword: "x",
          snapshots: [
            { foundUrl: "https://a.com/x" },
            { foundUrl: "https://a.com/x" },
          ],
        },
      ]),
    ).toEqual([]);
  });

  it("single switch is not flip-flop", () => {
    expect(
      detectCannibalization([
        {
          keyword: "x",
          snapshots: [
            { foundUrl: "https://a.com/lama" },
            { foundUrl: "https://a.com/baru" },
            { foundUrl: "https://a.com/baru" },
          ],
        },
      ]),
    ).toEqual([]);
  });
});
