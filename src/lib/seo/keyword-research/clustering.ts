import { SeoKeywordIntent } from "@prisma/client";
import { SEO_INTENT_LABELS } from "@/lib/seo/labels";

/**
 * Clustering keyword berdasarkan intent. Berisi fallback deterministik (tanpa
 * LLM) + sanitasi output cluster dari LLM. Sengaja bebas dependensi server agar
 * mudah di-test (Vitest).
 */

export type ClusterableKeyword = {
  keyword: string;
  intent: SeoKeywordIntent;
};

export type KeywordCluster = {
  label: string;
  intent: SeoKeywordIntent;
  keywords: string[];
};

/** Urutan prioritas intent (transaksional paling "panas" untuk B2C). */
const INTENT_ORDER: SeoKeywordIntent[] = [
  SeoKeywordIntent.TRANSACTIONAL,
  SeoKeywordIntent.COMMERCIAL,
  SeoKeywordIntent.INFORMATIONAL,
  SeoKeywordIntent.NAVIGATIONAL,
  SeoKeywordIntent.UNKNOWN,
];

function parseIntent(raw: unknown): SeoKeywordIntent {
  const value = String(raw ?? "").trim().toUpperCase();
  if ((Object.values(SeoKeywordIntent) as string[]).includes(value)) {
    return value as SeoKeywordIntent;
  }
  switch (String(raw ?? "").trim().toLowerCase()) {
    case "informational":
      return SeoKeywordIntent.INFORMATIONAL;
    case "commercial":
      return SeoKeywordIntent.COMMERCIAL;
    case "transactional":
      return SeoKeywordIntent.TRANSACTIONAL;
    case "navigational":
      return SeoKeywordIntent.NAVIGATIONAL;
    default:
      return SeoKeywordIntent.UNKNOWN;
  }
}

/** Fallback deterministik: kelompokkan keyword berdasarkan intent-nya. */
export function clusterKeywordsByIntent(
  ideas: ClusterableKeyword[],
): KeywordCluster[] {
  const groups = new Map<SeoKeywordIntent, string[]>();
  for (const idea of ideas) {
    const kw = idea.keyword.trim();
    if (!kw) continue;
    const list = groups.get(idea.intent) ?? [];
    if (!list.some((k) => k.toLowerCase() === kw.toLowerCase())) list.push(kw);
    groups.set(idea.intent, list);
  }
  return INTENT_ORDER.filter((intent) => groups.has(intent)).map((intent) => ({
    label: SEO_INTENT_LABELS[intent],
    intent,
    keywords: groups.get(intent)!,
  }));
}

/**
 * Sanitasi cluster hasil LLM ke set keyword yang valid. Keyword yang tidak
 * masuk cluster mana pun dikelompokkan ulang berdasarkan intent ("Lainnya"),
 * sehingga semua keyword selalu tercakup.
 */
export function normalizeClusters(
  raw: unknown,
  ideas: ClusterableKeyword[],
): KeywordCluster[] {
  // Peta keyword valid (lowercase → bentuk kanonik) + intent aslinya.
  const canonical = new Map<string, string>();
  const intentOf = new Map<string, SeoKeywordIntent>();
  for (const idea of ideas) {
    const kw = idea.keyword.trim();
    if (!kw) continue;
    const key = kw.toLowerCase();
    if (!canonical.has(key)) {
      canonical.set(key, kw);
      intentOf.set(key, idea.intent);
    }
  }

  const assigned = new Set<string>();
  const clusters: KeywordCluster[] = [];

  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (!entry || typeof entry !== "object") continue;
      const obj = entry as { label?: unknown; intent?: unknown; keywords?: unknown };
      const label = String(obj.label ?? "").trim();
      if (!label) continue;
      const rawKeywords = Array.isArray(obj.keywords) ? obj.keywords : [];
      const keywords: string[] = [];
      for (const k of rawKeywords) {
        const key = String(k ?? "").trim().toLowerCase();
        if (!key || assigned.has(key) || !canonical.has(key)) continue;
        assigned.add(key);
        keywords.push(canonical.get(key)!);
      }
      if (keywords.length > 0) {
        clusters.push({ label, intent: parseIntent(obj.intent), keywords });
      }
    }
  }

  // Keyword yang belum terpetakan → kelompokkan berdasarkan intent.
  const leftover = ideas.filter(
    (idea) => idea.keyword.trim() && !assigned.has(idea.keyword.trim().toLowerCase()),
  );
  if (leftover.length > 0) {
    for (const cluster of clusterKeywordsByIntent(leftover)) {
      clusters.push(cluster);
    }
  }

  return clusters;
}

/**
 * Bangun peta keyword (lowercase) → { label, intent } dari daftar cluster, untuk
 * memberi label cluster ke tiap `SeoKeyword` saat persist.
 */
export function clusterAssignmentMap(
  clusters: KeywordCluster[],
): Map<string, { label: string; intent: SeoKeywordIntent }> {
  const map = new Map<string, { label: string; intent: SeoKeywordIntent }>();
  for (const cluster of clusters) {
    for (const kw of cluster.keywords) {
      const key = kw.trim().toLowerCase();
      if (key && !map.has(key)) {
        map.set(key, { label: cluster.label, intent: cluster.intent });
      }
    }
  }
  return map;
}
