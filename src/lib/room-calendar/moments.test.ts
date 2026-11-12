import { describe, expect, it } from "vitest";
import { eachDayKey } from "./dates";
import {
  dayMomentsOf,
  indexMomentsByDay,
  momentsBetween,
  momentsOfYear,
  upcomingMajorMoments,
} from "./moments";
import { eventDays, eventTimeLabel } from "./types";

describe("moments", () => {
  it("memuat tanggal kembar tiap bulan dan menandai yang besar", () => {
    const twins = momentsOfYear(2026).filter((m) => m.kind === "twin");
    expect(twins).toHaveLength(12);
    expect(twins.find((m) => m.date === "2026-11-11")).toMatchObject({ label: "11.11", major: true });
    expect(twins.find((m) => m.date === "2026-12-12")?.label).toBe("12.12 Harbolnas");
    expect(twins.find((m) => m.date === "2026-03-03")?.major).toBeUndefined();
  });

  it("menghitung Black Friday sebagai Jumat setelah Kamis keempat November", () => {
    const of = (year: number) => momentsOfYear(year).find((m) => m.label === "Black Friday")?.date;
    expect(of(2026)).toBe("2026-11-27");
    expect(of(2027)).toBe("2027-11-26");
    expect(of(2028)).toBe("2028-11-24");
  });

  it("membuat periode gajian dari tanggal 25 sampai akhir bulan", () => {
    const feb = momentsOfYear(2028).find((m) => m.id === "gajian:2028-02");
    expect(feb).toMatchObject({ date: "2028-02-25", endDate: "2028-02-29" });
  });

  it("menandai hari raya 2027 yang belum pasti sebagai perkiraan", () => {
    const y = momentsOfYear(2027);
    expect(y.find((m) => m.label === "Idul Fitri")?.estimated).toBe(true);
    expect(y.find((m) => m.label === "Natal")?.estimated).toBeUndefined();
    expect(momentsOfYear(2026).some((m) => m.estimated)).toBe(false);
  });

  it("tetap memberi momen terhitung untuk tahun tanpa tabel libur", () => {
    const y = momentsOfYear(2030);
    expect(y.some((m) => m.kind === "holiday")).toBe(false);
    expect(y.some((m) => m.label === "11.11")).toBe(true);
  });

  it("mengambil momen yang menyentuh rentang, termasuk yang berentang", () => {
    const list = momentsBetween("2026-03-01", "2026-03-05");
    expect(list.some((m) => m.label === "Ramadan")).toBe(true);
    expect(list.some((m) => m.label === "3.3")).toBe(true);
    expect(list.some((m) => m.label === "Idul Fitri")).toBe(false);
  });

  it("mengindeks momen per hari untuk grid", () => {
    const days = eachDayKey("2026-12-20", "2026-12-31");
    const map = indexMomentsByDay(momentsBetween(days[0]!, days.at(-1)!), days);
    expect(dayMomentsOf(map, "2026-12-25").holiday?.label).toBe("Natal");
    expect(dayMomentsOf(map, "2026-12-24").payday).toBe(false);
    expect(dayMomentsOf(map, "2026-12-25").payday).toBe(true);
    expect(dayMomentsOf(map, "2026-12-22").points.map((m) => m.label)).toContain("Hari Ibu");
    expect(dayMomentsOf(map, "2026-12-21").points).toEqual([]);
  });

  it("menandai hari pertama musim", () => {
    const days = eachDayKey("2026-02-18", "2026-02-20");
    const map = indexMomentsByDay(momentsBetween(days[0]!, days.at(-1)!), days);
    expect(dayMomentsOf(map, "2026-02-18").season).toBeNull();
    expect(dayMomentsOf(map, "2026-02-19").seasonStarts).toBe(true);
    expect(dayMomentsOf(map, "2026-02-20").seasonStarts).toBe(false);
    expect(dayMomentsOf(map, "2026-02-20").season?.label).toBe("Ramadan");
  });

  it("memilih momen besar berikutnya untuk hitung mundur", () => {
    const next = upcomingMajorMoments("2026-11-12");
    expect(next.map((m) => m.label)).toEqual(["Black Friday", "12.12 Harbolnas", "Hari Ibu"]);
  });
});

describe("eventDays", () => {
  it("memakai hari WIB, bukan UTC", () => {
    // 23.30 WIB tanggal 12 = 16.30 UTC tanggal 12; 01.00 WIB tanggal 13 = 18.00 UTC tanggal 12.
    expect(eventDays({ startsAt: "2026-11-12T18:00:00.000Z", endsAt: null })).toEqual({
      start: "2026-11-13",
      end: "2026-11-13",
    });
  });

  it("tidak menghitung hari berikutnya untuk acara yang selesai tepat tengah malam", () => {
    // 20.00 WIB tanggal 12 sampai 00.00 WIB tanggal 13.
    expect(
      eventDays({ startsAt: "2026-11-12T13:00:00.000Z", endsAt: "2026-11-12T17:00:00.000Z" }),
    ).toEqual({ start: "2026-11-12", end: "2026-11-12" });
  });

  it("merentang acara sepanjang hari dari 00.00 sampai 23.59 WIB", () => {
    expect(
      eventDays({ startsAt: "2026-11-09T17:00:00.000Z", endsAt: "2026-11-12T16:59:00.000Z" }),
    ).toEqual({ start: "2026-11-10", end: "2026-11-12" });
  });

  it("menulis jam mulai dan selesai dalam WIB", () => {
    expect(
      eventTimeLabel({
        startsAt: "2026-11-12T12:00:00.000Z",
        endsAt: "2026-11-12T14:00:00.000Z",
        allDay: false,
      }),
    ).toBe("19.00–21.00");
    expect(
      eventTimeLabel({ startsAt: "2026-11-12T12:00:00.000Z", endsAt: null, allDay: true }),
    ).toBe("");
  });
});
