import { InfluencerPlatform, SocialListeningPlatform } from "@prisma/client";
import { describe, expect, it } from "vitest";
import type { RawSocialMention } from "@/lib/research/social-listening/collect-mentions";
import {
  collectDiscoveredCreators,
  matchDiscoveryTerm,
  normalizeDiscoveredHandle,
  toInfluencerPlatform,
} from "@/lib/brand-research/influencer/discovery/handles";

function mention(
  overrides: Partial<RawSocialMention> & { author?: string },
): RawSocialMention {
  return {
    platform: SocialListeningPlatform.TIKTOK,
    externalId: `id-${Math.random()}`,
    text: "",
    likes: 0,
    comments: 0,
    views: 0,
    ...overrides,
  };
}

describe("normalizeDiscoveredHandle", () => {
  it("membuang @ dan menyeragamkan huruf kecil", () => {
    expect(normalizeDiscoveredHandle("@NanaBeauty")).toBe("nanabeauty");
    expect(normalizeDiscoveredHandle("  Budi_Skin  ")).toBe("budi_skin");
  });

  it("menerima titik — pola paling lazim di handle Indonesia", () => {
    // Ini yang akan rusak bila validasinya menumpang parseInfluencerUrl():
    // di sana "nana.beauty" terbaca sebagai domain, bukan username.
    expect(normalizeDiscoveredHandle("nana.beauty")).toBe("nana.beauty");
    expect(normalizeDiscoveredHandle("@dr.skin.id")).toBe("dr.skin.id");
  });

  it("menolak yang bukan username", () => {
    expect(normalizeDiscoveredHandle("")).toBeNull();
    expect(normalizeDiscoveredHandle(undefined)).toBeNull();
    expect(normalizeDiscoveredHandle("nama dengan spasi")).toBeNull();
    expect(normalizeDiscoveredHandle("email@domain.com")).toBeNull();
    expect(normalizeDiscoveredHandle("a".repeat(31))).toBeNull();
    // Hanya tanda baca — lolos pola karakter tapi bukan milik siapa pun.
    expect(normalizeDiscoveredHandle("...")).toBeNull();
    expect(normalizeDiscoveredHandle("___")).toBeNull();
  });
});

describe("toInfluencerPlatform", () => {
  it("memetakan platform yang bisa diaudit", () => {
    expect(toInfluencerPlatform(SocialListeningPlatform.TIKTOK)).toBe(
      InfluencerPlatform.TIKTOK,
    );
    expect(toInfluencerPlatform(SocialListeningPlatform.INSTAGRAM)).toBe(
      InfluencerPlatform.INSTAGRAM,
    );
  });
});

describe("matchDiscoveryTerm", () => {
  it("mencocokkan hashtag di caption", () => {
    expect(
      matchDiscoveryTerm("review serum baru #skincare #glowing", [
        "#skincare",
        "#haircare",
      ]),
    ).toBe("#skincare");
  });

  it("mengabaikan spasi dan garis bawah di kedua sisi", () => {
    expect(matchDiscoveryTerm("wajib coba #skincare", ["skin care"])).toBe(
      "skin care",
    );
    expect(matchDiscoveryTerm("tips #skin_care harian", ["skincare"])).toBe(
      "skincare",
    );
  });

  it("mengembalikan null bila tidak ada yang cocok", () => {
    expect(matchDiscoveryTerm("masak apa hari ini", ["#skincare"])).toBeNull();
    expect(matchDiscoveryTerm("", ["#skincare"])).toBeNull();
  });
});

