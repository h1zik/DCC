import "server-only";

import { SeoJobStatus, SeoJobType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DataForSeoError } from "@/lib/seo/dataforseo/client";
import { runRankCheck } from "@/lib/seo/rank-tracker/rank-check";

export type RankSyncResult = {
  projects: number;
  keywords: number;
  failed: number;
};

/** Tipe SeoJob yang dipakai untuk sinkron ranking satu proyek (entityId = projectId). */
export const RANK_SYNC_JOB_TYPE = SeoJobType.RANK_CHECK;

/** Job RUNNING yang dimulai lebih lama dari ini dianggap terhenti (boleh dijalankan ulang). */
export const RANK_SYNC_RUNNING_WINDOW_MS = 30 * 60 * 1000;

/** Ringkasan kegagalan untuk kolom `error` SeoJob / baris status UI. */
export function summarizeRankSyncFailures(
  failed: number,
  total: number,
  firstError: string | null,
): string | null {
  if (failed === 0) return null;
  const base = `${failed} dari ${total} keyword gagal`;
  return firstError ? `${base}: ${firstError}` : base;
}

export type RankSyncJobSummary = {
  id: string;
  status: SeoJobStatus;
  percent: number;
  stepLabel: string | null;
  error: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  /** RUNNING lebih lama dari `RANK_SYNC_RUNNING_WINDOW_MS` — dianggap terhenti. */
  stale: boolean;
};

/** Job sinkron ranking terakhir untuk satu proyek (untuk baris status di halaman detail). */
export async function getLatestRankSyncJob(
  projectId: string,
): Promise<RankSyncJobSummary | null> {
  const job = await prisma.seoJob.findFirst({
    where: { entityId: projectId, type: RANK_SYNC_JOB_TYPE },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      percent: true,
      stepLabel: true,
      error: true,
      startedAt: true,
      completedAt: true,
      createdAt: true,
    },
  });
  if (!job) return null;
  const stale =
    job.status === SeoJobStatus.RUNNING &&
    job.startedAt != null &&
    Date.now() - job.startedAt.getTime() > RANK_SYNC_RUNNING_WINDOW_MS;
  return { ...job, stale };
}

/** True bila ada job sinkron ranking proyek ini yang masih RUNNING dan belum basi. */
export async function isRankSyncRunning(projectId: string): Promise<boolean> {
  const running = await prisma.seoJob.findFirst({
    where: {
      entityId: projectId,
      type: RANK_SYNC_JOB_TYPE,
      status: SeoJobStatus.RUNNING,
      startedAt: { gte: new Date(Date.now() - RANK_SYNC_RUNNING_WINDOW_MS) },
    },
    select: { id: true },
  });
  return running != null;
}

/**
 * Cek ranking semua keyword pada satu proyek (berurutan agar tidak membanjiri
 * API). Progres & hasil dicatat ke `SeoJob` (type RANK_CHECK, entityId =
 * projectId) sehingga kegagalan sinkron — mis. saldo DataForSEO habis — tampak
 * di UI, bukan hanya di log.
 */
export async function syncProjectRanks(
  projectId: string,
): Promise<{ keywords: number; failed: number; jobId: string }> {
  const tracked = await prisma.seoTrackedKeyword.findMany({
    where: { projectId },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  const total = tracked.length;

  const job = await prisma.seoJob.create({
    data: {
      type: RANK_SYNC_JOB_TYPE,
      entityId: projectId,
      status: SeoJobStatus.RUNNING,
      startedAt: new Date(),
      percent: 0,
      stepLabel: `0 dari ${total} keyword`,
    },
    select: { id: true },
  });

  let keywords = 0;
  let failed = 0;
  let firstError: string | null = null;
  let firstDfsError: string | null = null;

  try {
    for (let i = 0; i < tracked.length; i += 1) {
      const tk = tracked[i];
      let stopEarly = false;
      try {
        await runRankCheck(tk.id);
        keywords += 1;
      } catch (err) {
        failed += 1;
        const message = err instanceof Error ? err.message : String(err);
        if (firstError == null) firstError = message;
        if (err instanceof DataForSeoError) {
          if (firstDfsError == null) firstDfsError = message;
          // Saldo habis: keyword berikutnya pasti gagal juga — hentikan lebih awal.
          if (err.balanceExhausted) stopEarly = true;
        }
        console.error("[seo/rank-sync] gagal cek keyword", tk.id, err);
      }

      const done = i + 1;
      if (stopEarly) {
        failed += total - done;
        await prisma.seoJob
          .update({
            where: { id: job.id },
            data: {
              percent: 100,
              stepLabel: `dihentikan di keyword ${done} dari ${total} (saldo DataForSEO habis)`,
            },
          })
          .catch(() => undefined);
        break;
      }

      await prisma.seoJob
        .update({
          where: { id: job.id },
          data: {
            percent: total > 0 ? Math.round((done / total) * 100) : 100,
            stepLabel: `${done} dari ${total} keyword`,
          },
        })
        .catch(() => undefined);
    }

    const error = summarizeRankSyncFailures(
      failed,
      total,
      firstDfsError ?? firstError,
    );
    await prisma.seoJob.update({
      where: { id: job.id },
      data: {
        status: failed > 0 ? SeoJobStatus.FAILED : SeoJobStatus.COMPLETED,
        percent: 100,
        error,
        completedAt: new Date(),
      },
    });
  } catch (err) {
    await prisma.seoJob
      .update({
        where: { id: job.id },
        data: {
          status: SeoJobStatus.FAILED,
          error: err instanceof Error ? err.message : "Sinkron ranking gagal.",
          completedAt: new Date(),
        },
      })
      .catch(() => undefined);
    throw err;
  }

  return { keywords, failed, jobId: job.id };
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
