import "server-only";

import { after } from "next/server";
import {
  InfluencerPlatform,
  KolPostStatus,
  KolScheduleStatus,
  KolSyncStatus,
} from "@prisma/client";
import {
  ApifyRunNotFoundError,
  fetchApifyDataset,
  getApifyRunStatus,
  isApifyConfigured,
  startApifyActor,
} from "@/lib/apify/client";
import {
  buildPostMetricsActorInput,
  getPostMetricsActorId,
} from "@/lib/apify/influencer-actors";
import { normalizePostItem } from "@/lib/apify/normalize-influencer";
import { getAdLibraryApifyOutcome } from "@/lib/brand-research/ad-library-apify-status";
import { computePostMetrics } from "@/lib/kol/metrics";
import { tryParsePostUrl } from "@/lib/kol/post-url";
import { getKolRateSettings } from "@/lib/kol/rate-context";
import { wibDayKey } from "@/lib/kol/time";
import { prisma } from "@/lib/prisma";

/** URL per run Apify — biaya tetap run terbagi, tapi run gemuk rawan timeout. */
const RUN_BATCH = 50;
/** Run yang tak selesai setelah ini dianggap gagal (bukan menggantung selamanya). */
const STALE_RUN_MS = 30 * 60_000;
const activeRuns = new Set<string>();

function todayKey(now = new Date()) {
  return wibDayKey(now);
}

/** Awal hari WIB ini dalam UTC — batas "sudah disinkron hari ini". */
function startOfWibToday(now = new Date()): Date {
  return new Date(`${todayKey(now)}T00:00:00+07:00`);
}

type DueSchedule = { id: string; postUrl: string; platform: InfluencerPlatform };

/**
 * Jadwal tayang yang perlu diambil metriknya: sudah POSTED, link valid, masih
 * dalam jendela pelacakan, dan belum disinkron hari ini (kecuali `force`).
 */
export async function findDueSchedules(opts: {
  scheduleIds?: string[];
  force?: boolean;
} = {}): Promise<DueSchedule[]> {
  const settings = await getKolRateSettings();
  const now = new Date();
  const rows = await prisma.kolSchedule.findMany({
    where: {
      status: KolScheduleStatus.POSTED,
      postStatus: { not: KolPostStatus.TAKEN_DOWN },
      postUrl: { not: null },
      ...(opts.scheduleIds ? { id: { in: opts.scheduleIds } } : {}),
      ...(opts.force
        ? {}
        : {
            OR: [
              { metricsSyncedAt: null },
              { metricsSyncedAt: { lt: startOfWibToday(now) } },
            ],
          }),
    },
    select: {
      id: true,
      postUrl: true,
      postedAt: true,
      socialAccount: { select: { platform: true } },
    },
  });
  return rows.flatMap((r) => {
    const parsed = tryParsePostUrl(r.postUrl);
    if (!parsed) return [];
    const days = settings.configs[r.socialAccount.platform].trackingDays;
    const posted = r.postedAt?.getTime() ?? now.getTime();
    if (!opts.scheduleIds && now.getTime() - posted > days * 86_400_000) return [];
    return [{ id: r.id, postUrl: parsed.url, platform: r.socialAccount.platform }];
  });
}

/**
 * Antrekan run sinkronisasi (dipecah per platform & per 50 URL). Jadwal yang
 * sudah ikut run yang masih berjalan dilewati supaya tidak dobel scrape.
 */
export async function enqueueKolPostSync(opts: {
  scheduleIds?: string[];
  force?: boolean;
} = {}): Promise<{ runs: number; schedules: number }> {
  const due = await findDueSchedules(opts);
  if (due.length === 0) return { runs: 0, schedules: 0 };

  const inflight = await prisma.kolPostSyncRun.findMany({
    where: { status: { in: [KolSyncStatus.QUEUED, KolSyncStatus.RUNNING] } },
    select: { scheduleIds: true },
  });
  const busy = new Set(inflight.flatMap((r) => r.scheduleIds));
  const todo = due.filter((d) => !busy.has(d.id));

  const runIds: string[] = [];
  for (const platform of [InfluencerPlatform.INSTAGRAM, InfluencerPlatform.TIKTOK]) {
    const list = todo.filter((d) => d.platform === platform);
    for (let i = 0; i < list.length; i += RUN_BATCH) {
      const chunk = list.slice(i, i + RUN_BATCH);
      const run = await prisma.kolPostSyncRun.create({
        data: {
          platform,
          scheduleIds: chunk.map((c) => c.id),
          postUrls: chunk.map((c) => c.postUrl),
        },
        select: { id: true },
      });
      runIds.push(run.id);
    }
  }

  if (runIds.length) {
    after(async () => {
      for (const id of runIds) {
        try {
          await executeKolPostSyncRun(id);
        } catch (err) {
          console.error("[kol/post-sync]", id, err);
        }
      }
    });
  }
  return { runs: runIds.length, schedules: todo.length };
}

