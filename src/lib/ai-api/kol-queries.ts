import "server-only";

import {
  InfluencerAuditStatus,
  InfluencerPlatform,
  KolChangeStatus,
  KolScheduleStatus,
  KolStatus,
  type Prisma,
  type UserRole,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AiApiRole } from "./auth";
import { canViewKol } from "./auth";

/**
 * Query read-only KOL Hub untuk AI read API, MCP, dan AI Agent in-app.
 *
 * PRIVASI: data sensitif KOL (telepon, email, alamat, rekening bank) TIDAK
 * PERNAH di-select di sini — semua query memakai `select` eksplisit.
 */
export type KolReaderRole = UserRole | AiApiRole;

function denied(message: string) {
  return { accessible: false as const, message, data: null };
}

const DENIED_MESSAGE =
  "Akses KOL Hub hanya untuk CEO, Administrator, dan Brand Manager (Project Manager).";

/** Status slot yang mengikat budget (komitmen biaya) — sama dengan `src/lib/kol/budget.ts`. */
const COMMITTED_STATUSES: KolScheduleStatus[] = [
  KolScheduleStatus.PENDING_APPROVAL,
  KolScheduleStatus.APPROVED,
  KolScheduleStatus.SCHEDULED,
  KolScheduleStatus.POSTED,
];

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function money(value: Prisma.Decimal | number | null | undefined): number {
  if (value == null) return 0;
  return Math.round(Number(value) * 100) / 100;
}

