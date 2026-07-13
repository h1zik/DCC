import { describe, expect, it } from "vitest";
import {
  parseContentParsingResult,
  type DfsContentParsingResult,
} from "@/lib/seo/dataforseo/content-parsing-parse";

const RESULT: DfsContentParsingResult[] = [
  {
    items: [
      {
        meta: {
          title: "10 Serum Niacinamide Terbaik",
          description: "Rekomendasi serum niacinamide.",
        },
        page_content: {
          main_topic: [
            {
              h_title: "10 Serum Niacinamide Terbaik",
              level: 1,
              primary_content: [
                { text: "Niacinamide membantu merawat kulit kusam." },
              ],
            },
            {
              h_title: "Apa itu Niacinamide?",
              level: 2,
              primary_content: [
                { text: "Turunan vitamin B3 yang populer di skincare." },
                { text: null },
              ],
              secondary_content: [{ text: "Cocok untuk kulit berminyak." }],
            },
          ],
          secondary_topic: [
            {
              h_title: "FAQ",
              level: 2,
              primary_content: [{ text: "Apakah aman? Aman untuk pemula." }],
            },
          ],
        },
      },
    ],
  },
];

describe("parseContentParsingResult", () => {
  it("extracts title, headings, and body text", () => {
    const parsed = parseContentParsingResult(RESULT);
    expect(parsed).not.toBeNull();
    expect(parsed!.title).toBe("10 Serum Niacinamide Terbaik");
    expect(parsed!.metaDescription).toBe("Rekomendasi serum niacinamide.");
    expect(parsed!.headings).toEqual([
      { level: 1, text: "10 Serum Niacinamide Terbaik" },
      { level: 2, text: "Apa itu Niacinamide?" },
      { level: 2, text: "FAQ" },
    ]);
    expect(parsed!.bodyText).toContain("kulit kusam");
    expect(parsed!.bodyText).toContain("kulit berminyak");
    expect(parsed!.wordCount).toBeGreaterThan(15);
  });

  it("returns null for empty results", () => {
    expect(parseContentParsingResult([])).toBeNull();
    expect(parseContentParsingResult([{ items: [{ page_content: {} }] }])).toBeNull();
  });
});
