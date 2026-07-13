import { topMovers, type MoverKeyword } from "@/lib/seo/rank-tracker/distribution";

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
};

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

  return `Ringkasan SEO mingguan ${input.projectName}: ${parts.join(" · ")}.`;
}
