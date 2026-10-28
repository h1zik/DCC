import { describe, expect, it } from "vitest";
import {
  extractVerifyMarkersFromHtml,
  readPendingClaims,
  removeClaim,
  stripVerifyMarkers,
  unionClaims,
  withPendingClaims,
} from "@/lib/seo/content/claims";

describe("claims helpers", () => {
  const html =
    "<p>A</p><!-- verify: klaim uji klinis --><p>B</p><!--verify:angka 90%-->";

  it("extracts and strips verify markers", () => {
    expect(extractVerifyMarkersFromHtml(html)).toEqual([
      "klaim uji klinis",
      "angka 90%",
    ]);
    expect(stripVerifyMarkers(html)).toBe("<p>A</p><p>B</p>");
  });

  it("reads pendingClaims tolerant of shape", () => {
    expect(readPendingClaims(null)).toEqual([]);
    expect(readPendingClaims({ steps: [] })).toEqual([]);
    expect(readPendingClaims({ pendingClaims: [" a ", "", 3, "b"] })).toEqual([
      "a",
      "b",
    ]);
  });

  it("unions without duplicates and preserves other aiMeta fields", () => {
    expect(unionClaims(["Klaim A", "klaim b"], ["klaim  a", "C"])).toEqual([
      "Klaim A",
      "klaim b",
      "C",
    ]);
    const next = withPendingClaims({ steps: [{ label: "x" }] }, ["a", "a"]);
    expect(next.steps).toEqual([{ label: "x" }]);
    expect(next.pendingClaims).toEqual(["a"]);
  });

  it("removes a claim case-insensitively", () => {
    expect(removeClaim(["Klaim A", "B"], "klaim a")).toEqual(["B"]);
  });
});
