/**
 * Distribusi posisi ranking + top movers. Pure agar mudah di-test.
 */

export type RankDistribution = {
  top3: number;
  top10: number;
  top20: number;
  top100: number;
  unranked: number;
};

export function rankDistribution(
  positions: (number | null)[],
): RankDistribution {
  const dist: RankDistribution = {
    top3: 0,
    top10: 0,
    top20: 0,
    top100: 0,
    unranked: 0,
  };
  for (const pos of positions) {
    if (pos == null || pos > 100) dist.unranked += 1;
    else if (pos <= 3) dist.top3 += 1;
    else if (pos <= 10) dist.top10 += 1;
    else if (pos <= 20) dist.top20 += 1;
    else dist.top100 += 1;
  }
  return dist;
}

export type MoverKeyword = {
  keyword: string;
  previousPosition: number | null;
  currentPosition: number | null;
};

export type Mover = MoverKeyword & {
  /** Positif = naik (posisi mengecil). null→ranking atau sebaliknya dihitung dari 101. */
  delta: number;
};

/** Top movers naik/turun. `limit` per arah. */
export function topMovers(
  keywords: MoverKeyword[],
  limit = 5,
): { up: Mover[]; down: Mover[] } {
  const movers: Mover[] = keywords
    .map((k) => {
      const prev = k.previousPosition ?? 101;
      const curr = k.currentPosition ?? 101;
      return { ...k, delta: prev - curr };
    })
    .filter((m) => m.delta !== 0);

  const up = movers
    .filter((m) => m.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, limit);
  const down = movers
    .filter((m) => m.delta < 0)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, limit);
  return { up, down };
}
