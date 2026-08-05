import { describe, expect, it } from "vitest";
import type { NormalizedComment } from "@/lib/apify/normalize-influencer";
import {
  analyzeCommentQuality,
  isLowSubstanceComment,
  isSpamComment,
  MIN_COMMENTS_FOR_QUALITY,
} from "@/lib/brand-research/influencer/comment-quality";

function posts(
  groups: { id: string; comments: NormalizedComment[] }[],
): { externalId: string; commentSamples: NormalizedComment[] }[] {
  return groups.map((g) => ({ externalId: g.id, commentSamples: g.comments }));
}

/** Sebar komentar ke beberapa post supaya melewati ambang minimal. */
function spread(comments: NormalizedComment[], perPost = 10) {
  const out: { id: string; comments: NormalizedComment[] }[] = [];
  for (let i = 0; i < comments.length; i += perPost) {
    out.push({ id: `p${i / perPost}`, comments: comments.slice(i, i + perPost) });
  }
  return posts(out);
}

describe("isLowSubstanceComment", () => {
  it("menandai emoji, pujian satu kata, dan mention kosong", () => {
    expect(isLowSubstanceComment("🔥🔥🔥")).toBe(true);
    expect(isLowSubstanceComment("mantap")).toBe(true);
    expect(isLowSubstanceComment("keren banget")).toBe(true);
    expect(isLowSubstanceComment("nice 🔥")).toBe(true);
    expect(isLowSubstanceComment("@budi.santoso")).toBe(true);
    expect(isLowSubstanceComment("   ")).toBe(true);
  });

  it("tidak menandai komentar yang menunjukkan minat nyata", () => {
    expect(isLowSubstanceComment("Kak ini harganya berapa ya?")).toBe(false);
    expect(isLowSubstanceComment("Udah cobain yang varian coklat, enak sih")).toBe(
      false,
    );
    // Dua kata tapi bukan pujian generik — tetap dihitung bersubstansi.
    expect(isLowSubstanceComment("racun banget")).toBe(false);
  });
});

describe("isSpamComment", () => {
  it("menangkap ajakan jualan yang khas", () => {
    expect(isSpamComment("cek bio ya kak")).toBe(true);
    expect(isSpamComment("Follow back dong")).toBe(true);
    expect(isSpamComment("wa 081234567890 buat order")).toBe(true);
    expect(isSpamComment("Klik link buat daftar")).toBe(true);
  });

  it("membiarkan komentar biasa", () => {
    expect(isSpamComment("Bagus banget kontennya kak, ditunggu part 2")).toBe(false);
  });
});

describe("analyzeCommentQuality", () => {
  it("menolak menyimpulkan dari sampel yang terlalu kecil", () => {
    const few = Array.from({ length: MIN_COMMENTS_FOR_QUALITY - 1 }, (_, i) => ({
      text: `komentar nomor ${i} yang cukup panjang`,
      author: `user${i}`,
    }));

    expect(analyzeCommentQuality(spread(few))).toBeNull();
    expect(analyzeCommentQuality([])).toBeNull();
    expect(analyzeCommentQuality([{ externalId: "a" }])).toBeNull();
  });

  it("mengukur kolom komentar yang sehat sebagai bersubstansi", () => {
    const healthy = Array.from({ length: 30 }, (_, i) => ({
      text: `Kak varian yang nomor ${i} ini cocok buat kulit berminyak nggak?`,
      author: `user${i}`,
    }));
    const r = analyzeCommentQuality(spread(healthy));

    expect(r).not.toBeNull();
    expect(r?.analyzedComments).toBe(30);
    expect(r?.postsWithComments).toBe(3);
    expect(r?.lowSubstanceShare).toBe(0);
    expect(r?.spamShare).toBe(0);
    expect(r?.uniqueAuthorRatio).toBe(1);
  });

  it("mengukur kolom komentar yang isinya emoji semua", () => {
    const shallow = Array.from({ length: 30 }, (_, i) => ({
      text: i % 2 === 0 ? "🔥🔥" : "mantap",
      author: `user${i}`,
    }));
    const r = analyzeCommentQuality(spread(shallow));

    expect(r?.lowSubstanceShare).toBe(1);
    // Teks yang persis sama berulang ikut terhitung.
    expect(r?.duplicateShare).toBe(1);
  });

  it("menghitung komentar dari lingkaran akun yang sama", () => {
    // Tiga akun yang sama muncul di semua post — pola khas engagement pod.
    const comments: NormalizedComment[] = [];
    for (let post = 0; post < 3; post += 1) {
      for (let i = 0; i < 10; i += 1) {
        comments.push({
          text: `Komentar panjang yang berbeda-beda nomor ${post}-${i}`,
          author: i < 6 ? `pod${i}` : `warga${post}${i}`,
        });
      }
    }
    const r = analyzeCommentQuality(spread(comments));

    expect(r?.repeatAuthorShare).toBeCloseTo(0.6, 2);
    expect(r?.uniqueAuthorRatio as number).toBeLessThan(1);
  });

  it("mengukur spam dan aksara asing", () => {
    const comments: NormalizedComment[] = [
      ...Array.from({ length: 12 }, (_, i) => ({
        text: "cek bio ya kak ada promo",
        author: `spam${i}`,
      })),
      ...Array.from({ length: 6 }, (_, i) => ({
        text: "очень красиво спасибо",
        author: `ru${i}`,
      })),
      ...Array.from({ length: 12 }, (_, i) => ({
        text: `Ini beneran bagus sih, aku pakai sudah ${i} bulan`,
        author: `asli${i}`,
      })),
    ];
    const r = analyzeCommentQuality(spread(comments));

    expect(r?.spamShare).toBeCloseTo(0.4, 1);
    expect(r?.foreignScriptShare).toBeCloseTo(0.2, 1);
  });

  it("mengabaikan komentar kosong", () => {
    const comments = [
      ...Array.from({ length: 30 }, (_, i) => ({
        text: `Pertanyaan yang cukup panjang nomor ${i}`,
        author: `u${i}`,
      })),
      { text: "   ", author: "kosong" },
    ];
    const r = analyzeCommentQuality(spread(comments));

    expect(r?.analyzedComments).toBe(30);
  });
});
