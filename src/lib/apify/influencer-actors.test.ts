import { InfluencerPlatform } from "@prisma/client";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildInfluencerActorInput,
  buildTikTokFallbackActorInput,
  getInfluencerFallbackActorId,
  parseInfluencerUrl,
} from "@/lib/apify/influencer-actors";

describe("parseInfluencerUrl — Instagram", () => {
  it("reads a plain profile link", () => {
    expect(parseInfluencerUrl("https://www.instagram.com/NabilaSyakieb/")).toEqual({
      platform: InfluencerPlatform.INSTAGRAM,
      handle: "nabilasyakieb",
      profileUrl: "https://www.instagram.com/nabilasyakieb/",
    });
  });

  it("tolerates a missing scheme and tracking query", () => {
    const r = parseInfluencerUrl("instagram.com/someone?igsh=abc123");
    expect(r.handle).toBe("someone");
    expect(r.platform).toBe(InfluencerPlatform.INSTAGRAM);
  });

  it("rejects a post link because it carries no username", () => {
    expect(() =>
      parseInfluencerUrl("https://www.instagram.com/p/C4xYzAbCdEf/"),
    ).toThrow(/link post/i);
  });

  it("rejects a reel link", () => {
    expect(() =>
      parseInfluencerUrl("https://instagram.com/reel/C4xYzAbCdEf/"),
    ).toThrow(/link post/i);
  });
});

describe("parseInfluencerUrl — TikTok", () => {
  it("reads a profile link", () => {
    expect(parseInfluencerUrl("https://www.tiktok.com/@Jerome.polin")).toEqual({
      platform: InfluencerPlatform.TIKTOK,
      handle: "jerome.polin",
      profileUrl: "https://www.tiktok.com/@jerome.polin",
    });
  });

  it("extracts the username from a video link", () => {
    const r = parseInfluencerUrl("https://www.tiktok.com/@someone/video/7300000000000000000");
    expect(r.handle).toBe("someone");
    expect(r.profileUrl).toBe("https://www.tiktok.com/@someone");
  });

  it("explains that short links must be resolved first", () => {
    expect(() => parseInfluencerUrl("https://vm.tiktok.com/ZSAbCdEf/")).toThrow(
      /link pendek/i,
    );
  });
});

describe("parseInfluencerUrl — bare handles", () => {
  it("needs an explicit platform", () => {
    expect(() => parseInfluencerUrl("@someone")).toThrow(/pilih platform/i);
  });

  it("uses the fallback platform when given", () => {
    expect(parseInfluencerUrl("@Someone", InfluencerPlatform.TIKTOK)).toEqual({
      platform: InfluencerPlatform.TIKTOK,
      handle: "someone",
      profileUrl: "https://www.tiktok.com/@someone",
    });
  });

  it("rejects an empty input", () => {
    expect(() => parseInfluencerUrl("   ")).toThrow(/kosong/i);
  });

  it("rejects unsupported platforms", () => {
    expect(() => parseInfluencerUrl("https://youtube.com/@someone")).toThrow(
      /Instagram dan TikTok/i,
    );
  });
});

describe("buildInfluencerActorInput", () => {
  it("asks the Instagram actor for profile details, not a post list", () => {
    const input = buildInfluencerActorInput(InfluencerPlatform.INSTAGRAM, "someone", 24);
    expect(input.resultsType).toBe("details");
    expect(input.directUrls).toEqual(["https://www.instagram.com/someone/"]);
    expect(input.resultsLimit).toBe(24);
  });

  it("asks the TikTok actor for a profile's latest videos without media downloads", () => {
    const input = buildInfluencerActorInput(InfluencerPlatform.TIKTOK, "someone", 24);
    expect(input.profiles).toEqual(["someone"]);
    expect(input.shouldDownloadVideos).toBe(false);
    // Post yang dipin sering berumur tahunan dan merusak hitungan ritme posting.
    expect(input.excludePinnedPosts).toBe(true);
  });

  it("clamps the sample size to a sane range", () => {
    expect(
      buildInfluencerActorInput(InfluencerPlatform.TIKTOK, "a", 5000).resultsPerPage,
    ).toBe(100);
    expect(
      buildInfluencerActorInput(InfluencerPlatform.TIKTOK, "a", 1).resultsPerPage,
    ).toBe(6);
  });
});

/**
 * Scraper TikTok rutin patah ketika TikTok mengubah halamannya — dan patahnya
 * diam-diam: run tetap dilaporkan SUKSES dengan nol video. Cadangan dari vendor
 * lain adalah satu-satunya yang menolong; cadangan dari penulis yang sama akan
 * patah oleh perubahan yang sama.
 */
describe("actor cadangan", () => {
  const original = process.env.APIFY_ACTOR_TIKTOK_PROFILE_FALLBACK;

  afterEach(() => {
    if (original === undefined) delete process.env.APIFY_ACTOR_TIKTOK_PROFILE_FALLBACK;
    else process.env.APIFY_ACTOR_TIKTOK_PROFILE_FALLBACK = original;
  });

  it("memakai actor dari vendor lain sebagai default TikTok", () => {
    delete process.env.APIFY_ACTOR_TIKTOK_PROFILE_FALLBACK;
    const fallback = getInfluencerFallbackActorId(InfluencerPlatform.TIKTOK);

    expect(fallback).toBe("apidojo~tiktok-profile-scraper");
    expect(fallback).not.toContain("clockworks");
  });

  it("bisa diganti lewat env tanpa deploy ulang", () => {
    process.env.APIFY_ACTOR_TIKTOK_PROFILE_FALLBACK = "vendor~lain";
    expect(getInfluencerFallbackActorId(InfluencerPlatform.TIKTOK)).toBe(
      "vendor~lain",
    );
  });

  it("tidak mengarang cadangan Instagram yang belum diuji", () => {
    expect(getInfluencerFallbackActorId(InfluencerPlatform.INSTAGRAM)).toBeNull();
  });

  it("mengirim input sesuai skema actor cadangan", () => {
    const input = buildTikTokFallbackActorInput("someone", 24);
    expect(input).toEqual({ usernames: ["someone"], maxItems: 24 });
  });

  it("membatasi jumlah item yang diminta", () => {
    expect(buildTikTokFallbackActorInput("a", 5000).maxItems).toBe(100);
    expect(buildTikTokFallbackActorInput("a", 1).maxItems).toBe(6);
  });
});
