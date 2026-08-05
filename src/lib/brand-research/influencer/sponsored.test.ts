import { describe, expect, it } from "vitest";
import {
  extractHashtags,
  isSponsoredCaption,
  isSponsoredPost,
} from "@/lib/brand-research/influencer/sponsored";

describe("extractHashtags", () => {
  it("reads hashtags including Indonesian words and underscores", () => {
    expect(extractHashtags("Seru banget! #KerjaSama #skin_care #OOTD")).toEqual([
      "kerjasama",
      "skin_care",
      "ootd",
    ]);
  });

  it("returns nothing for captions without hashtags", () => {
    expect(extractHashtags("hari ini cerah sekali")).toEqual([]);
  });
});

describe("isSponsoredCaption", () => {
  it("detects common paid markers", () => {
    expect(isSponsoredCaption("cobain ini yuk #ad")).toBe(true);
    expect(isSponsoredCaption("makasih brand-nya #endorse")).toBe(true);
    expect(isSponsoredCaption("seneng banget #kerjasama sama mereka")).toBe(true);
    expect(isSponsoredCaption("#PaidPartnership with brand")).toBe(true);
    expect(isSponsoredCaption("Paid partnership with Somethinc")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isSponsoredCaption("#SPONSORED")).toBe(true);
    expect(isSponsoredCaption("#Endorsement")).toBe(true);
  });

  it("does not fire on words that merely start with a marker", () => {
    // Kesalahan klasik: pencocokan substring membuat #adventure jadi "#ad".
    expect(isSponsoredCaption("liburan seru #adventure")).toBe(false);
    expect(isSponsoredCaption("#adorable banget anaknya")).toBe(false);
    expect(isSponsoredCaption("#addicted sama kopi ini")).toBe(false);
  });

  it("does not fire on ordinary captions", () => {
    expect(isSponsoredCaption("sarapan dulu sebelum kerja")).toBe(false);
    expect(isSponsoredCaption(null)).toBe(false);
    expect(isSponsoredCaption("")).toBe(false);
  });
});

describe("isSponsoredPost", () => {
  it("trusts the platform marker even when the caption says nothing", () => {
    expect(
      isSponsoredPost({ caption: "hari yang menyenangkan", isSponsoredMeta: true }),
    ).toBe(true);
  });

  it("falls back to caption detection when no platform marker exists", () => {
    expect(isSponsoredPost({ caption: "produk baru #adv" })).toBe(true);
    expect(isSponsoredPost({ caption: "jalan pagi" })).toBe(false);
  });
});
