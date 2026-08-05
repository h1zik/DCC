import "server-only";

import { after } from "next/server";
import {
  InfluencerAuditStatus,
  InfluencerPlatform,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildInfluencerActorInput,
  buildInstagramReelsActorInput,
  DEFAULT_POST_SAMPLE,
  getInfluencerActorId,
  influencerActorEnvHint,
} from "@/lib/apify/influencer-actors";
import {
  ApifyRunNotFoundError,
  fetchApifyDataset,
  getApifyRunStatus,
  isApifyConfigured,
  startApifyActor,
} from "@/lib/apify/client";
import {
  mergeInstagramSurfaces,
  normalizeInfluencerDataset,
  normalizeInstagramReels,
  type NormalizedInfluencerProfile,
} from "@/lib/apify/normalize-influencer";
import { getAdLibraryApifyOutcome } from "@/lib/brand-research/ad-library-apify-status";
import {
  postEngagementRate,
  scoreInfluencer,
  selectSample,
  TIER_LABEL,
  VERDICT_LABEL,
  type InfluencerScoreResult,
} from "@/lib/brand-research/influencer/score";
import { isSponsoredPost } from "@/lib/brand-research/influencer/sponsored";
import {
  buildResearchAiStep,
  generateResearchJson,
  researchAiMetaFromSteps,
} from "@/lib/research/llm";

/** Cegah dua eksekusi paralel untuk audit yang sama dalam satu proses. */
const activeAuditIds = new Set<string>();

/**
 * Jeda sebelum audit yang tersangkut di COLLECTING tanpa `apifyRunId` boleh
 * dimulai ulang — mencegah duplicate actor run saat polling berjalan paralel.
 */
const ORPHANED_START_GRACE_MS = 2 * 60_000;

async function patchAudit(
  auditId: string,
  data: Prisma.InfluencerAuditUpdateManyMutationInput,
): Promise<boolean> {
  const result = await prisma.influencerAudit.updateMany({
    where: { id: auditId },
    data,
  });
  return result.count > 0;
}

