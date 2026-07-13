import { describe, expect, it } from "vitest";
import {
  assignTermsToSections,
  planDraftSections,
  tailWords,
  type PlannedSection,
} from "@/lib/seo/content/draft-plan";
import type { SemanticTerm } from "@/lib/seo/content/term-analysis";

const term = (t: string, importance: number): SemanticTerm => ({
  term: t,
  docCount: 3,
  avgCount: 2,
  importance,
  targetMin: 1,
  targetMax: 3,
});

const OUTLINE = [
  { heading: "Apa itu Niacinamide?", points: ["definisi"] },
  { heading: "Manfaat untuk Kulit", points: ["mencerahkan", "barrier"] },
  { heading: "FAQ Seputar Niacinamide", points: [] },
];

describe("planDraftSections", () => {
  it("creates opening + body sections, skipping FAQ outline sections", () => {
    const sections = planDraftSections(OUTLINE, [], 2000, { hasFaq: true });
    expect(sections[0].heading).toBeNull();
    expect(sections.map((s) => s.heading)).toEqual([
      null,
      "Apa itu Niacinamide?",
      "Manfaat untuk Kulit",
    ]);
    // Budget: opening 10% = 200; faq 15% = 300; body = (2000-500)/2 = 750.
    expect(sections[0].wordBudget).toBe(200);
    expect(sections[1].wordBudget).toBe(750);
  });

  it("falls back to a single section when outline empty", () => {
    const sections = planDraftSections([], [], null);
    expect(sections).toHaveLength(2);
    expect(sections[1].heading).toBe("Pembahasan");
  });
});

describe("assignTermsToSections", () => {
  it("distributes terms round-robin by importance to body sections only", () => {
    const sections: PlannedSection[] = [
      { id: "opening", heading: null, points: [], terms: [], wordBudget: 100 },
      { id: "s1", heading: "A", points: [], terms: [], wordBudget: 100 },
      { id: "s2", heading: "B", points: [], terms: [], wordBudget: 100 },
    ];
    const out = assignTermsToSections(sections, [
      term("t1", 0.9),
      term("t2", 0.8),
      term("t3", 0.7),
    ]);
    expect(out[0].terms).toEqual([]);
    expect(out[1].terms).toEqual(["t1", "t3"]);
    expect(out[2].terms).toEqual(["t2"]);
  });
});

describe("tailWords", () => {
  it("returns the last N words of the text content", () => {
    const html = "<p>satu dua tiga empat lima</p>";
    expect(tailWords(html, 2)).toBe("empat lima");
  });

  it("strips tags", () => {
    expect(tailWords("<h2>Judul</h2><p>isi</p>", 10)).toBe("Judul isi");
  });
});
