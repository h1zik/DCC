import "server-only";

import { after } from "next/server";
import {
  InfluencerDiscoverySource,
  InfluencerJobStatus,
  InfluencerPlatform,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { RawSocialMention } from "@/lib/research/social-listening/collect-mentions";
import {
  isInstagramMentionsConfigured,
  pollInstagramScrapes,
  startInstagramScrapes,
} from "@/lib/research/social-listening/scrape-instagram-mentions";
import {
  isTikTokMentionsConfigured,
  pollTikTokScrape,
  startTikTokScrape,
} from "@/lib/research/social-listening/scrape-tiktok-mentions";
import {
  dedupeDiscoveryTerms,
  MAX_DISCOVERY_TERMS,
} from "@/lib/brand-research/influencer/discovery/discovery-limits";
import { collectDiscoveredCreators } from "@/lib/brand-research/influencer/discovery/handles";
import { persistDiscoveredCreators } from "@/lib/brand-research/influencer/discovery/persist-creators";
import { enqueueEnrichmentForProfiles } from "@/lib/brand-research/influencer/discovery/enrich-batch";

/**
 * Crawl penemuan kreator: hashtag/kata kunci masuk, orang keluar.
 *
 * Alurnya sengaja meniru `run-audit.ts` — idempoten, satu langkah per
 * pemanggilan, aman dipanggil berulang oleh cron — karena kendalanya sama:
 * Apify berjalan asinkron dan request HTTP tidak boleh menunggu.
 */

/** Cegah dua eksekusi paralel untuk run yang sama dalam satu proses. */
const activeRunIds = new Set<string>();

/**
 * Jeda sebelum run yang tersangkut di COLLECTING tanpa run Apify boleh dimulai
 * ulang — mencegah scrape kembar saat polling berjalan paralel.
 */
const ORPHANED_START_GRACE_MS = 2 * 60_000;

/**
 * Kata kunci maksimum per crawl — scraper di baliknya memang memotong di 5.
 * Nilainya tinggal di modul client-safe supaya dialog crawl bisa memakainya.
 */
export { MAX_DISCOVERY_TERMS };

/**
 * Crawl penemuan kreator SELALU lewat Apify, tidak pernah lewat VPS.
 *
 * Bukan soal kualitas data — keduanya memulangkan bentuk yang sama. Soalnya
 * batas waktu: jalur VPS tidak punya satu pun, jadi panggilan yang tidak
 * dijawab menggantung tanpa henti, dan crawl berhenti selamanya di COLLECTING
 * tanpa pesan error apa pun. Itu terbukti terjadi. Modul ini berjalan tanpa
 * pengawasan lewat cron, sehingga jalur yang bisa menggantung diam-diam adalah
 * jalur yang salah; Apify punya status run yang bisa ditanya dan pasti berakhir.
 *
 * Social Listening sengaja dibiarkan tetap memakai VPS: di sana ada orang yang
 * menunggu di depan layar dan bisa menjalankan ulang.
 */
const SCRAPE_ROUTE = { preferApify: true } as const;

/**
 * Crawl yang tidak juga selesai setelah ini dianggap gagal.
 *
 * Menjaga agar kegagalan apa pun yang tidak terduga — proses mati di tengah
 * jalan, run Apify raib, scraper yang tak pernah menjawab — berakhir sebagai
 * pesan error yang terbaca pengguna, bukan sebagai baris yang diam selamanya.
 */
const STALE_RUN_MS = 30 * 60_000;

/**
 * Batas atas kreator yang disimpan per run.
 *
 * Bukan pengendali biaya (biayanya sudah terjadi saat scrape), melainkan
 * pengaman agar satu crawl yang meleset tidak menyuntikkan ribuan baris sampah.
 * Bila batas ini kena, sisanya dilaporkan lewat `warnings` — bukan dibuang diam-diam.
 */
const MAX_PROFILES_PER_RUN = 300;

async function patchRun(
  runId: string,
  data: Prisma.InfluencerDiscoveryRunUpdateManyMutationInput,
): Promise<boolean> {
  const result = await prisma.influencerDiscoveryRun.updateMany({
    where: { id: runId },
    data,
  });
  return result.count > 0;
}

/** Kolom Json yang menyimpan daftar teks (run ID Apify, peringatan). */
function readStringArray(value: Prisma.JsonValue | null): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function resolvePlatforms(platforms: InfluencerPlatform[]): InfluencerPlatform[] {
  return platforms.length > 0
    ? platforms
    : [InfluencerPlatform.TIKTOK, InfluencerPlatform.INSTAGRAM];
}

/**
 * Majukan satu crawl satu langkah: mulai scrape → tunggu → panen → simpan.
 *
 * Idempoten dan dirancang dipanggil berulang oleh cron.
 */
export async function executeDiscoveryRun(runId: string): Promise<void> {
  if (activeRunIds.has(runId)) return;
  activeRunIds.add(runId);

  try {
    let run = await prisma.influencerDiscoveryRun.findUnique({
      where: { id: runId },
    });
    if (!run) return;

    let claimedPending = false;
    if (run.status === InfluencerJobStatus.PENDING) {
      const claimed = await prisma.influencerDiscoveryRun.updateMany({
        where: { id: runId, status: InfluencerJobStatus.PENDING },
        data: {
          status: InfluencerJobStatus.COLLECTING,
          startedAt: new Date(),
          errorMessage: null,
        },
      });
      if (claimed.count === 0) return;
      claimedPending = true;
      run = { ...run, status: InfluencerJobStatus.COLLECTING };
    } else if (run.status !== InfluencerJobStatus.COLLECTING) {
      return;
    }

    // Sudah terlalu lama untuk masih dipercaya akan selesai. Digagalkan di sini
    // supaya pengguna melihat sebab yang bisa ditindaklanjuti, bukan baris yang
    // menunjukkan "berjalan" tanpa batas.
    if (Date.now() - run.createdAt.getTime() >= STALE_RUN_MS) {
      throw new Error(
        `Crawl melewati batas ${Math.round(STALE_RUN_MS / 60_000)} menit tanpa selesai. Scraper kemungkinan tidak menjawab — jalankan ulang, dan bila berulang periksa APIFY_API_TOKEN serta status actor di dashboard Apify.`,
      );
    }

    const platforms = resolvePlatforms(run.platforms);
    const warnings = readStringArray(run.warnings);
    const instagramRunIds = readStringArray(run.apifyInstagramRunIds);
    const hasStarted = !!run.apifyTikTokRunId || instagramRunIds.length > 0;

    // ── Langkah 1: mulai scrape ─────────────────────────────────────────
    if (!hasStarted) {
      const oldEnoughToRecover =
        Date.now() - run.createdAt.getTime() >= ORPHANED_START_GRACE_MS;
      if (!claimedPending && !oldEnoughToRecover) return;

      const startWarnings: string[] = [];
      let tiktokRunId: string | null = null;
      let igRunIds: string[] = [];

      if (platforms.includes(InfluencerPlatform.TIKTOK)) {
        if (!isTikTokMentionsConfigured(SCRAPE_ROUTE)) {
          startWarnings.push(
            "TikTok scraper belum dikonfigurasi — platform TikTok dilewati.",
          );
        } else {
          try {
            const started = await startTikTokScrape(run.terms, {
              searchLimit: run.searchLimit,
              ...SCRAPE_ROUTE,
            });
            if (started) {
              tiktokRunId = started.runId;
              if (started.warnings?.length) {
                startWarnings.push(...started.warnings);
              }
            } else {
              startWarnings.push("TikTok: gagal memulai scrape.");
            }
          } catch (err) {
            startWarnings.push(
              `TikTok: ${err instanceof Error ? err.message : "gagal memulai scrape."}`,
            );
          }
        }
      }

      if (platforms.includes(InfluencerPlatform.INSTAGRAM)) {
        if (!isInstagramMentionsConfigured(SCRAPE_ROUTE)) {
          startWarnings.push(
            "Instagram scraper belum dikonfigurasi — platform Instagram dilewati.",
          );
        } else {
          try {
            const started = await startInstagramScrapes(run.terms, {
              searchLimit: run.searchLimit,
              ...SCRAPE_ROUTE,
            });
            igRunIds = started.runIds;
            if (started.warnings.length > 0) {
              startWarnings.push(...started.warnings);
            }
            if (igRunIds.length === 0) {
              startWarnings.push("Instagram: gagal memulai scrape.");
            }
          } catch (err) {
            startWarnings.push(
              `Instagram: ${err instanceof Error ? err.message : "gagal memulai scrape."}`,
            );
          }
        }
      }

      // Tidak satu pun platform berhasil dimulai: gagalkan sekarang. Membiarkan
      // run tanpa runId akan membuatnya dicoba ulang tiap siklus cron selamanya.
      if (!tiktokRunId && igRunIds.length === 0) {
        throw new Error(
          startWarnings.length > 0
            ? startWarnings.join(" ")
            : "Tidak ada platform yang bisa di-scrape untuk crawl ini.",
        );
      }

      await patchRun(runId, {
        apifyTikTokRunId: tiktokRunId,
        apifyInstagramRunIds: igRunIds as unknown as Prisma.InputJsonValue,
        warnings: [
          ...warnings,
          ...startWarnings,
        ] as unknown as Prisma.InputJsonValue,
      });
      // Jangan blokir request ini menunggu actor; poll berikutnya melanjutkan.
      return;
    }

    // ── Langkah 2: tunggu semua platform selesai ────────────────────────
    const pollWarnings: string[] = [];
    const mentions: RawSocialMention[] = [];
    let stillRunning = false;

    if (run.apifyTikTokRunId) {
      try {
        const result = await pollTikTokScrape(run.apifyTikTokRunId, SCRAPE_ROUTE);
        if (!result.done) {
          stillRunning = true;
        } else if (result.succeeded || result.mentions.length > 0) {
          mentions.push(...result.mentions);
          if (result.mentions.length === 0) {
            pollWarnings.push(
              "TikTok: scrape selesai tapi tidak ada video ditemukan.",
            );
          }
        } else {
          pollWarnings.push(
            `TikTok: scrape gagal${result.apifyStatus ? ` (${result.apifyStatus})` : ""}.`,
          );
        }
      } catch (err) {
        // Gangguan sementara membaca status bukan kegagalan crawl — coba lagi.
        console.warn("[brand/influencer/discovery/poll-tiktok]", runId, err);
        return;
      }
    }

    if (instagramRunIds.length > 0) {
      try {
        const result = await pollInstagramScrapes(instagramRunIds, SCRAPE_ROUTE);
        if (!result.done) {
          stillRunning = true;
        } else if (result.succeeded || result.mentions.length > 0) {
          mentions.push(...result.mentions);
          if (result.mentions.length === 0) {
            pollWarnings.push(
              "Instagram: scrape selesai tapi tidak ada post ditemukan.",
            );
          }
        } else {
          pollWarnings.push("Instagram: scrape gagal.");
        }
      } catch (err) {
        console.warn("[brand/influencer/discovery/poll-instagram]", runId, err);
        return;
      }
    }

    if (stillRunning) return;

    // ── Langkah 3: panen kreator & simpan ───────────────────────────────
    const creators = collectDiscoveredCreators(mentions, run.terms);
    const capped = creators.slice(0, MAX_PROFILES_PER_RUN);
    if (creators.length > capped.length) {
      pollWarnings.push(
        `Crawl menemukan ${creators.length} kreator, disimpan ${capped.length} teratas (batas ${MAX_PROFILES_PER_RUN} per run). Persempit kata kuncinya bila sisanya masih dibutuhkan.`,
      );
    }

    const { found, created } = await persistDiscoveredCreators(
      runId,
      run.source,
      run.createdById,
      capped,
    );

    if (found === 0 && mentions.length > 0) {
      pollWarnings.push(
        `${mentions.length} post terbaca tapi tidak satu pun membawa username yang bisa dipakai.`,
      );
    }

    /**
     * Langsung antrekan pengukuran untuk kreator yang belum punya angka.
     *
     * Tanpa ini, hasil crawl hanya berupa daftar username tanpa jumlah follower
     * maupun engagement — belum bisa diperingkat, jadi belum berguna. Biayanya
     * sudah terbatas dengan sendirinya oleh `MAX_PROFILES_PER_RUN` di atas.
     */
    try {
      const needMeasuring = await prisma.influencerProfile.findMany({
        where: { discoveryHits: { some: { runId } }, snapshots: { none: {} } },
        select: { id: true },
      });
      if (needMeasuring.length > 0) {
        const { batchIds } = await enqueueEnrichmentForProfiles(
          needMeasuring.map((p) => p.id),
        );
        pollWarnings.push(
          `${needMeasuring.length} kreator diantre untuk diukur dalam ${batchIds.length} batch.`,
        );
      }
    } catch (err) {
      // Crawl-nya sendiri sudah berhasil — kegagalan mengantre pengukuran
      // tidak boleh membatalkan kreator yang sudah tersimpan.
      console.error("[brand/influencer/discovery/enqueue-enrich]", runId, err);
      pollWarnings.push(
        "Kreator tersimpan, tapi antrean pengukuran gagal dibuat. Jalankan ulang pengukuran dari halaman KOL Radar.",
      );
    }

    await patchRun(runId, {
      status: InfluencerJobStatus.READY,
      postsScanned: mentions.length,
      profilesFound: found,
      profilesNew: created,
      warnings: [
        ...warnings,
        ...pollWarnings,
      ] as unknown as Prisma.InputJsonValue,
      finishedAt: new Date(),
      errorMessage: null,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Crawl penemuan kreator gagal.";
    await patchRun(runId, {
      status: InfluencerJobStatus.FAILED,
      errorMessage: message,
      finishedAt: new Date(),
    });
    throw err;
  } finally {
    activeRunIds.delete(runId);
  }
}

export type EnqueueDiscoveryInput = {
  source: InfluencerDiscoverySource;
  terms: string[];
  /** Kosong berarti kedua platform. */
  platforms?: InfluencerPlatform[];
  searchLimit: number;
  createdById: string | null;
};

export async function enqueueDiscoveryRun(
  input: EnqueueDiscoveryInput,
): Promise<{ runId: string }> {
  // Dinormalkan lebih dulu supaya "#Skincare" dan "skincare" tidak memakan dua
  // dari lima slot untuk menyisir hashtag yang sama persis.
  const terms = dedupeDiscoveryTerms(input.terms);

  if (terms.length === 0) {
    throw new Error("Isi minimal satu hashtag atau kata kunci.");
  }
  // Ditolak dengan jelas, bukan dipotong diam-diam: scraper di baliknya memang
  // hanya memproses lima, dan kata kunci yang hilang tanpa kabar akan terbaca
  // sebagai "tidak ada hasil" padahal tidak pernah dicari.
  if (terms.length > MAX_DISCOVERY_TERMS) {
    throw new Error(
      `Maksimal ${MAX_DISCOVERY_TERMS} kata kunci per crawl — Anda mengisi ${terms.length}. Pecah jadi beberapa crawl.`,
    );
  }

  const run = await prisma.influencerDiscoveryRun.create({
    data: {
      source: input.source,
      terms,
      platforms: input.platforms ?? [],
      searchLimit: input.searchLimit,
      createdById: input.createdById,
      status: InfluencerJobStatus.PENDING,
    },
    select: { id: true },
  });

  after(async () => {
    try {
      await executeDiscoveryRun(run.id);
    } catch (err) {
      console.error("[brand/influencer/discovery]", err);
    }
  });

  return { runId: run.id };
}

/** Dipanggil cron: majukan semua crawl yang belum selesai. */
export async function pollRunningDiscoveryRuns(): Promise<{ polled: number }> {
  const runs = await prisma.influencerDiscoveryRun.findMany({
    where: {
      status: {
        in: [
          InfluencerJobStatus.PENDING,
          InfluencerJobStatus.COLLECTING,
        ],
      },
    },
    take: 5,
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  for (const run of runs) {
    try {
      await executeDiscoveryRun(run.id);
    } catch {
      /* error sudah tersimpan di record run */
    }
  }

  return { polled: runs.length };
}