async function generateAuditNarrative(
  auditId: string,
  profile: { handle: string; platform: InfluencerPlatform; followers: number },
  scored: InfluencerScoreResult,
): Promise<void> {
  const platformLabel =
    profile.platform === InfluencerPlatform.INSTAGRAM ? "Instagram" : "TikTok";

  let actualModel: string | undefined;

  try {
    const result = await generateResearchJson<{
      summary: string;
      strengths: string[];
      risks: string[];
      recommendation: string;
    }>(
      `Kamu adalah influencer marketing strategist di Indonesia yang bertugas menilai kelayakan seorang KOL sebelum brand membayar mereka.

Influencer: @${profile.handle} (${platformLabel})
Tier: ${TIER_LABEL[scored.tier]}
Follower: ${profile.followers.toLocaleString("id-ID")}

Metrik terukur (semua angka pusat memakai MEDIAN, bukan rata-rata, agar satu post viral tidak menyesatkan):
- Engagement rate standar (like+komentar terhadap follower): ${scored.engagementRate}% — median tier ini ${scored.benchmarkEr}%, jadi ${scored.metrics.erVsBenchmark}× median
- Engagement rate penuh (termasuk share & simpan): ${scored.totalEngagementRate}%
- Engagement rate terhadap view: ${scored.viewEngagementRate ?? "tidak tersedia"}%
- View rate (view dibagi follower): ${scored.viewRate ?? "tidak tersedia"}%

Feed vs Reels (khusus Instagram; di TikTok semuanya video):
- Post feed dianalisis: ${scored.feedPostCount}, Reels dianalisis: ${scored.reelsPostCount}
- ER feed (angka utama di atas): ${scored.engagementRate}%
- ER Reels terhadap follower: ${scored.reelsEngagementRate ?? "tidak tersedia"}%
- CATATAN PENTING: feed dan Reels adalah dua permukaan berbeda. Kalau ER feed jauh di atas ER Reels, artinya audiensnya berinteraksi di post feed sementara Reels-nya dipakai menjangkau orang baru — sarankan format feed bila brand mengejar engagement, dan Reels bila mengejar jangkauan. Jangan menyimpulkan salah satunya buruk hanya karena berbeda.
- Median per post: like ${scored.medianLikes}, komentar ${scored.medianComments}, share ${scored.medianShares}, view ${scored.medianViews}
- Rata-rata per post (pembanding): like ${scored.avgLikes}, view ${scored.avgViews}
- Rasio komentar terhadap like: ${scored.metrics.commentLikeRatio ?? "tidak tersedia"}
- Variasi engagement antar post: ${scored.metrics.engagementCv ?? "tidak tersedia"}
- Dominasi post viral (rata-rata ÷ median): ${scored.metrics.viralSkew ?? "tidak tersedia"}
- Tren engagement (post terbaru vs terlama): ${scored.metrics.engagementTrendPct ?? "tidak tersedia"}%
- Ritme posting: ${scored.postsPerWeek} post/minggu, terakhir posting ${scored.daysSinceLastPost ?? "?"} hari lalu

Post berbayar vs organik:
- Post berbayar terdeteksi: ${scored.sponsored.sponsoredCount}, organik: ${scored.sponsored.organicCount}
- ER post berbayar: ${scored.sponsored.sponsoredEr ?? "sampel tidak cukup"}%, ER post organik: ${scored.sponsored.organicEr ?? "sampel tidak cukup"}%
- Selisih: ${scored.sponsored.deltaPct ?? "tidak bisa dihitung"}%
- Perkiraan ER yang akan didapat brand bila memasang campaign: ${scored.metrics.expectedCampaignEr}% (sumber: ${scored.metrics.expectedCampaignErSource === "sponsored" ? "post berbayar influencer ini" : "ER umum, karena post berbayar tidak cukup untuk dijadikan dasar"})
- CATATAN: deteksi berbayar hanya menangkap post yang memberi penanda (#ad, #kerjasama, label paid partnership). Angka ini batas bawah, bukan jumlah pasti.

Kualitas sampel:
- Post dianalisis: ${scored.postsAnalyzed} dari ${scored.postsFetched} yang diambil, mencakup ${scored.sampleWindowDays ?? "?"} hari
- Tingkat keyakinan: ${scored.confidence}

Hasil penilaian sistem:
- Skor performa: ${scored.score}/100 — ${VERDICT_LABEL[scored.verdict]}
- Skor keaslian: ${scored.authenticityScore}/100

Sinyal yang terdeteksi:
${scored.fakeFlags.length > 0 ? scored.fakeFlags.map((f) => `- [${f.impact}/${f.severity}] ${f.label}: ${f.detail}`).join("\n") : "- Tidak ada"}

Tulis penilaian yang jujur dan tegas untuk tim brand. Jangan mengarang data di luar angka di atas. Aturan:
- Bila ada DUA ATAU LEBIH sinyal berdampak "authenticity" tingkat "high", katakan terus terang engagement-nya patut dicurigai dan jangan merekomendasikan kerja sama.
- Bila hanya ADA SATU sinyal "authenticity" tingkat "high", jangan menuduh. Sebutkan sinyal itu sebagai hal yang perlu diperiksa manual dulu, dan jelaskan penjelasan wajar apa yang mungkin ada di baliknya.
- Sinyal berdampak "performance" bukan tuduhan kecurangan — itu soal hasil yang akan didapat, bukan keaslian audiens. Jangan menyebutnya engagement palsu.
- Bila tingkat keyakinan rendah, sebutkan bahwa kesimpulannya sementara dan sarankan audit ulang setelah influencer memposting lebih banyak.
- Bila ER post berbayar jauh di bawah organik, jadikan itu poin utama — angka itulah yang akan brand dapatkan.

Balas JSON:
{
  "summary": "3-4 kalimat penilaian menyeluruh dalam bahasa Indonesia",
  "strengths": ["kekuatan konkret berbasis angka di atas"],
  "risks": ["risiko konkret; sebut sinyal palsu bila ada"],
  "recommendation": "1-2 kalimat: layak diajak kerja sama atau tidak, dan dengan syarat apa"
}`,
      {
        tier: "flash",
        onModelUsed: (model) => {
          actualModel = model;
        },
      },
    );

    await patchAudit(auditId, {
      aiSummary: result.summary,
      aiMeta: researchAiMetaFromSteps([
        buildResearchAiStep("Penilaian influencer", "flash", { actualModel }),
      ]) as unknown as Prisma.InputJsonValue,
      metrics: {
        ...scored.metrics,
        narrative: {
          strengths: result.strengths,
          risks: result.risks,
          recommendation: result.recommendation,
        },
      } as unknown as Prisma.InputJsonValue,
    });
  } catch (err) {
    // Narasi AI adalah pelengkap — metrik terukur tetap tersimpan dan berguna
    // tanpa itu, jadi kegagalan di sini tidak boleh menggagalkan audit.
    console.error("[brand/influencer/narrative]", err);
    await patchAudit(auditId, {
      aiMeta: researchAiMetaFromSteps([
        buildResearchAiStep("Penilaian influencer", "flash", {
          actualModel,
          error: err instanceof Error ? err.message : "Analisis AI gagal.",
        }),
      ]) as unknown as Prisma.InputJsonValue,
    });
  }
}

