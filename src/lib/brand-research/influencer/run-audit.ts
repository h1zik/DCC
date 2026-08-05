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
  buildTikTokFallbackActorInput,
  DEFAULT_POST_SAMPLE,
  getInfluencerActorId,
  getInfluencerFallbackActorId,
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
  SURFACE_LABEL,
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
- Engagement rate standar (like+komentar terhadap follower), dihitung dari ${scored.primarySurface ? SURFACE_LABEL[scored.primarySurface] : "seluruh post"}: ${scored.engagementRate}% — median tier ini ${scored.benchmarkEr}%, jadi ${scored.metrics.erVsBenchmark}× median
- Engagement rate penuh (termasuk share & simpan): ${scored.totalEngagementRate}%
- Engagement rate terhadap view: ${scored.viewEngagementRate ?? "tidak tersedia"}%
- View rate (view dibagi follower): ${scored.viewRate ?? "tidak tersedia"}%

Feed vs Reels (khusus Instagram; di TikTok semuanya video):
- Post feed dianalisis: ${scored.feedPostCount}, Reels dianalisis: ${scored.reelsPostCount}
- ER feed: ${scored.feedEngagementRate ?? "tidak tersedia"}%
- ER Reels: ${scored.reelsEngagementRate ?? "tidak tersedia"}%
- Permukaan yang jadi dasar angka utama: ${scored.primarySurface ? SURFACE_LABEL[scored.primarySurface] : "tidak ada"}
- CATATAN PENTING: feed dan Reels adalah dua permukaan berbeda dan dihitung terpisah dengan rumus yang sama, jadi kedua angka di atas boleh dibandingkan langsung. Angka utama diambil dari permukaan TERKUAT karena itulah format yang akan dipesan brand. WAJIB sebutkan format mana yang harus dipesan, dan berapa angkanya kalau brand salah memesan format satunya. Permukaan yang lemah BUKAN alasan menolak influencer — itu alasan memilih format.
- Median per post: like ${scored.medianLikes}, komentar ${scored.medianComments}, share ${scored.medianShares}, view ${scored.medianViews}
- Rata-rata per post (pembanding): like ${scored.avgLikes}, view ${scored.avgViews}
- Rasio komentar terhadap like: ${scored.metrics.commentLikeRatio ?? "tidak tersedia"}
- Variasi engagement antar post: ${scored.metrics.engagementCv ?? "tidak tersedia"}
- Dominasi post viral (rata-rata ÷ median): ${scored.metrics.viralSkew ?? "tidak tersedia"}
- Tren engagement (post terbaru vs terlama): ${scored.metrics.engagementTrendPct ?? "tidak tersedia"}%
- Ritme posting: ${scored.postsPerWeek} post/minggu, terakhir posting ${scored.daysSinceLastPost ?? "?"} hari lalu

