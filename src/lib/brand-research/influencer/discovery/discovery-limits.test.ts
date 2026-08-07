import { describe, expect, it } from "vitest";
import {
  dedupeDiscoveryTerms,
  MAX_DISCOVERY_TERM_LENGTH,
  normalizeDiscoveryTerm,
  parseDiscoveryTerms,
} from "@/lib/brand-research/influencer/discovery/discovery-limits";

describe("normalizeDiscoveryTerm", () => {
  it("membuang tanda pagar dan spasi berlebih", () => {
    expect(normalizeDiscoveryTerm("  #skincarelokal  ")).toBe("skincarelokal");
    expect(normalizeDiscoveryTerm("##double")).toBe("double");
    expect(normalizeDiscoveryTerm("review   skincare")).toBe("review skincare");
  });

  it("menyamakan huruf besar-kecil — hashtag tidak peka kapitalisasi", () => {
    expect(normalizeDiscoveryTerm("#SkincareLokal")).toBe("skincarelokal");
  });

  it("memotong kata kunci yang kelewat panjang", () => {
    const long = "a".repeat(MAX_DISCOVERY_TERM_LENGTH + 20);
    expect(normalizeDiscoveryTerm(long)).toHaveLength(MAX_DISCOVERY_TERM_LENGTH);
  });

  it("mengembalikan string kosong untuk isian tanpa isi", () => {
    expect(normalizeDiscoveryTerm("   ")).toBe("");
    expect(normalizeDiscoveryTerm("#")).toBe("");
  });
});

describe("parseDiscoveryTerms", () => {
  it("memecah lewat koma dan baris baru", () => {
    expect(parseDiscoveryTerms("#a, #b\n#c")).toEqual(["a", "b", "c"]);
  });

  it("membuang isian kosong dari pemisah beruntun", () => {
    expect(parseDiscoveryTerms("#a,,\n , #b")).toEqual(["a", "b"]);
  });

  it("mempertahankan urutan ketik", () => {
    expect(parseDiscoveryTerms("zeta, alpha")).toEqual(["zeta", "alpha"]);
  });

  it("tidak menghasilkan apa-apa dari isian kosong", () => {
    expect(parseDiscoveryTerms("")).toEqual([]);
    expect(parseDiscoveryTerms("  ,  \n ")).toEqual([]);
  });
});

describe("dedupeDiscoveryTerms", () => {
  /**
   * Inti dari normalisasi ini: satu crawl hanya punya lima slot, dan dua
   * penulisan hashtag yang sama tidak boleh memakan dua di antaranya.
   */
  it("menyatukan penulisan berbeda dari hashtag yang sama", () => {
    expect(dedupeDiscoveryTerms(["#Skincare", "skincare", " SKINCARE "])).toEqual(
      ["skincare"],
    );
  });

  it("menormalkan daftar yang belum tersentuh parse", () => {
    expect(dedupeDiscoveryTerms([" #a ", "#B", ""])).toEqual(["a", "b"]);
  });
});
