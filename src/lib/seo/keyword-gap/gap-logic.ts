/**
 * Jantung fitur Keyword Gap: gabungkan ranked keywords per-domain menjadi
 * baris terpadu dan klasifikasi opportunity bucket.
 */

export type GapBucket =
  | "missing"
  | "weak"
  | "strong"
  | "shared"
  | "untapped"
  | "unique"
  | "mixed";

export type GapDomainRow = {
  keyword: string;
  searchVolume: number | null;
  difficulty: number | null;
  position: number | null;
};

export type GapRow = {
  keyword: string;
  searchVolume: number | null;
  difficulty: number | null;
  targetPos: number | null;
  /** Posisi per domain kompetitor (null = tidak ranking). */
  competitorPos: Record<string, number | null>;
  /** Label Semrush dapat tumpang tindih, mis. shared + weak. */
  buckets: GapBucket[];
  /** Label utama untuk badge dan kompatibilitas data lama. */
  bucket: GapBucket;
};

export type GapCoverage = {
  /** Jumlah baris yang benar-benar diambil per domain. */
  fetchedByDomain: Record<string, number>;
  /** Jumlah keyword yang tersedia menurut DataForSEO per domain. */
  totalByDomain: Record<string, number>;
  /** Domain yang datanya dipotong oleh batas API. */
  truncatedDomains: string[];
  perDomainLimit: number;
};

export type GapSummary = {
  version: 2;
  buckets: Record<GapBucket, number>;
  /** Jumlah keyword pada sampel yang di-ranking tiap domain (untuk venn). */
  domainCounts: Record<string, number>;
  /** Keyword yang di-ranking target DAN minimal satu kompetitor. */
  sharedWithAnyCompetitor: number;
  /** Jumlah keyword unik dalam union sampel yang diambil. */
  totalKeywords: number;
  coverage?: GapCoverage;
};

/**
 * Label mengikuti definisi Keyword Gap dan dapat tumpang tindih. `mixed`
 * menampung kasus target serta sebagian kompetitor ranking dengan posisi
 * campuran, yang tidak memiliki label intersection khusus.
 */
export function classifyBuckets(
  targetPos: number | null,
  competitorPositions: (number | null)[],
  competitorCount: number,
): GapBucket[] {
  const ranking = competitorPositions.filter((p): p is number => p != null);

  if (targetPos == null) {
    const labels: GapBucket[] = [];
    if (ranking.length > 0) labels.push("untapped");
    if (ranking.length === competitorCount) labels.unshift("missing");
    return labels;
  }
  if (ranking.length === 0) return ["unique"];

  const labels: GapBucket[] = [];
  const allCompetitorsRank = ranking.length === competitorCount;
  if (allCompetitorsRank) labels.push("shared");
  if (allCompetitorsRank && ranking.every((position) => position < targetPos)) {
    labels.unshift("weak");
  }
  if (
    competitorPositions.every(
      (position) => position == null || targetPos < position,
    )
  ) {
    labels.unshift("strong");
  }
  return labels.length > 0 ? labels : ["mixed"];
}

export function classifyBucket(
  targetPos: number | null,
  competitorPositions: (number | null)[],
  competitorCount: number,
): GapBucket {
  return (
    classifyBuckets(targetPos, competitorPositions, competitorCount)[0] ??
    "mixed"
  );
}

/** Gabungkan union ranked keywords target dan seluruh kompetitor. */
export function mergeGapRows(
  targetDomain: string,
  sources: Record<string, GapDomainRow[]>,
  opts: { cap?: number; coverage?: GapCoverage } = {},
): { rows: GapRow[]; summary: GapSummary; truncated: boolean } {
  const domains = Object.keys(sources);
  const competitors = domains.filter((domain) => domain !== targetDomain);
  const byKeyword = new Map<
    string,
    {
      keyword: string;
      searchVolume: number | null;
      difficulty: number | null;
      positions: Record<string, number | null>;
    }
  >();

  for (const [domain, rows] of Object.entries(sources)) {
    for (const row of rows) {
      const key = row.keyword.trim().toLowerCase();
      if (!key) continue;
      const existing = byKeyword.get(key) ?? {
        keyword: row.keyword.trim(),
        searchVolume: null,
        difficulty: null,
        positions: Object.fromEntries(
          domains.map((sourceDomain) => [sourceDomain, null]),
        ) as Record<string, number | null>,
      };
      existing.searchVolume = existing.searchVolume ?? row.searchVolume;
      existing.difficulty = existing.difficulty ?? row.difficulty;
      existing.positions[domain] = row.position;
      byKeyword.set(key, existing);
    }
  }

  const allRows: GapRow[] = [...byKeyword.values()].map((row) => {
    const targetPos = row.positions[targetDomain] ?? null;
    const competitorPos = Object.fromEntries(
      competitors.map((domain) => [domain, row.positions[domain] ?? null]),
    ) as Record<string, number | null>;
    const rowBuckets = classifyBuckets(
      targetPos,
      Object.values(competitorPos),
      competitors.length,
    );
    return {
      keyword: row.keyword,
      searchVolume: row.searchVolume,
      difficulty: row.difficulty,
      targetPos,
      competitorPos,
      buckets: rowBuckets,
      bucket: rowBuckets[0] ?? "mixed",
    };
  });

  allRows.sort((a, b) => (b.searchVolume ?? -1) - (a.searchVolume ?? -1));

  const buckets: Record<GapBucket, number> = {
    missing: 0,
    weak: 0,
    strong: 0,
    shared: 0,
    untapped: 0,
    unique: 0,
    mixed: 0,
  };
  const domainCounts: Record<string, number> = { target: 0 };
  for (const competitor of competitors) domainCounts[competitor] = 0;
  let sharedWithAnyCompetitor = 0;

  for (const row of allRows) {
    for (const bucket of row.buckets) buckets[bucket] += 1;
    if (row.targetPos != null) domainCounts.target += 1;
    let anyCompetitor = false;
    for (const competitor of competitors) {
      if (row.competitorPos[competitor] != null) {
        domainCounts[competitor] += 1;
        anyCompetitor = true;
      }
    }
    if (anyCompetitor && row.targetPos != null) sharedWithAnyCompetitor += 1;
  }

  const cap = opts.cap ?? 4000;
  const truncated = allRows.length > cap;
  return {
    rows: allRows.slice(0, cap),
    summary: {
      version: 2,
      buckets,
      domainCounts,
      sharedWithAnyCompetitor,
      totalKeywords: allRows.length,
      coverage: opts.coverage,
    },
    truncated,
  };
}