async function persistAuditResult(
  auditId: string,
  profileId: string,
  normalized: NormalizedInfluencerProfile,
  scored: InfluencerScoreResult,
): Promise<void> {
  await prisma.influencerProfile.update({
    where: { id: profileId },
    data: {
      displayName: normalized.displayName ?? undefined,
      avatarUrl: normalized.avatarUrl ?? undefined,
      bio: normalized.bio ?? undefined,
      isVerified: normalized.isVerified,
    },
  });

  // Snapshot ditulis ulang dari nol supaya audit ulang yang tertunda tidak
  // meninggalkan post basi dari percobaan sebelumnya.
  await prisma.influencerPost.deleteMany({ where: { auditId } });
  if (normalized.posts.length > 0) {
    // Post di luar jendela sampel tetap disimpan (transparansi) tapi ditandai
    // agar UI bisa menjelaskan mengapa post itu tidak ikut menghitung ER.
    const sampleIds = new Set(
      selectSample(normalized.posts, new Date()).map((p) => p.externalId),
    );

    await prisma.influencerPost.createMany({
      data: normalized.posts.map((p) => ({
        auditId,
        externalId: p.externalId,
        url: p.url ?? null,
        caption: p.caption?.slice(0, 2000) ?? null,
        thumbnailUrl: p.thumbnailUrl ?? null,
        mediaType: p.mediaType ?? null,
        likes: p.likes,
        comments: p.comments,
        shares: p.shares,
        views: p.views,
        saves: p.saves,
        engagementRate: postEngagementRate(p, normalized.followers),
        isSponsored: isSponsoredPost(p),
        inSample: sampleIds.has(p.externalId),
        surface: p.surface,
        isPinned: p.isPinned ?? false,
        postedAt: p.postedAt ?? null,
      })),
      skipDuplicates: true,
    });
  }

  await patchAudit(auditId, {
    status: InfluencerAuditStatus.ANALYZING,
    followers: normalized.followers,
    following: normalized.following,
    postCount: normalized.postCount,
    tier: scored.tier,
    postsFetched: scored.postsFetched,
    postsAnalyzed: scored.postsAnalyzed,
    sampleWindowDays: scored.sampleWindowDays,
    confidence: scored.confidence,
    medianLikes: scored.medianLikes,
    medianComments: scored.medianComments,
    medianShares: scored.medianShares,
    medianViews: scored.medianViews,
    avgLikes: scored.avgLikes,
    avgComments: scored.avgComments,
    avgShares: scored.avgShares,
    avgViews: scored.avgViews,
    engagementRate: scored.engagementRate,
    totalEngagementRate: scored.totalEngagementRate,
    viewEngagementRate: scored.viewEngagementRate,
    viewRate: scored.viewRate,
    feedPostCount: scored.feedPostCount,
    reelsPostCount: scored.reelsPostCount,
    reelsEngagementRate: scored.reelsEngagementRate,
    postsPerWeek: scored.postsPerWeek,
    daysSinceLastPost: scored.daysSinceLastPost,
    sponsoredCount: scored.sponsored.sponsoredCount,
    organicCount: scored.sponsored.organicCount,
    sponsoredEr: scored.sponsored.sponsoredEr,
    organicEr: scored.sponsored.organicEr,
    sponsoredDeltaPct: scored.sponsored.deltaPct,
    expectedCampaignEr: scored.metrics.expectedCampaignEr,
    score: scored.score,
    verdict: scored.verdict,
    benchmarkEr: scored.benchmarkEr,
    authenticityScore: scored.authenticityScore,
    fakeFlags: scored.fakeFlags as unknown as Prisma.InputJsonValue,
    metrics: scored.metrics as unknown as Prisma.InputJsonValue,
    collectedAt: new Date(),
    errorMessage: null,
  });
}

