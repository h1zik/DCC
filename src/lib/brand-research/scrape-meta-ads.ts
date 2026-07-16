import "server-only";

import { after } from "next/server";
import { Prisma, SocialListeningStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildMetaAdLibraryActorInput,
  getMetaAdLibraryActorId,
  metaAdLibraryActorEnvHint,
} from "@/lib/apify/actors";
import {
  fetchApifyDataset,
  getApifyRunStatus,
  isApifyConfigured,
  startApifyActor,
} from "@/lib/apify/client";
import {
  generateDemoMetaAds,
  normalizeMetaAds,
  type NormalizedMetaAd,
} from "@/lib/apify/normalize-meta-ads";
import {
  filterAdsByScrapeMediaType,
  type ScrapeMediaType,
} from "@/lib/brand-research/ad-library-media";
import {
  computeDaysRunning,
  scoreAdWinning,
} from "@/lib/brand-research/ad-winning-score";
import { assertDemoDataAllowed } from "@/lib/demo-data-policy";
import { generateResearchJson } from "@/lib/research/gemini-client";
import { filterAdsForMonitorView } from "@/lib/brand-research/ad-library-safety";
import { brandStudioBrandFilter } from "@/lib/brand-research/brand-studio-scope";
import { getAdLibraryApifyOutcome } from "@/lib/brand-research/ad-library-apify-status";

const activeBatchIds = new Set<string>();
const ORPHANED_START_GRACE_MS = 2 * 60_000;

async function patchBatch(
  batchId: string,
  data: Prisma.BrandAdLibraryBatchUpdateManyMutationInput,
): Promise<boolean> {
  const result = await prisma.brandAdLibraryBatch.updateMany({
    where: { id: batchId },
    data,
  });
  return result.count > 0;
}

async function upsertAdsForMonitor(
  monitorId: string,
  batchId: string,
  ads: NormalizedMetaAd[],
): Promise<number> {
  const now = new Date();
  let count = 0;
  for (const ad of ads) {
    const daysRunning = computeDaysRunning(ad.deliveryStart, ad.deliveryStop, now);
    const winning = scoreAdWinning({
      daysRunning,
      isActive: ad.isActive,
      collationCount: ad.collationCount,
      audienceUpper: ad.audienceUpper,
      platformCount: ad.platforms.length,
    });

    // Field yang identik untuk create & update (selain monitorId/externalId).
    const data = {
      batchId,
      pageId: ad.pageId,
      pageName: ad.pageName,
      pageProfileUrl: ad.pageProfileUrl,
      bodyText: ad.bodyText,
      linkTitle: ad.linkTitle,
      linkUrl: ad.linkUrl,
      linkDescription: ad.linkDescription,
      linkCaption: ad.linkCaption,
      ctaType: ad.ctaType,
      ctaText: ad.ctaText,
      mediaType: ad.mediaType,
      imageUrl: ad.imageUrl,
      videoUrl: ad.videoUrl,
      snapshotUrl: ad.snapshotUrl,
      platforms: ad.platforms,
      isActive: ad.isActive,
      deliveryStart: ad.deliveryStart,
      deliveryStop: ad.deliveryStop,
      collationCount: ad.collationCount,
      pageLikeCount: ad.pageLikeCount,
      pageCategories: ad.pageCategories,
      pageCreationDate: ad.pageCreationDate,
      totalActiveAds: ad.totalActiveAds,
      audienceLower: ad.audienceLower,
      audienceUpper: ad.audienceUpper,
      spendLower: ad.spendLower,
      spendUpper: ad.spendUpper,
      currency: ad.currency,
      cards: ad.cards as unknown as Prisma.InputJsonValue,
      winningScore: winning.score,
      rawData: ad.rawData as Prisma.InputJsonValue,
      scrapedAt: ad.scrapedAt ?? now,
    };

    await prisma.brandAdLibraryAd.upsert({
      where: { monitorId_externalId: { monitorId, externalId: ad.externalId } },
      create: { monitorId, externalId: ad.externalId, ...data },
      update: data,
    });
    count += 1;
  }
  return count;
}

async function syncAdsForMonitor(
  monitorId: string,
  batchId: string,
  ads: NormalizedMetaAd[],
): Promise<number> {
  const count = await upsertAdsForMonitor(monitorId, batchId, ads);
  const externalIds = ads.map((a) => a.externalId);

  if (externalIds.length > 0) {
    await prisma.brandAdLibraryAd.deleteMany({
      where: {
        monitorId,
        externalId: { notIn: externalIds },
      },
    });
  } else {
    await prisma.brandAdLibraryAd.deleteMany({ where: { monitorId } });
  }

  return count;
}

function applyAdLibraryGuards(
  ads: NormalizedMetaAd[],
  monitor: {
    searchTerms: string[];
    adLibraryUrls: string[];
    searchType: string | null;
  },
): NormalizedMetaAd[] {
  return filterAdsForMonitorView(ads, monitor);
}

