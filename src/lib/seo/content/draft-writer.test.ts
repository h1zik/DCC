import { describe, expect, it } from "vitest";
import { splitBatchHtml } from "@/lib/seo/content/draft-plan";

describe("splitBatchHtml", () => {
  it("returns whole html for a single section", () => {
    const out = splitBatchHtml("<p>isi</p>", [{ id: "opening", heading: null }]);
    expect(out).toEqual([{ id: "opening", html: "<p>isi</p>" }]);
  });

  it("splits opening + h2 sections", () => {
    const html = "<p>pembuka</p>\n<h2>A</h2><p>isi a</p>\n<h2>B</h2><p>isi b</p>";
    const out = splitBatchHtml(html, [
      { id: "opening", heading: null },
      { id: "s1", heading: "A" },
      { id: "s2", heading: "B" },
    ]);
    expect(out[0]).toEqual({ id: "opening", html: "<p>pembuka</p>" });
    expect(out[1].html).toContain("<h2>A</h2>");
    expect(out[2].html).toContain("<h2>B</h2>");
  });

  it("gives remaining parts (incl. h3 subsections) to the last section", () => {
    const html = "<h2>A</h2><p>a</p><h2>B</h2><p>b</p><h2>C</h2><p>c</p>";
    const out = splitBatchHtml(html, [
      { id: "s1", heading: "A" },
      { id: "s2", heading: "B" },
    ]);
    expect(out[0].html).toContain("<h2>A</h2>");
    expect(out[1].html).toContain("<h2>B</h2>");
    expect(out[1].html).toContain("<h2>C</h2>");
  });

  it("handles missing opening gracefully", () => {
    const html = "<h2>A</h2><p>a</p>";
    const out = splitBatchHtml(html, [
      { id: "opening", heading: null },
      { id: "s1", heading: "A" },
    ]);
    expect(out[0]).toEqual({ id: "opening", html: "" });
    expect(out[1].html).toContain("<h2>A</h2>");
  });
});
