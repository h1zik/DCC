import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Pengumpul konteks "grounding" untuk ide konten — INI yang bikin ide tidak
 * generic. Menarik sinyal NYATA brand: brand voice (Brand Strategy), keluhan &
 * pujian customer asli (Review Intel), hook iklan kompetitor yang menang (Ad
 * Library), dan tren kategori (Trend Radar). Tiap sumber best-effort: satu yang
 * kosong/gagal tidak menjatuhkan yang lain, dan kita catat sumber mana yang
 * benar-benar terpakai (transparansi).
 */

export type BrandVoice = {
  purpose: string | null;
  coreMessage: string | null;
  usp: string | null;
  tone: string | null;
  personality: string | null;
};

export type CompetitorHook = {
  text: string;
  pageName: string | null;
};

export type TrendSignal = {
  name: string;
  phase: string;
  narrative: string | null;
};

export type BrandContext = {
  brandName: string | null;
  voice: BrandVoice | null;
  painPoints: string[];
  praises: string[];
  gapOpportunity: string | null;
  competitorHooks: CompetitorHook[];
  trends: TrendSignal[];
  /** Sumber yang benar-benar berisi data: brand_voice | reviews | ad_library | trends. */
  usedSources: string[];
};

const MAX_PAINS = 6;
const MAX_PRAISES = 4;
const MAX_HOOKS = 6;
const MAX_TRENDS = 8;

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Ubah Json tone/personality (array/objek/string) jadi teks ringkas. */
function jsonToText(value: unknown, max = 200): string | null {
  if (value == null) return null;
  if (typeof value === "string") return str(value);
  if (Array.isArray(value)) {
    const parts = value
      .map((v) => (typeof v === "string" ? v : typeof v === "object" && v ? Object.values(v).filter((x) => typeof x === "string").join(" ") : ""))
      .filter(Boolean);
    return parts.length ? parts.join(", ").slice(0, max) : null;
  }
  if (typeof value === "object") {
    const parts = Object.values(value as Record<string, unknown>)
      .filter((x): x is string => typeof x === "string" && x.trim().length > 0);
    return parts.length ? parts.join(", ").slice(0, max) : null;
  }
  return null;
}

/** Ambil daftar tema dari Json topComplaints/topPraises (string[] atau {theme/label/text,count}[]). */
function themeList(raw: unknown, max: number): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    let label: string | null = null;
    if (typeof item === "string") label = str(item);
    else if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      label = str(o.theme) ?? str(o.label) ?? str(o.text) ?? str(o.name);
    }
    if (label && !out.includes(label)) out.push(label);
    if (out.length >= max) break;
  }
  return out;
}

async function addVoice(ctx: BrandContext, brandId: string): Promise<void> {
  try {
    const doc = await prisma.brandStrategyDocument.findFirst({
      where: { ownerBrandId: brandId },
      orderBy: { updatedAt: "desc" },
      select: {
        brandPurpose: true,
        coreMessage: true,
        brandUsp: true,
        toneOfVoice: true,
        brandPersonality: true,
      },
    });
    if (!doc) return;
    const voice: BrandVoice = {
      purpose: str(doc.brandPurpose),
      coreMessage: str(doc.coreMessage),
      usp: str(doc.brandUsp),
      tone: jsonToText(doc.toneOfVoice),
      personality: jsonToText(doc.brandPersonality),
    };
    if (Object.values(voice).some(Boolean)) {
      ctx.voice = voice;
      ctx.usedSources.push("brand_voice");
    }
  } catch (err) {
    console.warn("[content-studio/grounding] voice gagal", err);
  }
}

type ReviewSummaryLike = {
  topComplaints: unknown;
  topPraises: unknown;
  gapOpportunity: string | null;
};

/**
 * Tarik VoC dari DUA modul review yang ada di DCC:
 *  - Brand Hub "Review Intelligence" (BrandReviewSource, brand-scoped), dan
 *  - Research Hub "Review Intel" (ReviewIntelSource, sering tanpa brand link →
 *    di-scope ke pembuat + brand bila ada).
 * Sebagian besar tim menaruh review di Research Hub, jadi ini penting.
 */