export async function generateAdLibraryAiSummary(monitorId: string): Promise<void> {
  const monitor = await prisma.brandAdLibraryMonitor.findUnique({
    where: { id: monitorId },
    include: {
      ads: {
        orderBy: { updatedAt: "desc" },
        take: 40,
      },
    },
  });
  if (!monitor || monitor.ads.length === 0) return;

  const sample = monitor.ads.map((ad) => ({
    pageName: ad.pageName,
    bodyText: ad.bodyText?.slice(0, 200) ?? null,
    ctaType: ad.ctaType,
    ctaText: ad.ctaText,
    mediaType: ad.mediaType,
    platforms: ad.platforms,
    isActive: ad.isActive,
  }));

  try {
    const result = await generateResearchJson<{
      summary: string;
      dominantFormats: string[];
      dominantCtas: string[];
      hookPatterns: string[];
      creativeRecommendations: string[];
    }>(
      `Kamu adalah strategist iklan performance & branding Indonesia.

Analisis sample iklan Meta Ad Library untuk monitor "${monitor.name}" (keyword: ${monitor.searchTerms.join(", ") || "URL"}).

Data iklan:
${JSON.stringify(sample, null, 2)}

Berikan insight untuk tim branding yang akan membuat konten iklan.

Balas JSON:
{
  "summary": "3-4 kalimat ringkasan pola kreatif dominan",
  "dominantFormats": ["IMAGE|VIDEO|CAROUSEL", ...],
  "dominantCtas": ["SHOP_NOW", ...],
  "hookPatterns": ["pola hook yang sering dipakai"],
  "creativeRecommendations": ["rekomendasi konkret untuk tim kreatif"]
}`,
      { tier: "flash" },
    );

    await prisma.brandAdLibraryMonitor.update({
      where: { id: monitorId },
      data: {
        aiSummary: result.summary,
        aiInsights: {
          dominantFormats: result.dominantFormats,
          dominantCtas: result.dominantCtas,
          hookPatterns: result.hookPatterns,
          creativeRecommendations: result.creativeRecommendations,
        },
      },
    });
  } catch (err) {
    console.error("[brand/ad-library/ai-summary]", err);
  }
}

