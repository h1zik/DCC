/**
 * Kurva XP → Level (murni, deterministik, di-pin unit test). Delta per-level
 * kuadratik → cumulative kubik, tanpa cliff. Tuning = ubah XP_CURVE / MAX_LEVEL.
 *
 *   levelDelta(L) = BASE + LINEAR*(L-2) + QUAD*(L-2)*(L-3)   (L ≥ 2)
 *   cumXp(L)      = Σ levelDelta(2..L)                        (cumXp(1) = 0)
 *   levelFromXp(xp) = level tertinggi dgn cumXp(level) ≤ xp   (cap MAX_LEVEL)
 */
export const XP_CURVE = { BASE: 100, LINEAR: 50, QUAD: 5 } as const;
export const MAX_LEVEL = 50;

/** XP yang dibutuhkan untuk NAIK dari level L-1 ke level L (L ≥ 2). */
export function levelDelta(level: number): number {
  if (level <= 1) return 0;
  const { BASE, LINEAR, QUAD } = XP_CURVE;
  const n = level - 2;
  return BASE + LINEAR * n + QUAD * n * (n - 1);
}

/** XP kumulatif untuk BERADA di level L (L ≥ 1). cumXp(1) = 0. */
export function cumXp(level: number): number {
  const capped = Math.min(Math.max(1, Math.floor(level)), MAX_LEVEL);
  let total = 0;
  for (let l = 2; l <= capped; l++) total += levelDelta(l);
  return total;
}

/** Alias semantik: XP kumulatif minimum untuk level tsb. */
export const xpForLevel = cumXp;

/** Level dari total XP (di-cap MAX_LEVEL). */
export function levelFromXp(xp: number): number {
  const x = Math.max(0, Math.floor(xp));
  let level = 1;
  while (level < MAX_LEVEL && cumXp(level + 1) <= x) level++;
  return level;
}

/**
 * Progres menuju level berikutnya untuk UI (XP bar).
 * `into` = XP di atas ambang level saat ini; `span` = XP dibutuhkan ke level +1.
 */
export function levelProgress(xp: number): {
  level: number;
  into: number;
  span: number;
  ratio: number;
  nextLevelXp: number;
} {
  const level = levelFromXp(xp);
  const base = cumXp(level);
  if (level >= MAX_LEVEL) {
    return { level, into: 0, span: 0, ratio: 1, nextLevelXp: base };
  }
  const nextLevelXp = cumXp(level + 1);
  const span = nextLevelXp - base;
  const into = Math.max(0, Math.floor(xp) - base);
  return { level, into, span, ratio: span > 0 ? into / span : 1, nextLevelXp };
}
