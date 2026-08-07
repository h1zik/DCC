import "server-only";

import {
  InfluencerAuditStatus,
  InfluencerJobStatus,
  Prisma,
  type InfluencerPlatform,
  type InfluencerTier,
  type InfluencerVerdict,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { creatorsToClassifyWhere } from "@/lib/brand-research/influencer/discovery/classify-creators";
import { profilesNeedingEnrichmentWhere } from "@/lib/brand-research/influencer/discovery/enrich-batch";
import {
  RADAR_PAGE_SIZE,
  type RadarFilterState,
} from "@/lib/brand-research/influencer/discovery/radar-query";

/**
 * Pembacaan daftar kreator untuk halaman peringkat.
 *
 * Seluruh penyaringan dan pengurutan terjadi di database. Itu keputusan yang
 * disengaja: modul ini dirancang menampung puluhan ribu kreator, dan menyaring
 * di browser berarti mengirimkan semuanya ke sana lebih dulu.
 */

function buildWhere(
  filters: RadarFilterState,
): Prisma.InfluencerProfileWhereInput {
  const where: Prisma.InfluencerProfileWhereInput = {};

  if (filters.platform !== "all") where.platform = filters.platform;
  if (filters.tier !== "all") where.latestTier = filters.tier;

  if (filters.category === "unclassified") where.category = null;
  else if (filters.category !== "all") where.category = filters.category;

  // "Sudah terukur" berarti follower-nya terbaca. Engagement boleh null —
  // akun yang menyembunyikan like tetap kreator yang sah untuk dipertimbangkan.
  if (filters.measuredOnly) where.latestFollowers = { not: null };

  const search = filters.search.trim().replace(/^@/, "");
  if (search) {
    where.OR = [
      { handle: { contains: search, mode: "insensitive" } },
      { displayName: { contains: search, mode: "insensitive" } },
    ];
  }

  return where;
}

function buildOrderBy(
  filters: RadarFilterState,
): Prisma.InfluencerProfileOrderByWithRelationInput[] {
  // `nulls: "last"` penting di semua urutan angka: kreator yang belum terukur
  // tidak boleh menduduki puncak daftar hanya karena nilainya kosong.
  switch (filters.sort) {
    case "followers":
      return [{ latestFollowers: { sort: "desc", nulls: "last" } }, { handle: "asc" }];
    case "engagement":
      return [
        { latestEngagementRate: { sort: "desc", nulls: "last" } },
        { handle: "asc" },
      ];
    case "newest":
      return [{ firstSeenAt: { sort: "desc", nulls: "last" } }, { handle: "asc" }];
    case "relevance":
    default:
      // Relevansi = seberapa sering kreator ini muncul di crawl. Orang yang
      // tertangkap di lima pencarian jauh lebih pasti berada di niche itu
      // daripada yang tertangkap sekali.
      return [
        { discoveryHits: { _count: "desc" } },
        { latestFollowers: { sort: "desc", nulls: "last" } },
        { handle: "asc" },
      ];
  }
}

export type RadarCreatorRow = {
  id: string;
  platform: InfluencerPlatform;
  handle: string;
  profileUrl: string;
  displayName: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
  category: string | null;
  categoryConfidence: number | null;
  language: string | null;
  followers: number | null;
  engagementRate: number | null;
  tier: InfluencerTier | null;
  measuredAt: string | null;
  /** Berapa crawl yang menemukan orang ini. */
  discoveryCount: number;
  /** Kata kunci penemunya — menjelaskan kenapa dia ada di daftar. */
  matchedTerms: string[];
  /** Sudah pernah diaudit penuh? Menentukan tombol yang ditampilkan. */
  hasAudit: boolean;
  auditScore: number | null;
  auditVerdict: InfluencerVerdict | null;
};

export type RadarPage = {
  rows: RadarCreatorRow[];
  total: number;
  page: number;
  pageCount: number;
};

export async function listRadarCreators(
  filters: RadarFilterState,
): Promise<RadarPage> {
  const where = buildWhere(filters);

  const [total, profiles] = await Promise.all([
    prisma.influencerProfile.count({ where }),
    prisma.influencerProfile.findMany({
      where,
      orderBy: buildOrderBy(filters),
      skip: (filters.page - 1) * RADAR_PAGE_SIZE,
      take: RADAR_PAGE_SIZE,
      select: {
        id: true,
        platform: true,
        handle: true,
        profileUrl: true,
        displayName: true,
        avatarUrl: true,
        isVerified: true,
        category: true,
        categoryConfidence: true,
        language: true,
        latestFollowers: true,
        latestEngagementRate: true,
        latestTier: true,
        latestMeasuredAt: true,
        _count: { select: { discoveryHits: true } },
        discoveryHits: {
          take: 3,
          orderBy: { createdAt: "desc" },
          select: { matchedTerm: true },
        },
        audits: {
          where: { status: InfluencerAuditStatus.READY },
          take: 1,
          orderBy: { createdAt: "desc" },
          select: { score: true, verdict: true },
        },
      },
    }),
  ]);

  return {
    rows: profiles.map((p) => {
      const audit = p.audits[0];
      return {
        id: p.id,
        platform: p.platform,
        handle: p.handle,
        profileUrl: p.profileUrl,
        displayName: p.displayName,
        avatarUrl: p.avatarUrl,
        isVerified: p.isVerified,
        category: p.category,
        categoryConfidence: p.categoryConfidence,
        language: p.language,
        followers: p.latestFollowers,
        engagementRate: p.latestEngagementRate,
        tier: p.latestTier,
        measuredAt: p.latestMeasuredAt?.toISOString() ?? null,
        discoveryCount: p._count.discoveryHits,
        matchedTerms: [...new Set(p.discoveryHits.map((h) => h.matchedTerm))],
        hasAudit: !!audit,
        auditScore: audit?.score ?? null,
        auditVerdict: audit?.verdict ?? null,
      };
    }),
    total,
    page: filters.page,
    pageCount: Math.max(Math.ceil(total / RADAR_PAGE_SIZE), 1),
  };
}

export type RadarStats = {
  totalCreators: number;
  measured: number;
  classified: number;
  audited: number;
  /**
   * Antrean kerja yang tersisa, dihitung dengan kriteria yang sama persis
   * dengan aksinya. Tombol "Ukur yang belum" tanpa angka memaksa orang
   * menekannya untuk tahu apakah ada yang perlu dikerjakan.
   */
  pendingMeasurement: number;
  pendingClassification: number;
  /** Job yang sedang jalan — dipakai UI memutuskan perlu polling atau tidak. */
  runningDiscovery: number;
  runningEnrichment: number;
};

export async function getRadarStats(): Promise<RadarStats> {
  const running = {
    in: [InfluencerJobStatus.PENDING, InfluencerJobStatus.COLLECTING],
  };

  const [
    totalCreators,
    measured,
    classified,
    audited,
    pendingMeasurement,
    pendingClassification,
    runningDiscovery,
    runningEnrichment,
  ] = await Promise.all([
    prisma.influencerProfile.count(),
    prisma.influencerProfile.count({ where: { latestFollowers: { not: null } } }),
    prisma.influencerProfile.count({ where: { category: { not: null } } }),
    prisma.influencerProfile.count({
      where: { audits: { some: { status: InfluencerAuditStatus.READY } } },
    }),
    prisma.influencerProfile.count({ where: profilesNeedingEnrichmentWhere() }),
    prisma.influencerProfile.count({ where: creatorsToClassifyWhere() }),
    prisma.influencerDiscoveryRun.count({ where: { status: running } }),
    prisma.influencerEnrichmentBatch.count({ where: { status: running } }),
  ]);

  return {
    totalCreators,
    measured,
    classified,
    audited,
    pendingMeasurement,
    pendingClassification,
    runningDiscovery,
    runningEnrichment,
  };
}

/** Kategori yang benar-benar ada isinya — dropdown tidak perlu memuat yang kosong. */
export async function listPopulatedCategories(): Promise<
  { category: string; count: number }[]
> {
  const grouped = await prisma.influencerProfile.groupBy({
    by: ["category"],
    where: { category: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { category: "desc" } },
  });

  return grouped
    .filter((g): g is typeof g & { category: string } => g.category !== null)
    .map((g) => ({ category: g.category, count: g._count._all }));
}
