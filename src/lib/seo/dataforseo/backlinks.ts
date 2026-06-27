import "server-only";

import { dataForSeoLive } from "@/lib/seo/dataforseo/client";
import { withDataForSeoCache } from "@/lib/seo/dataforseo/cache";

/**
 * Wrapper DataForSEO Backlinks API: summary, referring domains, anchors, dan
 * history (untuk backlink baru/hilang). Semua live + di-cache 24 jam.
 */

export type BacklinkSummary = {
  rank: number | null;
  backlinks: number | null;
  referringDomains: number | null;
  referringMainDomains: number | null;
  referringDomainsNofollow: number | null;
  brokenBacklinks: number | null;
  spamScore: number | null;
  dofollow: number | null;
  referringLinksTld: Record<string, number> | null;
};

type DfsSummaryResult = {
  rank?: number;
  backlinks?: number;
  referring_domains?: number;
  referring_main_domains?: number;
  referring_domains_nofollow?: number;
  broken_backlinks?: number;
  backlinks_spam_score?: number;
  referring_links_tld?: Record<string, number> | null;
  referring_links_attributes?: Record<string, number> | null;
};

export async function fetchBacklinkSummary(
  target: string,
): Promise<BacklinkSummary | null> {
  const endpoint = "backlinks/summary/live";
  const payload = {
    target,
    internal_list_limit: 10,
    backlinks_status_type: "live",
    include_subdomains: true,
  };
  const result = await withDataForSeoCache(endpoint, payload, () =>
    dataForSeoLive<DfsSummaryResult>(endpoint, payload),
  );
  const r = result[0];
  if (!r) return null;

  const nofollowLinks = r.referring_links_attributes?.nofollow ?? null;
  const dofollow =
    r.backlinks != null && nofollowLinks != null
      ? Math.max(0, r.backlinks - nofollowLinks)
      : null;

  return {
    rank: r.rank ?? null,
    backlinks: r.backlinks ?? null,
    referringDomains: r.referring_domains ?? null,
    referringMainDomains: r.referring_main_domains ?? null,
    referringDomainsNofollow: r.referring_domains_nofollow ?? null,
    brokenBacklinks: r.broken_backlinks ?? null,
    spamScore: r.backlinks_spam_score ?? null,
    dofollow,
    referringLinksTld: r.referring_links_tld ?? null,
  };
}

export type ReferringDomain = {
  domain: string;
  rank: number | null;
  backlinks: number | null;
  firstSeen: string | null;
  lost: boolean;
};

type DfsReferringDomainsResult = {
  items?:
    | {
        domain?: string;
        rank?: number;
        backlinks?: number;
        first_seen?: string | null;
        lost_date?: string | null;
      }[]
    | null;
};

export async function fetchReferringDomains(
  target: string,
  limit = 50,
): Promise<ReferringDomain[]> {
  const endpoint = "backlinks/referring_domains/live";
  const payload = {
    target,
    limit: Math.min(1000, Math.max(1, limit)),
    order_by: ["rank,desc"],
    backlinks_status_type: "live",
    include_subdomains: true,
  };
  const result = await withDataForSeoCache(endpoint, payload, () =>
    dataForSeoLive<DfsReferringDomainsResult>(endpoint, payload),
  );
  const items = result[0]?.items ?? [];
  return items
    .filter((i) => i.domain)
    .map((i) => ({
      domain: i.domain!.trim(),
      rank: i.rank ?? null,
      backlinks: i.backlinks ?? null,
      firstSeen: i.first_seen ?? null,
      lost: i.lost_date != null,
    }));
}

export type BacklinkAnchor = {
  anchor: string;
  backlinks: number | null;
  referringDomains: number | null;
};

type DfsAnchorsResult = {
  items?:
    | {
        anchor?: string;
        backlinks?: number;
        referring_domains?: number;
      }[]
    | null;
};

export async function fetchBacklinkAnchors(
  target: string,
  limit = 30,
): Promise<BacklinkAnchor[]> {
  const endpoint = "backlinks/anchors/live";
  const payload = {
    target,
    limit: Math.min(1000, Math.max(1, limit)),
    order_by: ["backlinks,desc"],
    backlinks_status_type: "live",
    include_subdomains: true,
  };
  const result = await withDataForSeoCache(endpoint, payload, () =>
    dataForSeoLive<DfsAnchorsResult>(endpoint, payload),
  );
  const items = result[0]?.items ?? [];
  return items
    .filter((i) => i.anchor != null)
    .map((i) => ({
      anchor: (i.anchor ?? "").trim() || "(kosong)",
      backlinks: i.backlinks ?? null,
      referringDomains: i.referring_domains ?? null,
    }));
}

export type BacklinkHistoryPoint = {
  date: string;
  backlinks: number | null;
  referringDomains: number | null;
  newBacklinks: number | null;
  lostBacklinks: number | null;
  newReferringDomains: number | null;
  lostReferringDomains: number | null;
};

type DfsHistoryResult = {
  items?:
    | {
        date?: string;
        backlinks?: number;
        referring_domains?: number;
        new_backlinks?: number;
        lost_backlinks?: number;
        new_referring_domains?: number;
        lost_referring_domains?: number;
      }[]
    | null;
};

export async function fetchBacklinkHistory(
  target: string,
): Promise<BacklinkHistoryPoint[]> {
  const endpoint = "backlinks/history/live";
  const payload = { target, backlinks_status_type: "live" };
  const result = await withDataForSeoCache(endpoint, payload, () =>
    dataForSeoLive<DfsHistoryResult>(endpoint, payload),
  );
  const items = result[0]?.items ?? [];
  return items
    .filter((i) => i.date)
    .map((i) => ({
      date: i.date!,
      backlinks: i.backlinks ?? null,
      referringDomains: i.referring_domains ?? null,
      newBacklinks: i.new_backlinks ?? null,
      lostBacklinks: i.lost_backlinks ?? null,
      newReferringDomains: i.new_referring_domains ?? null,
      lostReferringDomains: i.lost_referring_domains ?? null,
    }));
}
