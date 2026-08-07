import "server-only";

import {
  InfluencerDiscoverySource,
  InfluencerPlatform,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DiscoveredCreator } from "@/lib/brand-research/influencer/discovery/handles";

/**
 * Tuliskan kreator hasil crawl ke database.
 *
 * Dipisah dari orkestrasi job karena persoalannya memang berbeda: yang di sini
 * murni soal menulis massal dengan benar, tanpa tahu-menahu soal Apify atau
 * siklus hidup run.
 */

export type PersistCreatorsResult = {
  /** Kreator yang berhasil dicatat sebagai hit run ini. */
  found: number;
  /** Dari situ, yang profilnya benar-benar baru dibuat. */
  created: number;
};

function keyOf(platform: InfluencerPlatform, handle: string): string {
  return `${platform}:${handle}`;
}

/**
 * Filter per platform, bukan satu OR panjang berisi pasangan platform+handle:
 * bentuk ini memakai index `@@unique([platform, handle])` alih-alih memindai baris.
 */
function buildHandleFilter(
  creators: DiscoveredCreator[],
): Prisma.InfluencerProfileWhereInput {
  const handlesFor = (platform: InfluencerPlatform) =>
    creators.filter((c) => c.platform === platform).map((c) => c.handle);

  const tiktok = handlesFor(InfluencerPlatform.TIKTOK);
  const instagram = handlesFor(InfluencerPlatform.INSTAGRAM);

  return {
    OR: [
      ...(tiktok.length > 0
        ? [{ platform: InfluencerPlatform.TIKTOK, handle: { in: tiktok } }]
        : []),
      ...(instagram.length > 0
        ? [{ platform: InfluencerPlatform.INSTAGRAM, handle: { in: instagram } }]
        : []),
    ],
  };
}

/**
 * Simpan kreator sebagai profil tingkat-0 beserta jejak penemuannya.
 *
 * Ditulis sebagai empat query massal, bukan tiga query per kreator: satu crawl
 * bisa memulangkan ratusan orang, dan loop per-baris di situ berarti ratusan
 * bolak-balik ke database untuk pekerjaan yang sebenarnya sekali jalan.
 *
 * Aman dipanggil ulang untuk run yang sama — profil yang sudah ada dipakai
 * kembali, dan hit yang sudah tercatat tidak digandakan.
 */
export async function persistDiscoveredCreators(
  runId: string,
  source: InfluencerDiscoverySource,
  createdById: string | null,
  creators: DiscoveredCreator[],
): Promise<PersistCreatorsResult> {
  if (creators.length === 0) return { found: 0, created: 0 };

  const handleFilter = buildHandleFilter(creators);

  const existing = await prisma.influencerProfile.findMany({
    where: handleFilter,
    select: { id: true, platform: true, handle: true, firstSeenAt: true },
  });

  const existingKeys = new Set(existing.map((p) => keyOf(p.platform, p.handle)));
  const fresh = creators.filter(
    (c) => !existingKeys.has(keyOf(c.platform, c.handle)),
  );

  const now = new Date();

  if (fresh.length > 0) {
    await prisma.influencerProfile.createMany({
      data: fresh.map((c) => ({
        platform: c.platform,
        handle: c.handle,
        profileUrl: c.profileUrl,
        discoverySource: source,
        firstSeenAt: now,
        createdById,
      })),
      skipDuplicates: true,
    });
  }

  // Profil lama yang baru sekarang tertangkap crawler belum punya `firstSeenAt`.
  // Diisi sekali saja — menimpanya tiap crawl akan menghapus riwayat sebenarnya.
  const backfillIds = existing
    .filter((p) => p.firstSeenAt === null)
    .map((p) => p.id);
  if (backfillIds.length > 0) {
    await prisma.influencerProfile.updateMany({
      where: { id: { in: backfillIds } },
      data: { firstSeenAt: now },
    });
  }

  // Dibaca ulang setelah createMany: Postgres lewat Prisma tidak memulangkan id
  // dari createMany, jadi id profil baru hanya bisa didapat dengan query ini.
  const all = await prisma.influencerProfile.findMany({
    where: handleFilter,
    select: { id: true, platform: true, handle: true },
  });
  const idByKey = new Map(all.map((p) => [keyOf(p.platform, p.handle), p.id]));

  /**
   * Satu baris per kata kunci penemu — bukan satu per kreator.
   *
   * Kreator yang tertangkap di beberapa hashtag sekaligus menghasilkan beberapa
   * baris, dan banyaknya baris itulah yang dibaca halaman peringkat sebagai
   * relevansi. Post terbaiknya diulang di tiap baris: ia berperan sebagai
   * contoh isi konten untuk klasifikasi niche, bukan sebagai arsip per hashtag.
   */
  const hits = creators.flatMap((c) => {
    const profileId = idByKey.get(keyOf(c.platform, c.handle));
    if (!profileId) return [];
    return c.matchedTerms.map((matchedTerm) => ({
      runId,
      profileId,
      matchedTerm,
      postUrl: c.postUrl,
      postCaption: c.postCaption,
      postLikes: c.postLikes,
      postComments: c.postComments,
      postViews: c.postViews,
      postedAt: c.postedAt,
    }));
  });

  await prisma.influencerDiscoveryHit.createMany({
    data: hits,
    // Run yang di-poll dua kali tidak boleh menggandakan hit-nya.
    skipDuplicates: true,
  });

  // `found` menghitung ORANG, bukan baris hit — itu angka yang dilaporkan ke
  // pengguna sebagai "sekian kreator ditemukan".
  const foundProfiles = new Set(hits.map((h) => h.profileId)).size;
  return { found: foundProfiles, created: fresh.length };
}
