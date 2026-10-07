import "server-only";

import {
  InfluencerAuditStatus,
  KolChangeStatus,
  KolScheduleStatus,
  KolStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { computeBudgetUsage, COMMITTED_STATUSES } from "@/lib/kol/budget";
import { maskAccountNumber, maskPhone } from "@/lib/kol/banks";
import { paymentStatusOf } from "@/lib/kol/finance-link";

/* ------------------------------------------------------------------------ */
/* Tipe tampilan (serializable)                                              */
/* ------------------------------------------------------------------------ */

export type KolAccountView = {
  id: string;
  platform: "INSTAGRAM" | "TIKTOK";
  handle: string;
  profileUrl: string;
  rateCard: number | null;
  isPrimary: boolean;
  influencerProfileId: string | null;
  followers: number | null;
  tier: string | null;
  engagementRate: number | null;
  audit: {
    verdict: string | null;
    score: number;
    authenticityScore: number;
    medianViews: number;
    auditedAt: string;
  } | null;
};

export type KolListRow = {
  id: string;
  fullName: string;
  status: KolStatus;
  categories: { id: string; name: string }[];
  accounts: KolAccountView[];
  pendingChange: string | null;
  scheduleCount: number;
  postedCount: number;
  lastScheduledAt: string | null;
  createdAt: string;
};

export type Option = { id: string; name: string };

/* ------------------------------------------------------------------------ */
/* Helper                                                                    */
/* ------------------------------------------------------------------------ */

const accountInclude = {
  influencerProfile: {
    select: {
      id: true,
      latestFollowers: true,
      latestTier: true,
      latestEngagementRate: true,
      audits: {
        where: { status: InfluencerAuditStatus.READY },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          verdict: true,
          score: true,
          authenticityScore: true,
          medianViews: true,
          followers: true,
          tier: true,
          createdAt: true,
        },
      },
    },
  },
} satisfies Prisma.KolSocialAccountInclude;

type AccountRow = Prisma.KolSocialAccountGetPayload<{
  include: typeof accountInclude;
}>;

function toAccountView(a: AccountRow): KolAccountView {
  const ip = a.influencerProfile;
  const audit = ip?.audits[0] ?? null;
  return {
    id: a.id,
    platform: a.platform,
    handle: a.handle,
    profileUrl: a.profileUrl,
    rateCard: a.rateCard == null ? null : Number(a.rateCard),
    isPrimary: a.isPrimary,
    influencerProfileId: a.influencerProfileId,
    followers: ip?.latestFollowers ?? audit?.followers ?? null,
    tier: ip?.latestTier ?? audit?.tier ?? null,
    engagementRate: ip?.latestEngagementRate ?? null,
    audit: audit
      ? {
          verdict: audit.verdict,
          score: audit.score,
          authenticityScore: audit.authenticityScore,
          medianViews: audit.medianViews,
          auditedAt: audit.createdAt.toISOString(),
        }
      : null,
  };
}

const num = (v: Prisma.Decimal | null | undefined) => (v == null ? 0 : Number(v));

/* ------------------------------------------------------------------------ */
/* Master data                                                               */
/* ------------------------------------------------------------------------ */

export async function listBrandOptions(): Promise<Option[]> {
  return prisma.brand.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export async function listUserOptions(): Promise<Option[]> {
  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });
  return users.map((u) => ({ id: u.id, name: u.name ?? u.email }));
}

export async function listCategories(opts: { includeArchived?: boolean } = {}) {
  const rows = await prisma.kolCategory.findMany({
    where: opts.includeArchived ? {} : { archivedAt: null },
    orderBy: { name: "asc" },
    include: { _count: { select: { profiles: true, briefs: true } } },
  });
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    archived: c.archivedAt != null,
    kolCount: c._count.profiles,
    briefCount: c._count.briefs,
  }));
}

/** Pastikan endorse type bawaan "Barter" ada (idempoten). */
export async function ensureKolDefaults() {
  const count = await prisma.kolEndorseType.count();
  if (count > 0) return;
  await prisma.kolEndorseType.createMany({
    data: [
      {
        name: "Barter",
        description: "Dibayar dengan produk — tanpa fee.",
        isBarter: true,
      },
      { name: "Paid", description: "Fee tunai sesuai rate card.", isBarter: false },
    ],
    skipDuplicates: true,
  });
}

export async function listEndorseTypes(opts: { includeArchived?: boolean } = {}) {
  await ensureKolDefaults();
  const rows = await prisma.kolEndorseType.findMany({
    where: opts.includeArchived ? {} : { archivedAt: null },
    orderBy: [{ isBarter: "desc" }, { name: "asc" }],
    include: { _count: { select: { schedules: true } } },
  });
  return rows.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    isBarter: t.isBarter,
    archived: t.archivedAt != null,
    scheduleCount: t._count.schedules,
  }));
}

