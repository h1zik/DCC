import "server-only";

import { FinanceSpendRequestStatus, KolScheduleStatus, KolStatus, Prisma } from "@prisma/client";
import { resolveTier } from "@/lib/brand-research/influencer/score";
import { COMMITTED_STATUSES } from "@/lib/kol/budget";
import { PLACEMENT_LABEL, OBJECTIVE_META, TIER_LABEL } from "@/lib/kol/labels";
import { prisma } from "@/lib/prisma";

export const ANALYTICS_DIMENSIONS = [
  "kol",
  "campaign",
  "product",
  "category",
  "brief",
  "pic",
  "tier",
  "platform",
  "placement",
  "objective",
] as const;
export type AnalyticsDimension = (typeof ANALYTICS_DIMENSIONS)[number];

export const DIMENSION_LABEL: Record<AnalyticsDimension, string> = {
  kol: "KOL",
  campaign: "Campaign",
  product: "Produk",
  category: "Kategori",
  brief: "Brief",
  pic: "PIC",
  tier: "Tier",
  platform: "Platform",
  placement: "Placement",
  objective: "Tujuan",
};

export type AnalyticsFilters = {
  from: Date;
  to: Date;
  brandId?: string | null;
  platform?: "INSTAGRAM" | "TIKTOK" | null;
};

export type MetricTotals = {
  schedules: number;
  posted: number;
  fyp: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  /** Biaya seluruh jadwal terkomitmen di periode. */
  cost: number;
  /** Biaya jadwal yang sudah tayang & punya views — dasar CPM yang jujur. */
  postedCost: number;
  /** Nilai yang sudah dibayar lewat Finance. */
  paid: number;
};

export type MetricRow = MetricTotals & { key: string; label: string; href?: string };

const emptyTotals = (): MetricTotals => ({
  schedules: 0,
  posted: 0,
  fyp: 0,
  views: 0,
  likes: 0,
  comments: 0,
  shares: 0,
  cost: 0,
  postedCost: 0,
  paid: 0,
});

/** Turunan untuk tampilan (tidak disimpan). */
export function derived(t: MetricTotals) {
  const engagement = t.likes + t.comments + t.shares;
  return {
    fypRate: t.posted ? (t.fyp / t.posted) * 100 : null,
    postingRate: t.schedules ? (t.posted / t.schedules) * 100 : null,
    avgViews: t.posted ? t.views / t.posted : null,
    cpm: t.views ? t.postedCost / (t.views / 1000) : null,
    cpv: t.views ? t.postedCost / t.views : null,
    viewsPer1k: t.postedCost ? t.views / (t.postedCost / 1000) : null,
    er: t.views ? (engagement / t.views) * 100 : null,
    engagement,
  };
}

const scheduleSelect = {
  id: true,
  status: true,
  placement: true,
  objective: true,
  rate: true,
  additionalCost: true,
  latestViews: true,
  latestLikes: true,
  latestComments: true,
  latestShares: true,
  isFyp: true,
  followersAtBooking: true,
  kol: {
    select: {
      id: true,
      fullName: true,
      categories: { select: { category: { select: { id: true, name: true } } } },
    },
  },
  campaign: { select: { id: true, title: true } },
  brief: { select: { id: true, title: true } },
  picUser: { select: { id: true, name: true, email: true } },
  socialAccount: {
    select: { platform: true, influencerProfile: { select: { latestFollowers: true } } },
  },
  products: { select: { product: { select: { id: true, name: true } } } },
  spendRequest: { select: { status: true, amount: true } },
} satisfies Prisma.KolScheduleSelect;

type Row = Prisma.KolScheduleGetPayload<{ select: typeof scheduleSelect }>;

function where(f: AnalyticsFilters): Prisma.KolScheduleWhereInput {
  return {
    status: { in: COMMITTED_STATUSES },
    scheduledAt: { gte: f.from, lt: f.to },
    ...(f.brandId ? { brandId: f.brandId } : {}),
    ...(f.platform ? { socialAccount: { platform: f.platform } } : {}),
  };
}

function add(t: MetricTotals, r: Row) {
  const cost = Number(r.rate) + Number(r.additionalCost);
  const posted = r.status === KolScheduleStatus.POSTED;
  t.schedules += 1;
  t.cost += cost;
  if (posted) {
    t.posted += 1;
    if (r.isFyp) t.fyp += 1;
    t.views += r.latestViews ?? 0;
    t.likes += r.latestLikes ?? 0;
    t.comments += r.latestComments ?? 0;
    t.shares += r.latestShares ?? 0;
    if (r.latestViews) t.postedCost += cost;
  }
  if (r.spendRequest?.status === FinanceSpendRequestStatus.PAID) {
    t.paid += Number(r.spendRequest.amount);
  }
}

