import { describe, expect, it } from "vitest";
import {
  extractPaaQuestions,
  extractRelatedSearches,
  extractTopOrganic,
  type SerpRawItem,
} from "@/lib/seo/content/serp-extract";

const items: SerpRawItem[] = [
  { type: "featured_snippet", rank_group: 1, rank_absolute: 1 },
  {
    type: "organic",
    rank_group: 1,
    rank_absolute: 2,
    domain: "Femaledaily.com",
    url: "https://femaledaily.com/serum-niacinamide",
    title: "10 Serum Niacinamide Terbaik",
  },
  {
    type: "people_also_ask",
    rank_group: 2,
    rank_absolute: 3,
    items: [
      { type: "people_also_ask_element", title: "Apakah niacinamide aman untuk kulit sensitif?" },
      { type: "people_also_ask_element", seed_question: "Kapan memakai serum niacinamide?" },
      { type: "people_also_ask_element", title: "apakah niacinamide aman untuk kulit sensitif?" },
    ],
  },
  {
    type: "organic",
    rank_group: 2,
    rank_absolute: 4,
    domain: "beautyjournal.id",
    url: "https://beautyjournal.id/niacinamide",
    title: "Manfaat Niacinamide",
  },
  // organik tanpa title/url harus dilewati
  { type: "organic", rank_group: 3, rank_absolute: 5, domain: "x.com" },
  {
    type: "related_searches",
    rank_group: 3,
    rank_absolute: 6,
    items: ["serum niacinamide untuk remaja", "niacinamide vs vitamin c", "serum niacinamide untuk remaja"],
  },
];

describe("extractTopOrganic", () => {
  it("returns ranked organic results with title+url only", () => {
    const top = extractTopOrganic(items);
    expect(top).toHaveLength(2);
    expect(top[0]).toEqual({
      rank: 1,
      title: "10 Serum Niacinamide Terbaik",
      url: "https://femaledaily.com/serum-niacinamide",
      domain: "femaledaily.com",
    });
  });

  it("respects the limit", () => {
    expect(extractTopOrganic(items, 1)).toHaveLength(1);
  });
});

describe("extractPaaQuestions", () => {
  it("collects unique questions from title or seed_question", () => {
    const qs = extractPaaQuestions(items);
    expect(qs).toEqual([
      "Apakah niacinamide aman untuk kulit sensitif?",
      "Kapan memakai serum niacinamide?",
    ]);
  });

  it("returns empty array when PAA absent", () => {
    expect(extractPaaQuestions([{ type: "organic" }])).toEqual([]);
  });
});

describe("extractRelatedSearches", () => {
  it("collects unique related searches", () => {
    expect(extractRelatedSearches(items)).toEqual([
      "serum niacinamide untuk remaja",
      "niacinamide vs vitamin c",
    ]);
  });
});
