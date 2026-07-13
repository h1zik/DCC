import "server-only";

import { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify";
import { visibilityScore } from "@/lib/seo/rank-tracker/visibility";
import { buildWeeklySummary } from "@/lib/seo/rank-tracker/weekly-summary";
import type { MoverKeyword } from "@/lib/seo/rank-tracker/distribution";

/**
 * Kirim ringkasan mingguan per proyek rank tracker ke pembuatnya
 * (cron `mode=weekly`, tiap Senin). Membandingkan posisi sekarang dengan
 * snapshot ~7 hari lalu.
 */
export async function sendWeeklyRankSummaries(): Promise<{ sent: number }> {
  const projects = await prisma.seoRankProject.findMany({
    where: { isActive: true },
    include: {
      keywords: {
        select: {
          id: true,
          keyword: true,
          lastPosition: true,
          searchVolume: true,
        },
      },
    },
  });

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  let sent = 0;

  for (const project of projects) {
    if (project.keywords.length === 0) continue;

    // Posisi ~7 hari lalu: snapshot terakhir SEBELUM batas 7 hari.
    const movers: MoverKeyword[] = [];
    let enteredTop10 = 0;
    let droppedFromTop10 = 0;
    const lastWeekPositions: (number | null)[] = [];

    for (const tk of project.keywords) {
      const old = await prisma.seoRankSnapshot.findFirst({
        where: { trackedKeywordId: tk.id, capturedAt: { lte: weekAgo } },
        orderBy: { capturedAt: "desc" },
        select: { position: true },
      });
      const prevPos = old?.position ?? null;
      lastWeekPositions.push(prevPos);
      movers.push({
        keyword: tk.keyword,
        previousPosition: prevPos,
        currentPosition: tk.lastPosition,
      });
      const wasTop10 = prevPos != null && prevPos <= 10;
      const isTop10 = tk.lastPosition != null && tk.lastPosition <= 10;
      if (!wasTop10 && isTop10) enteredTop10 += 1;
      if (wasTop10 && !isTop10) droppedFromTop10 += 1;
    }

    const visibilityNow = visibilityScore(
      project.keywords.map((k) => ({
        position: k.lastPosition,
        searchVolume: k.searchVolume,
      })),
    );
    const hasHistory = lastWeekPositions.some((p) => p != null);
    const visibilityLastWeek = hasHistory
      ? visibilityScore(
          project.keywords.map((k, i) => ({
            position: lastWeekPositions[i],
            searchVolume: k.searchVolume,
          })),
        )
      : null;

    const message = buildWeeklySummary({
      projectName: project.name,
      visibilityNow,
      visibilityLastWeek,
      keywords: movers,
      enteredTop10,
      droppedFromTop10,
    });

    try {
      await notifyUser(project.createdById, message, NotificationType.SEO_ALERT);
      sent += 1;
    } catch (err) {
      console.error("[seo/weekly-notify] gagal kirim", project.id, err);
    }
  }

  return { sent };
}