export async function listBriefs(brandId?: string | null) {
  const rows = await prisma.kolBrief.findMany({
    where: { archivedAt: null, ...(brandId ? { brandId } : {}) },
    orderBy: { createdAt: "desc" },
    include: {
      brand: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
      _count: { select: { schedules: true } },
    },
  });
  return rows.map((b) => ({
    id: b.id,
    title: b.title,
    brandId: b.brandId,
    brandName: b.brand.name,
    categoryId: b.categoryId,
    categoryName: b.category?.name ?? null,
    linkUrl: b.linkUrl,
    description: b.description,
    scheduleCount: b._count.schedules,
    createdAt: b.createdAt.toISOString(),
  }));
}

export async function listBudgets(brandId?: string | null) {
  const rows = await prisma.kolBudget.findMany({
    where: { archivedAt: null, ...(brandId ? { brandId } : {}) },
    orderBy: { createdAt: "desc" },
    include: {
      brand: { select: { id: true, name: true } },
      _count: { select: { campaigns: true } },
    },
  });
  const usage = await computeBudgetUsage(
    prisma,
    rows.map((r) => r.id),
  );
  return rows.map((b) => {
    const u = usage.get(b.id);
    return {
      id: b.id,
      name: b.name,
      brandId: b.brandId,
      brandName: b.brand.name,
      notes: b.notes,
      beginning: num(b.beginningBalance),
      committed: u?.committed ?? 0,
      pending: u?.pending ?? 0,
      remaining: u?.remaining ?? num(b.beginningBalance),
      campaignCount: b._count.campaigns,
    };
  });
}

export type BudgetRow = Awaited<ReturnType<typeof listBudgets>>[number];

export async function listCampaigns(
  brandId?: string | null,
  opts: { id?: string; includeArchived?: boolean } = {},
) {
  const rows = await prisma.kolCampaign.findMany({
    where: {
      ...(opts.includeArchived ? {} : { archivedAt: null }),
      ...(brandId ? { brandId } : {}),
      ...(opts.id ? { id: opts.id } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      brand: { select: { id: true, name: true } },
      budget: { select: { id: true, name: true } },
      picUser: { select: { id: true, name: true, email: true } },
    },
  });
  const ids = rows.map((r) => r.id);
  const [grouped, usage] = await Promise.all([
    prisma.kolSchedule.groupBy({
      by: ["campaignId", "status"],
      where: { campaignId: { in: ids } },
      _count: { _all: true },
      _sum: { rate: true, additionalCost: true },
    }),
    computeBudgetUsage(
      prisma,
      [...new Set(rows.map((r) => r.budgetId))],
    ),
  ]);
  return rows.map((c) => {
    const mine = grouped.filter((g) => g.campaignId === c.id);
    const count = (s: KolScheduleStatus[]) =>
      mine
        .filter((g) => s.includes(g.status))
        .reduce((acc, g) => acc + g._count._all, 0);
    const spend = mine
      .filter((g) => COMMITTED_STATUSES.includes(g.status))
      .reduce((acc, g) => acc + num(g._sum.rate) + num(g._sum.additionalCost), 0);
    const u = usage.get(c.budgetId);
    return {
      id: c.id,
      title: c.title,
      description: c.description,
      archived: c.archivedAt != null,
      brandId: c.brandId,
      brandName: c.brand.name,
      budgetId: c.budgetId,
      budgetName: c.budget.name,
      budgetRemaining: u?.remaining ?? 0,
      budgetBeginning: u?.beginning ?? 0,
      startDate: c.startDate?.toISOString().slice(0, 10) ?? null,
      endDate: c.endDate?.toISOString().slice(0, 10) ?? null,
      picUserId: c.picUserId,
      picName: c.picUser ? (c.picUser.name ?? c.picUser.email) : null,
      scheduleCount: count(Object.values(KolScheduleStatus)),
      postedCount: count([KolScheduleStatus.POSTED]),
      pendingCount: count([KolScheduleStatus.PENDING_APPROVAL]),
      committedSpend: spend,
    };
  });
}

export type CampaignRow = Awaited<ReturnType<typeof listCampaigns>>[number];

export async function listProductsForPricing(brandId?: string | null) {
  const rows = await prisma.product.findMany({
    where: brandId ? { brandId } : {},
    orderBy: [{ brand: { name: "asc" } }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      sku: true,
      retailPrice: true,
      brandId: true,
      brand: { select: { name: true } },
      _count: { select: { kolScheduleProducts: true } },
    },
  });
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    brandId: p.brandId,
    brandName: p.brand.name,
    retailPrice: p.retailPrice == null ? null : Number(p.retailPrice),
    usedInSchedules: p._count.kolScheduleProducts,
  }));
}