async function addReviews(
  ctx: BrandContext,
  brandId: string | null,
  userId: string,
): Promise<void> {
  const summaries: ReviewSummaryLike[] = [];

  if (brandId) {
    try {
      const brandSources = await prisma.brandReviewSource.findMany({
        where: { ownerBrandId: brandId },
        include: { summary: true },
        orderBy: { updatedAt: "desc" },
        take: 5,
      });
      for (const s of brandSources) if (s.summary) summaries.push(s.summary);
    } catch (err) {
      console.warn("[content-studio/grounding] brand reviews gagal", err);
    }
  }

  try {
    const intelSources = await prisma.reviewIntelSource.findMany({
      where: {
        summary: { isNot: null },
        ...(brandId
          ? { OR: [{ brandId }, { createdById: userId }] }
          : { createdById: userId }),
      },
      include: { summary: true },
      orderBy: { updatedAt: "desc" },
      take: 8,
    });
    for (const s of intelSources) if (s.summary) summaries.push(s.summary);
  } catch (err) {
    console.warn("[content-studio/grounding] research review intel gagal", err);
  }

  const pains: string[] = [];
  const praises: string[] = [];
  let gap: string | null = null;
  for (const summary of summaries) {
    for (const p of themeList(summary.topComplaints, MAX_PAINS)) {
      if (!pains.includes(p)) pains.push(p);
    }
    for (const p of themeList(summary.topPraises, MAX_PRAISES)) {
      if (!praises.includes(p)) praises.push(p);
    }
    if (!gap) gap = str(summary.gapOpportunity);
  }
  ctx.painPoints = pains.slice(0, MAX_PAINS);
  ctx.praises = praises.slice(0, MAX_PRAISES);
  ctx.gapOpportunity = gap;
  if (pains.length || praises.length || gap) ctx.usedSources.push("reviews");
}

async function addCompetitorHooks(ctx: BrandContext, brandId: string): Promise<void> {
  try {
    const ads = await prisma.brandAdLibraryAd.findMany({
      where: {
        monitor: { ownerBrandId: brandId },
        bodyText: { not: null },
        winningScore: { not: null },
      },
      orderBy: { winningScore: "desc" },
      take: MAX_HOOKS,
      select: { bodyText: true, pageName: true },
    });
    const hooks: CompetitorHook[] = [];
    for (const ad of ads) {
      const text = str(ad.bodyText);
      if (!text) continue;
      hooks.push({ text: text.slice(0, 220), pageName: ad.pageName });
    }
    ctx.competitorHooks = hooks;
    if (hooks.length) ctx.usedSources.push("ad_library");
  } catch (err) {
    console.warn("[content-studio/grounding] ad library gagal", err);
  }
}

async function addTrends(ctx: BrandContext): Promise<void> {
  try {
    const digest = await prisma.trendRadarDigest.findFirst({
      where: { status: "READY" },
      orderBy: { weekStart: "desc" },
      include: {
        items: {
          orderBy: { tmiScore: "desc" },
          take: MAX_TRENDS,
          select: { name: true, phase: true, narrative: true },
        },
      },
    });
    const items = digest?.items ?? [];
    ctx.trends = items.map((t) => ({
      name: t.name,
      phase: String(t.phase),
      narrative: str(t.narrative),
    }));
    if (ctx.trends.length) ctx.usedSources.push("trends");
  } catch (err) {
    console.warn("[content-studio/grounding] trends gagal", err);
  }
}

export async function gatherBrandContext(
  brandId: string | null,
  userId: string,
): Promise<BrandContext> {
  const ctx: BrandContext = {
    brandName: null,
    voice: null,
    painPoints: [],
    praises: [],
    gapOpportunity: null,
    competitorHooks: [],
    trends: [],
    usedSources: [],
  };

  if (brandId) {
    try {
      const brand = await prisma.brand.findUnique({
        where: { id: brandId },
        select: { name: true },
      });
      ctx.brandName = brand?.name ?? null;
    } catch {
      /* abaikan */
    }
    await addVoice(ctx, brandId);
    await addCompetitorHooks(ctx, brandId);
  }

  // Review intel & tren tetap berguna walau tanpa brand (VoC kategori + tren global).
  await addReviews(ctx, brandId, userId);
  await addTrends(ctx);

  return ctx;
}

/** Label sumber grounding untuk UI. */
export const GROUNDING_SOURCE_LABELS: Record<string, string> = {
  brand_voice: "Brand Voice",
  reviews: "Review Intel",
  ad_library: "Ad Library",
  trends: "Trend Radar",
};
