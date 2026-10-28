import "server-only";

import { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify";
import {
  buildWeeklySummary,
  computeWeeklyStats,
  type WeeklyKeywordInput,
} from "@/lib/seo/rank-tracker/weekly-summary";

/**
 * Kirim ringkasan mingguan per proyek rank tracker ke pembuatnya
 * (cron `mode=weekly`, tiap Senin). Membandingkan posisi sekarang dengan
 * snapshot ~7 hari lalu pada SUBSET keyword yang sama (yang sudah punya
 * snapshot berumur >= 7 hari); keyword baru dilaporkan terpisah.
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
    const inputs: WeeklyKeywordInput[] = [];
    for (const tk of project.keywords) {
      const old = await prisma.seoRankSnapshot.findFirst({
        where: { trackedKeywordId: tk.id, capturedAt: { lte: weekAgo } },
        orderBy: { capturedAt: "desc" },
        select: { position: true },
      });
      inputs.push({
        keyword: tk.keyword,
        lastPosition: tk.lastPosition,
        searchVolume: tk.searchVolume,
        // undefined = belum ada snapshot setua itu (keyword baru).
        weekAgoPosition: old ? old.position : undefined,
      });
    }

    const stats = computeWeeklyStats(inputs);
    const message = buildWeeklySummary({ projectName: project.name, ...stats });

    try {
      await notifyUser(project.createdById, message, NotificationType.SEO_ALERT);
      sent += 1;
    } catch (err) {
      console.error("[seo/weekly-notify] gagal kirim", project.id, err);
    }
  }

  return { sent };
}