/* ------------------------------------------------------------------------ */
/* KOL                                                                       */
/* ------------------------------------------------------------------------ */

export type KolListFilters = {
  q?: string | null;
  status?: KolStatus | null;
  categoryId?: string | null;
  platform?: "INSTAGRAM" | "TIKTOK" | null;
  tier?: string | null;
};

export async function listKols(filters: KolListFilters = {}): Promise<KolListRow[]> {
  const q = filters.q?.trim();
  const where: Prisma.KolProfileWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.categoryId
      ? { categories: { some: { categoryId: filters.categoryId } } }
      : {}),
    ...(filters.platform || filters.tier
      ? {
          socialAccounts: {
            some: {
              ...(filters.platform ? { platform: filters.platform } : {}),
              ...(filters.tier
                ? {
                    influencerProfile: {
                      latestTier: filters.tier as Prisma.EnumInfluencerTierNullableFilter["equals"],
                    },
                  }
                : {}),
            },
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { fullName: { contains: q, mode: "insensitive" } },
            {
              socialAccounts: {
                some: {
                  handle: { contains: q.replace(/^@/, "").toLowerCase() },
                },
              },
            },
          ],
        }
      : {}),
  };

  const rows = await prisma.kolProfile.findMany({
    where,
    orderBy: [{ status: "asc" }, { fullName: "asc" }],
    take: 500,
    include: {
      categories: { include: { category: { select: { id: true, name: true } } } },
      socialAccounts: {
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        include: accountInclude,
      },
      changeRequests: {
        where: { status: KolChangeStatus.PENDING },
        select: { type: true },
        take: 1,
      },
      schedules: {
        where: { status: { notIn: [KolScheduleStatus.CANCELLED, KolScheduleStatus.REJECTED] } },
        select: { status: true, scheduledAt: true },
      },
    },
  });

  return rows.map((k) => {
    const dates = k.schedules
      .map((s) => s.scheduledAt?.getTime() ?? 0)
      .filter(Boolean);
    return {
      id: k.id,
      fullName: k.fullName,
      status: k.status,
      categories: k.categories.map((c) => c.category),
      accounts: k.socialAccounts.map(toAccountView),
      pendingChange: k.changeRequests[0]?.type ?? null,
      scheduleCount: k.schedules.length,
      postedCount: k.schedules.filter((s) => s.status === KolScheduleStatus.POSTED)
        .length,
      lastScheduledAt: dates.length ? new Date(Math.max(...dates)).toISOString() : null,
      createdAt: k.createdAt.toISOString(),
    };
  });
}

export async function getKolStats() {
  const [byStatus, pendingChanges] = await Promise.all([
    prisma.kolProfile.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.kolProfileChangeRequest.count({
      where: { status: KolChangeStatus.PENDING },
    }),
  ]);
  const count = (s: KolStatus) =>
    byStatus.find((b) => b.status === s)?._count._all ?? 0;
  return {
    active: count(KolStatus.ACTIVE),
    waiting: count(KolStatus.WAITING_APPROVAL),
    blacklisted: count(KolStatus.BLACKLISTED),
    rejected: count(KolStatus.REJECTED),
    pendingChanges,
  };
}

