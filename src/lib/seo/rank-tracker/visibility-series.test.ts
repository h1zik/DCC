import { describe, expect, it } from "vitest";
import {
  buildAvgPositionSeries,
  buildDailyPositions,
  buildVisibilitySeries,
} from "@/lib/seo/rank-tracker/visibility-series";

// 28 Okt 2026 pukul 10:00 WIB.
const NOW = new Date("2026-10-28T03:00:00.000Z");

describe("buildDailyPositions", () => {
  it("carries each keyword's last position forward and skips days without data", () => {
    const rows = buildDailyPositions(
      [
        {
          id: "a",
          searchVolume: 100,
          snapshots: [
            { capturedAt: "2026-10-25T22:00:00.000Z", position: 5 }, // 26 Okt WIB
            { capturedAt: "2026-10-27T22:00:00.000Z", position: 3 }, // 28 Okt WIB
          ],
        },
        {
          id: "b",
          searchVolume: 100,
          snapshots: [
            { capturedAt: "2026-10-26T22:00:00.000Z", position: null }, // 27 Okt WIB
          ],
        },
      ],
      4,
      NOW,
    );
    expect(rows.map((r) => r.date)).toEqual([
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
    ]);
    expect(rows[0].keywords).toEqual([
      { id: "a", position: 5, searchVolume: 100 },
    ]);
    expect(rows[1].keywords).toEqual([
      { id: "a", position: 5, searchVolume: 100 },
      { id: "b", position: null, searchVolume: 100 },
    ]);
    expect(rows[2].keywords.find((k) => k.id === "a")?.position).toBe(3);
  });

  it("buckets by WIB day, not UTC day", () => {
    const rows = buildDailyPositions(
      [
        {
          id: "a",
          searchVolume: null,
          snapshots: [{ capturedAt: "2026-10-27T17:30:00.000Z", position: 1 }],
        },
      ],
      2,
      NOW,
    );
    expect(rows.map((r) => r.date)).toEqual(["2026-10-28"]);
  });
});

describe("buildVisibilitySeries", () => {
  it("does not spike when only one keyword is re-checked on a day", () => {
    const keywords = [
      {
        id: "top",
        searchVolume: 1000,
        snapshots: [{ capturedAt: "2026-10-26T22:00:00.000Z", position: 1 }],
      },
      {
        id: "none",
        searchVolume: 1000,
        snapshots: [
          { capturedAt: "2026-10-26T22:00:00.000Z", position: null },
          // Cek ulang manual hanya keyword ini keesokan harinya.
          { capturedAt: "2026-10-27T22:00:00.000Z", position: null },
        ],
      },
    ];
    const series = buildVisibilitySeries(keywords, 2, NOW);
    expect(series).toEqual([
      { date: "2026-10-27", score: 50 },
      { date: "2026-10-28", score: 50 },
    ]);
  });

  it("returns empty when there are no snapshots", () => {
    expect(
      buildVisibilitySeries([{ id: "a", searchVolume: 1, snapshots: [] }], 7, NOW),
    ).toEqual([]);
  });
});

describe("buildAvgPositionSeries", () => {
  it("averages ranking keywords only and skips days where none rank", () => {
    const series = buildAvgPositionSeries(
      [
        {
          id: "a",
          searchVolume: null,
          snapshots: [
            { capturedAt: "2026-10-25T22:00:00.000Z", position: null },
            { capturedAt: "2026-10-26T22:00:00.000Z", position: 4 },
          ],
        },
        {
          id: "b",
          searchVolume: null,
          snapshots: [{ capturedAt: "2026-10-26T22:00:00.000Z", position: 7 }],
        },
      ],
      3,
      NOW,
    );
    expect(series).toEqual([
      { date: "2026-10-27", avgPosition: 5.5 },
      { date: "2026-10-28", avgPosition: 5.5 },
    ]);
  });
});
