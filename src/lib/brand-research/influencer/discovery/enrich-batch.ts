import "server-only";

import { after } from "next/server";
import {
  InfluencerJobStatus,
  InfluencerPlatform,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildInfluencerBatchActorInput,
  getInfluencerActorId,
  influencerActorEnvHint,
  SNAPSHOT_BATCH_SIZE,
  SNAPSHOT_POST_SAMPLE,
} from "@/lib/apify/influencer-actors";
import {
  ApifyRunNotFoundError,
  fetchApifyDataset,
  getApifyRunStatus,
  isApifyConfigured,
  startApifyActor,
} from "@/lib/apify/client";
import {
  groupInfluencerDatasetByHandle,
  normalizeInfluencerDataset,
} from "@/lib/apify/normalize-influencer";
import { getAdLibraryApifyOutcome } from "@/lib/brand-research/ad-library-apify-status";
import { buildSnapshotMetrics } from "@/lib/brand-research/influencer/discovery/snapshot";

/**
 * Pengayaan tingkat-1: ukur puluhan kreator dalam satu run Apify.
 *
 * Ini yang membuat database kreator terjangkau. Audit penuh memanggil actor
 * sekali per orang dengan 24 post; batch ini memanggilnya sekali untuk 50 orang
 * dengan 8 post. Hasilnya bukan pengganti audit — hanya cukup untuk menjawab
 * "siapa yang pantas diaudit", yang justru pertanyaan sesungguhnya saat
 * menghadapi ribuan nama.
 */

const activeBatchIds = new Set<string>();
const ORPHANED_START_GRACE_MS = 2 * 60_000;

async function patchBatch(
  batchId: string,
  data: Prisma.InfluencerEnrichmentBatchUpdateManyMutationInput,
): Promise<boolean> {
  const result = await prisma.influencerEnrichmentBatch.updateMany({
    where: { id: batchId },
    data,
  });
  return result.count > 0;
}

function readStringArray(value: Prisma.JsonValue | null): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

/**
 * Tulis snapshot untuk seluruh kreator yang datanya pulang.
 *
 * Profil yang diminta tapi tidak ada di dataset sengaja dilewati tanpa
 * menuliskan baris kosong: snapshot bernilai nol tidak bisa dibedakan dari
 * kreator yang memang mati, dan itu akan meracuni peringkat.
 */
async function persistBatchSnapshots(
  batchId: string,
  platform: InfluencerPlatform,
  handles: string[],
  items: Record<string, unknown>[],
): Promise<{ enriched: number; missing: number; warnings: string[] }> {
  const groups = groupInfluencerDatasetByHandle(platform, items);
  const warnings: string[] = [];
  const now = new Date();

  const profiles = await prisma.influencerProfile.findMany({
    where: { platform, handle: { in: handles } },
    select: { id: true, handle: true },
  });
  const idByHandle = new Map(profiles.map((p) => [p.handle, p.id]));

  const snapshots: Prisma.InfluencerSnapshotCreateManyInput[] = [];
  const profilePatches: { id: string; data: Prisma.InfluencerProfileUpdateInput }[] =
    [];

  for (const handle of handles) {
    const group = groups.get(handle);
    const profileId = idByHandle.get(handle);
    if (!profileId) {
      // Profil dihapus setelah batch diantre — bukan kegagalan scrape.
      continue;
    }
    if (!group || group.length === 0) continue;

    try {
      const normalized = normalizeInfluencerDataset(platform, group, handle);
      const metrics = buildSnapshotMetrics(platform, normalized, now);

      snapshots.push({
        profileId,
        batchRunId: batchId,
        collectedAt: now,
        ...metrics,
      });

      // Metadata profil ikut disegarkan — nama tampilan dan avatar inilah yang
      // membuat daftar peringkat bisa dibaca manusia, dan hanya di sinilah
      // keduanya didapat tanpa panggilan tambahan. Angka terakhir ikut
      // disalin ke profil supaya halaman peringkat bisa mengurutkan lewat index.
      profilePatches.push({
        id: profileId,
        data: {
          displayName: normalized.displayName ?? undefined,
          avatarUrl: normalized.avatarUrl ?? undefined,
          bio: normalized.bio ?? undefined,
          isVerified: normalized.isVerified,
          latestFollowers: metrics.followers,
          latestEngagementRate: metrics.engagementRate,
          latestTier: metrics.tier,
          latestMeasuredAt: now,
        },
      });
    } catch (err) {
      // Satu akun privat tidak boleh menggagalkan 49 lainnya.
      warnings.push(
        `@${handle}: ${err instanceof Error ? err.message : "data tidak bisa dibaca"}`,
      );
    }
  }

  if (snapshots.length > 0) {
    await prisma.influencerSnapshot.createMany({ data: snapshots });
    await prisma.$transaction(
      profilePatches.map((p) =>
        prisma.influencerProfile.update({ where: { id: p.id }, data: p.data }),
      ),
    );
  }

  const missing = handles.length - snapshots.length;
  if (missing > 0) {
    warnings.push(
      `${missing} dari ${handles.length} kreator tidak mengembalikan data — kemungkinan akun privat, kosong, atau baru ganti username.`,
    );
  }

  return { enriched: snapshots.length, missing, warnings };
}