export async function getKolDetail(
  id: string,
  opts: { revealSensitive: boolean },
) {
  const k = await prisma.kolProfile.findUnique({
    where: { id },
    include: {
      categories: { include: { category: { select: { id: true, name: true } } } },
      socialAccounts: {
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        include: accountInclude,
      },
      createdBy: { select: { name: true, email: true } },
      approvedBy: { select: { name: true, email: true } },
      changeRequests: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          requestedBy: { select: { id: true, name: true, email: true } },
          decidedBy: { select: { name: true, email: true } },
        },
      },
      schedules: {
        orderBy: [{ scheduledAt: "desc" }, { createdAt: "desc" }],
        take: 50,
        include: {
          brand: { select: { name: true } },
          campaign: { select: { id: true, title: true } },
          socialAccount: { select: { platform: true, handle: true } },
          endorseType: { select: { name: true } },
        },
      },
    },
  });
  if (!k) return null;

  const reveal = opts.revealSensitive;
  const pending = k.changeRequests.find((c) => c.status === KolChangeStatus.PENDING);
  const committed = k.schedules.filter((s) => COMMITTED_STATUSES.includes(s.status));

  return {
    id: k.id,
    fullName: k.fullName,
    status: k.status,
    blacklistReason: k.blacklistReason,
    email: k.email,
    phone: reveal ? k.phone : maskPhone(k.phone),
    birthDate: k.birthDate?.toISOString().slice(0, 10) ?? null,
    notes: k.notes,
    address: {
      line: k.addressLine,
      district: k.district,
      city: k.city,
      province: k.province,
      postalCode: k.postalCode,
    },
    bank: {
      code: k.bankCode,
      name: k.bankName,
      branch: k.bankBranch,
      holder: k.accountHolder,
      number: reveal ? k.accountNumber : maskAccountNumber(k.accountNumber),
    },
    sensitiveRevealed: reveal,
    categories: k.categories.map((c) => c.category),
    accounts: k.socialAccounts.map(toAccountView),
    createdBy: k.createdBy ? (k.createdBy.name ?? k.createdBy.email) : null,
    approvedBy: k.approvedBy ? (k.approvedBy.name ?? k.approvedBy.email) : null,
    approvedAt: k.approvedAt?.toISOString() ?? null,
    createdAt: k.createdAt.toISOString(),
    pendingChange: pending
      ? {
          id: pending.id,
          type: pending.type,
          reason: pending.reason,
          requestedById: pending.requestedById,
          requestedBy: pending.requestedBy
            ? (pending.requestedBy.name ?? pending.requestedBy.email)
            : null,
          createdAt: pending.createdAt.toISOString(),
        }
      : null,
    history: k.changeRequests
      .filter((c) => c.status !== KolChangeStatus.PENDING)
      .map((c) => ({
        id: c.id,
        type: c.type,
        status: c.status,
        decidedBy: c.decidedBy ? (c.decidedBy.name ?? c.decidedBy.email) : null,
        decidedAt: c.decidedAt?.toISOString() ?? null,
        decisionNote: c.decisionNote,
      })),
    stats: {
      schedules: committed.length,
      posted: k.schedules.filter((s) => s.status === KolScheduleStatus.POSTED).length,
      totalFee: committed.reduce(
        (acc, s) => acc + num(s.rate) + num(s.additionalCost),
        0,
      ),
      brands: [...new Set(committed.map((s) => s.brand.name))],
    },
    schedules: k.schedules.map((s) => ({
      id: s.id,
      subNumber: s.subNumber,
      status: s.status,
      brandName: s.brand.name,
      campaignId: s.campaign.id,
      campaignTitle: s.campaign.title,
      platform: s.socialAccount.platform,
      handle: s.socialAccount.handle,
      placement: s.placement,
      endorseType: s.endorseType.name,
      scheduledAt: s.scheduledAt?.toISOString() ?? null,
      rate: num(s.rate),
      additionalCost: num(s.additionalCost),
    })),
  };
}

export type KolDetail = NonNullable<Awaited<ReturnType<typeof getKolDetail>>>;

/**
 * Nilai form edit. Tanpa `revealSensitive`, HP & nomor rekening dikosongkan
 * (server mempertahankan nilai lama bila field dibiarkan kosong).
 */
export async function getKolFormValues(id: string, revealSensitive: boolean) {
  const k = await prisma.kolProfile.findUnique({
    where: { id },
    include: {
      categories: { select: { categoryId: true } },
      socialAccounts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
    },
  });
  if (!k) return null;
  return {
    id: k.id,
    status: k.status,
    masked: {
      phone: !revealSensitive && k.phone ? maskPhone(k.phone) : null,
      accountNumber:
        !revealSensitive && k.accountNumber ? maskAccountNumber(k.accountNumber) : null,
    },
    values: {
      fullName: k.fullName,
      email: k.email ?? "",
      phone: revealSensitive ? (k.phone ?? "") : "",
      birthDate: k.birthDate?.toISOString().slice(0, 10) ?? "",
      notes: k.notes ?? "",
      addressLine: k.addressLine ?? "",
      district: k.district ?? "",
      city: k.city ?? "",
      province: k.province ?? "",
      postalCode: k.postalCode ?? "",
      bankCode: k.bankCode ?? "",
      bankBranch: k.bankBranch ?? "",
      accountHolder: k.accountHolder ?? "",
      accountNumber: revealSensitive ? (k.accountNumber ?? "") : "",
      categoryIds: k.categories.map((c) => c.categoryId),
      socialAccounts: k.socialAccounts.map((a) => ({
        id: a.id,
        platform: a.platform,
        handle: a.handle,
        rateCard: a.rateCard == null ? "" : String(Number(a.rateCard)),
      })),
    },
  };
}

/**
 * Prefill form "Tambah KOL" dari profil influencer Brand Hub (Radar/Audit).
 * Bila akun itu sudah masuk database KOL, kembalikan KOL pemiliknya.
 */
