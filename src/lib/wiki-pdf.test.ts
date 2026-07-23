import { describe, expect, it } from "vitest";

import { formatPdfOrderedListMarker } from "./wiki-pdf";

describe("formatPdfOrderedListMarker", () => {
  it("matches the nested list styles used by the wiki editor", () => {
    expect(formatPdfOrderedListMarker(3, 0)).toBe("3.");
    expect(formatPdfOrderedListMarker(3, 1)).toBe("c.");
    expect(formatPdfOrderedListMarker(3, 2)).toBe("iii.");
  });

  it("supports alphabetic markers beyond z", () => {
    expect(formatPdfOrderedListMarker(27, 1)).toBe("aa.");
  });
});
