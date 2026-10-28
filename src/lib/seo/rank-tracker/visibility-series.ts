import { wibDayKey, wibDayKeyRange } from "@/lib/seo/rank-tracker/day-key";
import {
  visibilityScore,
  type VisibilityKeyword,
} from "@/lib/seo/rank-tracker/visibility";

/**
 * Time-series harian (kalender WIB) dengan carry-forward: posisi sebuah
 * keyword pada hari D = snapshot terakhirnya pada atau sebelum D. Keyword yang
 * belum punya snapshot sampai hari D tidak ikut dihitung pada hari itu.
 *
 * Dengan begitu cek ulang manual satu keyword tidak membuat skor hari itu
 * melonjak ke 100% / anjlok ke 0% hanya karena subset keyword yang tercatat
 * hari itu berbeda. Pure agar mudah di-test.
 */

export type SeriesKeyword = {
  id: string;
  searchVolume: number | null;
  snapshots: { capturedAt: Date | string; position: number | null }[];
};

export type DailyPositions = {
  date: string;
  keywords: (VisibilityKeyword & { id: string })[];
};

/**
 * Untuk tiap hari pada rentang, posisi terakhir (carry-forward) tiap keyword
 * yang sudah punya data. Hari tanpa satu pun keyword berdata dilewati.
 */
export function buildDailyPositions(
  keywords: SeriesKeyword[],
  days: number,
  now: Date | number = Date.now(),
): DailyPositions[] {
  const dayKeys = wibDayKeyRange(days, now);

  // Pra-urutkan snapshot tiap keyword dan hitung kunci harinya sekali saja.
  const prepared = keywords.map((k) => {
    const snaps = k.snapshots
      .map((s) => ({
        t: new Date(s.capturedAt).getTime(),
        day: wibDayKey(s.capturedAt),
        position: s.position,
      }))
      .filter((s) => Number.isFinite(s.t))
      .sort((a, b) => a.t - b.t);
    return { id: k.id, searchVolume: k.searchVolume, snaps, cursor: 0, current: null as
      | { position: number | null }
      | null };
  });

  const out: DailyPositions[] = [];
  for (const day of dayKeys) {
    const rows: DailyPositions["keywords"] = [];
    for (const k of prepared) {
      while (k.cursor < k.snaps.length && k.snaps[k.cursor].day <= day) {
        k.current = { position: k.snaps[k.cursor].position };
        k.cursor += 1;
      }
      if (k.current) {
        rows.push({
          id: k.id,
          position: k.current.position,
          searchVolume: k.searchVolume,
        });
      }
    }
    if (rows.length > 0) out.push({ date: day, keywords: rows });
  }
  return out;
}

/** Visibility % per hari (carry-forward). */
export function buildVisibilitySeries(
  keywords: SeriesKeyword[],
  days: number,
  now: Date | number = Date.now(),
): { date: string; score: number }[] {
  return buildDailyPositions(keywords, days, now).map((d) => ({
    date: d.date,
    score: visibilityScore(d.keywords),
  }));
}

/**
 * Posisi rata-rata (keyword yang ranking) per hari, carry-forward. Hari ketika
 * tidak ada keyword yang ranking dilewati.
 */
export function buildAvgPositionSeries(
  keywords: SeriesKeyword[],
  days: number,
  now: Date | number = Date.now(),
): { date: string; avgPosition: number }[] {
  const out: { date: string; avgPosition: number }[] = [];
  for (const d of buildDailyPositions(keywords, days, now)) {
    const ranked = d.keywords
      .map((k) => k.position)
      .filter((p): p is number => p != null);
    if (ranked.length === 0) continue;
    out.push({
      date: d.date,
      avgPosition:
        Math.round((ranked.reduce((a, b) => a + b, 0) / ranked.length) * 10) / 10,
    });
  }
  return out;
}
