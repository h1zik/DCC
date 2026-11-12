import {
  addDaysKey,
  lastDayOfMonth,
  makeDayKey,
  rangesOverlap,
  weekdayIndex,
  type DayKey,
} from "./dates";

/**
 * Momen marketing & hari libur untuk lapisan kalender. Murni, tanpa database:
 * sebagian dihitung (tanggal kembar, gajian, Black Friday), sebagian tabel per
 * tahun (libur nasional, Ramadan).
 *
 * Tanggal yang mengikuti kalender Hijriah/Saka/Buddhis baru pasti setelah SKB
 * libur nasional terbit. Selama belum dicocokkan, entrinya diberi
 * `estimated: true` dan UI menampilkan keterangan "perkiraan".
 */

export type MomentKind =
  /** Libur nasional: angka tanggal merah. */
  | "holiday"
  /** Tanggal kembar (9.9, 11.11, …). */
  | "twin"
  /** Momen belanja lain (Black Friday, Hari Pelanggan). */
  | "commerce"
  /** Hari peringatan yang sering dipakai tema konten. */
  | "cultural"
  /** Periode gajian: 25 sampai akhir bulan. */
  | "payday"
  /** Musim panjang, mis. Ramadan. */
  | "season";

export type Moment = {
  id: string;
  date: DayKey;
  /** Terisi untuk momen berentang (gajian, Ramadan). */
  endDate?: DayKey;
  label: string;
  kind: MomentKind;
  /** Momen besar: ikut hitung mundur dan diberi penanda lebih tegas. */
  major?: boolean;
  estimated?: boolean;
};

type YearEntry = {
  date: string;
  endDate?: string;
  label: string;
  kind: MomentKind;
  major?: boolean;
  estimated?: boolean;
};

/**
 * Libur nasional & musim per tahun (bulan-hari "MM-DD").
 * 2026 mengikuti SKB Tiga Menteri tentang libur nasional 2026.
 * 2027: tanggal Masehi tetap dan hari raya Kristen (dihitung dari Paskah)
 * sudah pasti; yang berbasis hilal/kalender lunar masih perkiraan.
 */
const YEAR_TABLE: Record<number, YearEntry[]> = {
  2026: [
    { date: "01-01", label: "Tahun Baru", kind: "holiday" },
    { date: "01-16", label: "Isra Mikraj", kind: "holiday" },
    { date: "02-17", label: "Imlek", kind: "holiday", major: true },
    { date: "02-19", endDate: "03-20", label: "Ramadan", kind: "season", major: true },
    { date: "03-19", label: "Nyepi", kind: "holiday" },
    { date: "03-21", label: "Idul Fitri", kind: "holiday", major: true },
    { date: "03-22", label: "Idul Fitri", kind: "holiday" },
    { date: "04-03", label: "Wafat Yesus Kristus", kind: "holiday" },
    { date: "04-05", label: "Paskah", kind: "holiday" },
    { date: "05-01", label: "Hari Buruh", kind: "holiday" },
    { date: "05-14", label: "Kenaikan Yesus Kristus", kind: "holiday" },
    { date: "05-27", label: "Idul Adha", kind: "holiday" },
    { date: "05-31", label: "Waisak", kind: "holiday" },
    { date: "06-01", label: "Hari Lahir Pancasila", kind: "holiday" },
    { date: "06-16", label: "Tahun Baru Islam", kind: "holiday" },
    { date: "08-17", label: "Hari Kemerdekaan", kind: "holiday", major: true },
    { date: "08-25", label: "Maulid Nabi", kind: "holiday" },
    { date: "12-25", label: "Natal", kind: "holiday", major: true },
  ],
  2027: [
    { date: "01-01", label: "Tahun Baru", kind: "holiday" },
    { date: "01-05", label: "Isra Mikraj", kind: "holiday", estimated: true },
    { date: "02-06", label: "Imlek", kind: "holiday", major: true },
    {
      date: "02-08",
      endDate: "03-09",
      label: "Ramadan",
      kind: "season",
      major: true,
      estimated: true,
    },
    { date: "03-08", label: "Nyepi", kind: "holiday", estimated: true },
    { date: "03-10", label: "Idul Fitri", kind: "holiday", major: true, estimated: true },
    { date: "03-11", label: "Idul Fitri", kind: "holiday", estimated: true },
    { date: "03-26", label: "Wafat Yesus Kristus", kind: "holiday" },
    { date: "03-28", label: "Paskah", kind: "holiday" },
    { date: "05-01", label: "Hari Buruh", kind: "holiday" },
    { date: "05-06", label: "Kenaikan Yesus Kristus", kind: "holiday" },
    { date: "05-17", label: "Idul Adha", kind: "holiday", estimated: true },
    { date: "05-20", label: "Waisak", kind: "holiday", estimated: true },
    { date: "06-01", label: "Hari Lahir Pancasila", kind: "holiday" },
    { date: "06-06", label: "Tahun Baru Islam", kind: "holiday", estimated: true },
    { date: "08-15", label: "Maulid Nabi", kind: "holiday", estimated: true },
    { date: "08-17", label: "Hari Kemerdekaan", kind: "holiday", major: true },
    { date: "12-25", label: "Natal", kind: "holiday", major: true },
  ],
};

/** Peringatan bertanggal tetap yang berulang tiap tahun. */
const RECURRING: YearEntry[] = [
  { date: "02-14", label: "Valentine", kind: "cultural", major: true },
  { date: "03-08", label: "Hari Perempuan Internasional", kind: "cultural" },
  { date: "04-21", label: "Hari Kartini", kind: "cultural" },
  { date: "09-04", label: "Hari Pelanggan Nasional", kind: "commerce" },
  { date: "10-02", label: "Hari Batik Nasional", kind: "cultural" },
  { date: "12-22", label: "Hari Ibu", kind: "cultural", major: true },
];

