import { normalizeDomain } from "@/lib/seo/dataforseo/serp-parse";

/**
 * Backlink gap: domain yang menaut ke kompetitor tapi belum ke target. Pure
 * (tanpa server) agar mudah di-test.
 */

export type GapDomain = {
  domain: string;
  rank: number | null;
  backlinks: number | null;
};

export function computeBacklinkGap(
  targetDomains: { domain: string }[],
  competitorDomains: { domain: string; rank?: number | null; backlinks?: number | null }[],
): GapDomain[] {
  const have = new Set(targetDomains.map((d) => normalizeDomain(d.domain)));
  const seen = new Set<string>();
  const out: GapDomain[] = [];

  for (const c of competitorDomains) {
    const key = normalizeDomain(c.domain);
    if (!key || have.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push({
      domain: c.domain,
      rank: c.rank ?? null,
      backlinks: c.backlinks ?? null,
    });
  }

  return out.sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0));
}
