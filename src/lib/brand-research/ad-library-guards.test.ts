import { describe, expect, it } from "vitest";
import {
  adMatchesSearchTerms,
  filterAdsBySearchRelevance,
} from "./ad-library-relevance";
import {
  filterSafeAdLibraryAds,
  isBlockedAdLibraryAd,
} from "./ad-library-safety";

describe("ad-library-relevance", () => {
  it("does not treat Meta searchTerm alone as a keyword match", () => {
    const ad = {
      bodyText: "Hot singles near you",
      linkTitle: null,
      pageName: "Adult Page",
      linkUrl: "https://example.com",
      rawData: { searchTerm: "parfum" },
    };
    expect(adMatchesSearchTerms(ad, ["parfum"])).toBe(false);
  });

  it("matches when keyword appears in ad copy", () => {
    const ad = {
      bodyText: "Parfum premium dengan wangi tahan lama",
      linkTitle: null,
      pageName: "Brand Parfum",
      linkUrl: null,
      rawData: { searchTerm: "parfum" },
    };
    expect(adMatchesSearchTerms(ad, ["parfum"])).toBe(true);
  });

  it("rejects ads with no creative text for keyword monitors", () => {
    const ad = {
      bodyText: null,
      linkTitle: null,
      pageName: null,
      linkUrl: "https://shop.com/parfum",
      rawData: { searchTerm: "parfum" },
    };
    expect(adMatchesSearchTerms(ad, ["parfum"])).toBe(false);
  });
});

describe("ad-library-safety", () => {
  it("blocks obvious adult ad copy", () => {
    expect(
      isBlockedAdLibraryAd({
        bodyText: "Watch free porn videos now",
        linkTitle: null,
        pageName: "Site",
        linkUrl: null,
      }),
    ).toBe(true);
  });

  it("allows normal perfume ad copy", () => {
    expect(
      isBlockedAdLibraryAd({
        bodyText: "Parfum elegan untuk pria modern",
        linkTitle: "Cologne premium",
        pageName: "Fragrance ID",
        linkUrl: "https://shop.example/parfum",
      }),
    ).toBe(false);
  });
});

describe("combined filters", () => {
  it("removes irrelevant Meta results even when searchTerm matches", () => {
    const ads = [
      {
        bodyText: "Parfum mewah",
        linkTitle: null,
        pageName: "OK",
        linkUrl: null,
        rawData: { searchTerm: "parfum" },
      },
      {
        bodyText: "Click for hot dating",
        linkTitle: null,
        pageName: "Bad",
        linkUrl: null,
        rawData: { searchTerm: "parfum" },
      },
    ];
    const relevant = filterAdsBySearchRelevance(ads, ["parfum"]);
    const safe = filterSafeAdLibraryAds(relevant);
    expect(safe).toHaveLength(1);
    expect(safe[0]?.pageName).toBe("OK");
  });
});
