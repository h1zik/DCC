import "server-only";

import { InfluencerAuditStatus, InfluencerPlatform, InfluencerTier, Prisma } from "@prisma/client";
import { resolveTier } from "@/lib/brand-research/influencer/score";
import { prisma } from "@/lib/prisma";
import {
  computeRateBand,
  DEFAULT_PLATFORM_CONFIG,
  DEFAULT_REFERENCE_CPM,
  rateVerdict,
  type RateBand,
  type RateVerdict,
} from "@/lib/kol/rate-card";

const PLATFORMS = [InfluencerPlatform.INSTAGRAM, InfluencerPlatform.TIKTOK];
const TIERS = Object.values(InfluencerTier);

/** Isi konfigurasi platform & CPM acuan bawaan bila belum ada (idempoten). */
export async function ensureKolRateDefaults() {
  const [configs, cpms] = await Promise.all([
    prisma.kolPlatformConfig.count(),
    prisma.kolReferenceCpm.count(),
  ]);
  if (configs < PLATFORMS.length) {
    await prisma.kolPlatformConfig.createMany({
      data: PLATFORMS.map((platform) => ({ platform, ...DEFAULT_PLATFORM_CONFIG })),
      skipDuplicates: true,
    });
  }
  if (cpms < PLATFORMS.length * TIERS.length) {
    await prisma.kolReferenceCpm.createMany({
      data: PLATFORMS.flatMap((platform) =>
        TIERS.map((tier) => ({
          platform,
          tier,
          cpm: new Prisma.Decimal(DEFAULT_REFERENCE_CPM[platform][tier]),
        })),
      ),
      skipDuplicates: true,
    });
  }
}

export type KolRateSettings = {
  configs: Record<
    "INSTAGRAM" | "TIKTOK",
    { floorPct: number; ceilingPct: number; fypThreshold: number; trackingDays: number }
  >;
  cpm: Record<"INSTAGRAM" | "TIKTOK", Record<InfluencerTier, number>>;
};

export async function getKolRateSettings(): Promise<KolRateSettings> {
  await ensureKolRateDefaults();
  const [configs, cpms] = await Promise.all([
    prisma.kolPlatformConfig.findMany(),
    prisma.kolReferenceCpm.findMany(),
  ]);
  const out = {
    configs: {
      INSTAGRAM: { ...DEFAULT_PLATFORM_CONFIG },
      TIKTOK: { ...DEFAULT_PLATFORM_CONFIG },
    },
    cpm: {
      INSTAGRAM: { ...DEFAULT_REFERENCE_CPM.INSTAGRAM },
      TIKTOK: { ...DEFAULT_REFERENCE_CPM.TIKTOK },
    },
  } as KolRateSettings;
  for (const c of configs) {
    out.configs[c.platform] = {
      floorPct: c.floorPct,
      ceilingPct: c.ceilingPct,
      fypThreshold: c.fypThreshold,
      trackingDays: c.trackingDays,
    };
  }
  for (const r of cpms) out.cpm[r.platform][r.tier] = Number(r.cpm);
  return out;
}

export type AccountRate = {
  accountId: string;
  platform: "INSTAGRAM" | "TIKTOK";
  followers: number | null;
  tier: InfluencerTier | null;
  medianViews: number | null;
  /** Dari mana median views: audit penuh atau snapshot ringan Radar. */
  source: "audit" | "snapshot" | null;
  measuredAt: string | null;
  referenceCpm: number | null;
  band: RateBand | null;
  rateCard: number | null;
  verdict: RateVerdict | null;
};

/**
 * Konteks rate card untuk sejumlah akun KOL: median views terbaru (audit atau
 * snapshot, mana yang lebih baru), tier dari follower, CPM acuan, dan band.
 */
export async function getAccountRates(accountIds: string[]): Promise<Map<string, AccountRate>> {
  const out = new Map<string, AccountRate>();
  if (accountIds.length === 0) return out;
  const [settings, accounts] = await Promise.all([
    getKolRateSettings(),
    prisma.kolSocialAccount.findMany({
      where: { id: { in: accountIds } },
      select: {
        id: true,
        platform: true,
        rateCard: true,
        influencerProfile: {
          select: {
            latestFollowers: true,
            audits: {
              where: { status: InfluencerAuditStatus.READY },
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { medianViews: true, followers: true, createdAt: true },
            },
            snapshots: {
              orderBy: { collectedAt: "desc" },
              take: 1,
              select: { medianViews: true, followers: true, collectedAt: true },
            },
          },
        },
      },
    }),
  ]);

  for (const a of accounts) {
    const audit = a.influencerProfile?.audits[0];
    const snap = a.influencerProfile?.snapshots[0];
    const useAudit =
      audit && audit.medianViews > 0 && (!snap || audit.createdAt >= snap.collectedAt || !snap.medianViews);
    const pick = useAudit
      ? { median: audit.medianViews, followers: audit.followers, at: audit.createdAt, source: "audit" as const }
      : snap && snap.medianViews > 0
        ? { median: snap.medianViews, followers: snap.followers, at: snap.collectedAt, source: "snapshot" as const }
        : null;
    const followers = a.influencerProfile?.latestFollowers ?? pick?.followers ?? null;
    const tier = followers != null ? resolveTier(followers) : null;
    const cfg = settings.configs[a.platform];
    const referenceCpm = tier ? settings.cpm[a.platform][tier] : null;
    const band =
      pick && referenceCpm
        ? computeRateBand(pick.median, referenceCpm, cfg.floorPct, cfg.ceilingPct)
        : null;
    const rateCard = a.rateCard == null ? null : Number(a.rateCard);
    out.set(a.id, {
      accountId: a.id,
      platform: a.platform,
      followers,
      tier,
      medianViews: pick?.median ?? null,
      source: pick?.source ?? null,
      measuredAt: pick?.at.toISOString() ?? null,
      referenceCpm,
      band,
      rateCard,
      verdict: band && rateCard != null && rateCard > 0 ? rateVerdict(rateCard, band) : null,
    });
  }
  return out;
}