describe("collectDiscoveredCreators", () => {
  it("mengubah post menjadi kreator unik", () => {
    const creators = collectDiscoveredCreators(
      [
        mention({ author: "nana.beauty", likes: 100, comments: 10 }),
        mention({ author: "budi_skin", likes: 50, comments: 5 }),
      ],
      ["#skincare"],
    );

    expect(creators).toHaveLength(2);
    expect(creators.map((c) => c.handle).sort()).toEqual([
      "budi_skin",
      "nana.beauty",
    ]);
    expect(creators[0].profileUrl).toContain("tiktok.com/@");
  });

  it("menggabungkan post dari orang yang sama dan menghitungnya", () => {
    const creators = collectDiscoveredCreators(
      [
        mention({ author: "nana.beauty", likes: 100, comments: 10 }),
        mention({ author: "@Nana.Beauty", likes: 900, comments: 90 }),
        mention({ author: "nana.beauty", likes: 20, comments: 2 }),
      ],
      ["#skincare"],
    );

    expect(creators).toHaveLength(1);
    expect(creators[0].postsSeen).toBe(3);
    // Post dengan engagement tertinggi yang disimpan, bukan yang terakhir dibaca.
    expect(creators[0].postLikes).toBe(900);
  });

  it("memisahkan handle sama di platform berbeda", () => {
    const creators = collectDiscoveredCreators(
      [
        mention({ author: "nana.beauty" }),
        mention({
          author: "nana.beauty",
          platform: SocialListeningPlatform.INSTAGRAM,
        }),
      ],
      ["#skincare"],
    );

    expect(creators).toHaveLength(2);
    expect(creators.map((c) => c.platform).sort()).toEqual([
      InfluencerPlatform.INSTAGRAM,
      InfluencerPlatform.TIKTOK,
    ]);
  });

  it("membuang mention tanpa username yang bisa dipakai", () => {
    const creators = collectDiscoveredCreators(
      [
        mention({ author: undefined }),
        mention({ author: "nama dengan spasi" }),
        mention({ author: "valid.handle" }),
      ],
      ["#skincare"],
    );

    expect(creators).toHaveLength(1);
    expect(creators[0].handle).toBe("valid.handle");
  });

  it("mengurutkan yang paling sering muncul lebih dulu", () => {
    // Urutan menentukan siapa yang bertahan saat hasil dipotong batas atas.
    const creators = collectDiscoveredCreators(
      [
        mention({ author: "sekali", likes: 10_000 }),
        mention({ author: "sering" }),
        mention({ author: "sering" }),
      ],
      ["#skincare"],
    );

    expect(creators.map((c) => c.handle)).toEqual(["sering", "sekali"]);
  });

  it("memakai kata kunci tunggal langsung tanpa menebak dari caption", () => {
    const creators = collectDiscoveredCreators(
      [mention({ author: "nana", text: "caption tanpa hashtag" })],
      ["#skincare"],
    );

    expect(creators[0].matchedTerms).toEqual(["#skincare"]);
  });

  it("mencantumkan semua kata kunci saat atribusi tidak bisa dipastikan", () => {
    // Menebak salah satu akan mencatatkan asal-usul yang keliru; menyebut
    // keduanya jujur soal apa yang sebenarnya diketahui.
    const creators = collectDiscoveredCreators(
      [mention({ author: "nana", text: "caption tanpa hashtag apa pun" })],
      ["#skincare", "#haircare"],
    );

    expect(creators[0].matchedTerms).toEqual(["#skincare, #haircare"]);
  });

  it("mengatribusikan ke kata kunci yang benar-benar ada di caption", () => {
    const creators = collectDiscoveredCreators(
      [mention({ author: "nana", text: "rutinitas #haircare mingguan" })],
      ["#skincare", "#haircare"],
    );

    expect(creators[0].matchedTerms).toEqual(["#haircare"]);
  });

  it("mengumpulkan SEMUA kata kunci yang memunculkan satu orang", () => {
    // Inilah sinyal relevansinya: orang yang tertangkap di tiga hashtag beauty
    // jauh lebih pasti seorang beauty creator daripada yang tertangkap sekali.
    // Kalau kata kunci kedua dan ketiga dibuang, sinyal itu hilang sama sekali.
    const creators = collectDiscoveredCreators(
      [
        mention({ author: "nana", text: "pagi #skincare" }),
        mention({ author: "nana", text: "sore #haircare" }),
        mention({ author: "nana", text: "malam #skincare lagi" }),
      ],
      ["#skincare", "#haircare"],
    );

    expect(creators).toHaveLength(1);
    expect(creators[0].matchedTerms.sort()).toEqual(["#haircare", "#skincare"]);
    expect(creators[0].postsSeen).toBe(3);
  });

  it("tidak menggandakan kata kunci yang sama", () => {
    const creators = collectDiscoveredCreators(
      [
        mention({ author: "nana", text: "satu #skincare" }),
        mention({ author: "nana", text: "dua #skincare" }),
      ],
      ["#skincare", "#haircare"],
    );

    expect(creators[0].matchedTerms).toEqual(["#skincare"]);
  });

  it("kata kunci tetap terkumpul walau post terbaik berganti", () => {
    // Post kedua menang karena engagement-nya lebih tinggi; kata kunci dari
    // post pertama tidak boleh ikut hilang bersamanya.
    const creators = collectDiscoveredCreators(
      [
        mention({ author: "nana", text: "#skincare", likes: 10 }),
        mention({ author: "nana", text: "#haircare", likes: 9000 }),
      ],
      ["#skincare", "#haircare"],
    );

    expect(creators[0].matchedTerms.sort()).toEqual(["#haircare", "#skincare"]);
    expect(creators[0].postLikes).toBe(9000);
  });
});