/** Tahun yang punya tabel libur nasional. Di luar ini hanya momen terhitung. */
export const HOLIDAY_YEARS = Object.keys(YEAR_TABLE).map(Number);

const MAJOR_TWINS = new Set([9, 10, 11, 12]);

/** Jumat setelah Kamis keempat November. */
function blackFriday(year: number): DayKey {
  const first = makeDayKey(year, 10, 1);
  // weekdayIndex: 0 = Senin, jadi Kamis = 3.
  const toThursday = (3 - weekdayIndex(first) + 7) % 7;
  return addDaysKey(first, toThursday + 21 + 1);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

const yearCache = new Map<number, Moment[]>();

/** Semua momen dalam satu tahun kalender, terurut tanggal. */
export function momentsOfYear(year: number): Moment[] {
  const cached = yearCache.get(year);
  if (cached) return cached;

  const out: Moment[] = [];
  const push = (e: YearEntry, source: string) => {
    out.push({
      id: `${source}:${year}-${e.date}:${e.label}`,
      date: `${year}-${e.date}`,
      ...(e.endDate ? { endDate: `${year}-${e.endDate}` } : {}),
      label: e.label,
      kind: e.kind,
      ...(e.major ? { major: true } : {}),
      ...(e.estimated ? { estimated: true } : {}),
    });
  };

  for (const e of YEAR_TABLE[year] ?? []) push(e, "id");
  for (const e of RECURRING) push(e, "tetap");

  for (let m = 1; m <= 12; m++) {
    const date = `${pad(m)}-${pad(m)}`;
    push(
      {
        date,
        label: m === 12 ? "12.12 Harbolnas" : `${m}.${m}`,
        kind: "twin",
        major: MAJOR_TWINS.has(m),
      },
      "kembar",
    );
    const monthKey = `${year}-${pad(m)}`;
    out.push({
      id: `gajian:${monthKey}`,
      date: `${monthKey}-25`,
      endDate: lastDayOfMonth(monthKey),
      label: "Periode gajian",
      kind: "payday",
    });
  }

  out.push({
    id: `bf:${year}`,
    date: blackFriday(year),
    label: "Black Friday",
    kind: "commerce",
    major: true,
  });

  out.sort((a, b) => (a.date === b.date ? a.label.localeCompare(b.label) : a.date < b.date ? -1 : 1));
  yearCache.set(year, out);
  return out;
}

/** Momen yang menyentuh rentang `from`–`to` (inklusif). */
export function momentsBetween(from: DayKey, to: DayKey): Moment[] {
  if (to < from) return [];
  const startYear = Number(from.slice(0, 4));
  const endYear = Number(to.slice(0, 4));
  const out: Moment[] = [];
  for (let y = startYear; y <= endYear; y++) {
    for (const m of momentsOfYear(y)) {
      if (rangesOverlap(m.date, m.endDate ?? m.date, from, to)) out.push(m);
    }
  }
  return out;
}

export type DayMoments = {
  /** Momen bertanggal tunggal di hari ini (libur, tanggal kembar, peringatan). */
  points: Moment[];
  holiday: Moment | null;
  payday: boolean;
  /** Musim yang sedang berjalan di hari ini, mis. Ramadan. */
  season: Moment | null;
  /** Hari pertama musim → label ditampilkan sekali. */
  seasonStarts: boolean;
};

const EMPTY_DAY: DayMoments = {
  points: [],
  holiday: null,
  payday: false,
  season: null,
  seasonStarts: false,
};

/** Indeks momen per hari untuk grid bulan. */
export function indexMomentsByDay(
  moments: readonly Moment[],
  days: readonly DayKey[],
): Map<DayKey, DayMoments> {
  const map = new Map<DayKey, DayMoments>();
  const wanted = new Set(days);
  const get = (day: DayKey) => {
    let entry = map.get(day);
    if (!entry) {
      entry = { points: [], holiday: null, payday: false, season: null, seasonStarts: false };
      map.set(day, entry);
    }
    return entry;
  };

  for (const m of moments) {
    if (m.kind === "payday" || m.kind === "season") {
      const end = m.endDate ?? m.date;
      for (const day of days) {
        if (day < m.date || day > end) continue;
        const entry = get(day);
        if (m.kind === "payday") entry.payday = true;
        else {
          entry.season = m;
          entry.seasonStarts = day === m.date;
        }
      }
      continue;
    }
    if (!wanted.has(m.date)) continue;
    const entry = get(m.date);
    entry.points.push(m);
    if (m.kind === "holiday" && !entry.holiday) entry.holiday = m;
  }
  return map;
}

export function dayMomentsOf(map: Map<DayKey, DayMoments>, day: DayKey): DayMoments {
  return map.get(day) ?? EMPTY_DAY;
}

/** Momen besar berikutnya sejak `today` (untuk hitung mundur). */
export function upcomingMajorMoments(today: DayKey, horizonDays = 120, limit = 3): Moment[] {
  const seen = new Set<string>();
  return momentsBetween(today, addDaysKey(today, horizonDays))
    .filter((m) => m.major && m.date >= today)
    .filter((m) => {
      // Idul Fitri dua hari cukup muncul sekali.
      const id = `${m.label}:${m.date.slice(0, 4)}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .slice(0, limit);
}
