import { describe, expect, it } from "vitest";
import { enrichAdMediaFromRaw, normalizeMetaAds } from "./normalize-meta-ads";

describe("normalizeMetaAds — video extraction", () => {
  it("extracts video URL nested under snapshot.videos", () => {
    const [ad] = normalizeMetaAds([
      {
        ad_archive_id: "123",
        snapshot: {
          videos: [
            {
              video_hd_url: "https://video.fbcdn.net/v/abc.mp4",
              video_preview_image_url: "https://scontent.fbcdn.net/poster.jpg",
            },
          ],
        },
      },
    ]);

    expect(ad?.videoUrl).toBe("https://video.fbcdn.net/v/abc.mp4");
    expect(ad?.mediaType).toBe("VIDEO");
    expect(ad?.imageUrl).toBe("https://scontent.fbcdn.net/poster.jpg");
  });

  it("extracts video URL from cards[]", () => {
    const [ad] = normalizeMetaAds([
      {
        id: "456",
        cards: [{ video_sd_url: "https://video.fbcdn.net/v/card.mp4" }],
      },
    ]);
    expect(ad?.videoUrl).toBe("https://video.fbcdn.net/v/card.mp4");
  });
});

describe("enrichAdMediaFromRaw — backfill stored ads", () => {
  it("backfills videoUrl from rawData when stored value is null", () => {
    const enriched = enrichAdMediaFromRaw({
      imageUrl: "https://scontent.fbcdn.net/poster.jpg",
      videoUrl: null,
      rawData: {
        snapshot: {
          videos: [{ video_hd_url: "https://video.fbcdn.net/v/old.mp4" }],
        },
      },
    });
    expect(enriched.videoUrl).toBe("https://video.fbcdn.net/v/old.mp4");
    expect(enriched.imageUrl).toBe("https://scontent.fbcdn.net/poster.jpg");
  });

  it("keeps existing values untouched when nothing to backfill", () => {
    const ad = {
      imageUrl: "https://scontent.fbcdn.net/a.jpg",
      videoUrl: "https://video.fbcdn.net/v/keep.mp4",
      rawData: {},
    };
    expect(enrichAdMediaFromRaw(ad)).toBe(ad);
  });
});