export async function getInfluencerPrefill(influencerProfileId: string) {
  const ip = await prisma.influencerProfile.findUnique({
    where: { id: influencerProfileId },
    select: {
      platform: true,
      handle: true,
      displayName: true,
      kolSocialAccount: { select: { kolId: true } },
    },
  });
  if (!ip) return null;
  const linked =
    ip.kolSocialAccount?.kolId ??
    (
      await prisma.kolSocialAccount.findUnique({
        where: { platform_handle: { platform: ip.platform, handle: ip.handle } },
        select: { kolId: true },
      })
    )?.kolId ??
    null;
  return {
    existingKolId: linked,
    platform: ip.platform,
    handle: ip.handle,
    displayName: ip.displayName,
  };
}

/** KOL pemilik profil influencer ini (bila sudah masuk database KOL). */
export async function findKolIdForInfluencer(influencerProfileId: string) {
  const acc = await prisma.kolSocialAccount.findUnique({
    where: { influencerProfileId },
    select: { kolId: true },
  });
  return acc?.kolId ?? null;
}

/** KOL aktif + akunnya, untuk schedule builder. */
export async function listSchedulableKols() {
  const rows = await prisma.kolProfile.findMany({
    where: { status: KolStatus.ACTIVE },
    orderBy: { fullName: "asc" },
    include: {
      socialAccounts: {
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        include: accountInclude,
      },
    },
  });
  return rows.map((k) => ({
    id: k.id,
    fullName: k.fullName,
    accounts: k.socialAccounts.map(toAccountView),
  }));
}

export type SchedulableKol = Awaited<ReturnType<typeof listSchedulableKols>>[number];

/** Akun sosmed satu KOL — untuk mengganti akun di jadwal yang sudah ada. */
export async function listKolAccounts(kolId: string) {
  const rows = await prisma.kolSocialAccount.findMany({
    where: { kolId },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    include: accountInclude,
  });
  return rows.map(toAccountView);
}

/* ------------------------------------------------------------------------ */
/* Jadwal                                                                    */
/* ------------------------------------------------------------------------ */

const scheduleListInclude = {
  brand: { select: { id: true, name: true } },
  campaign: { select: { id: true, title: true } },
  kol: { select: { id: true, fullName: true } },
  socialAccount: {
    select: {
      platform: true,
      handle: true,
      profileUrl: true,
      influencerProfile: { select: { latestFollowers: true, latestTier: true } },
    },
  },
  endorseType: { select: { name: true, isBarter: true } },
  brief: { select: { id: true, title: true } },
  picUser: { select: { name: true, email: true } },
  requestedBy: { select: { id: true, name: true, email: true } },
  order: { select: { id: true, orderNumber: true } },
  products: { include: { product: { select: { name: true, sku: true } } } },
  spendRequest: { select: { id: true, status: true, decisionNote: true, updatedAt: true } },
  spk: { select: { id: true, status: true, docNumber: true } },
} satisfies Prisma.KolScheduleInclude;

type ScheduleRowRaw = Prisma.KolScheduleGetPayload<{
  include: typeof scheduleListInclude;
}>;

function toScheduleRow(s: ScheduleRowRaw) {
  return {
    id: s.id,
    subNumber: s.subNumber,
    orderId: s.order.id,
    orderNumber: s.order.orderNumber,
    status: s.status,
    postStatus: s.postStatus,
    shipmentStatus: s.shipmentStatus,
    brandId: s.brand.id,
    brandName: s.brand.name,
    campaignId: s.campaign.id,
    campaignTitle: s.campaign.title,
    kolId: s.kol.id,
    kolName: s.kol.fullName,
    platform: s.socialAccount.platform,
    handle: s.socialAccount.handle,
    profileUrl: s.socialAccount.profileUrl,
    followers: s.socialAccount.influencerProfile?.latestFollowers ?? null,
    tier: s.socialAccount.influencerProfile?.latestTier ?? null,
    socialAccountId: s.socialAccountId,
    endorseTypeId: s.endorseTypeId,
    placement: s.placement,
    objective: s.objective,
    endorseType: s.endorseType.name,
    isBarter: s.endorseType.isBarter,
    briefId: s.brief?.id ?? null,
    briefTitle: s.brief?.title ?? null,
    picUserId: s.picUserId,
    picName: s.picUser ? (s.picUser.name ?? s.picUser.email) : null,
    requestedById: s.requestedBy?.id ?? null,
    requestedBy: s.requestedBy ? (s.requestedBy.name ?? s.requestedBy.email) : null,
    scheduledAt: s.scheduledAt?.toISOString() ?? null,
    submittedAt: s.submittedAt?.toISOString() ?? null,
    rate: num(s.rate),
    additionalCost: num(s.additionalCost),
    postUrl: s.postUrl,
    postedAt: s.postedAt?.toISOString() ?? null,
    latestViews: s.latestViews,
    latestLikes: s.latestLikes,
    latestComments: s.latestComments,
    latestShares: s.latestShares,
    isFyp: s.isFyp,
    fypReachedAt: s.fypReachedAt?.toISOString() ?? null,
    peakVelocity: s.peakVelocity,
    timeToPeakHours: s.timeToPeakHours,
    decayRate: s.decayRate,
    metricsSyncedAt: s.metricsSyncedAt?.toISOString() ?? null,
    metricsError: s.metricsError,
    followersAtBooking: s.followersAtBooking,
    paymentStatus: paymentStatusOf(s.spendRequest?.status),
    spendRequestId: s.spendRequest?.id ?? null,
    paymentNote: s.spendRequest?.decisionNote ?? null,
    spkId: s.spk?.id ?? null,
    spkStatus: s.spk?.status ?? null,
    spkNumber: s.spk?.docNumber ?? null,
    courier: s.courier,
    trackingNumber: s.trackingNumber,
    decisionNote: s.decisionNote,
    products: s.products.map((p) => ({
      id: p.productId,
      name: p.product.name,
      sku: p.product.sku,
      quantity: p.quantity,
      unitValue: p.unitValue == null ? null : Number(p.unitValue),
    })),
  };
}