/**
 * Jalankan satu audit sampai selesai atau sampai menunggu Apify.
 *
 * Fungsi ini idempoten dan dirancang dipanggil berulang oleh cron: setiap
 * pemanggilan memajukan audit satu langkah (mulai run → tunggu → ambil dataset
 * → skor → simpan), lalu keluar.
 */
export async function executeInfluencerAudit(auditId: string): Promise<void> {
  if (activeAuditIds.has(auditId)) return;
  activeAuditIds.add(auditId);

  try {
    let audit = await prisma.influencerAudit.findUnique({
      where: { id: auditId },
      include: { profile: true },
    });
    if (!audit?.profile) return;

    let claimedPending = false;
    if (audit.status === InfluencerAuditStatus.PENDING) {
      const claimed = await prisma.influencerAudit.updateMany({
        where: { id: auditId, status: InfluencerAuditStatus.PENDING },
        data: {
          status: InfluencerAuditStatus.COLLECTING,
          startedAt: new Date(),
          errorMessage: null,
        },
      });
      if (claimed.count === 0) return;
      claimedPending = true;
      audit = { ...audit, status: InfluencerAuditStatus.COLLECTING };
    } else if (audit.status !== InfluencerAuditStatus.COLLECTING) {
      return;
    }

    const { profile } = audit;

    if (!isApifyConfigured()) {
      throw new Error(
        "APIFY_API_TOKEN belum diset — audit influencer memerlukan data live, tidak ada mode demo.",
      );
    }

    const actorId = getInfluencerActorId(profile.platform);
    if (!actorId) throw new Error(influencerActorEnvHint(profile.platform));

    const needsReelsRun = profile.platform === InfluencerPlatform.INSTAGRAM;

    const runId = audit.apifyRunId;
    if (!runId) {
      const oldEnoughToRecover =
        Date.now() - audit.createdAt.getTime() >= ORPHANED_START_GRACE_MS;
      if (!claimedPending && !oldEnoughToRecover) return;

      // Dua run dijalankan bersamaan untuk Instagram: `details` memberi
      // metadata profil + grid, `reels` memberi Reels berikut hitungan view
      // yang benar. Keduanya koleksi terpisah — grid saja tidak cukup.
      const started = await startApifyActor(
        actorId,
        buildInfluencerActorInput(
          profile.platform,
          profile.handle,
          DEFAULT_POST_SAMPLE,
        ),
      );

      let reelsRunId: string | null = null;
      if (needsReelsRun) {
        try {
          const startedReels = await startApifyActor(
            actorId,
            buildInstagramReelsActorInput(profile.handle, DEFAULT_POST_SAMPLE),
          );
          reelsRunId = startedReels.runId;
        } catch (err) {
          // Reels adalah pelengkap: metrik engagement tetap bisa dihitung dari
          // feed, jadi kegagalan di sini tidak boleh menggagalkan audit.
          console.warn("[brand/influencer/start-reels]", auditId, err);
        }
      }

      await patchAudit(auditId, {
        apifyRunId: started.runId,
        apifyReelsRunId: reelsRunId,
      });
      // Jangan blokir request ini menunggu actor; poll berikutnya melanjutkan.
      return;
    }

    let run: Awaited<ReturnType<typeof getApifyRunStatus>>;
    try {
      run = await getApifyRunStatus(runId);
    } catch (err) {
      // Run yang hilang tidak akan pernah muncul lagi — tandai gagal supaya
      // audit tidak nyangkut di COLLECTING selamanya.
      if (err instanceof ApifyRunNotFoundError) throw err;
      // Gangguan sementara membaca status bukan kegagalan audit.
      console.warn("[brand/influencer/poll-status]", auditId, err);
      return;
    }

    const outcome = getAdLibraryApifyOutcome(run.status);
    if (outcome === "waiting") return;
    if (outcome === "failed") throw new Error(`Apify run status: ${run.status}`);

    // Run Reels ditunggu juga, tapi kegagalannya diturunkan jadi audit tanpa
    // data Reels — bukan audit yang gagal.
    let reelsItems: Record<string, unknown>[] = [];
    if (audit.apifyReelsRunId) {
      let reelsRun: Awaited<ReturnType<typeof getApifyRunStatus>> | null = null;
      try {
        reelsRun = await getApifyRunStatus(audit.apifyReelsRunId);
      } catch (err) {
        if (!(err instanceof ApifyRunNotFoundError)) {
          console.warn("[brand/influencer/poll-reels]", auditId, err);
          return;
        }
        console.warn("[brand/influencer/reels-run-hilang]", auditId, err);
      }

      if (reelsRun) {
        const reelsOutcome = getAdLibraryApifyOutcome(reelsRun.status);
        if (reelsOutcome === "waiting") return;
        if (reelsOutcome === "succeeded") {
          try {
            reelsItems = await fetchApifyDataset<Record<string, unknown>>(
              reelsRun.datasetId,
            );
          } catch (err) {
            console.warn("[brand/influencer/fetch-reels]", auditId, err);
            return;
          }
        } else {
          console.warn(
            `[brand/influencer/reels-gagal] ${auditId}: ${reelsRun.status} — audit dilanjutkan tanpa data Reels.`,
          );
        }
      }
    }

    let items: Record<string, unknown>[];
    try {
      items = await fetchApifyDataset<Record<string, unknown>>(run.datasetId);
    } catch (err) {
      // Run sukses tapi dataset belum tersedia — coba lagi di poll berikutnya.
      console.warn("[brand/influencer/fetch-dataset]", auditId, err);
      return;
    }

    const normalized = normalizeInfluencerDataset(
      profile.platform,
      items,
      profile.handle,
    );

    if (needsReelsRun && reelsItems.length > 0) {
      normalized.posts = mergeInstagramSurfaces(
        normalized.posts,
        normalizeInstagramReels(reelsItems),
      );
    }

    if (normalized.posts.length === 0) {
      throw new Error(
        `Tidak ada post yang bisa dianalisis dari @${profile.handle}. Akun mungkin kosong, privat, atau baru saja mengganti username.`,
      );
    }
    if (normalized.followers === 0) {
      throw new Error(
        `Jumlah follower @${profile.handle} tidak terbaca, sehingga engagement rate tidak bisa dihitung.`,
      );
    }

    const scored = scoreInfluencer({
      platform: profile.platform,
      followers: normalized.followers,
      following: normalized.following,
      posts: normalized.posts,
    });

    const stillThere = await prisma.influencerProfile.findUnique({
      where: { id: profile.id },
      select: { id: true },
    });
    if (!stillThere) {
      console.info(
        `[brand/influencer/audit] profil ${profile.id} dihapus saat audit — hasil dibuang.`,
      );
      return;
    }

    await persistAuditResult(auditId, profile.id, normalized, scored);
    await generateAuditNarrative(
      auditId,
      {
        handle: profile.handle,
        platform: profile.platform,
        followers: normalized.followers,
      },
      scored,
    );
    await patchAudit(auditId, { status: InfluencerAuditStatus.READY });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Audit influencer gagal.";
    await patchAudit(auditId, {
      status: InfluencerAuditStatus.FAILED,
      errorMessage: message,
    });
    throw err;
  } finally {
    activeAuditIds.delete(auditId);
  }
}

