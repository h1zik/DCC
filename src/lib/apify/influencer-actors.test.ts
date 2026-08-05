import { InfluencerPlatform } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  buildInfluencerActorInput,
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
