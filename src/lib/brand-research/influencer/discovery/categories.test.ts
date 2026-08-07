import { InfluencerPlatform } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  buildClassificationPrompt,
  CREATOR_CATEGORIES,
  creatorCategoryLabel,
  hasClassifiableSignal,
  isCreatorCategory,
  parseCreatorClassifications,
  type ClassifiableCreator,
} from "@/lib/brand-research/influencer/discovery/categories";

function creator(
  overrides: Partial<ClassifiableCreator> & { handle: string },
): ClassifiableCreator {
  return {
    platform: InfluencerPlatform.TIKTOK,
    bio: null,
    discoveryTerms: [],
    captions: [],
    ...overrides,
  };
}

describe("taksonomi kategori", () => {
  it("setiap kode punya label", () => {
    for (const code of CREATOR_CATEGORIES) {
      expect(creatorCategoryLabel(code)).not.toBe("Belum diklasifikasi");
    }
  });

  it("menolak kode di luar daftar", () => {
    expect(isCreatorCategory("beauty-skincare")).toBe(true);
    expect(isCreatorCategory("kecantikan")).toBe(false);
    expect(isCreatorCategory(null)).toBe(false);
    expect(isCreatorCategory(42)).toBe(false);
  });

  it("kategori kosong tampil sebagai belum diklasifikasi", () => {
    expect(creatorCategoryLabel(null)).toBe("Belum diklasifikasi");
  });
});

describe("hasClassifiableSignal", () => {
  it("menolak kreator yang tidak membawa bahan apa pun", () => {
    // Tanpa bio, hashtag, maupun caption, LLM cuma bisa menebak dari bentuk
    // username — itu bukan klasifikasi, itu karangan.
    expect(hasClassifiableSignal(creator({ handle: "kosong" }))).toBe(false);
    expect(
      hasClassifiableSignal(creator({ handle: "spasi", bio: "   " })),
    ).toBe(false);
  });

  it("menerima bila ada salah satu bahan", () => {
    expect(
      hasClassifiableSignal(creator({ handle: "a", bio: "skincare enthusiast" })),
    ).toBe(true);
    expect(
      hasClassifiableSignal(
        creator({ handle: "b", discoveryTerms: ["#skincare"] }),
      ),
    ).toBe(true);
    expect(
      hasClassifiableSignal(creator({ handle: "c", captions: ["review serum"] })),
    ).toBe(true);
  });
});

describe("buildClassificationPrompt", () => {
  it("memuat seluruh kode kategori dan tiap kreator", () => {
    const prompt = buildClassificationPrompt([
      creator({ handle: "nana", bio: "beauty", discoveryTerms: ["#skincare"] }),
      creator({ handle: "budi", captions: ["resep nasi goreng"] }),
    ]);

    for (const code of CREATOR_CATEGORIES) {
      expect(prompt).toContain(code);
    }
    expect(prompt).toContain("nana");
    expect(prompt).toContain("budi");
    expect(prompt).toContain("#skincare");
    expect(prompt).toContain("resep nasi goreng");
  });

  it("menandai bio kosong secara eksplisit, bukan membiarkannya kosong", () => {
    const prompt = buildClassificationPrompt([creator({ handle: "nana" })]);
    expect(prompt).toContain("(kosong)");
  });
});

describe("parseCreatorClassifications", () => {
  const requested = [
    creator({ handle: "nana", bio: "skincare" }),
    creator({ handle: "budi", bio: "kuliner" }),
  ];

  it("membaca hasil yang benar", () => {
    const { classifications, warnings } = parseCreatorClassifications(
      {
        results: [
          { handle: "nana", category: "beauty-skincare", confidence: 0.9, language: "id" },
          { handle: "budi", category: "food-beverage", confidence: 0.8, language: "id" },
        ],
      },
      requested,
    );

    expect(classifications).toHaveLength(2);
    expect(warnings).toHaveLength(0);
    expect(classifications[0]).toEqual({
      handle: "nana",
      category: "beauty-skincare",
      confidence: 0.9,
      language: "id",
    });
  });

  it("membuang kategori karangan alih-alih memaksanya jadi 'other'", () => {
    // "other" adalah pernyataan bahwa kontennya memang tak berkategori;
    // kode karangan berarti jawabannya tidak terbaca. Menyamakan keduanya akan
    // mengunci label palsu yang tak pernah dicoba ulang.
    const { classifications, warnings } = parseCreatorClassifications(
      {
        results: [
          { handle: "nana", category: "kecantikan", confidence: 0.9 },
          { handle: "budi", category: "food-beverage", confidence: 0.8 },
        ],
      },
      requested,
    );

    expect(classifications.map((c) => c.handle)).toEqual(["budi"]);
    expect(warnings.some((w) => w.includes("kecantikan"))).toBe(true);
  });

  it("mencocokkan handle tanpa peduli huruf besar-kecil", () => {
    const { classifications } = parseCreatorClassifications(
      { results: [{ handle: "NANA", category: "beauty-skincare", confidence: 1 }] },
      requested,
    );
    expect(classifications[0].handle).toBe("nana");
  });

  it("mengabaikan handle yang tidak pernah diminta", () => {
    const { classifications, warnings } = parseCreatorClassifications(
      {
        results: [
          { handle: "orang-asing", category: "beauty-skincare", confidence: 1 },
        ],
      },
      requested,
    );

    expect(classifications).toHaveLength(0);
    expect(warnings.some((w) => w.includes("orang-asing"))).toBe(true);
  });

  it("menjepit confidence ke rentang 0-1", () => {
    const { classifications } = parseCreatorClassifications(
      {
        results: [
          { handle: "nana", category: "beauty-skincare", confidence: 5 },
          { handle: "budi", category: "food-beverage", confidence: -2 },
        ],
      },
      requested,
    );

    expect(classifications[0].confidence).toBe(1);
    expect(classifications[1].confidence).toBe(0);
  });

  it("menormalkan kode bahasa dan menolak yang tidak masuk akal", () => {
    const { classifications } = parseCreatorClassifications(
      {
        results: [
          { handle: "nana", category: "beauty-skincare", confidence: 1, language: "ID" },
          { handle: "budi", category: "food-beverage", confidence: 1, language: "bahasa indonesia" },
        ],
      },
      requested,
    );

    expect(classifications[0].language).toBe("id");
    // "bahasa indonesia" dipotong jadi "ba" — bukan kode sah, jadi ditolak.
    expect(classifications[1].language).toBeNull();
  });

  it("mengambil jawaban pertama saat satu handle dijawab dua kali", () => {
    const { classifications } = parseCreatorClassifications(
      {
        results: [
          { handle: "nana", category: "beauty-skincare", confidence: 0.9 },
          { handle: "nana", category: "gaming", confidence: 0.1 },
        ],
      },
      requested,
    );

    expect(classifications).toHaveLength(1);
    expect(classifications[0].category).toBe("beauty-skincare");
  });

  it("tidak meledak saat jawaban AI berbentuk lain", () => {
    for (const raw of [null, undefined, "teks biasa", {}, { results: "bukan array" }]) {
      const { classifications, warnings } = parseCreatorClassifications(
        raw,
        requested,
      );
      expect(classifications).toHaveLength(0);
      expect(warnings.length).toBeGreaterThan(0);
    }
  });

  it("melaporkan kreator yang tidak terjawab", () => {
    const { warnings } = parseCreatorClassifications(
      { results: [{ handle: "nana", category: "beauty-skincare", confidence: 1 }] },
      requested,
    );
    expect(warnings.some((w) => w.includes("1 dari 2"))).toBe(true);
  });
});
