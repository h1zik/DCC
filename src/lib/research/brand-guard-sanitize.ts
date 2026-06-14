import type { ActionPlan } from "@/lib/research/prescriptive/types";

const MAX_FORBIDDEN = 30;

/** Dedupe brand names case-insensitively, preserve first casing. */
export function dedupeBrandNames(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const name = raw.trim();
    if (!name || name.length < 2) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= MAX_FORBIDDEN) break;
  }
  return out;
}

const GENERIC_KEYWORD_TOKENS = new Set([
  "lip",
  "lipcream",
  "lipstik",
  "lipstick",
  "lip",
  "cream",
  "serum",
  "toner",
  "moisturizer",
  "skincare",
  "bodycare",
  "kosmetik",
  "makeup",
  "parfum",
  "fragrance",
  "original",
  "asli",
  "murah",
  "termurah",
  "terbaik",
  "best",
  "review",
  "rekomendasi",
  "recommendation",
  "untuk",
  "wanita",
  "pria",
  "anak",
  "bayi",
  "promo",
  "diskon",
  "sale",
  "online",
  "shopee",
  "tokopedia",
  "lazada",
  "official",
  "store",
  "shop",
  "toko",
  "brand",
  "merk",
  "no",
  "non",
  "waterproof",
  "longlasting",
  "matte",
  "glossy",
  "tahan",
  "lama",
  "warna",
  "shade",
  "nude",
  "pink",
  "red",
  "coral",
  "peach",
  "brown",
  "orange",
  "purple",
  "mauve",
  "berry",
  "ml",
  "gr",
  "gram",
  "pcs",
  "pack",
  "set",
  "bundle",
  "plus",
  "dan",
  "the",
  "a",
  "de",
  "di",
  "ke",
  "dengan",
  "yang",
  "dan",
  "atau",
  "new",
  "baru",
  "viral",
  "trending",
  "trend",
  "halal",
  "bpom",
  "bpom",
  "herbal",
  "natural",
  "organik",
  "organic",
  "vegan",
  "cruelty",
  "free",
]);

function normalizeToken(token: string): string {
  return token.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function tokenizeKeyword(keyword: string): string[] {
  return keyword
    .toLowerCase()
    .split(/[\s\-_/+,]+/)
    .map(normalizeToken)
    .filter((t) => t.length >= 2);
}

function isGenericToken(token: string, categorySeed?: string): boolean {
  if (GENERIC_KEYWORD_TOKENS.has(token)) return true;
  if (categorySeed) {
    const seedTokens = tokenizeKeyword(categorySeed);
    if (seedTokens.includes(token)) return true;
  }
  return false;
}

/** Extract brand-like tokens from marketplace keyword strings. */
export function extractForbiddenBrandsFromKeywords(
  keywords: string[],
  categorySeed?: string,
): string[] {
  const candidates: string[] = [];

  for (const keyword of keywords) {
    const tokens = tokenizeKeyword(keyword);
    const brandish = tokens.filter((t) => !isGenericToken(t, categorySeed));
    for (const t of brandish) {
      candidates.push(t);
    }
    if (brandish.length >= 2) {
      candidates.push(brandish.join(" "));
    }
  }

  return dedupeBrandNames(candidates);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Strip or genericize forbidden brand tokens in copy text. */
export function sanitizeTextAgainstBrands(
  text: string,
  forbiddenBrands: string[],
): string {
  if (!text || forbiddenBrands.length === 0) return text;

  let out = text;
  const sorted = [...forbiddenBrands].sort((a, b) => b.length - a.length);

  for (const brand of sorted) {
    const trimmed = brand.trim();
    if (trimmed.length < 2) continue;
    const pattern = new RegExp(`\\b${escapeRegex(trimmed)}\\b`, "gi");
    out = out.replace(pattern, "produk kategori");
  }

  return out.replace(/\s{2,}/g, " ").trim();
}

export function sanitizeStringArray(
  items: string[] | undefined,
  forbiddenBrands: string[],
): string[] {
  if (!items?.length) return [];
  return items.map((s) => sanitizeTextAgainstBrands(s, forbiddenBrands));
}

export function sanitizeCopyKeywords(
  copy: {
    listingTitle?: string[];
    listingDescription?: string[];
    socialMedia?: string[];
    [key: string]: unknown;
  } | undefined,
  forbiddenBrands: string[],
): Record<string, unknown> {
  if (!copy || typeof copy !== "object") return copy ?? {};
  const out: Record<string, unknown> = { ...copy };
  for (const key of ["listingTitle", "listingDescription", "socialMedia"] as const) {
    if (Array.isArray(out[key])) {
      out[key] = sanitizeStringArray(out[key] as string[], forbiddenBrands);
    }
  }
  return out;
}

export function sanitizeActionPlan(
  plan: ActionPlan | null,
  forbiddenBrands: string[],
): ActionPlan | null {
  if (!plan || forbiddenBrands.length === 0) return plan;

  return {
    headline: sanitizeTextAgainstBrands(plan.headline, forbiddenBrands),
    recommendations: plan.recommendations.map((r) => ({
      ...r,
      action: sanitizeTextAgainstBrands(r.action, forbiddenBrands),
      rationale: sanitizeTextAgainstBrands(r.rationale, forbiddenBrands),
      expectedImpact: sanitizeTextAgainstBrands(r.expectedImpact, forbiddenBrands),
      metricToWatch: r.metricToWatch
        ? sanitizeTextAgainstBrands(r.metricToWatch, forbiddenBrands)
        : r.metricToWatch,
      evidence: r.evidence.map((e) => ({
        ...e,
        label: sanitizeTextAgainstBrands(e.label, forbiddenBrands),
      })),
    })),
  };
}

export function sanitizeRelatedProducts(
  products: string[],
  forbiddenBrands: string[],
): string[] {
  return products.map((p) => sanitizeTextAgainstBrands(p, forbiddenBrands));
}
