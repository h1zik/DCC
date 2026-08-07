import { InfluencerPlatform, InfluencerTier } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  countActiveRadarFilters,
  DEFAULT_RADAR_FILTERS,
  isRadarFilterActive,
  parseRadarFilters,
  radarFilterQuery,
  type RadarFilterState,
} from "@/lib/brand-research/influencer/discovery/radar-query";

function parse(query: string): RadarFilterState {
  return parseRadarFilters(new URLSearchParams(query));
}

describe("parseRadarFilters", () => {
  it("jatuh ke default saat tidak ada parameter", () => {
    expect(parse("")).toEqual(DEFAULT_RADAR_FILTERS);
    expect(parseRadarFilters(null)).toEqual(DEFAULT_RADAR_FILTERS);
  });

  it("membaca filter yang sah", () => {
    const f = parse(
      "q=nana&platform=TIKTOK&cat=beauty-skincare&tier=MICRO&measured=1&sort=followers&page=3",
    );
    expect(f).toEqual({
      search: "nana",
      platform: InfluencerPlatform.TIKTOK,
      category: "beauty-skincare",
      tier: InfluencerTier.MICRO,
      measuredOnly: true,
      sort: "followers",
      page: 3,
    });
  });

  it("membuang nilai asing alih-alih menghasilkan daftar kosong", () => {
    // Nilai dari URL tidak boleh dipercaya: enum yang tidak dikenal harus
    // jatuh ke default, bukan menyaring habis seluruh hasil.
    const f = parse("platform=FACEBOOK&tier=RAKSASA&cat=kecantikan&sort=harga");
    expect(f.platform).toBe("all");
    expect(f.tier).toBe("all");
    expect(f.category).toBe("all");
    expect(f.sort).toBe("relevance");
  });

  it("menerima kategori khusus 'unclassified'", () => {
    expect(parse("cat=unclassified").category).toBe("unclassified");
  });

  it("menjepit nomor halaman", () => {
    // Tanpa pagar, ?page=999999 berubah jadi OFFSET raksasa di Postgres.
    expect(parse("page=0").page).toBe(1);
    expect(parse("page=-5").page).toBe(1);
    expect(parse("page=abc").page).toBe(1);
    expect(parse("page=999999").page).toBe(400);
  });

  it("memotong pencarian yang kepanjangan", () => {
    expect(parse(`q=${"a".repeat(500)}`).search).toHaveLength(100);
  });
});

describe("radarFilterQuery", () => {
  it("membuang nilai default supaya URL tetap bersih", () => {
    expect(radarFilterQuery(DEFAULT_RADAR_FILTERS)).toBe("");
  });

  it("bolak-balik tanpa kehilangan keadaan", () => {
    const original: RadarFilterState = {
      search: "nana",
      platform: InfluencerPlatform.INSTAGRAM,
      category: "food-beverage",
      tier: InfluencerTier.MID,
      measuredOnly: true,
      sort: "engagement",
      page: 4,
    };
    expect(parse(radarFilterQuery(original))).toEqual(original);
  });

  it("membuang spasi di pencarian", () => {
    expect(radarFilterQuery({ ...DEFAULT_RADAR_FILTERS, search: "   " })).toBe("");
  });
});

describe("penanda filter aktif", () => {
  it("urutan dan halaman tidak dihitung sebagai filter", () => {
    // Keduanya selalu punya nilai, jadi menghitungnya akan membuat tombol
    // reset muncul terus-menerus padahal tidak ada yang disaring.
    const f: RadarFilterState = {
      ...DEFAULT_RADAR_FILTERS,
      sort: "followers",
      page: 5,
    };
    expect(isRadarFilterActive(f)).toBe(false);
    expect(countActiveRadarFilters(f)).toBe(0);
  });

  it("menghitung tiap filter yang dipasang", () => {
    const f: RadarFilterState = {
      ...DEFAULT_RADAR_FILTERS,
      search: "nana",
      platform: InfluencerPlatform.TIKTOK,
      category: "beauty-makeup",
      tier: InfluencerTier.NANO,
      measuredOnly: true,
    };
    expect(isRadarFilterActive(f)).toBe(true);
    expect(countActiveRadarFilters(f)).toBe(5);
  });
});
