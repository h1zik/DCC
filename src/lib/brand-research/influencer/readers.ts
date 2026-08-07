import "server-only";

import { InfluencerAuditStatus, InfluencerVerdict } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { brandStudioBrandFilter } from "@/lib/brand-research/brand-studio-scope";

/**
 * Halaman ini hanya memuat orang yang SUDAH atau SEDANG diaudit.
 *
 * `InfluencerProfile` dipakai bersama dengan KOL Radar, dan crawl satu hashtag
 * saja bisa menyuntikkan ratusan kreator ke tabel yang sama. Tanpa saringan
 * ini, daftar audit tenggelam oleh nama-nama yang belum pernah diperiksa
 * siapa pun — padahal pertanyaan di halaman ini justru "apa hasil pemeriksaan
 * orang ini", yang tidak punya jawaban bagi mereka. Tempat kandidat mentah
 * adalah KOL Radar; profil pindah ke sini begitu auditnya diantre.
 *
 * Sengaja `some: {}` tanpa menyebut status: audit yang masih berjalan atau
 * gagal tetap milik halaman ini — statusnya bagian dari yang perlu dilihat.
 */
function auditedOnlyFilter(ownerBrandId?: string | null) {
  return {
    ...brandStudioBrandFilter(ownerBrandId),
    audits: { some: {} },
  };
}

/**
 * Daftar influencer + audit terakhir. Audit dibatasi satu per profil supaya
 * halaman daftar tidak menarik seluruh riwayat.
 */
export async function listInfluencerProfiles(ownerBrandId?: string | null) {
  return prisma.influencerProfile.findMany({
    where: auditedOnlyFilter(ownerBrandId),
    orderBy: { updatedAt: "desc" },
    include: {
      ownerBrand: { select: { id: true, name: true } },
      audits: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      _count: { select: { audits: true } },
    },
  });
}

export async function getInfluencerProfileDetail(
  profileId: string,
  ownerBrandId?: string | null,
) {
  return prisma.influencerProfile.findFirst({
    where: {
      id: profileId,
      ...brandStudioBrandFilter(ownerBrandId),
    },
    include: {
      ownerBrand: { select: { id: true, name: true } },
      audits: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          posts: {
            orderBy: { postedAt: "desc" },
            take: 50,
          },
        },
      },
    },
  });
}

/** Ringkasan untuk kartu statistik di halaman daftar. */
export async function getInfluencerHubStats(ownerBrandId?: string | null) {
  // Saringan yang sama dengan daftarnya — "Total" yang menghitung kandidat
  // KOL Radar akan mengklaim 69 sementara daftarnya menampilkan 9.
  const profiles = await prisma.influencerProfile.findMany({
    where: auditedOnlyFilter(ownerBrandId),
    select: {
      id: true,
      audits: {
        where: { status: InfluencerAuditStatus.READY },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          score: true,
          verdict: true,
          engagementRate: true,
          authenticityScore: true,
        },
      },
    },
  });

  const latest = profiles
    .map((p) => p.audits[0])
    .filter((a): a is NonNullable<typeof a> => !!a);

  const suspicious = latest.filter(
    (a) => a.verdict === InfluencerVerdict.SUSPICIOUS,
  ).length;
  const needsReview = latest.filter(
    (a) => a.verdict === InfluencerVerdict.NEEDS_REVIEW,
  ).length;
  const recommended = latest.filter(
    (a) =>
      a.verdict === InfluencerVerdict.EXCELLENT ||
      a.verdict === InfluencerVerdict.GOOD,
  ).length;
  const avgScore =
    latest.length > 0
      ? Math.round(latest.reduce((s, a) => s + a.score, 0) / latest.length)
      : 0;

  return {
    total: profiles.length,
    audited: latest.length,
    recommended,
    needsReview,
    suspicious,
    avgScore,
  };
}
