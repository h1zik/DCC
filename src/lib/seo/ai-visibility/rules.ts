/**
 * Aturan AI Visibility (pure): deteksi apakah brand disebut di jawaban AI
 * (teks + sitasi) dan ringkasan run.
 */

export type AiVisibilityResult = {
  keyword: string;
  platform: string;
  prompt: string;
  mentioned: boolean;
  matchedTerms: string[];
  /** Cuplikan jawaban di sekitar mention (atau awal jawaban). */
  excerpt: string;
  citations: string[];
  error?: string;
};

export type AiVisibilitySummary = {
  /** 0–100: persentase cek dengan mention. */
  mentionRate: number;
  totalChecks: number;
  mentionedChecks: number;
  byPlatform: Record<string, { total: number; mentioned: number; rate: number }>;
};

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Cek mention brand di teks jawaban + URL sitasi. Term domain (mengandung
 * titik) dicocokkan sebagai substring URL/teks; term nama sebagai kata utuh
 * (case-insensitive).
 */
export function detectBrandMention(
  answerText: string,
  citations: string[],
  brandTerms: string[],
): { mentioned: boolean; matchedTerms: string[] } {
  const matched = new Set<string>();
  const text = answerText.toLowerCase();
  const citationText = citations.join(" ").toLowerCase();

  for (const raw of brandTerms) {
    const term = raw.trim().toLowerCase();
    if (!term) continue;
    if (term.includes(".")) {
      // Domain: substring match di sitasi ATAU teks.
      if (citationText.includes(term) || text.includes(term)) matched.add(raw.trim());
    } else {
      const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegex(term)}($|[^\\p{L}\\p{N}])`, "iu");
      if (re.test(answerText) || re.test(citationText)) matched.add(raw.trim());
    }
  }
  return { mentioned: matched.size > 0, matchedTerms: [...matched] };
}

/** Cuplikan ±120 karakter di sekitar mention pertama (atau awal teks). */
export function buildExcerpt(
  answerText: string,
  matchedTerms: string[],
  maxLen = 260,
): string {
  const clean = answerText.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const term = matchedTerms[0]?.toLowerCase();
  if (term) {
    const idx = clean.toLowerCase().indexOf(term);
    if (idx >= 0) {
      const start = Math.max(0, idx - 120);
      const end = Math.min(clean.length, idx + term.length + 120);
      return `${start > 0 ? "…" : ""}${clean.slice(start, end)}${end < clean.length ? "…" : ""}`;
    }
  }
  return clean.slice(0, maxLen) + (clean.length > maxLen ? "…" : "");
}

export function buildRunSummary(
  results: AiVisibilityResult[],
): AiVisibilitySummary {
  const valid = results.filter((r) => !r.error);
  const byPlatform: AiVisibilitySummary["byPlatform"] = {};
  for (const r of valid) {
    const entry = byPlatform[r.platform] ?? { total: 0, mentioned: 0, rate: 0 };
    entry.total += 1;
    if (r.mentioned) entry.mentioned += 1;
    byPlatform[r.platform] = entry;
  }
  for (const p of Object.keys(byPlatform)) {
    const e = byPlatform[p];
    e.rate = e.total > 0 ? Math.round((e.mentioned / e.total) * 100) : 0;
  }
  const mentioned = valid.filter((r) => r.mentioned).length;
  return {
    mentionRate: valid.length > 0 ? Math.round((mentioned / valid.length) * 100) : 0,
    totalChecks: valid.length,
    mentionedChecks: mentioned,
    byPlatform,
  };
}