Post berbayar vs organik (dibandingkan DI DALAM permukaan utama saja, supaya post berbayar tidak diadu melawan post organik dari format berbeda):
- Post berbayar terdeteksi: ${scored.sponsored.sponsoredCount}, organik: ${scored.sponsored.organicCount}
- Di seluruh permukaan: ${scored.metrics.sponsoredCountAllSurfaces} post berbayar dari ${scored.postsAnalyzed} post (${Math.round(scored.metrics.sponsoredShare * 100)}% isi profilnya endorse)
- ER post berbayar: ${scored.sponsored.sponsoredEr ?? "sampel tidak cukup"}%, ER post organik: ${scored.sponsored.organicEr ?? "sampel tidak cukup"}%
- Selisih: ${scored.sponsored.deltaPct ?? "tidak bisa dihitung"}%
- Perkiraan ER yang akan didapat brand bila memasang campaign: ${scored.metrics.expectedCampaignEr}% (sumber: ${scored.metrics.expectedCampaignErSource === "sponsored" ? "post berbayar influencer ini" : "ER umum, karena post berbayar tidak cukup untuk dijadikan dasar"})
- CATATAN: deteksi berbayar hanya menangkap post yang memberi penanda (#ad, #kerjasama, label paid partnership). Angka ini batas bawah, bukan jumlah pasti.

Kualitas komentar (hanya bila datanya terbawa):
${
  scored.commentQuality
    ? `- ${scored.commentQuality.analyzedComments} komentar terbaca dari ${scored.commentQuality.postsWithComments} post
- Komentar tanpa substansi (emoji/pujian satu kata): ${Math.round(scored.commentQuality.lowSubstanceShare * 100)}%
- Komentar berpola jualan/spam: ${Math.round(scored.commentQuality.spamShare * 100)}%
- Komentar dari akun yang muncul berulang di banyak post: ${Math.round(scored.commentQuality.repeatAuthorShare * 100)}%
- Komentar beraksara non-Latin: ${Math.round(scored.commentQuality.foreignScriptShare * 100)}%`
    : "- Tidak tersedia — dataset tidak membawa cukup contoh komentar. JANGAN berspekulasi soal kualitas komentar."
}

Risiko asosiasi merek (pencocokan kata pada caption, WAJIB diverifikasi manual):
${
  scored.brandSafety.hits.length > 0
    ? scored.brandSafety.hits
        .map(
          (h) =>
            `- [${h.severity}] ${h.label}: ${h.postCount} post, istilah "${h.terms.slice(0, 4).join('", "')}"${h.daysSinceLatest !== null ? `, terbaru ${h.daysSinceLatest} hari lalu` : ""}`,
        )
        .join("\n")
    : "- Tidak ada istilah berisiko terdeteksi di caption yang terbaca."
}

Kualitas sampel:
- Post dianalisis: ${scored.postsAnalyzed} dari ${scored.postsFetched} yang diambil, mencakup ${scored.sampleWindowDays ?? "?"} hari
- Post yang like-nya disembunyikan pemilik akun (dikeluarkan dari hitungan, BUKAN dihitung nol): ${scored.metrics.hiddenLikePosts}
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
- Bila ada risiko asosiasi merek tingkat "high" (mis. judi online), jadikan itu poin PERTAMA di risiko dan syaratkan verifikasi manual post terkait sebelum deal — tapi tetap sebut bahwa ini hasil pencocokan kata yang bisa keliru, bukan vonis.
- Sebut format yang harus dipesan (feed atau Reels) di rekomendasi bila kedua permukaan ada dan angkanya berbeda jauh.

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
  now: Date,
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
      selectSample(normalized.posts, now).map((p) => p.externalId),
    );

    await prisma.influencerPost.createMany({
      data: normalized.posts.map((p) => ({
        auditId,
        externalId: p.externalId,
        url: p.url ?? null,
        caption: p.caption?.slice(0, 2000) ?? null,
        thumbnailUrl: p.thumbnailUrl ?? null,
        mediaType: p.mediaType ?? null,
        // -1 dipertahankan apa adanya: itu penanda Instagram untuk "like
        // disembunyikan". Menyimpannya sebagai 0 akan membuat tabel post
        // melaporkan nol like padahal angkanya cuma tidak diketahui.
        likes: p.likesHidden ? -1 : p.likes,
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
        apifySecondaryRunId: reelsRunId,
      });
      // Jangan blokir request ini menunggu actor; poll berikutnya melanjutkan.
      return;
    }

    /**
     * Pindah ke actor cadangan.
     *
     * Dipakai saat actor utama TikTok pulang tanpa video. Run cadangan disimpan
     * di kolom yang sama dengan run Reels Instagram — perannya beda per
     * platform, dan karena TikTok tidak punya Reels, keduanya tidak pernah
     * bertabrakan. Kolom yang sudah terisi juga menjadi penanda bahwa cadangan
     * SUDAH dicoba, sehingga tidak ada kemungkinan berputar tanpa henti.
     */
    const startFallback = async (reason: string): Promise<boolean> => {
      const fallbackActor = getInfluencerFallbackActorId(profile.platform);
      if (!fallbackActor || audit.apifySecondaryRunId) return false;

      try {
        const started = await startApifyActor(
          fallbackActor,
          buildTikTokFallbackActorInput(profile.handle, DEFAULT_POST_SAMPLE),
        );
        await patchAudit(auditId, { apifySecondaryRunId: started.runId });
        console.warn(
          `[brand/influencer/fallback] ${auditId}: ${reason} — beralih ke ${fallbackActor}.`,
        );
        return true;
      } catch (err) {
        console.error("[brand/influencer/start-fallback]", auditId, err);
        return false;
      }
    };

    const usesFallback =
      profile.platform === InfluencerPlatform.TIKTOK &&
      !!audit.apifySecondaryRunId;

    // Begitu cadangan berjalan, run utama tidak lagi relevan — yang ditunggu
    // dan dibaca adalah run cadangan itu.
    const activeRunId = usesFallback
      ? (audit.apifySecondaryRunId as string)
      : runId;

    let run: Awaited<ReturnType<typeof getApifyRunStatus>>;
    try {
      run = await getApifyRunStatus(activeRunId);
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
    if (outcome === "failed") {
      // Actor utama yang gagal masih menyisakan satu peluang: vendor lain.
      if (!usesFallback && (await startFallback(`run ${run.status}`))) return;
      throw new Error(
        usesFallback
          ? `Actor utama dan actor cadangan sama-sama gagal (status terakhir: ${run.status}).`
          : `Apify run status: ${run.status}`,
      );
    }

    // Run Reels ditunggu juga, tapi kegagalannya diturunkan jadi audit tanpa
    // data Reels — bukan audit yang gagal.
    let reelsItems: Record<string, unknown>[] = [];
    if (needsReelsRun && audit.apifySecondaryRunId) {
      let reelsRun: Awaited<ReturnType<typeof getApifyRunStatus>> | null = null;
      try {
        reelsRun = await getApifyRunStatus(audit.apifySecondaryRunId);
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

    /**
     * Run yang SUKSES tapi pulang tanpa satu pun item adalah gejala khas
     * scraper TikTok yang sedang diblokir — bukan akun yang kosong. Membedakan
     * keduanya penting: yang satu bisa ditolong actor lain, yang satu tidak.
     */
    if (items.length === 0 && !usesFallback) {
      if (await startFallback("actor utama tidak mengembalikan item")) return;
    }

    let normalized: NormalizedInfluencerProfile;
    try {
      normalized = normalizeInfluencerDataset(
        profile.platform,
        items,
        profile.handle,
      );
    } catch (err) {
      // Normalizer menolak dataset ini (mis. tidak ada video sama sekali).
      // Selama cadangan belum dicoba, itu belum tentu salah akunnya.
      if (!usesFallback && (await startFallback("dataset tidak bisa dibaca"))) {
        return;
      }
      throw err;
    }

    if (needsReelsRun && reelsItems.length > 0) {
      normalized.posts = mergeInstagramSurfaces(
        normalized.posts,
        normalizeInstagramReels(reelsItems),
      );
    }

    if (normalized.posts.length === 0 && !usesFallback) {
      if (await startFallback("tidak ada post yang bisa dibaca")) return;
    }

    if (normalized.posts.length === 0) {
      throw new Error(
        usesFallback
          ? `Tidak ada post yang bisa dianalisis dari @${profile.handle}. Actor utama dan actor cadangan sama-sama pulang kosong — kemungkinan besar akunnya memang kosong, privat, atau baru ganti username; tapi bisa juga kedua scraper sedang diblokir TikTok. Coba lagi beberapa jam lagi sebelum menyimpulkan.`
          : `Tidak ada post yang bisa dianalisis dari @${profile.handle}. Akun mungkin kosong, privat, atau baru saja mengganti username.`,
      );
    }
    if (normalized.followers === 0) {
      throw new Error(
        `Jumlah follower @${profile.handle} tidak terbaca, sehingga engagement rate tidak bisa dihitung.`,
      );
    }

    // Satu `now` dipakai untuk menilai dan untuk menandai post mana yang masuk
    // sampel, supaya keduanya tidak pernah berbeda batas jendelanya.
    const now = new Date();
    const scored = scoreInfluencer({
      platform: profile.platform,
      followers: normalized.followers,
      following: normalized.following,
      posts: normalized.posts,
      now,
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

    await persistAuditResult(auditId, profile.id, normalized, scored, now);
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
