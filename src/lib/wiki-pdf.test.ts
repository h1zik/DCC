import { describe, expect, it } from "vitest";

import { prepareWikiHtmlForPdf } from "./wiki-pdf";

describe("prepareWikiHtmlForPdf", () => {
  it("strips script tags and inline event handlers", () => {
    const out = prepareWikiHtmlForPdf(
      '<p onclick="alert(1)">hi</p><script>alert(2)</script>',
    );
    expect(out).not.toContain("<script>");
    expect(out).not.toContain("onclick");
    expect(out).toContain("hi");
  });

  it("strips javascript: URLs but keeps safe links", () => {
    const out = prepareWikiHtmlForPdf(
      '<a href="javascript:alert(1)">bad</a><a href="https://example.com">good</a>',
    );
    expect(out).not.toContain("javascript:");
    expect(out).toContain('href="https://example.com"');
  });

  it("keeps inline styles and classes (needed for color/highlight fidelity)", () => {
    const out = prepareWikiHtmlForPdf('<p style="color: rgb(255, 0, 0)" class="foo">hi</p>');
    expect(out).toContain("color: rgb(255, 0, 0)");
    expect(out).toContain('class="foo"');
  });

  it("rescales colgroup col px widths to percentages", () => {
    const out = prepareWikiHtmlForPdf(
      '<table><colgroup><col style="width: 100px"><col style="width: 300px"></colgroup><tbody><tr><td>a</td><td>b</td></tr></tbody></table>',
    );
    expect(out).toContain("width: 25.00%");
    expect(out).toContain("width: 75.00%");
  });

  it("gives an un-resized column (TipTap's min-width: 48px) a fair share instead of squeezing it to 48px", () => {
    // Kolom 1 & 2 pernah di-resize manual (width: eksplisit); kolom 3 belum
    // pernah disentuh dan hanya punya `min-width` (bukan `width` tetap).
    const out = prepareWikiHtmlForPdf(
      '<table><colgroup><col style="width: 340px"><col style="width: 340px"><col style="min-width: 48px"></colgroup><tbody><tr><td>a</td><td>b</td><td>c</td></tr></tbody></table>',
    );
    expect(out).toContain("width: 33.33%");
    expect(out).not.toContain("width: 6."); // 48/(340+340+48) ~ 6.6% — bug lama
  });

  it("replaces youtube iframes with a placeholder card", () => {
    const out = prepareWikiHtmlForPdf(
      '<div data-youtube-video><iframe src="https://youtube.com/embed/x"></iframe></div>',
    );
    expect(out).not.toContain("<iframe");
    expect(out).toContain("pdf-embed-card");
  });
});
