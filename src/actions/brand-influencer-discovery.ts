"use server";

import { revalidatePath } from "next/cache";
import {
  InfluencerDiscoverySource,
  InfluencerJobStatus,
  InfluencerPlatform,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBrandManager } from "@/lib/brand-research/auth";
import {
  enqueueDiscoveryRun,
  MAX_DISCOVERY_TERMS,
} from "@/lib/brand-research/influencer/discovery/run-discovery";
import {
  enqueueEnrichmentForProfiles,
  findProfilesNeedingEnrichment,
} from "@/lib/brand-research/influencer/discovery/enrich-batch";
import { classifyPendingCreators } from "@/lib/brand-research/influencer/discovery/classify-creators";
import { enqueueInfluencerAudit } from "@/lib/brand-research/influencer/run-audit";
import {
  clampSocialSearchLimit,
  DEFAULT_TIKTOK_SEARCH_LIMIT,
  MAX_TIKTOK_SEARCH_LIMIT,
} from "@/lib/research/social-listening/search-limits-public";

const RADAR_PATH = "/brand-hub/kol-radar";

const startSchema = z.object({
  terms: z
    .array(z.string().min(1).max(80))
    .min(1, "Isi minimal satu hashtag atau kata kunci.")
    .max(
      MAX_DISCOVERY_TERMS,
      `Maksimal ${MAX_DISCOVERY_TERMS} kata kunci per crawl.`,
    ),
  platforms: z.array(z.nativeEnum(InfluencerPlatform)).optional(),
  source: z.nativeEnum(InfluencerDiscoverySource).optional(),
  searchLimit: z.number().int().positive().optional(),
});

/**
 * Mulai crawl penemuan kreator dari hashtag/kata kunci.
 *
 * Kembali segera setelah run tercatat — scrape-nya berjalan di latar dan
 * dimajukan cron, sama seperti audit.
 */
export async function startInfluencerDiscovery(
  input: z.input<typeof startSchema>,
) {
  const session = await requireBrandManager();
  const data = startSchema.parse(input);

  const { runId } = await enqueueDiscoveryRun({
    source: data.source ?? InfluencerDiscoverySource.HASHTAG,
    terms: data.terms,
    platforms: data.platforms ?? [],
    searchLimit: clampSocialSearchLimit(
      data.searchLimit ?? DEFAULT_TIKTOK_SEARCH_LIMIT,
      MAX_TIKTOK_SEARCH_LIMIT,
    ),
    createdById: session.user.id,
  });

  revalidatePath(RADAR_PATH);
  return { runId };
}

export async function fetchDiscoveryRuns(limit = 20) {
  await requireBrandManager();

  return prisma.influencerDiscoveryRun.findMany({
    take: Math.min(Math.max(limit, 1), 100),
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      source: true,
      status: true,
      terms: true,
      platforms: true,
      searchLimit: true,
      postsScanned: true,
      profilesFound: true,
      profilesNew: true,
      warnings: true,
      errorMessage: true,
      startedAt: true,
      finishedAt: true,
      createdAt: true,
      createdBy: { select: { id: true, name: true } },
    },
  });
}

/**
 * Status ringkas untuk polling dari UI — sengaja tidak menarik daftar hit,
 * yang bisa berisi ratusan baris per run.
 */
export async function fetchDiscoveryRunStatus(runId: string) {
  await requireBrandManager();

  const run = await prisma.influencerDiscoveryRun.findUnique({
    where: { id: runId },
    select: {
      id: true,
      status: true,
      postsScanned: true,
      profilesFound: true,
      profilesNew: true,
      warnings: true,
      errorMessage: true,
    },
  });
  if (!run) throw new Error("Crawl tidak ditemukan.");
  return run;
}

/**
 * Ukur kreator yang belum punya angka.
 *
 * Biasanya tidak perlu dipanggil manual — crawl mengantre pengukuran sendiri.
 * Ini jaring pengaman untuk kreator yang batch-nya gagal atau yang masuk
 * database lewat jalur lain.
 */
export async function enrichPendingCreators(limit = 200) {
  await requireBrandManager();

  const profileIds = await findProfilesNeedingEnrichment(
    Math.min(Math.max(limit, 1), 500),
  );
  if (profileIds.length === 0) {
    return { queued: 0, batches: 0 };
  }

  const { batchIds, queued } = await enqueueEnrichmentForProfiles(profileIds);
  revalidatePath(RADAR_PATH);
  return { queued, batches: batchIds.length };
}

/** Beri label niche pada kreator yang belum berlabel. */
export async function classifyCreators(limit?: number) {
  await requireBrandManager();
  const result = await classifyPendingCreators(limit);
  revalidatePath(RADAR_PATH);
  return result;
}

/**
 * Jalankan audit penuh untuk satu kreator dari halaman radar.
 *
 * Inilah perpindahan dari pengukuran murah ke penilaian sungguhan: snapshot
 * menjawab "siapa yang pantas diperiksa", audit menjawab "layakkah dia
 * dibayar". Mesinnya persis yang sudah dipakai modul Influencer Audit.
 */
export async function auditCreatorFromRadar(profileId: string) {
  await requireBrandManager();

  const profile = await prisma.influencerProfile.findUnique({
    where: { id: profileId },
    select: { id: true },
  });
  if (!profile) throw new Error("Kreator tidak ditemukan.");

  const { auditId } = await enqueueInfluencerAudit(profileId);
  revalidatePath(RADAR_PATH);
  return { auditId };
}

/**
 * Hapus catatan crawl.
 *
 * Kreator yang ditemukannya TETAP ADA — yang terhapus hanya jejak "ditemukan
 * lewat crawl ini" (InfluencerDiscoveryHit ikut cascade). Menghapus profilnya
 * juga akan membuang orang yang mungkin sedang dipantau brand lain.
 */
export async function deleteDiscoveryRun(runId: string) {
  await requireBrandManager();

  const run = await prisma.influencerDiscoveryRun.findUnique({
    where: { id: runId },
    select: { status: true },
  });
  if (!run) throw new Error("Crawl tidak ditemukan.");
  if (
    run.status === InfluencerJobStatus.PENDING ||
    run.status === InfluencerJobStatus.COLLECTING
  ) {
    throw new Error("Crawl masih berjalan — tunggu selesai sebelum menghapus.");
  }

  await prisma.influencerDiscoveryRun.delete({ where: { id: runId } });
  revalidatePath(RADAR_PATH);
}