/** Kunci & label grup untuk satu jadwal (satu jadwal bisa masuk beberapa grup). */
function groupsOf(r: Row, by: AnalyticsDimension): { key: string; label: string; href?: string }[] {
  switch (by) {
    case "kol":
      return [{ key: r.kol.id, label: r.kol.fullName, href: `/kol-hub/kols/${r.kol.id}` }];
    case "campaign":
      return [{ key: r.campaign.id, label: r.campaign.title, href: `/kol-hub/campaigns/${r.campaign.id}` }];
    case "product":
      return r.products.length
        ? r.products.map((p) => ({ key: p.product.id, label: p.product.name }))
        : [{ key: "_none", label: "Tanpa produk" }];
    case "category":
      return r.kol.categories.length
        ? r.kol.categories.map((c) => ({ key: c.category.id, label: c.category.name }))
        : [{ key: "_none", label: "Tanpa kategori" }];
    case "brief":
      return [r.brief ? { key: r.brief.id, label: r.brief.title } : { key: "_none", label: "Tanpa brief" }];
    case "pic":
      return [
        r.picUser
          ? { key: r.picUser.id, label: r.picUser.name ?? r.picUser.email }
          : { key: "_none", label: "Tanpa PIC" },
      ];
    case "tier": {
      const f = r.followersAtBooking ?? r.socialAccount.influencerProfile?.latestFollowers;
      if (f == null) return [{ key: "_none", label: "Belum terukur" }];
      const t = resolveTier(f);
      return [{ key: t, label: TIER_LABEL[t] ?? t }];
    }
    case "platform":
      return [
        {
          key: r.socialAccount.platform,
          label: r.socialAccount.platform === "TIKTOK" ? "TikTok" : "Instagram",
        },
      ];
    case "placement":
      return [{ key: r.placement, label: PLACEMENT_LABEL[r.placement] }];
    case "objective":
      return [{ key: r.objective, label: OBJECTIVE_META[r.objective].label }];
  }
}

export async function getKolAnalytics(f: AnalyticsFilters, by: AnalyticsDimension) {
  const span = f.to.getTime() - f.from.getTime();
  const prevFilters = { ...f, from: new Date(f.from.getTime() - span), to: f.from };

  const [rows, prevRows, activeKols, priorKolIds] = await Promise.all([
    prisma.kolSchedule.findMany({ where: where(f), select: scheduleSelect }),
    prisma.kolSchedule.findMany({ where: where(prevFilters), select: scheduleSelect }),
    prisma.kolProfile.count({ where: { status: KolStatus.ACTIVE } }),
    prisma.kolSchedule.findMany({
      where: {
        status: { in: COMMITTED_STATUSES },
        scheduledAt: { lt: f.from },
        ...(f.brandId ? { brandId: f.brandId } : {}),
      },
      select: { kolId: true },
      distinct: ["kolId"],
    }),
  ]);

  const totals = emptyTotals();
  const previous = emptyTotals();
  rows.forEach((r) => add(totals, r));
  prevRows.forEach((r) => add(previous, r));

  const groups = new Map<string, MetricRow>();
  for (const r of rows) {
    for (const g of groupsOf(r, by)) {
      const cur = groups.get(g.key) ?? { ...emptyTotals(), ...g };
      add(cur, r);
      groups.set(g.key, cur);
    }
  }

  const prior = new Set(priorKolIds.map((p) => p.kolId));
  const kolsInPeriod = new Set(rows.map((r) => r.kol.id));
  const newKols = [...kolsInPeriod].filter((id) => !prior.has(id)).length;

  return {
    totals,
    previous,
    rows: [...groups.values()].sort((a, b) => b.views - a.views || b.cost - a.cost),
    kolTracker: {
      active: activeKols,
      used: kolsInPeriod.size,
      newKols,
      repeatKols: kolsInPeriod.size - newKols,
      unused: Math.max(0, activeKols - kolsInPeriod.size),
    },
  };
}

export type KolAnalytics = Awaited<ReturnType<typeof getKolAnalytics>>;

/** Periode preset → rentang [from, to) dalam WIB. */
export function periodRange(period: string | null | undefined, now = new Date()): {
  from: Date;
  to: Date;
  label: string;
  key: string;
} {
  const wibToday = new Date(now.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
  const endOfToday = new Date(new Date(`${wibToday}T00:00:00+07:00`).getTime() + 86_400_000);
  if (period && /^\d{4}-\d{2}$/.test(period)) {
    const [y, m] = period.split("-").map(Number);
    const from = new Date(Date.UTC(y, m - 1, 1, -7));
    const to = new Date(Date.UTC(y, m, 1, -7));
    const label = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(
      new Date(Date.UTC(y, m - 1, 1)),
    );
    return { from, to, label, key: period };
  }
  const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;
  return {
    from: new Date(endOfToday.getTime() - days * 86_400_000),
    to: endOfToday,
    label: `${days} hari terakhir`,
    key: `${days}d`,
  };
}
