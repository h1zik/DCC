import { topMovers, type MoverKeyword } from "@/lib/seo/rank-tracker/distribution";
import { visibilityScore } from "@/lib/seo/rank-tracker/visibility";

/**
 * Builder ringkasan mingguan rank tracker (Bahasa Indonesia) — pure agar mudah
 * di-test. Dikirim via notifikasi tiap Senin (cron `mode=weekly`).
 */

export type WeeklySummaryInput = {
  projectName: string;
  visibilityNow: number;
  visibilityLastWeek: number | null;
  keywords: MoverKeyword[];
  enteredTop10: number;
  droppedFromTop10: number;
  /** Keyword yang belum punya snapshot berumur >= 7 hari (tidak dibandingkan). */
  newKeywords?: number;
};

export type WeeklyKeywordInput = {
  keyword: string;
  lastPosition: number | null;
  searchVolume: number | null;
  /**
   * Posisi dari snapshot terakhir yang berumur >= 7 hari. `undefined` berarti
   * TIDAK ADA snapshot setua itu (keyword baru) — berbeda dengan `null` yang
   * berarti "tercatat, tapi di luar top 100".
   */
  weekAgoPosition: number | null | undefined;
};

export type WeeklyStats = Omit<WeeklySummaryInput, "projectName"> & {
  newKeywords: number;
};

/**
 * Hitung statistik mingguan dari subset keyword yang SAMA: hanya keyword
 * yang punya snapshot >= 7 hari yang ikut dalam movers, hitungan top 10, dan
 * kedua angka visibility (sekarang vs minggu lalu). Keyword baru dilaporkan
 * terpisah. Bila belum ada keyword dengan riwayat, visibility sekarang
 * dihitung atas semua keyword dan pembanding minggu lalu null.
 */
export function computeWeeklyStats(keywords: WeeklyKeywordInput[]): WeeklyStats {
  const withHistory = keywords.filter((k) => k.weekAgoPosition !== undefined);
  const newKeywords = keywords.length - withHistory.length;

  const movers: MoverKeyword[] = [];
  let enteredTop10 = 0;
  let droppedFromTop10 = 0;
  for (const k of withHistory) {
    const prevPos = k.weekAgoPosition ?? null;
    movers.push({
      keyword: k.keyword,
      previousPosition: prevPos,
      currentPosition: k.lastPosition,
    });
    const wasTop10 = prevPos != null && prevPos <= 10;
    const isTop10 = k.lastPosition != null && k.lastPosition <= 10;
    if (!wasTop10 && isTop10) enteredTop10 += 1;
    if (wasTop10 && !isTop10) droppedFromTop10 += 1;
  }

  if (withHistory.length === 0) {
    return {
      visibilityNow: visibilityScore(
        keywords.map((k) => ({
          position: k.lastPosition,
          searchVolume: k.searchVolume,
        })),
      ),
      visibilityLastWeek: null,
      keywords: movers,
      enteredTop10,
      droppedFromTop10,
      newKeywords,
    };
  }

  const visibilityNow = visibilityScore(
    withHistory.map((k) => ({
      position: k.lastPosition,
      searchVolume: k.searchVolume,
    })),
  );
  const visibilityLastWeek = visibilityScore(
    withHistory.map((k) => ({
      position: k.weekAgoPosition ?? null,
      searchVolume: k.searchVolume,
    })),
  );

  return {
    visibilityNow,
    visibilityLastWeek,
    keywords: movers,
    enteredTop10,
    droppedFromTop10,
    newKeywords,
  };
}

export function buildWeeklySummary(input: WeeklySummaryInput): string {
  const parts: string[] = [];

  if (input.visibilityLastWeek != null) {
    const delta =
      Math.round((input.visibilityNow - input.visibilityLastWeek) * 10) / 10;
    const arrow = delta > 0 ? "naik" : delta < 0 ? "turun" : "stabil";
    parts.push(
      `Visibility ${input.visibilityNow}%${
        delta !== 0 ? ` (${arrow} ${Math.abs(delta)} poin)` : " (stabil)"
      }`,
    );
  } else {
    parts.push(`Visibility ${input.visibilityNow}%`);
  }

  const { up, down } = topMovers(input.keywords, 2);
  if (up.length > 0) {
    parts.push(
      `naik: ${up.map((m) => `"${m.keyword}" (+${m.delta})`).join(", ")}`,
    );
  }
  if (down.length > 0) {
    parts.push(
      `turun: ${down.map((m) => `"${m.keyword}" (${m.delta})`).join(", ")}`,
    );
  }
  if (input.enteredTop10 > 0) parts.push(`${input.enteredTop10} keyword masuk top 10`);
  if (input.droppedFromTop10 > 0) {
    parts.push(`${input.droppedFromTop10} keyword keluar dari top 10`);
  }
  if ((input.newKeywords ?? 0) > 0) {
    parts.push(`${input.newKeywords} keyword baru belum punya data seminggu`);
  }

  return `Ringkasan SEO mingguan ${input.projectName}: ${parts.join(" · ")}.`;
}