export type ScheduleRow = ReturnType<typeof toScheduleRow>;

export type ScheduleFilters = {
  status?: KolScheduleStatus | null;
  brandId?: string | null;
  campaignId?: string | null;
  kolId?: string | null;
  q?: string | null;
  from?: Date | null;
  to?: Date | null;
  platform?: "INSTAGRAM" | "TIKTOK" | null;
  placement?: string | null;
};

function scheduleWhere(f: ScheduleFilters): Prisma.KolScheduleWhereInput {
  const q = f.q?.trim();
  return {
    ...(f.status ? { status: f.status } : {}),
    ...(f.brandId ? { brandId: f.brandId } : {}),
    ...(f.campaignId ? { campaignId: f.campaignId } : {}),
    ...(f.kolId ? { kolId: f.kolId } : {}),
    ...(f.platform ? { socialAccount: { platform: f.platform } } : {}),
    ...(f.placement
      ? { placement: f.placement as Prisma.EnumKolPlacementFilter["equals"] }
      : {}),
    ...(f.from || f.to
      ? {
          scheduledAt: {
            ...(f.from ? { gte: f.from } : {}),
            ...(f.to ? { lt: f.to } : {}),
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { subNumber: { contains: q, mode: "insensitive" } },
            { kol: { fullName: { contains: q, mode: "insensitive" } } },
            { campaign: { title: { contains: q, mode: "insensitive" } } },
            { socialAccount: { handle: { contains: q.replace(/^@/, "").toLowerCase() } } },
          ],
        }
      : {}),
  };
}

export async function listSchedules(f: ScheduleFilters = {}, take = 300) {
  const rows = await prisma.kolSchedule.findMany({
    where: scheduleWhere(f),
    orderBy: [{ scheduledAt: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }],
    take,
    include: scheduleListInclude,
  });
  return rows.map(toScheduleRow);
}

export async function getScheduleStatusCounts(
  f: Omit<ScheduleFilters, "status"> = {},
) {
  const grouped = await prisma.kolSchedule.groupBy({
    by: ["status"],
    where: scheduleWhere(f),
    _count: { _all: true },
  });
  const out = Object.fromEntries(
    Object.values(KolScheduleStatus).map((s) => [s, 0]),
  ) as Record<KolScheduleStatus, number>;
  for (const g of grouped) out[g.status] = g._count._all;
  return out;
}

