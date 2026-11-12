import { describe, expect, it } from "vitest";
import {
  addDaysKey,
  countdownLabel,
  diffDays,
  formatDayRange,
  isDayKey,
  monthGrid,
  shiftMonth,
  weekdayIndex,
} from "./dates";
import { layoutWeek, packLanes } from "./layout";

describe("dates", () => {
  it("menghitung hari tanpa terpengaruh zona waktu", () => {
    expect(addDaysKey("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDaysKey("2027-01-01", -1)).toBe("2026-12-31");
    expect(diffDays("2026-11-12", "2026-12-12")).toBe(30);
    expect(diffDays("2026-12-12", "2026-11-12")).toBe(-30);
  });

  it("memakai Senin sebagai awal minggu", () => {
    // 12 November 2026 adalah Kamis.
    expect(weekdayIndex("2026-11-12")).toBe(3);
    expect(weekdayIndex("2026-11-09")).toBe(0);
    expect(weekdayIndex("2026-11-15")).toBe(6);
  });

  it("membuat grid bulan 6 minggu yang memuat seluruh bulan", () => {
    const grid = monthGrid("2026-11");
    expect(grid).toHaveLength(6);
    expect(grid.every((w) => w.length === 7)).toBe(true);
    // 1 November 2026 jatuh hari Minggu → minggu pertama mulai 26 Oktober.
    expect(grid[0]![0]).toBe("2026-10-26");
    expect(grid[0]![6]).toBe("2026-11-01");
    expect(grid.flat()).toContain("2026-11-30");
  });

  it("menggeser bulan melewati batas tahun", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });

  it("menolak kunci hari yang tidak nyata", () => {
    expect(isDayKey("2026-11-12")).toBe(true);
    expect(isDayKey("2026-02-30")).toBe(false);
    expect(isDayKey("12-11-2026")).toBe(false);
    expect(isDayKey(null)).toBe(false);
  });

  it("menulis hitung mundur gaya H-n", () => {
    expect(countdownLabel("2026-11-12", "2026-11-12")).toBe("Hari ini");
    expect(countdownLabel("2026-11-12", "2026-11-13")).toBe("Besok");
    expect(countdownLabel("2026-11-12", "2026-12-12")).toBe("H-30");
    expect(countdownLabel("2026-11-12", "2026-11-10")).toBe("H+2");
  });

  it("meringkas rentang tanggal", () => {
    expect(formatDayRange("2026-11-03", "2026-11-03")).toBe("3 Nov");
    expect(formatDayRange("2026-11-03", "2026-11-11")).toBe("3–11 Nov");
    expect(formatDayRange("2026-11-28", "2026-12-05")).toBe("28 Nov – 5 Des");
    expect(formatDayRange("2026-12-28", "2027-01-03")).toBe("28 Des 2026 – 3 Jan 2027");
  });
});

describe("layoutWeek", () => {
  const week = monthGrid("2026-11")[2]!; // 9–15 November 2026

  it("memotong rentang di tepi minggu dan menandai sambungannya", () => {
    const { segments } = layoutWeek(week, [
      { id: "mega", start: "2026-11-03", end: "2026-11-11" },
      { id: "glow", start: "2026-11-14", end: "2026-11-30" },
    ]);
    const mega = segments.find((s) => s.id === "mega")!;
    expect(mega).toMatchObject({ colStart: 0, colEnd: 2, continuesBefore: true, continuesAfter: false });
    const glow = segments.find((s) => s.id === "glow")!;
    expect(glow).toMatchObject({ colStart: 5, colEnd: 6, continuesBefore: false, continuesAfter: true });
  });

  it("menaruh rentang yang tidak beririsan di lajur yang sama", () => {
    const { segments, laneCount } = layoutWeek(week, [
      { id: "a", start: "2026-11-09", end: "2026-11-10" },
      { id: "b", start: "2026-11-12", end: "2026-11-13" },
    ]);
    expect(laneCount).toBe(1);
    expect(segments.map((s) => s.lane)).toEqual([0, 0]);
  });

  it("memisahkan rentang yang beririsan ke lajur berbeda tanpa tumpang tindih", () => {
    const { segments, laneCount } = layoutWeek(week, [
      { id: "a", start: "2026-11-09", end: "2026-11-12" },
      { id: "b", start: "2026-11-11", end: "2026-11-14" },
      { id: "c", start: "2026-11-12", end: "2026-11-12" },
    ]);
    expect(laneCount).toBe(3);
    for (const x of segments) {
      for (const y of segments) {
        if (x === y || x.lane !== y.lane) continue;
        expect(x.colEnd < y.colStart || y.colEnd < x.colStart).toBe(true);
      }
    }
  });

  it("menghitung yang tidak muat per hari saat lajur dibatasi", () => {
    const { segments, hiddenByCol } = layoutWeek(
      week,
      [
        { id: "a", start: "2026-11-09", end: "2026-11-15" },
        { id: "b", start: "2026-11-09", end: "2026-11-15" },
        { id: "c", start: "2026-11-10", end: "2026-11-11" },
      ],
      2,
    );
    expect(segments.map((s) => s.id).sort()).toEqual(["a", "b"]);
    expect(hiddenByCol).toEqual([0, 1, 1, 0, 0, 0, 0]);
  });

  it("mengabaikan rentang di luar minggu", () => {
    const { segments } = layoutWeek(week, [
      { id: "lama", start: "2026-10-01", end: "2026-11-08" },
      { id: "nanti", start: "2026-11-16", end: "2026-11-20" },
    ]);
    expect(segments).toEqual([]);
  });
});

describe("packLanes", () => {
  it("memadatkan rentang yang tidak beririsan ke lajur yang sama", () => {
    const lanes = packLanes([
      { id: "a", start: "2026-11-01", end: "2026-11-05" },
      { id: "b", start: "2026-11-06", end: "2026-11-09" },
      { id: "c", start: "2026-11-04", end: "2026-11-07" },
    ]);
    expect(lanes.get("a")).toBe(0);
    expect(lanes.get("c")).toBe(1);
    expect(lanes.get("b")).toBe(0);
  });
});
