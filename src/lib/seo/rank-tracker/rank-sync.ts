import "server-only";

import { prisma } from "@/lib/prisma";
import { runRankCheck } from "@/lib/seo/rank-tracker/rank-check";

export type RankSyncResult = {
  projects: number;
  keywords: number;
  failed: number;
};

/** Cek ranking semua keyword pada satu proyek (berurutan agar tidak membanjiri API). */
export async function syncProjectRanks(
  projectId: string,
): Promise<{ keywords: number; failed: number }> {
  const tracked = await prisma.seoTrackedKeyword.findMany({
    where: { projectId },
    select: { id: true },
  });

  let keywords = 0;
  let failed = 0;
  for (const tk of tracked) {
    try {
      await runRankCheck(tk.id);
      keywords += 1;
    } catch (err) {
      failed += 1;
      console.error("[seo/rank-sync] gagal cek keyword", tk.id, err);
    }
  }
  return { keywords, failed };
}

/**
 * Cek ranking untuk semua proyek aktif — dipanggil cron harian
 * (`/api/cron/seo-sync?mode=ranks`).
 */
export async function syncActiveRankProjects(): Promise<RankSyncResult> {
  const projects = await prisma.seoRankProject.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  let keywords = 0;
  let failed = 0;
  for (const project of projects) {
    const res = await syncProjectRanks(project.id);
    keywords += res.keywords;
    failed += res.failed;
  }

  return { projects: projects.length, keywords, failed };
}
