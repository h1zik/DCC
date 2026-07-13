/**
 * Jantung fitur Keyword Gap: gabungkan hasil domain_intersection per
 * kompetitor menjadi baris terpadu + klasifikasi bucket ala Semrush.
 * Pure agar mudah di-test.
 */

export type GapBucket = "missing" | "weak" | "strong" | "shared" | "untapped";

export type GapSourceRow = {
  keyword: string;
  searchVolume: number | null;
  difficulty: number | null;
  targetPosition: number | null;
  competitorPosition: number | null;
};

export type GapRow = {
  keyword: string;
  searchVolume: number | null;
  difficulty: number | null;
  targetPos: number | null;
  /** Posisi per domain kompetitor (null = tidak ranking). */
  competitorPos: Record<string, number | null>;
  bucket: GapBucket;
};

export type GapSummary = {
  buckets: Record<GapBucket, number>;
  /** Jumlah keyword yang di-ranking tiap domain (untuk venn). */
  domainCounts: Record<string, number>;
  /** Keyword yang di-ranking target DAN minimal satu kompetitor. */
  sharedWithAnyCompetitor: number;
  totalKeywords: number;
};

/**
 * Klasifikasi bucket Semrush:
 * - missing : semua/ada kompetitor ranking, target tidak.
 * - untapped: hanya SATU kompetitor ranking, target tidak (khusus >1 kompetitor).
 * - weak    : target ranking tapi di bawah SEMUA kompetitor yang ranking.
 * - strong  : target ranking di atas semua kompetitor (atau kompetitor tak ranking).
 * - shared  : target & kompetitor sama-sama ranking, posisi campuran.
 */
export function classifyBucket(
  targetPos: number | null,
  competitorPositions: (number | null)[],
  competitorCount: number,
): GapBucket {
  const ranking = competitorPositions.filter((p): p is number => p != null);
  if (targetPos == null) {
    if (competitorCount > 1 && ranking.length === 1) return "untapped";
    return "missing";
  }
  if (ranking.length === 0) return "strong";
  const betterThanTarget = ranking.filter((p) => p < targetPos).length;
  if (betterThanTarget === ranking.length) return "weak";
  if (betterThanTarget === 0) return "strong";
  return "shared";
}

/**
 * Merge hasil intersection per kompetitor → baris terpadu.
 * `sources` = map domain kompetitor → baris hasil intersection-nya.
 */
export function mergeGapRows(
  sources: Record<string, GapSourceRow[]>,
  opts: { cap?: number } = {},
): { rows: GapRow[]; summary: GapSummary; truncated: boolean } {
  const competitors = Object.keys(sources);
  const byKeyword = new Map<
    string,
    {
      keyword: string;
      searchVolume: number | null;
      difficulty: number | null;
      targetPos: number | null;
      competitorPos: Record<string, number | null>;
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
        targetPos: null,
        competitorPos: Object.fromEntries(
          competitors.map((c) => [c, null]),
        ) as Record<string, number | null>,
      };
      existing.searchVolume = existing.searchVolume ?? row.searchVolume;
      existing.difficulty = existing.difficulty ?? row.difficulty;
      existing.targetPos = existing.targetPos ?? row.targetPosition;
      existing.competitorPos[domain] = row.competitorPosition;
      byKeyword.set(key, existing);
    }
  }

  const allRows: GapRow[] = [...byKeyword.values()].map((r) => ({
    ...r,
    bucket: classifyBucket(
      r.targetPos,
      Object.values(r.competitorPos),
      competitors.length,
    ),
  }));

  // Urutkan volume desc (null di akhir).
  allRows.sort((a, b) => (b.searchVolume ?? -1) - (a.searchVolume ?? -1));

  const buckets: Record<GapBucket, number> = {
    missing: 0,
    weak: 0,
    strong: 0,
    shared: 0,
    untapped: 0,
  };
  const domainCounts: Record<string, number> = { target: 0 };
  for (const c of competitors) domainCounts[c] = 0;
  let sharedWithAnyCompetitor = 0;

  for (const row of allRows) {
    buckets[row.bucket] += 1;
    if (row.targetPos != null) domainCounts.target += 1;
    let anyComp = false;
    for (const c of competitors) {
      if (row.competitorPos[c] != null) {
        domainCounts[c] += 1;
        anyComp = true;
      }
    }
    if (anyComp && row.targetPos != null) sharedWithAnyCompetitor += 1;
  }

  const cap = opts.cap ?? 700;
  const truncated = allRows.length > cap;

  return {
    rows: allRows.slice(0, cap),
    summary: {
      buckets,
      domainCounts,
      sharedWithAnyCompetitor,
      totalKeywords: allRows.length,
    },
    truncated,
  };
}
