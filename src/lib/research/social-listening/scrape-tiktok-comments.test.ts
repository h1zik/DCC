import { describe, expect, it } from "vitest";
import { SocialListeningPlatform } from "@prisma/client";
import {
  buildTikTokCommentsInput,
  canonicalTikTokVideoUrl,
  normalizeTikTokVideoUrl,
  parseTikTokCommentItems,
  pickTikTokPostsForCommentScrape,
} from "@/lib/research/social-listening/scrape-tiktok-comments";

describe("normalizeTikTokVideoUrl", () => {
  it("strips query string and normalizes path", () => {
    expect(
      normalizeTikTokVideoUrl(
        "https://www.tiktok.com/@user/video/123?utm_source=foo",
      ),
    ).toBe("/@user/video/123");
  });
});

describe("canonicalTikTokVideoUrl", () => {
  it("returns clean URL without query or hash", () => {
    expect(
      canonicalTikTokVideoUrl(
        "https://www.tiktok.com/@user/video/123?_r=1&u_code=abc#fragment",
      ),
    ).toBe("https://www.tiktok.com/@user/video/123");
  });
});

describe("pickTikTokPostsForCommentScrape", () => {
  it("only includes TikTok posts with comments > 0, sorted by engagement", () => {
    const picked = pickTikTokPostsForCommentScrape(
      [
        {
          platform: SocialListeningPlatform.TIKTOK,
          externalId: "a",
          text: "viral no comments",
          url: "https://www.tiktok.com/@a/video/1",
          likes: 50_000,
          comments: 0,
          views: 1_000_000,
        },
        {
          platform: SocialListeningPlatform.TIKTOK,
          externalId: "b",
          text: "has comments",
          url: "https://www.tiktok.com/@b/video/2",
          likes: 100,
          comments: 50,
          views: 10_000,
        },
        {
          platform: SocialListeningPlatform.TIKTOK,
          externalId: "c",
          text: "more comments",
          url: "https://www.tiktok.com/@c/video/3",
          likes: 200,
          comments: 200,
          views: 20_000,
        },
        {
          platform: SocialListeningPlatform.INSTAGRAM,
          externalId: "ig",
          text: "skip ig",
          url: "https://www.instagram.com/p/1",
          likes: 999,
          comments: 999,
          views: 999,
        },
      ],
      2,
    );

    expect(picked.map((m) => m.externalId)).toEqual(["c", "b"]);
  });
});

describe("buildTikTokCommentsInput", () => {
  it("targets clockworks comments scraper schema", () => {
    expect(
      buildTikTokCommentsInput(["https://www.tiktok.com/@u/video/1"], 50),
    ).toEqual({
      postURLs: ["https://www.tiktok.com/@u/video/1"],
      commentsPerPost: 50,
      topLevelCommentsPerPost: 50,
      maxRepliesPerComment: 0,
    });
  });
});

describe("parseTikTokCommentItems", () => {
  it("maps comment rows to parent mention via videoWebUrl", () => {
    const parentByVideoUrl = new Map([
      ["/@bellapoarch/video/6862153058223197445", "post-1"],
    ]);

    const parsed = parseTikTokCommentItems(
      [
        {
          text: "Packaging kecil travel size dong please",
          diggCount: 42,
          createTimeISO: "2024-08-06T11:21:16.000Z",
          uniqueId: "beauty_id",
          videoWebUrl:
            "https://www.tiktok.com/@bellapoarch/video/6862153058223197445",
          cid: "7399984975553086214",
        },
        {
          errorCode: "NOT_FOUND",
          text: "should skip",
          videoWebUrl:
            "https://www.tiktok.com/@bellapoarch/video/6862153058223197445",
        },
      ],
      parentByVideoUrl,
    );

    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      platform: SocialListeningPlatform.TIKTOK,
      externalId: "tt-7399984975553086214",
      text: "Packaging kecil travel size dong please",
      author: "beauty_id",
      likes: 42,
      parentExternalId: "post-1",
    });
  });
});