function moneyOrNull(
  value: Prisma.Decimal | number | null | undefined,
): number | null {
  return value == null ? null : money(value);
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function dateOnly(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function cpm(cost: number, views: number | null | undefined): number | null {
  if (!views || views <= 0) return null;
  return Math.round(cost / (views / 1000));
}

function pct(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return Math.round((part / whole) * 1000) / 10;
}

function parseEnum<T extends string>(
  values: readonly T[],
  raw: string | null | undefined,
): T | undefined {
  const v = raw?.trim().toUpperCase();
  return v && (values as readonly string[]).includes(v) ? (v as T) : undefined;
}

/** ISO date/datetime → Date. Tanggal polos (YYYY-MM-DD) dibaca sebagai WIB. */
function parseDateBound(
  raw: string | null | undefined,
  edge: "start" | "end",
): Date | undefined {
  const v = raw?.trim();
  if (!v) return undefined;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(v)
    ? new Date(
        `${v}T${edge === "start" ? "00:00:00.000" : "23:59:59.999"}+07:00`,
      )
    : new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function scheduledAtRange(from?: string | null, to?: string | null) {
  const gte = parseDateBound(from, "start");
  const lte = parseDateBound(to, "end");
  if (!gte && !lte) return undefined;
  return { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) };
}

function userLabel(u: { name: string | null; email: string } | null) {
  return u ? u.name?.trim() || u.email : null;
}

function clampLimit(raw: number | undefined, fallback: number, max: number) {
  if (raw == null || !Number.isFinite(raw) || raw < 1) return fallback;
  return Math.min(Math.floor(raw), max);
}

/* -------------------------------------------------------------------------- */
/* Shared selects                                                             */
/* -------------------------------------------------------------------------- */

const ACCOUNT_SELECT = {
  id: true,
  platform: true,
  handle: true,
  rateCard: true,
  isPrimary: true,
  influencerProfile: {
    select: {
      latestFollowers: true,
      latestTier: true,
      audits: {
        where: { status: InfluencerAuditStatus.READY },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          verdict: true,
          authenticityScore: true,
          medianViews: true,
          createdAt: true,
        },
      },
    },
  },
} satisfies Prisma.KolSocialAccountSelect;

type AccountRow = Prisma.KolSocialAccountGetPayload<{
  select: typeof ACCOUNT_SELECT;
}>;

function mapAccount(a: AccountRow) {
  const audit = a.influencerProfile?.audits[0] ?? null;
  return {
    platform: a.platform,
    handle: a.handle,
    isPrimary: a.isPrimary,
    followers: a.influencerProfile?.latestFollowers ?? null,
    tier: a.influencerProfile?.latestTier ?? null,
    rateCard: moneyOrNull(a.rateCard),
    auditVerdict: audit?.verdict ?? null,
    authenticityScore: audit?.authenticityScore ?? null,
    medianViews: audit ? Math.round(audit.medianViews) : null,
    auditedAt: iso(audit?.createdAt),
  };
}

const PROFILE_SELECT = {
  id: true,
  fullName: true,
  status: true,
  createdAt: true,
  categories: { select: { category: { select: { name: true } } } },
  socialAccounts: {
    orderBy: [{ isPrimary: "desc" }, { platform: "asc" }],
    select: ACCOUNT_SELECT,
  },
  _count: { select: { schedules: true } },
} satisfies Prisma.KolProfileSelect;

type ProfileRow = Prisma.KolProfileGetPayload<{ select: typeof PROFILE_SELECT }>;

function mapProfile(p: ProfileRow, postedCount: number) {
  return {
    id: p.id,
    fullName: p.fullName,
    status: p.status,
    categories: p.categories.map((c) => c.category.name),
    accounts: p.socialAccounts.map(mapAccount),
    scheduleCount: p._count.schedules,
    postedCount,
    createdAt: iso(p.createdAt),
  };
}

async function postedCountByKol(kolIds: string[]) {
  const out = new Map<string, number>();
  if (kolIds.length === 0) return out;
  const rows = await prisma.kolSchedule.groupBy({
    by: ["kolId"],
    where: { kolId: { in: kolIds }, status: KolScheduleStatus.POSTED },
    _count: { _all: true },
  });
  for (const r of rows) out.set(r.kolId, r._count._all);
  return out;
}

const SCHEDULE_SELECT = {
  id: true,
  subNumber: true,
  placement: true,
  objective: true,
  status: true,
  scheduledAt: true,
  postedAt: true,
  postUrl: true,
  rate: true,
  additionalCost: true,
  latestViews: true,
  latestLikes: true,
  latestComments: true,
  latestShares: true,
  isFyp: true,
  peakVelocity: true,
  metricsSyncedAt: true,
  order: { select: { orderNumber: true } },
  brand: { select: { id: true, name: true } },
  campaign: { select: { id: true, title: true } },
  kol: { select: { id: true, fullName: true } },
  socialAccount: { select: { platform: true, handle: true } },
  spendRequest: { select: { status: true } },
} satisfies Prisma.KolScheduleSelect;

type ScheduleRow = Prisma.KolScheduleGetPayload<{
  select: typeof SCHEDULE_SELECT;
}>;

function mapSchedule(s: ScheduleRow) {
  const cost = money(s.rate) + money(s.additionalCost);
  return {
    id: s.id,
    subNumber: s.subNumber,
    orderNumber: s.order.orderNumber,
    brand: s.brand,
    campaign: s.campaign,
    kol: s.kol,
    account: s.socialAccount,
    placement: s.placement,
    objective: s.objective,
    status: s.status,
    scheduledAt: iso(s.scheduledAt),
    postedAt: iso(s.postedAt),
    postUrl: s.postUrl,
    rate: money(s.rate),
    additionalCost: money(s.additionalCost),
    cost,
    views: s.latestViews,
    likes: s.latestLikes,
    comments: s.latestComments,
    shares: s.latestShares,
    isFyp: s.isFyp,
    peakVelocity: s.peakVelocity,
    cpm: cpm(cost, s.latestViews),
    metricsSyncedAt: iso(s.metricsSyncedAt),
    paymentStatus: s.spendRequest?.status ?? null,
  };
}

/* -------------------------------------------------------------------------- */
/* Profiles                                                                   */
/* -------------------------------------------------------------------------- */

export async function aiListKolProfiles(
  role: KolReaderRole,
  params: {
    status?: string | null;
    platform?: string | null;
    categoryName?: string | null;
    q?: string | null;
    limit?: number;
  } = {},
) {
  if (!canViewKol(role)) return denied(DENIED_MESSAGE);

  const status = parseEnum(Object.values(KolStatus), params.status);
  const platform = parseEnum(
    Object.values(InfluencerPlatform),
    params.platform,
  );
  const categoryName = params.categoryName?.trim();
  const q = params.q?.trim();
  const handleQ = q?.replace(/^@/, "").toLowerCase();
  const limit = clampLimit(params.limit, 30, 100);

  const where: Prisma.KolProfileWhereInput = {
    ...(status ? { status } : {}),
    ...(platform ? { socialAccounts: { some: { platform } } } : {}),
    ...(categoryName
      ? {
          categories: {
            some: {
              category: {
                name: { contains: categoryName, mode: "insensitive" },
              },
            },
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { fullName: { contains: q, mode: "insensitive" } },
            { socialAccounts: { some: { handle: { contains: handleQ } } } },
          ],
        }
      : {}),
  };

  const [total, profiles] = await Promise.all([
    prisma.kolProfile.count({ where }),
    prisma.kolProfile.findMany({
      where,
      orderBy: { fullName: "asc" },
      take: limit,
      select: PROFILE_SELECT,
    }),
  ]);
  const posted = await postedCountByKol(profiles.map((p) => p.id));

  return {
    accessible: true as const,
    filters: {
      status: status ?? null,
      platform: platform ?? null,
      categoryName: categoryName || null,
      q: q || null,
    },
    total,
    count: profiles.length,
    profiles: profiles.map((p) => mapProfile(p, posted.get(p.id) ?? 0)),
  };
}

export async function aiGetKolProfile(role: KolReaderRole, kolId: string) {
  if (!canViewKol(role)) return denied(DENIED_MESSAGE);

  const profile = await prisma.kolProfile.findUnique({
    where: { id: kolId },
    select: PROFILE_SELECT,
  });
  if (!profile) {
    return {
      accessible: true as const,
      found: false as const,
      message: `KOL dengan id ${kolId} tidak ditemukan.`,
    };
  }

  const [posted, schedules, committed] = await Promise.all([
    postedCountByKol([profile.id]),
    prisma.kolSchedule.findMany({
      where: { kolId: profile.id },
      orderBy: [
        { scheduledAt: { sort: "desc", nulls: "last" } },
        { createdAt: "desc" },
      ],
      take: 20,
      select: SCHEDULE_SELECT,
    }),
    prisma.kolSchedule.findMany({
      where: { kolId: profile.id, status: { in: COMMITTED_STATUSES } },
      select: {
        status: true,
        rate: true,
        additionalCost: true,
        latestViews: true,
        isFyp: true,
      },
    }),
  ]);

  let totalCost = 0;
  let postedCost = 0;
  let postedViews = 0;
  let postedCount = 0;
  let fypCount = 0;
  for (const s of committed) {
    const cost = money(s.rate) + money(s.additionalCost);
    totalCost += cost;
    if (s.status === KolScheduleStatus.POSTED) {
      postedCount += 1;
      postedCost += cost;
      postedViews += s.latestViews ?? 0;
      if (s.isFyp) fypCount += 1;
    }
  }

  return {
    accessible: true as const,
    found: true as const,
    profile: mapProfile(profile, posted.get(profile.id) ?? 0),
    performance: {
      committedCost: money(totalCost),
      postedCount,
      postedViews,
      fypCount,
      fypRate: pct(fypCount, postedCount),
      avgCpm: cpm(postedCost, postedViews),
    },
    recentSchedules: schedules.map((s) => {
      const row = mapSchedule(s);
      return {
        subNumber: row.subNumber,
        brand: row.brand.name,
        campaign: row.campaign.title,
        account: `${row.account.platform} @${row.account.handle}`,
        placement: row.placement,
        status: row.status,
        scheduledAt: row.scheduledAt,
        cost: row.cost,
        views: row.views,
        isFyp: row.isFyp,
        cpm: row.cpm,
        paymentStatus: row.paymentStatus,
      };
    }),
  };
}

/* -------------------------------------------------------------------------- */
/* Schedules                                                                  */
/* -------------------------------------------------------------------------- */

export async function aiListKolSchedules(
  role: KolReaderRole,
  params: {
    status?: string | null;
    brandId?: string | null;
    campaignId?: string | null;
    kolId?: string | null;
    from?: string | null;
    to?: string | null;
    limit?: number;
  } = {},
) {
  if (!canViewKol(role)) return denied(DENIED_MESSAGE);

  const status = parseEnum(Object.values(KolScheduleStatus), params.status);
  const range = scheduledAtRange(params.from, params.to);
  const limit = clampLimit(params.limit, 50, 200);

  const where: Prisma.KolScheduleWhereInput = {
    ...(status ? { status } : {}),
    ...(params.brandId ? { brandId: params.brandId } : {}),
    ...(params.campaignId ? { campaignId: params.campaignId } : {}),
    ...(params.kolId ? { kolId: params.kolId } : {}),
    ...(range ? { scheduledAt: range } : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.kolSchedule.count({ where }),
    prisma.kolSchedule.findMany({
      where,
      orderBy: [
        { scheduledAt: { sort: "desc", nulls: "last" } },
        { createdAt: "desc" },
      ],
      take: limit,
      select: SCHEDULE_SELECT,
    }),
  ]);

  const schedules = rows.map(mapSchedule);
  const totalCost = schedules
    .filter((s) => COMMITTED_STATUSES.includes(s.status))
    .reduce((sum, s) => sum + s.cost, 0);
  const totalViews = schedules.reduce((sum, s) => sum + (s.views ?? 0), 0);

  return {
    accessible: true as const,
    filters: {
      status: status ?? null,
      brandId: params.brandId ?? null,
      campaignId: params.campaignId ?? null,
      kolId: params.kolId ?? null,
      from: iso(range?.gte),
      to: iso(range?.lte),
    },
    total,
    count: schedules.length,
    summary: {
      committedCost: money(totalCost),
      totalViews,
      note: "committedCost hanya menjumlah slot PENDING_APPROVAL/APPROVED/SCHEDULED/POSTED pada baris yang ditampilkan.",
    },
    schedules,
  };
}

/* -------------------------------------------------------------------------- */
/* Campaign performance                                                       */
/* -------------------------------------------------------------------------- */

export async function aiGetKolCampaignPerformance(
  role: KolReaderRole,
  params: {
    campaignId?: string | null;
    brandId?: string | null;
    from?: string | null;
    to?: string | null;
    limit?: number;
  } = {},
) {
  if (!canViewKol(role)) return denied(DENIED_MESSAGE);

  const range = scheduledAtRange(params.from, params.to);
  const limit = clampLimit(params.limit, 30, 100);

  const campaigns = await prisma.kolCampaign.findMany({
    where: params.campaignId
      ? { id: params.campaignId }
      : {
          archivedAt: null,
          ...(params.brandId ? { brandId: params.brandId } : {}),
        },
    orderBy: [{ startDate: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    take: limit,
    select: {
      id: true,
      title: true,
      startDate: true,
      endDate: true,
      archivedAt: true,
      brand: { select: { id: true, name: true } },
      budget: {
        select: {
          id: true,
          name: true,
          beginningBalance: true,
          archivedAt: true,
        },
      },
      schedules: {
        where: range ? { scheduledAt: range } : undefined,
        select: {
          status: true,
          rate: true,
          additionalCost: true,
          latestViews: true,
          isFyp: true,
        },
      },
    },
  });

  // Pemakaian budget selalu all-time (tidak ikut filter tanggal) — satu
  // budget bisa dipakai beberapa campaign, jadi agregasi lewat campaign.budgetId.
  const budgetIds = [...new Set(campaigns.map((c) => c.budget.id))];
  const budgetUsed = new Map<string, number>();
  if (budgetIds.length > 0) {
    const committedRows = await prisma.kolSchedule.findMany({
      where: {
        status: { in: COMMITTED_STATUSES },
        campaign: { budgetId: { in: budgetIds } },
      },
      select: {
        rate: true,
        additionalCost: true,
        campaign: { select: { budgetId: true } },
      },
    });
    for (const r of committedRows) {
      const key = r.campaign.budgetId;
      budgetUsed.set(
        key,
        (budgetUsed.get(key) ?? 0) + money(r.rate) + money(r.additionalCost),
      );
    }
  }

  let grandCost = 0;
  let grandPostedCost = 0;
  let grandViews = 0;
  let grandPosted = 0;
  let grandFyp = 0;

  const rows = campaigns.map((c) => {
    let totalCost = 0;
    let postedCost = 0;
    let totalViews = 0;
    let postedCount = 0;
    let fypCount = 0;
    const byStatus: Partial<Record<KolScheduleStatus, number>> = {};

    for (const s of c.schedules) {
      byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;
      if (!COMMITTED_STATUSES.includes(s.status)) continue;
      const cost = money(s.rate) + money(s.additionalCost);
      totalCost += cost;
      if (s.status === KolScheduleStatus.POSTED) {
        postedCount += 1;
        postedCost += cost;
        totalViews += s.latestViews ?? 0;
        if (s.isFyp) fypCount += 1;
      }
    }

    grandCost += totalCost;
    grandPostedCost += postedCost;
    grandViews += totalViews;
    grandPosted += postedCount;
    grandFyp += fypCount;

    const beginning = money(c.budget.beginningBalance);
    const used = money(budgetUsed.get(c.budget.id) ?? 0);

    return {
      id: c.id,
      title: c.title,
      brand: c.brand,
      startDate: dateOnly(c.startDate),
      endDate: dateOnly(c.endDate),
      archived: c.archivedAt != null,
      scheduleCount: c.schedules.length,
      byStatus,
      postedCount,
      totalCost: money(totalCost),
      totalViews,
      fypCount,
      fypRate: pct(fypCount, postedCount),
      avgCpm: cpm(postedCost, totalViews),
      budget: {
        id: c.budget.id,
        name: c.budget.name,
        beginning,
        used,
        remaining: money(beginning - used),
        usedPct: pct(used, beginning),
      },
    };
  });

  return {
    accessible: true as const,
    filters: {
      campaignId: params.campaignId ?? null,
      brandId: params.brandId ?? null,
      from: iso(range?.gte),
      to: iso(range?.lte),
    },
    definitions: {
      totalCost:
        "Σ(rate + additionalCost) slot berstatus PENDING_APPROVAL/APPROVED/SCHEDULED/POSTED (dalam rentang tanggal bila difilter).",
      totalViews: "Σ views terakhir slot POSTED.",
      avgCpm: "Biaya slot POSTED ÷ (views ÷ 1000), dalam Rupiah.",
      budget:
        "Pemakaian budget selalu all-time lintas semua campaign yang memakai budget tersebut.",
    },
    totals: {
      campaignCount: rows.length,
      totalCost: money(grandCost),
      totalViews: grandViews,
      postedCount: grandPosted,
      fypCount: grandFyp,
      fypRate: pct(grandFyp, grandPosted),
      avgCpm: cpm(grandPostedCost, grandViews),
    },
    campaigns: rows,
  };
}

/* -------------------------------------------------------------------------- */
/* Pending approvals                                                          */
/* -------------------------------------------------------------------------- */

export async function aiGetKolPendingApprovals(
  role: KolReaderRole,
  limit = 50,
) {
  if (!canViewKol(role)) return denied(DENIED_MESSAGE);
  const take = clampLimit(limit, 50, 200);

  const [changeCount, changes, scheduleCount, schedules] = await Promise.all([
    prisma.kolProfileChangeRequest.count({
      where: { status: KolChangeStatus.PENDING },
    }),
    prisma.kolProfileChangeRequest.findMany({
      where: { status: KolChangeStatus.PENDING },
      orderBy: { createdAt: "asc" },
      take,
      select: {
        id: true,
        type: true,
        reason: true,
        createdAt: true,
        kol: { select: { id: true, fullName: true, status: true } },
        requestedBy: { select: { name: true, email: true } },
      },
    }),
    prisma.kolSchedule.count({
      where: { status: KolScheduleStatus.PENDING_APPROVAL },
    }),
    prisma.kolSchedule.findMany({
      where: { status: KolScheduleStatus.PENDING_APPROVAL },
      orderBy: [{ submittedAt: "asc" }, { createdAt: "asc" }],
      take: take * 4,
      select: {
        id: true,
        orderId: true,
        subNumber: true,
        placement: true,
        scheduledAt: true,
        submittedAt: true,
        rate: true,
        additionalCost: true,
        order: {
          select: {
            orderNumber: true,
            requestedBy: { select: { name: true, email: true } },
          },
        },
        brand: { select: { id: true, name: true } },
        campaign: { select: { id: true, title: true } },
        kol: { select: { id: true, fullName: true } },
        socialAccount: { select: { platform: true, handle: true } },
      },
    }),
  ]);

  type OrderGroup = {
    orderId: string;
    orderNumber: string;
    kol: { id: string; fullName: string };
    brand: { id: string; name: string };
    campaign: { id: string; title: string };
    requestedBy: string | null;
    submittedAt: string | null;
    slots: {
      subNumber: string;
      account: string;
      placement: string;
      scheduledAt: string | null;
      cost: number;
    }[];
    total: number;
  };
  const groups = new Map<string, OrderGroup>();
  for (const s of schedules) {
    let g = groups.get(s.orderId);
    if (!g) {
      g = {
        orderId: s.orderId,
        orderNumber: s.order.orderNumber,
        kol: s.kol,
        brand: s.brand,
        campaign: s.campaign,
        requestedBy: userLabel(s.order.requestedBy),
        submittedAt: iso(s.submittedAt),
        slots: [],
        total: 0,
      };
      groups.set(s.orderId, g);
    }
    const cost = money(s.rate) + money(s.additionalCost);
    g.slots.push({
      subNumber: s.subNumber,
      account: `${s.socialAccount.platform} @${s.socialAccount.handle}`,
      placement: s.placement,
      scheduledAt: iso(s.scheduledAt),
      cost,
    });
    g.total = money(g.total + cost);
  }
  const orders = [...groups.values()].slice(0, take);

  return {
    accessible: true as const,
    counts: {
      profileChangeRequests: changeCount,
      pendingSchedules: scheduleCount,
      pendingOrders: groups.size,
      pendingScheduleValue: money(
        orders.reduce((sum, o) => sum + o.total, 0),
      ),
    },
    profileChangeRequests: changes.map((c) => ({
      id: c.id,
      kol: { id: c.kol.id, fullName: c.kol.fullName, status: c.kol.status },
      type: c.type,
      reason: c.reason,
      requestedBy: userLabel(c.requestedBy),
      createdAt: iso(c.createdAt),
    })),
    scheduleOrders: orders,
  };
}
