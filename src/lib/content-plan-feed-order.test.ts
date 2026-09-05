import { describe, expect, it } from "vitest";
import {
  ContentPlanFeedVisibility,
  ContentPlanPlatform,
} from "@prisma/client";
import {
  contentPlanFeedExclusionReason,
  contentPlanFeedPostingTime,
  mergeContentPlanFeedOrder,
  sortContentPlanFeedAuto,
} from "./content-plan-feed-order";

const day = (d: number) => new Date(2026, 8, d).getTime();

function row(id: string, postingTime: number | null, feedPosition: number | null = null) {
  return { id, postingTime, feedPosition };
}

describe("sortContentPlanFeedAuto", () => {
  it("tanpa tanggal paling atas, lalu terbaru ke terlama, seri ikut urutan input", () => {
    const out = sortContentPlanFeedAuto([
      row("a", day(1)),
      row("u1", null),
      row("c", day(3)),
      row("b2", day(2)),
      row("u2", null),
      row("b1", day(2)),
    ]);
    expect(out.map((r) => r.id)).toEqual(["u1", "u2", "c", "b2", "b1", "a"]);
  });
});

describe("mergeContentPlanFeedOrder", () => {
  it("tanpa posisi manual = urutan otomatis", () => {
    const out = mergeContentPlanFeedOrder([row("a", day(1)), row("b", day(2))]);
    expect(out.map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("posisi manual menang, walau bertentangan dengan tanggal", () => {
    const out = mergeContentPlanFeedOrder([
      row("old", day(1), 0),
      row("new", day(5), 1),
    ]);
    expect(out.map((r) => r.id)).toEqual(["old", "new"]);
  });

  it("baris baru tanpa posisi disisipkan sebelum baris manual pertama yang lebih lama", () => {
    const out = mergeContentPlanFeedOrder([
      row("m10", day(10), 0),
      row("m5", day(5), 1),
      row("a8", day(8)),
      row("a7", day(7)),
    ]);
    expect(out.map((r) => r.id)).toEqual(["m10", "a8", "a7", "m5"]);
  });

  it("baris otomatis tanpa tanggal ditaruh paling atas dengan urutan input terjaga", () => {
    const out = mergeContentPlanFeedOrder([
      row("m10", day(10), 0),
      row("u1", null),
      row("u2", null),
    ]);
    expect(out.map((r) => r.id)).toEqual(["u1", "u2", "m10"]);
  });

  it("baris otomatis lebih lama dari semua baris manual ditaruh paling bawah", () => {
    const out = mergeContentPlanFeedOrder([
      row("m10", day(10), 0),
      row("m5", day(5), 1),
      row("a1", day(1)),
    ]);
    expect(out.map((r) => r.id)).toEqual(["m10", "m5", "a1"]);
  });

  it("baris manual tanpa tanggal tidak dipakai sebagai pembanding", () => {
    const out = mergeContentPlanFeedOrder([
      row("mu", null, 0),
      row("m5", day(5), 1),
      row("a8", day(8)),
    ]);
    expect(out.map((r) => r.id)).toEqual(["mu", "a8", "m5"]);
  });
});

describe("contentPlanFeedPostingTime", () => {
  it("menggabungkan tanggal lokal dan jam posting", () => {
    const t = contentPlanFeedPostingTime({
      tanggalPosting: new Date(2026, 8, 3, 23, 0),
      jamPosting: "09:30",
    });
    expect(t).toBe(new Date(2026, 8, 3, 9, 30).getTime());
  });

  it("null bila tanggal kosong", () => {
    expect(contentPlanFeedPostingTime({ tanggalPosting: null, jamPosting: "09:30" })).toBeNull();
  });
});

describe("contentPlanFeedExclusionReason", () => {
  const prefs = { includeArchived: false, instagramOnly: true, includeUndated: false };
  const base = {
    feedVisibility: ContentPlanFeedVisibility.AUTO,
    archivedAt: null,
    platforms: [ContentPlanPlatform.INSTAGRAM],
    tanggalPosting: new Date(2026, 8, 3),
    jamPosting: null,
  };

  it("HIDDEN selalu keluar, SHOWN selalu masuk", () => {
    expect(
      contentPlanFeedExclusionReason(
        { ...base, feedVisibility: ContentPlanFeedVisibility.HIDDEN },
        { includeArchived: true, instagramOnly: false, includeUndated: true },
      ),
    ).toBe("hidden");
    expect(
      contentPlanFeedExclusionReason(
        {
          ...base,
          feedVisibility: ContentPlanFeedVisibility.SHOWN,
          archivedAt: new Date(),
          platforms: [ContentPlanPlatform.TIKTOK],
          tanggalPosting: null,
        },
        prefs,
      ),
    ).toBeNull();
  });

  it("AUTO mengikuti preferensi: arsip, platform, tanpa tanggal", () => {
    expect(contentPlanFeedExclusionReason(base, prefs)).toBeNull();
    expect(contentPlanFeedExclusionReason({ ...base, archivedAt: new Date() }, prefs)).toBe(
      "archived",
    );
    expect(
      contentPlanFeedExclusionReason({ ...base, platforms: [ContentPlanPlatform.TIKTOK] }, prefs),
    ).toBe("platform");
    expect(contentPlanFeedExclusionReason({ ...base, platforms: [] }, prefs)).toBeNull();
    expect(contentPlanFeedExclusionReason({ ...base, tanggalPosting: null }, prefs)).toBe(
      "undated",
    );
  });
});