export async function enqueueInfluencerAudit(
  profileId: string,
): Promise<{ auditId: string }> {
  const profile = await prisma.influencerProfile.findUnique({
    where: { id: profileId },
    select: { id: true },
  });
  if (!profile) throw new Error("Influencer tidak ditemukan.");

  const inFlight = await prisma.influencerAudit.findFirst({
    where: {
      profileId,
      status: {
        in: [InfluencerAuditStatus.PENDING, InfluencerAuditStatus.COLLECTING],
      },
    },
    select: { id: true },
  });
  if (inFlight) {
    throw new Error("Audit masih berjalan — tunggu sampai selesai.");
  }

  const audit = await prisma.influencerAudit.create({
    data: { profileId, status: InfluencerAuditStatus.PENDING },
  });

  after(async () => {
    try {
      await executeInfluencerAudit(audit.id);
    } catch (err) {
      console.error("[brand/influencer/audit]", err);
    }
  });

  return { auditId: audit.id };
}

/** Dipanggil cron: majukan semua audit yang belum selesai. */
export async function pollRunningInfluencerAudits(): Promise<{
  polled: number;
}> {
  const audits = await prisma.influencerAudit.findMany({
    where: {
      status: {
        in: [InfluencerAuditStatus.PENDING, InfluencerAuditStatus.COLLECTING],
      },
    },
    take: 10,
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  for (const audit of audits) {
    try {
      await executeInfluencerAudit(audit.id);
    } catch {
      /* error sudah tersimpan di record audit */
    }
  }

  return { polled: audits.length };
}