/** Kunci post dari item dataset — dicocokkan dengan kunci dari URL jadwal. */
function itemKeys(platform: InfluencerPlatform, raw: Record<string, unknown>): string[] {
  const post = normalizePostItem(platform, raw);
  if (!post) return [];
  const keys = new Set<string>();
  if (platform === InfluencerPlatform.TIKTOK) keys.add(post.externalId);
  if (post.shortCode) keys.add(post.shortCode);
  const fromUrl = tryParsePostUrl(post.url ?? null);
  if (fromUrl) keys.add(fromUrl.key);
  for (const field of ["inputUrl", "submittedVideoUrl", "url", "webVideoUrl"]) {
    const v = raw[field];
    if (typeof v === "string") {
      const p = tryParsePostUrl(v);
      if (p) keys.add(p.key);
    }
  }
  return [...keys];
}

/** Hitung ulang cache metrik satu jadwal dari seluruh snapshot-nya. */
export async function recomputeScheduleMetrics(scheduleId: string, fypThreshold: number) {
  const s = await prisma.kolSchedule.findUnique({
    where: { id: scheduleId },
    select: {
      postedAt: true,
      snapshots: {
        orderBy: { capturedOn: "asc" },
        select: { capturedOn: true, views: true, likes: true, comments: true, shares: true },
      },
    },
  });
  if (!s) return;
  const m = computePostMetrics(
    s.snapshots.map((x) => ({
      day: x.capturedOn.toISOString().slice(0, 10),
      views: x.views,
      likes: x.likes,
      comments: x.comments,
      shares: x.shares,
    })),
    { fypThreshold, postedAt: s.postedAt },
  );
  await prisma.kolSchedule.update({
    where: { id: scheduleId },
    data: {
      latestViews: m.latest?.views ?? null,
      latestLikes: m.latest?.likes ?? null,
      latestComments: m.latest?.comments ?? null,
      latestShares: m.latest?.shares ?? null,
      isFyp: m.isFyp,
      fypReachedAt: m.fypDay ? new Date(`${m.fypDay}T12:00:00+07:00`) : null,
      peakVelocity: m.peakVelocity,
      timeToPeakHours: m.timeToPeakHours,
      decayRate: m.decayRate,
      metricsSyncedAt: new Date(),
      metricsError: null,
    },
  });
}

