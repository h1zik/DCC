import { describe, expect, it } from "vitest";
import { SeoKeywordIntent } from "@prisma/client";
import {
  clusterAssignmentMap,
  clusterKeywordsByIntent,
  normalizeClusters,
} from "@/lib/seo/keyword-research/clustering";

const ideas = [
  { keyword: "beli serum vitamin c", intent: SeoKeywordIntent.TRANSACTIONAL },
  { keyword: "serum vitamin c terbaik", intent: SeoKeywordIntent.COMMERCIAL },
  { keyword: "manfaat serum vitamin c", intent: SeoKeywordIntent.INFORMATIONAL },
  { keyword: "harga serum vitamin c", intent: SeoKeywordIntent.TRANSACTIONAL },
];

describe("clusterKeywordsByIntent", () => {
  it("groups keywords by intent and orders transactional first", () => {
    const clusters = clusterKeywordsByIntent(ideas);
    expect(clusters[0].intent).toBe(SeoKeywordIntent.TRANSACTIONAL);
    expect(clusters[0].keywords).toContain("beli serum vitamin c");
    expect(clusters[0].keywords).toContain("harga serum vitamin c");
    // 3 intents distinct → 3 clusters
    expect(clusters).toHaveLength(3);
  });

  it("dedupes keywords case-insensitively", () => {
    const clusters = clusterKeywordsByIntent([
      { keyword: "Serum", intent: SeoKeywordIntent.COMMERCIAL },
      { keyword: "serum", intent: SeoKeywordIntent.COMMERCIAL },
    ]);
    expect(clusters[0].keywords).toHaveLength(1);
  });
});

describe("normalizeClusters", () => {
  it("keeps only valid keywords and buckets leftovers by intent", () => {
    const raw = [
      {
        label: "Beli",
        intent: "transactional",
        keywords: ["beli serum vitamin c", "keyword-asing-tidak-valid"],
      },
    ];
    const clusters = normalizeClusters(raw, ideas);
    const beli = clusters.find((c) => c.label === "Beli");
    expect(beli?.keywords).toEqual(["beli serum vitamin c"]);
    // Sisanya tetap tercakup di cluster fallback.
    const allKeywords = clusters.flatMap((c) => c.keywords);
    expect(allKeywords).toContain("manfaat serum vitamin c");
    expect(allKeywords).toContain("serum vitamin c terbaik");
    expect(allKeywords).not.toContain("keyword-asing-tidak-valid");
  });

  it("falls back entirely when raw is not an array", () => {
    const clusters = normalizeClusters(null, ideas);
    const total = clusters.flatMap((c) => c.keywords).length;
    expect(total).toBe(4);
  });

  it("does not assign the same keyword to two clusters", () => {
    const raw = [
      { label: "A", intent: "commercial", keywords: ["serum vitamin c terbaik"] },
      { label: "B", intent: "commercial", keywords: ["serum vitamin c terbaik"] },
    ];
    const clusters = normalizeClusters(raw, ideas);
    const occurrences = clusters
      .flatMap((c) => c.keywords)
      .filter((k) => k === "serum vitamin c terbaik").length;
    expect(occurrences).toBe(1);
  });
});

describe("clusterAssignmentMap", () => {
  it("maps each keyword to its cluster label and intent", () => {
    const clusters = clusterKeywordsByIntent(ideas);
    const map = clusterAssignmentMap(clusters);
    expect(map.get("beli serum vitamin c")?.intent).toBe(
      SeoKeywordIntent.TRANSACTIONAL,
    );
    expect(map.get("manfaat serum vitamin c")?.label).toBeTruthy();
  });
});