/** Majukan satu batch satu langkah. Idempoten, aman dipanggil cron berulang. */
export async function executeEnrichmentBatch(batchId: string): Promise<void> {
  if (activeBatchIds.has(batchId)) return;
  activeBatchIds.add(batchId);

  try {
    let batch = await prisma.influencerEnrichmentBatch.findUnique({
      where: { id: batchId },
    });
    if (!batch) return;

    let claimedPending = false;
    if (batch.status === InfluencerJobStatus.PENDING) {
      const claimed = await prisma.influencerEnrichmentBatch.updateMany({
        where: { id: batchId, status: InfluencerJobStatus.PENDING },
        data: {
          status: InfluencerJobStatus.COLLECTING,
          startedAt: new Date(),
          errorMessage: null,
        },
      });
      if (claimed.count === 0) return;
      claimedPending = true;
      batch = { ...batch, status: InfluencerJobStatus.COLLECTING };
    } else if (batch.status !== InfluencerJobStatus.COLLECTING) {
      return;
    }

    if (!isApifyConfigured()) {
      throw new Error(
        "APIFY_API_TOKEN belum diset — pengayaan kreator memerlukan data live.",
      );
    }

    const actorId = getInfluencerActorId(batch.platform);
    if (!actorId) throw new Error(influencerActorEnvHint(batch.platform));

    // ── Langkah 1: mulai run ────────────────────────────────────────────
    if (!batch.apifyRunId) {
      const oldEnoughToRecover =
        Date.now() - batch.createdAt.getTime() >= ORPHANED_START_GRACE_MS;
      if (!claimedPending && !oldEnoughToRecover) return;

      const started = await startApifyActor(
        actorId,
        buildInfluencerBatchActorInput(
          batch.platform,
          batch.handles,
          batch.postSample,
        ),
      );
      await patchBatch(batchId, { apifyRunId: started.runId });
      return;
    }

    // ── Langkah 2: tunggu ───────────────────────────────────────────────
    let run: Awaited<ReturnType<typeof getApifyRunStatus>>;
    try {
      run = await getApifyRunStatus(batch.apifyRunId);
    } catch (err) {
      if (err instanceof ApifyRunNotFoundError) throw err;
      console.warn("[brand/influencer/enrich/poll]", batchId, err);
      return;
    }

    const outcome = getAdLibraryApifyOutcome(run.status);
    if (outcome === "waiting") return;
    if (outcome === "failed") {
      throw new Error(`Apify run status: ${run.status}`);
    }

    let items: Record<string, unknown>[];
    try {
      items = await fetchApifyDataset<Record<string, unknown>>(run.datasetId);
    } catch (err) {
      // Run sukses tapi dataset belum siap — coba lagi di poll berikutnya.
      console.warn("[brand/influencer/enrich/dataset]", batchId, err);
      return;
    }

    // ── Langkah 3: ukur & simpan ────────────────────────────────────────
    const { enriched, missing, warnings } = await persistBatchSnapshots(
      batchId,
      batch.platform,
      batch.handles,
      items,
    );

    if (enriched === 0) {
      // Run sukses tapi nol hasil adalah gejala khas scraper yang diblokir,
      // bukan 50 akun yang kebetulan semuanya privat.
      throw new Error(
        `Run selesai tapi tidak satu pun dari ${batch.handles.length} kreator terbaca. Kemungkinan besar scraper sedang diblokir platform — coba lagi beberapa jam lagi.`,
      );
    }

    await patchBatch(batchId, {
      status: InfluencerJobStatus.READY,
      profilesEnriched: enriched,
      profilesMissing: missing,
      warnings: [
        ...readStringArray(batch.warnings),
        ...warnings,
      ] as unknown as Prisma.InputJsonValue,
      finishedAt: new Date(),
      errorMessage: null,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Pengayaan kreator gagal.";
    await patchBatch(batchId, {
      status: InfluencerJobStatus.FAILED,
      errorMessage: message,
      finishedAt: new Date(),
    });
    throw err;
  } finally {
    activeBatchIds.delete(batchId);
  }
}

/**
 * Antrekan pengayaan untuk sekumpulan profil.
 *
 * Dipecah per platform (bentuk input actor-nya berbeda) lalu per potongan
 * `SNAPSHOT_BATCH_SIZE`. Mengembalikan id batch yang dibuat.
 */
export async function enqueueEnrichmentForProfiles(
  profileIds: string[],
): Promise<{ batchIds: string[]; queued: number }> {
  if (profileIds.length === 0) return { batchIds: [], queued: 0 };

  const profiles = await prisma.influencerProfile.findMany({
    where: { id: { in: profileIds } },
    select: { platform: true, handle: true },
  });
  if (profiles.length === 0) return { batchIds: [], queued: 0 };

  const byPlatform = new Map<InfluencerPlatform, string[]>();
  for (const p of profiles) {
    const bucket = byPlatform.get(p.platform);
    if (bucket) bucket.push(p.handle);
    else byPlatform.set(p.platform, [p.handle]);
  }

  const batchIds: string[] = [];

  for (const [platform, handles] of byPlatform) {
    for (let i = 0; i < handles.length; i += SNAPSHOT_BATCH_SIZE) {
      const chunk = handles.slice(i, i + SNAPSHOT_BATCH_SIZE);
      const batch = await prisma.influencerEnrichmentBatch.create({
        data: {
          platform,
          handles: chunk,
          postSample: SNAPSHOT_POST_SAMPLE,
          status: InfluencerJobStatus.PENDING,
        },
        select: { id: true },
      });
      batchIds.push(batch.id);
    }
  }

  // Batch pertama dimulai segera; sisanya menyusul lewat cron. Menjalankan
  // semuanya sekaligus akan menembak Apify dengan puluhan run serentak.
  const first = batchIds[0];
  if (first) {
    after(async () => {
      try {
        await executeEnrichmentBatch(first);
      } catch (err) {
        console.error("[brand/influencer/enrich]", err);
      }
    });
  }

  return { batchIds, queued: profiles.length };
}

/**
 * Profil yang belum punya snapshot sama sekali, atau yang snapshot terakhirnya
 * sudah lewat `staleDays`.
 *
 * Diekspor terpisah dari pencariannya supaya UI bisa MENGHITUNG antrean dengan
 * kriteria yang sama persis. Angka di tombol yang lahir dari where-clause
 * tiruan pasti menyimpang begitu salah satu sisi diubah.
 */
export function profilesNeedingEnrichmentWhere(
  staleDays: number | null = null,
): Prisma.InfluencerProfileWhereInput {
  if (staleDays === null) return { snapshots: { none: {} } };

  const cutoff = new Date(Date.now() - staleDays * 86_400_000);
  return {
    OR: [
      { snapshots: { none: {} } },
      { snapshots: { every: { collectedAt: { lt: cutoff } } } },
    ],
  };
}

export async function findProfilesNeedingEnrichment(
  limit: number,
  staleDays: number | null = null,
): Promise<string[]> {
  const profiles = await prisma.influencerProfile.findMany({
    where: profilesNeedingEnrichmentWhere(staleDays),
    take: limit,
    // Yang paling banyak muncul di crawl didahulukan: kalau anggaran run habis
    // di tengah jalan, yang terukur duluan adalah yang paling relevan.
    orderBy: [{ discoveryHits: { _count: "desc" } }, { firstSeenAt: "asc" }],
    select: { id: true },
  });

  return profiles.map((p) => p.id);
}

/** Dipanggil cron: majukan semua batch yang belum selesai. */
export async function pollRunningEnrichmentBatches(): Promise<{
  polled: number;
}> {
  const batches = await prisma.influencerEnrichmentBatch.findMany({
    where: {
      status: {
        in: [InfluencerJobStatus.PENDING, InfluencerJobStatus.COLLECTING],
      },
    },
    // Lebih rendah dari audit: tiap batch memicu run Apify berisi 50 handle,
    // jadi lima per siklus sudah setara 250 profil sedang diproses.
    take: 5,
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  for (const batch of batches) {
    try {
      await executeEnrichmentBatch(batch.id);
    } catch {
      /* error sudah tersimpan di record batch */
    }
  }

  return { polled: batches.length };
}