export async function getScheduleDetail(id: string) {
  const s = await prisma.kolSchedule.findUnique({
    where: { id },
    include: {
      ...scheduleListInclude,
      decidedBy: { select: { name: true, email: true } },
      order: {
        select: {
          id: true,
          orderNumber: true,
          note: true,
          schedules: {
            orderBy: { subNumber: "asc" },
            select: {
              id: true,
              subNumber: true,
              status: true,
              placement: true,
              scheduledAt: true,
              rate: true,
              additionalCost: true,
            },
          },
        },
      },
    },
  });
  if (!s) return null;
  const [events, snapshots, inFlight] = await Promise.all([
    prisma.kolAuditEvent.findMany({
      where: {
        OR: [
          { entityType: "schedule", entityId: s.id },
          { entityType: "order", entityId: s.orderId },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { actor: { select: { name: true, email: true } } },
    }),
    prisma.kolPostSnapshot.findMany({
      where: { scheduleId: s.id },
      orderBy: { capturedOn: "asc" },
      select: { capturedOn: true, views: true, likes: true, comments: true, shares: true },
    }),
    prisma.kolPostSyncRun.count({
      where: { status: { in: ["QUEUED", "RUNNING"] }, scheduleIds: { has: s.id } },
    }),
  ]);
  return {
    ...toScheduleRow(s),
    orderNote: s.order.note,
    decidedBy: s.decidedBy ? (s.decidedBy.name ?? s.decidedBy.email) : null,
    decidedAt: s.decidedAt?.toISOString() ?? null,
    snapshots: snapshots.map((x) => ({
      day: x.capturedOn.toISOString().slice(0, 10),
      views: x.views,
      likes: x.likes,
      comments: x.comments,
      shares: x.shares,
    })),
    syncInFlight: inFlight > 0,
    siblings: s.order.schedules.map((x) => ({
      id: x.id,
      subNumber: x.subNumber,
      status: x.status,
      placement: x.placement,
      scheduledAt: x.scheduledAt?.toISOString() ?? null,
      total: num(x.rate) + num(x.additionalCost),
    })),
    events: events.map((e) => ({
      id: e.id,
      action: e.action,
      actor: e.actor ? (e.actor.name ?? e.actor.email) : "Sistem",
      createdAt: e.createdAt.toISOString(),
      meta: e.meta as Record<string, unknown> | null,
    })),
  };
}

export type ScheduleDetail = NonNullable<Awaited<ReturnType<typeof getScheduleDetail>>>;

/* ------------------------------------------------------------------------ */
/* Approval & overview                                                       */
/* ------------------------------------------------------------------------ */

export async function listApprovalQueue() {
  const [changes, schedules] = await Promise.all([
    prisma.kolProfileChangeRequest.findMany({
      where: { status: KolChangeStatus.PENDING },
      orderBy: { createdAt: "asc" },
      include: {
        requestedBy: { select: { id: true, name: true, email: true } },
        kol: {
          include: {
            socialAccounts: {
              orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
              include: accountInclude,
            },
            categories: { include: { category: { select: { name: true } } } },
          },
        },
      },
    }),
    prisma.kolSchedule.findMany({
      where: { status: KolScheduleStatus.PENDING_APPROVAL },
      orderBy: [{ submittedAt: "asc" }, { subNumber: "asc" }],
      include: scheduleListInclude,
    }),
  ]);

  // Kelompokkan slot per order supaya approver bisa memutus sekaligus.
  const budgetIds = await prisma.kolCampaign.findMany({
    where: { id: { in: [...new Set(schedules.map((s) => s.campaignId))] } },
    select: { id: true, budgetId: true, budget: { select: { name: true } } },
  });
  const usage = await computeBudgetUsage(
    prisma,
    [...new Set(budgetIds.map((b) => b.budgetId))],
  );
  const campaignBudget = new Map(budgetIds.map((b) => [b.id, b]));

  const orders = new Map<
    string,
    {
      orderId: string;
      orderNumber: string;
      kolId: string;
      kolName: string;
      brandName: string;
      campaignTitle: string;
      budgetName: string;
      budgetRemaining: number;
      budgetBeginning: number;
      requestedById: string | null;
      requestedBy: string | null;
      submittedAt: string | null;
      slots: ScheduleRow[];
      total: number;
    }
  >();
  for (const raw of schedules) {
    const s = toScheduleRow(raw);
    const cb = campaignBudget.get(raw.campaignId);
    const u = cb ? usage.get(cb.budgetId) : undefined;
    const o = orders.get(s.orderId) ?? {
      orderId: s.orderId,
      orderNumber: s.orderNumber,
      kolId: s.kolId,
      kolName: s.kolName,
      brandName: s.brandName,
      campaignTitle: s.campaignTitle,
      budgetName: cb?.budget.name ?? "—",
      budgetRemaining: u?.remaining ?? 0,
      budgetBeginning: u?.beginning ?? 0,
      requestedById: s.requestedById,
      requestedBy: s.requestedBy,
      submittedAt: s.submittedAt,
      slots: [],
      total: 0,
    };
    o.slots.push(s);
    o.total += s.rate + s.additionalCost;
    orders.set(s.orderId, o);
  }

  return {
    changes: changes.map((c) => ({
      id: c.id,
      type: c.type,
      reason: c.reason,
      payload: c.payload as Record<string, unknown> | null,
      createdAt: c.createdAt.toISOString(),
      requestedById: c.requestedById,
      requestedBy: c.requestedBy ? (c.requestedBy.name ?? c.requestedBy.email) : null,
      kol: {
        id: c.kol.id,
        fullName: c.kol.fullName,
        status: c.kol.status,
        categories: c.kol.categories.map((x) => x.category.name),
        accounts: c.kol.socialAccounts.map(toAccountView),
      },
    })),
    orders: [...orders.values()],
  };
}

export type ApprovalQueue = Awaited<ReturnType<typeof listApprovalQueue>>;

export async function getSpkForSchedule(scheduleId: string) {
  const d = await prisma.kolSpkDocument.findUnique({
    where: { scheduleId },
    select: { id: true, docNumber: true, status: true, templateId: true, signedFileKey: true },
  });
  return d
    ? {
        id: d.id,
        docNumber: d.docNumber,
        status: d.status,
        templateId: d.templateId,
        hasSigned: d.signedFileKey != null,
      }
    : null;
}

/** Template SPK aktif; dengan `brandId` → template organisasi + khusus brand itu. */
export async function listSpkTemplates(brandId?: string | null) {
  const rows = await prisma.kolSpkTemplate.findMany({
    where: {
      archivedAt: null,
      ...(brandId !== undefined
        ? { OR: [{ scope: "ORGANIZATION" }, { scope: "BRAND", brandId: brandId ?? "__none" }] }
        : {}),
    },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    include: {
      brand: { select: { name: true } },
      _count: { select: { documents: true } },
    },
  });
  return rows.map((t) => ({
    id: t.id,
    name: t.name,
    scope: t.scope,
    brandId: t.brandId,
    brandName: t.brand?.name ?? null,
    body: t.body,
    isDefault: t.isDefault,
    documentCount: t._count.documents,
    updatedAt: t.updatedAt.toISOString(),
  }));
}

export type SpkTemplateRow = Awaited<ReturnType<typeof listSpkTemplates>>[number];

/** Jadwal disetujui berbiaya yang belum punya pengajuan dana Finance. */
export async function countSchedulesMissingSpendRequest() {
  const rows = await prisma.kolSchedule.findMany({
    where: {
      spendRequestId: null,
      status: { in: [KolScheduleStatus.APPROVED, KolScheduleStatus.SCHEDULED, KolScheduleStatus.POSTED] },
    },
    select: { rate: true, additionalCost: true },
  });
  return rows.filter((r) => Number(r.rate) + Number(r.additionalCost) > 0).length;
}

export async function getApprovalCount() {
  const [changes, schedules] = await Promise.all([
    prisma.kolProfileChangeRequest.count({ where: { status: KolChangeStatus.PENDING } }),
    prisma.kolSchedule.count({ where: { status: KolScheduleStatus.PENDING_APPROVAL } }),
  ]);
  return { changes, schedules, total: changes + schedules };
}

export async function getKolHubOverview(brandId?: string | null) {
  const now = new Date();
  const in14 = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const brandFilter = brandId ? { brandId } : {};

  const [kolStats, approvals, upcoming, overdue, statusCounts, budgets, recentPosted] =
    await Promise.all([
      getKolStats(),
      getApprovalCount(),
      listSchedules(
        {
          brandId,
          from: now,
          to: in14,
        },
        40,
      ).then((rows) =>
        rows
          .filter((r) => r.status === "APPROVED" || r.status === "SCHEDULED")
          .sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? "")),
      ),
      prisma.kolSchedule.count({
        where: {
          ...brandFilter,
          status: { in: [KolScheduleStatus.APPROVED, KolScheduleStatus.SCHEDULED] },
          scheduledAt: { lt: now },
        },
      }),
      getScheduleStatusCounts({ brandId }),
      listBudgets(brandId),
      prisma.kolSchedule.count({
        where: {
          ...brandFilter,
          status: KolScheduleStatus.POSTED,
          postedAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

  const budgetTotals = budgets.reduce(
    (acc, b) => ({
      beginning: acc.beginning + b.beginning,
      committed: acc.committed + b.committed,
      remaining: acc.remaining + b.remaining,
    }),
    { beginning: 0, committed: 0, remaining: 0 },
  );

  return {
    kolStats,
    approvals,
    upcoming,
    overdue,
    statusCounts,
    budgets: budgets.slice(0, 6),
    budgetTotals,
    postedLast30: recentPosted,
  };
}

/** Jadwal untuk kalender dalam rentang [from, to). */
export async function listCalendarSchedules(f: ScheduleFilters & { from: Date; to: Date }) {
  const rows = await listSchedules(
    { ...f, status: null },
    1000,
  );
  return rows.filter(
    (r) => r.status !== "CANCELLED" && r.status !== "REJECTED" && r.scheduledAt,
  );
}