export async function executeBrandAdLibraryBatch(batchId: string): Promise<void> {
  if (activeBatchIds.has(batchId)) return;

  activeBatchIds.add(batchId);

  try {
    let batch = await prisma.brandAdLibraryBatch.findUnique({
      where: { id: batchId },
      include: { monitor: true },
    });
    if (!batch?.monitor) return;

    let claimedPendingBatch = false;
    if (batch.status === SocialListeningStatus.PENDING) {
      const claimed = await prisma.brandAdLibraryBatch.updateMany({
        where: {
          id: batchId,
          status: SocialListeningStatus.PENDING,
        },
        data: {
          status: SocialListeningStatus.COLLECTING,
          errorMessage: null,
        },
      });
      if (claimed.count === 0) return;
      claimedPendingBatch = true;
      batch = { ...batch, status: SocialListeningStatus.COLLECTING };
    } else if (batch.status !== SocialListeningStatus.COLLECTING) {
      return;
    }

    const monitor = batch.monitor;
    const scrapeMedia = (monitor.mediaType ?? "all") as ScrapeMediaType;
    let ads: NormalizedMetaAd[] = [];

    if (!isApifyConfigured()) {
      assertDemoDataAllowed("Scraper Meta Ad Library (Apify)");
      ads = generateDemoMetaAds(monitor.searchTerms);
    } else {
      const actorId = getMetaAdLibraryActorId();
      if (!actorId) {
        throw new Error(metaAdLibraryActorEnvHint());
      }

      let runId = batch.apifyRunId;
      if (!runId) {
        // Biasanya hanya batch yang baru diklaim yang masuk ke sini. Grace
        // period memungkinkan recovery bila proses mati setelah status berubah
        // ke COLLECTING tetapi sebelum runId sempat disimpan, tanpa mudah
        // membuat duplicate actor run saat ada polling paralel.
        const oldEnoughToRecover =
          Date.now() - batch.createdAt.getTime() >= ORPHANED_START_GRACE_MS;
        if (!claimedPendingBatch && !oldEnoughToRecover) return;

        const input = buildMetaAdLibraryActorInput(monitor);
        const started = await startApifyActor(actorId, input);
        runId = started.runId;
        await patchBatch(batchId, { apifyRunId: runId });

        // Jangan menunggu actor di request/callback ini. Poll berikutnya akan
        // mengecek status dan mengambil dataset setelah Apify selesai.
        return;
      }

      let run: Awaited<ReturnType<typeof getApifyRunStatus>>;
      try {
        run = await getApifyRunStatus(runId);
      } catch (err) {
        // Gangguan sementara saat membaca status Apify bukan kegagalan scrape.
        // Biarkan COLLECTING agar polling berikutnya dapat mencoba lagi.
        console.warn("[brand/ad-library/poll-status]", batchId, err);
        return;
      }

      const outcome = getAdLibraryApifyOutcome(run.status);
      if (outcome === "waiting") return;
      if (outcome === "failed") {
        const status = run.status;
        throw new Error(`Apify run status: ${status}`);
      }

      let items: Record<string, unknown>[];
      try {
        items = await fetchApifyDataset<Record<string, unknown>>(run.datasetId);
      } catch (err) {
        // Run sudah sukses tetapi dataset mungkin belum sesaat tersedia atau
        // request sedang terganggu. Retry pada polling berikutnya.
        console.warn("[brand/ad-library/fetch-dataset]", batchId, err);
        return;
      }
      ads = normalizeMetaAds(items);
    }

    if (scrapeMedia !== "all") {
      ads = filterAdsByScrapeMediaType(ads, scrapeMedia);
    }

    const beforeGuardCount = ads.length;
    ads = applyAdLibraryGuards(ads, monitor);

    // Hormati target jumlah (maxAds) sebagai TOTAL hasil akhir. Actor scrape per
    // keyword/URL, jadi total mentah bisa sedikit di atas target — pangkas di sini.
    const targetCount = Math.min(Math.max(monitor.maxAds || 50, 10), 200);
    if (ads.length > targetCount) {
      ads = ads.slice(0, targetCount);
    }

    if (ads.length === 0 && beforeGuardCount > 0) {
      throw new Error(
        `Meta mengembalikan ${beforeGuardCount} iklan, tetapi tidak ada yang lolos filter keamanan/relevansi untuk keyword "${monitor.searchTerms.join(", ")}". Coba keyword lebih spesifik atau gunakan URL Ad Library halaman kompetitor.`,
      );
    }

    if (ads.length === 0) {
      const mediaHint =
        monitor.mediaType && monitor.mediaType !== "all"
          ? ` Tidak ada iklan format "${monitor.mediaType}" — coba Image + Video atau ubah keyword.`
          : "";
      throw new Error(
        `Tidak ada iklan ditemukan.${mediaHint} Coba keyword lain, perluas negara, atau ubah filter media.`,
      );
    }

    const monitorStillThere = await prisma.brandAdLibraryMonitor.findUnique({
      where: { id: monitor.id },
      select: { id: true },
    });
    if (!monitorStillThere) {
      console.info(
        `[brand/ad-library/scrape] monitor ${monitor.id} dihapus saat scrape — hasil dibuang.`,
      );
      return;
    }

    const adCount = await syncAdsForMonitor(monitor.id, batchId, ads);

    await patchBatch(batchId, {
      status: SocialListeningStatus.READY,
      adCount,
      collectedAt: new Date(),
      errorMessage: null,
    });

    await generateAdLibraryAiSummary(monitor.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scrape Ad Library gagal.";
    await patchBatch(batchId, {
      status: SocialListeningStatus.FAILED,
      errorMessage: message,
    });
    throw err;
  } finally {
    activeBatchIds.delete(batchId);
  }
}

export async function enqueueBrandAdLibraryScrape(
  monitorId: string,
): Promise<{ batchId: string }> {
  const monitor = await prisma.brandAdLibraryMonitor.findUnique({
    where: { id: monitorId },
  });
  if (!monitor) throw new Error("Monitor Ad Library tidak ditemukan.");

  const inFlight = await prisma.brandAdLibraryBatch.findFirst({
    where: {
      monitorId,
      status: { in: [SocialListeningStatus.PENDING, SocialListeningStatus.COLLECTING] },
    },
  });
  if (inFlight) {
    throw new Error("Scrape masih berjalan — tunggu batch sebelumnya selesai.");
  }

  const batch = await prisma.brandAdLibraryBatch.create({
    data: {
      monitorId,
      status: SocialListeningStatus.PENDING,
    },
  });

  after(async () => {
    try {
      await executeBrandAdLibraryBatch(batch.id);
    } catch (err) {
      console.error("[brand/ad-library/scrape]", err);
    }
  });

  return { batchId: batch.id };
}

export async function pollBrandAdLibraryBatchesLight(): Promise<void> {
  const batches = await prisma.brandAdLibraryBatch.findMany({
    where: {
      status: {
        in: [SocialListeningStatus.PENDING, SocialListeningStatus.COLLECTING],
      },
    },
    take: 10,
    orderBy: { createdAt: "asc" },
  });

  for (const batch of batches) {
    try {
      await executeBrandAdLibraryBatch(batch.id);
    } catch {
      /* errors persisted on batch */
    }
  }
}

export async function listBrandAdLibraryMonitors(ownerBrandId?: string | null) {
  return prisma.brandAdLibraryMonitor.findMany({
    where: brandStudioBrandFilter(ownerBrandId),
    orderBy: { updatedAt: "desc" },
    include: {
      batches: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      _count: { select: { ads: true } },
    },
  });
}

export async function getBrandAdLibraryMonitorDetail(
  monitorId: string,
  ownerBrandId?: string | null,
) {
  return prisma.brandAdLibraryMonitor.findFirst({
    where: {
      id: monitorId,
      ...brandStudioBrandFilter(ownerBrandId),
    },
    include: {
      batches: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
      ads: {
        orderBy: { updatedAt: "desc" },
        take: 200,
      },
    },
  });
}