/** Majukan satu run satu langkah. Idempoten — aman dipanggil cron berulang. */
export async function executeKolPostSyncRun(runId: string): Promise<void> {
  if (activeRuns.has(runId)) return;
  activeRuns.add(runId);
  try {
    let run = await prisma.kolPostSyncRun.findUnique({ where: { id: runId } });
    if (!run) return;

    if (run.status === KolSyncStatus.QUEUED) {
      const claimed = await prisma.kolPostSyncRun.updateMany({
        where: { id: runId, status: KolSyncStatus.QUEUED },
        data: { status: KolSyncStatus.RUNNING, startedAt: new Date() },
      });
      if (claimed.count === 0) return;
      run = { ...run, status: KolSyncStatus.RUNNING, startedAt: new Date() };
    } else if (run.status !== KolSyncStatus.RUNNING) {
      return;
    }

    if (run.startedAt && Date.now() - run.startedAt.getTime() > STALE_RUN_MS) {
      throw new Error("Sinkronisasi tidak selesai dalam 30 menit — dijalankan ulang besok.");
    }
    if (!isApifyConfigured()) {
      throw new Error("APIFY_API_TOKEN belum diset — metrik post butuh scraper Apify.");
    }

    // Langkah 1: mulai run actor.
    if (!run.apifyRunId) {
      const started = await startApifyActor(
        getPostMetricsActorId(run.platform),
        buildPostMetricsActorInput(run.platform, run.postUrls),
      );
      await prisma.kolPostSyncRun.update({
        where: { id: runId },
        data: { apifyRunId: started.runId },
      });
      return;
    }

    // Langkah 2: tunggu selesai.
    let status: Awaited<ReturnType<typeof getApifyRunStatus>>;
    try {
      status = await getApifyRunStatus(run.apifyRunId);
    } catch (err) {
      if (err instanceof ApifyRunNotFoundError) throw err;
      console.warn("[kol/post-sync/poll]", runId, err);
      return;
    }
    const outcome = getAdLibraryApifyOutcome(status.status);
    if (outcome === "waiting") return;
    if (outcome === "failed") throw new Error(`Apify run status: ${status.status}`);

    let items: Record<string, unknown>[];
    try {
      items = await fetchApifyDataset<Record<string, unknown>>(status.datasetId);
    } catch (err) {
      console.warn("[kol/post-sync/dataset]", runId, err);
      return;
    }

    // Langkah 3: cocokkan item → jadwal, simpan snapshot hari ini.
    const byKey = new Map<string, Record<string, unknown>>();
    for (const raw of items) for (const k of itemKeys(run.platform, raw)) byKey.set(k, raw);

    const settings = await getKolRateSettings();
    const fypThreshold = settings.configs[run.platform].fypThreshold;
    const schedules = await prisma.kolSchedule.findMany({
      where: { id: { in: run.scheduleIds } },
      select: { id: true, postUrl: true },
    });
    const capturedOn = new Date(`${todayKey()}T00:00:00Z`);
    let updated = 0;
    let missing = 0;

    for (const s of schedules) {
      const parsed = tryParsePostUrl(s.postUrl);
      const raw = parsed ? byKey.get(parsed.key) : undefined;
      const post = raw ? normalizePostItem(run.platform, raw) : null;
      if (!post) {
        missing += 1;
        await prisma.kolSchedule.update({
          where: { id: s.id },
          data: {
            metricsError:
              "Post tidak terbaca scraper — pastikan link benar, akun publik, dan konten belum dihapus.",
            metricsSyncedAt: new Date(),
          },
        });
        continue;
      }
      const values = {
        views: post.views,
        likes: Math.max(post.likes, 0),
        comments: post.comments,
        shares: post.shares,
        saves: post.saves,
        capturedAt: new Date(),
      };
      await prisma.kolPostSnapshot.upsert({
        where: { scheduleId_capturedOn: { scheduleId: s.id, capturedOn } },
        create: { scheduleId: s.id, capturedOn, ...values },
        update: values,
      });
      await recomputeScheduleMetrics(s.id, fypThreshold);
      updated += 1;
    }

    await prisma.kolPostSyncRun.update({
      where: { id: runId },
      data: {
        status: KolSyncStatus.SUCCEEDED,
        updated,
        missing,
        finishedAt: new Date(),
        error:
          updated === 0 && schedules.length > 0
            ? "Tidak ada post yang terbaca — kemungkinan scraper diblokir; dicoba lagi besok."
            : null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sinkronisasi metrik gagal.";
    await prisma.kolPostSyncRun.updateMany({
      where: { id: runId },
      data: { status: KolSyncStatus.FAILED, error: message.slice(0, 500), finishedAt: new Date() },
    });
    throw err;
  } finally {
    activeRuns.delete(runId);
  }
}

/** Cron `poll`: majukan run yang belum selesai. */
export async function pollRunningKolPostSyncs(): Promise<{ polled: number }> {
  const runs = await prisma.kolPostSyncRun.findMany({
    where: { status: { in: [KolSyncStatus.QUEUED, KolSyncStatus.RUNNING] } },
    orderBy: { createdAt: "asc" },
    take: 5,
    select: { id: true },
  });
  for (const r of runs) {
    try {
      await executeKolPostSyncRun(r.id);
    } catch {
      /* galat sudah tersimpan di baris run */
    }
  }
  return { polled: runs.length };
}

/** Cron harian `kol-posts`: antrekan semua post yang jatuh tempo. */
export async function syncDueKolPosts() {
  return enqueueKolPostSync();
}

export async function getLatestKolSyncRun() {
  return prisma.kolPostSyncRun.findFirst({
    orderBy: { createdAt: "desc" },
    select: { status: true, createdAt: true, finishedAt: true, updated: true, missing: true, error: true },
  });
}
