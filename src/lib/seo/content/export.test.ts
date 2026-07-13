import { describe, expect, it } from "vitest";
import {
  buildCleanHtml,
  buildDocxHtml,
  buildMarkdown,
  extractVerifyMarkers,
  type ExportableDraft,
} from "@/lib/seo/content/export";
import { slugify } from "@/lib/seo/content/slug";

const DRAFT: ExportableDraft = {
  title: "Serum Niacinamide Terbaik",
  targetKeyword: "serum niacinamide",
  contentHtml:
    '<h1>Serum Niacinamide Terbaik</h1><p>Intro tentang niacinamide.</p><!-- verify: klaim persentase pencerahan --><h2>Manfaat</h2><p>Membantu mencerahkan.</p><p></p>',
  metaTitle: "Serum Niacinamide Terbaik 2026",
  metaDescription: "Rekomendasi serum niacinamide untuk kulit kusam & berminyak.",
  slug: "serum-niacinamide-terbaik",
};

describe("buildCleanHtml", () => {
  it("strips verify comments and empty paragraphs", () => {
    const html = buildCleanHtml(DRAFT);
    expect(html).not.toContain("verify:");
    expect(html).not.toContain("<p></p>");
    expect(html).toContain("<h2>Manfaat</h2>");
  });

  it("prepends an H1 when missing", () => {
    const html = buildCleanHtml({ ...DRAFT, contentHtml: "<p>isi</p>" });
    expect(html.startsWith("<h1>Serum Niacinamide Terbaik</h1>")).toBe(true);
  });
});

describe("buildMarkdown", () => {
  it("includes front-matter meta and converted body", () => {
    const md = buildMarkdown(DRAFT);
    expect(md).toContain('title: "Serum Niacinamide Terbaik"');
    expect(md).toContain('meta_title: "Serum Niacinamide Terbaik 2026"');
    expect(md).toContain('slug: "serum-niacinamide-terbaik"');
    expect(md).toContain("# Serum Niacinamide Terbaik");
    expect(md).toContain("## Manfaat");
  });
});

describe("buildDocxHtml", () => {
  it("wraps content in a document with meta table", () => {
    const html = buildDocxHtml(DRAFT);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Meta title");
    expect(html).toContain("Serum Niacinamide Terbaik 2026");
  });
});

describe("extractVerifyMarkers", () => {
  it("collects verify notes", () => {
    expect(extractVerifyMarkers(DRAFT.contentHtml)).toEqual([
      "klaim persentase pencerahan",
    ]);
  });

  it("returns empty when none", () => {
    expect(extractVerifyMarkers("<p>bersih</p>")).toEqual([]);
  });
});

describe("slugify", () => {
  it("makes kebab-case slugs", () => {
    expect(slugify("Serum Niacinamide: Terbaik & Termurah 2026!")).toBe(
      "serum-niacinamide-terbaik-termurah-2026",
    );
  });

  it("handles diacritics and repeated dashes", () => {
    expect(slugify("Café  --  Skincare")).toBe("cafe-skincare");
  });
});
