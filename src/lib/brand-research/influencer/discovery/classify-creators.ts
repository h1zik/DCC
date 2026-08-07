import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateResearchJson } from "@/lib/research/llm";
import {
  buildClassificationPrompt,
  CATEGORY_STALE_DAYS,
  CLASSIFY_BATCH_SIZE,
  hasClassifiableSignal,
  parseCreatorClassifications,
  type ClassifiableCreator,
} from "@/lib/brand-research/influencer/discovery/categories";

/**
 * Beri label niche pada kreator hasil crawl.
 *
 * Kategori adalah filter utama halaman peringkat: tanpanya, daftar ribuan nama
 * hanya bisa diurut, tidak bisa dipersempit ke "beauty micro creator" yang
 * sebenarnya dicari orang. Klasifikasinya di-batch dua puluh orang per
 * panggilan supaya biaya AI-nya tetap sepele.
 */

/** Berapa panggilan LLM maksimum per sekali jalan — pagar biaya sederhana. */
const MAX_BATCHES_PER_RUN = 10;

export type ClassifyResult = {
  classified: number;
  skipped: number;
  warnings: string[];
};

/**
 * Kandidat: belum pernah diklasifikasi, atau labelnya sudah kedaluwarsa.
 *
 * Bio dan arah konten orang berubah — kreator yang dulu posting skincare bisa
 * beralih ke parenting setelah punya anak, dan label lama akan menyesatkan
 * pencarian sampai diperbarui.
 */
export function creatorsToClassifyWhere(): Prisma.InfluencerProfileWhereInput {
  const staleCutoff = new Date(
    Date.now() - CATEGORY_STALE_DAYS * 86_400_000,
  );

  return {
    OR: [
      { category: null },
      { categorySetAt: null },
      { categorySetAt: { lt: staleCutoff } },
    ],
  };
}

async function findCreatorsToClassify(
  limit: number,
): Promise<ClassifiableCreator[]> {
  const profiles = await prisma.influencerProfile.findMany({
    where: creatorsToClassifyWhere(),
    take: limit,
    /**
     * `nulls: "last"` di sini bukan kosmetik. Profil hasil crawl selalu punya
     * `firstSeenAt` DAN selalu membawa hashtag penemunya, sehingga selalu bisa
     * diklasifikasi. Profil lama yang ditambahkan manual punya `firstSeenAt`
     * kosong dan kerap tanpa bio — tidak bisa diklasifikasi, tapi tetap
     * terambil query ini. Kalau mereka naik ke atas (perilaku bawaan Postgres
     * untuk DESC), mereka memakan jatah batch tiap kali dijalankan sementara
     * kreator yang sebenarnya bisa dilabeli tidak pernah kebagian.
     */
    orderBy: [{ firstSeenAt: { sort: "desc", nulls: "last" } }],
    select: {
      handle: true,
      platform: true,
      bio: true,
      discoveryHits: {
        take: 5,
        orderBy: { createdAt: "desc" },
        select: { matchedTerm: true, postCaption: true },
      },
    },
  });

  return profiles
    .map((p) => ({
      handle: p.handle,
      platform: p.platform,
      bio: p.bio,
      discoveryTerms: [
        ...new Set(p.discoveryHits.map((h) => h.matchedTerm).filter(Boolean)),
      ],
      captions: p.discoveryHits
        .map((h) => h.postCaption)
        .filter((c): c is string => !!c),
    }))
    .filter(hasClassifiableSignal);
}

async function classifyBatch(
  batch: ClassifiableCreator[],
): Promise<{ classified: number; warnings: string[] }> {
  const raw = await generateResearchJson<unknown>(
    buildClassificationPrompt(batch),
    { tier: "flash" },
  );

  const { classifications, warnings } = parseCreatorClassifications(raw, batch);
  if (classifications.length === 0) {
    return { classified: 0, warnings };
  }

  const now = new Date();
  const byHandle = new Map(batch.map((c) => [c.handle, c.platform]));

  // updateMany per kreator, bukan satu query massal: nilainya berbeda per baris
  // dan Postgres tidak punya bentuk "update banyak baris dengan nilai berbeda"
  // yang terjangkau lewat Prisma. Dua puluh update dalam satu transaksi murah.
  await prisma.$transaction(
    classifications.flatMap((c) => {
      const platform = byHandle.get(c.handle);
      if (!platform) return [];
      return [
        prisma.influencerProfile.updateMany({
          where: { platform, handle: c.handle },
          data: {
            category: c.category,
            categoryConfidence: c.confidence,
            categorySetAt: now,
            language: c.language,
          },
        }),
      ];
    }),
  );

  return { classified: classifications.length, warnings };
}

/**
 * Klasifikasi kreator yang belum berlabel, dalam beberapa batch.
 *
 * Aman dipanggil berulang: yang sudah berlabel dan masih segar tidak ikut
 * terambil lagi.
 */
export async function classifyPendingCreators(
  maxCreators = CLASSIFY_BATCH_SIZE * MAX_BATCHES_PER_RUN,
): Promise<ClassifyResult> {
  const candidates = await findCreatorsToClassify(maxCreators);
  if (candidates.length === 0) {
    return { classified: 0, skipped: 0, warnings: [] };
  }

  let classified = 0;
  const warnings: string[] = [];

  for (let i = 0; i < candidates.length; i += CLASSIFY_BATCH_SIZE) {
    const batch = candidates.slice(i, i + CLASSIFY_BATCH_SIZE);
    try {
      const result = await classifyBatch(batch);
      classified += result.classified;
      warnings.push(...result.warnings);
    } catch (err) {
      // Satu batch gagal tidak boleh menjatuhkan sisanya — kreatornya tetap
      // tak berlabel dan akan terambil lagi di pemanggilan berikutnya.
      console.error("[brand/influencer/classify]", err);
      warnings.push(
        `Satu batch gagal diklasifikasi: ${err instanceof Error ? err.message : "kesalahan AI"}`,
      );
    }
  }

  return {
    classified,
    skipped: candidates.length - classified,
    warnings,
  };
}
