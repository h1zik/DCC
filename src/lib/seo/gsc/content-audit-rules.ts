/**
 * Aturan Content Audit (pure): klasifikasi tren per-halaman dari data GSC
 * 28 hari vs 28 hari sebelumnya.
 */

export type PageTrendStatus = "decay" | "rising" | "stable" | "fresh";

export type AuditPageRow = {
  page: string;
  clicks: number;
  prevClicks: number;
  impressions: number;
  /** Perubahan klik dalam % (null bila prev 0). */
  deltaPct: number | null;
  status: PageTrendStatus;
  topQueries: { query: string; clicks: number }[];
};

/** Ambang klasifikasi. */
const DECAY_MIN_PREV_CLICKS = 20;
const DECAY_DROP_PCT = -30;
const RISING_GAIN_PCT = 30;
const RISING_MIN_CLICKS = 10;
const FRESH_MAX_PREV = 5;

export function classifyPageTrend(
  clicks: number,
  prevClicks: number,
): PageTrendStatus {
  if (prevClicks <= FRESH_MAX_PREV) {
    return clicks > FRESH_MAX_PREV ? "fresh" : "stable";
  }
  const deltaPct = ((clicks - prevClicks) / prevClicks) * 100;
  if (prevClicks >= DECAY_MIN_PREV_CLICKS && deltaPct <= DECAY_DROP_PCT) {
    return "decay";
  }
  if (deltaPct >= RISING_GAIN_PCT && clicks >= RISING_MIN_CLICKS) {
    return "rising";
  }
  return "stable";
}

export type AuditSummary = {
  decayed: number;
  rising: number;
  stable: number;
  fresh: number;
  totalClicks: number;
  prevTotalClicks: number;
};

/**
 * Gabungkan data GSC (halaman kini, halaman sebelumnya, query per halaman)
 * menjadi baris audit terurut: decay dulu (prioritas aksi), lalu klik terbesar.
 */
export function buildAuditRows(input: {
  current: { page: string; clicks: number; impressions: number }[];
  previous: { page: string; clicks: number }[];
  pageQueries: { page: string; query: string; clicks: number }[];
}): { rows: AuditPageRow[]; summary: AuditSummary } {
  const prevByPage = new Map(input.previous.map((p) => [p.page, p.clicks]));
  const queriesByPage = new Map<string, { query: string; clicks: number }[]>();
  for (const pq of input.pageQueries) {
    const list = queriesByPage.get(pq.page) ?? [];
    list.push({ query: pq.query, clicks: pq.clicks });
    queriesByPage.set(pq.page, list);
  }

  const seen = new Set<string>();
  const rows: AuditPageRow[] = [];

  const push = (
    page: string,
    clicks: number,
    impressions: number,
    prevClicks: number,
  ) => {
    if (seen.has(page)) return;
    seen.add(page);
    const status = classifyPageTrend(clicks, prevClicks);
    rows.push({
      page,
      clicks,
      prevClicks,
      impressions,
      deltaPct:
        prevClicks > 0
          ? Math.round(((clicks - prevClicks) / prevClicks) * 1000) / 10
          : null,
      status,
      topQueries: (queriesByPage.get(page) ?? [])
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 3),
    });
  };

  for (const cur of input.current) {
    push(cur.page, cur.clicks, cur.impressions, prevByPage.get(cur.page) ?? 0);
  }
  // Halaman yang dulunya dapat klik tapi kini hilang total.
  for (const prev of input.previous) {
    push(prev.page, 0, 0, prev.clicks);
  }

  const statusRank: Record<PageTrendStatus, number> = {
    decay: 0,
    rising: 1,
    fresh: 2,
    stable: 3,
  };
  rows.sort(
    (a, b) =>
      statusRank[a.status] - statusRank[b.status] ||
      b.prevClicks + b.clicks - (a.prevClicks + a.clicks),
  );

  const summary: AuditSummary = {
    decayed: rows.filter((r) => r.status === "decay").length,
    rising: rows.filter((r) => r.status === "rising").length,
    stable: rows.filter((r) => r.status === "stable").length,
    fresh: rows.filter((r) => r.status === "fresh").length,
    totalClicks: rows.reduce((s, r) => s + r.clicks, 0),
    prevTotalClicks: rows.reduce((s, r) => s + r.prevClicks, 0),
  };

  return { rows: rows.slice(0, 300), summary };
}
