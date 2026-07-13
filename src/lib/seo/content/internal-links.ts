/**
 * Saran internal link TANPA LLM: cocokkan token keyword/term artikel dengan
 * halaman milik sendiri (dari rank tracker & audit). Pure agar mudah di-test.
 */

export type LinkCandidate = {
  url: string;
  /** Keyword yang terasosiasi (mis. tracked keyword). */
  keyword?: string | null;
};

export type InternalLinkSuggestion = {
  anchorText: string;
  url: string;
  reason: string;
};

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9à-ÿ\s-]/gi, " ")
      .split(/[\s/-]+/)
      .filter((t) => t.length >= 3),
  );
}

function slugTokens(url: string): Set<string> {
  try {
    const path = new URL(url).pathname;
    return tokens(path.replace(/\.(html?|php|aspx?)$/i, ""));
  } catch {
    return new Set();
  }
}

function overlap(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const t of a) if (b.has(t)) n++;
  return n;
}

export function suggestInternalLinks(opts: {
  targetKeyword: string;
  relatedKeywords: string[];
  terms: string[];
  candidates: LinkCandidate[];
  limit?: number;
}): InternalLinkSuggestion[] {
  const limit = opts.limit ?? 5;
  const topicTokens = new Set<string>();
  for (const source of [
    opts.targetKeyword,
    ...opts.relatedKeywords,
    ...opts.terms,
  ]) {
    for (const t of tokens(source)) topicTokens.add(t);
  }
  if (topicTokens.size === 0) return [];

  const seen = new Set<string>();
  const scored: (InternalLinkSuggestion & { score: number })[] = [];

  for (const cand of opts.candidates) {
    const url = cand.url?.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);

    const kwTokens = cand.keyword ? tokens(cand.keyword) : new Set<string>();
    const sTokens = slugTokens(url);
    const score = overlap(topicTokens, kwTokens) * 2 + overlap(topicTokens, sTokens);
    if (score < 2) continue;

    const anchorText =
      cand.keyword?.trim() ||
      [...sTokens].slice(0, 4).join(" ") ||
      url;
    scored.push({
      anchorText,
      url,
      reason: cand.keyword
        ? `Halaman ini menarget "${cand.keyword}" — relevan dengan topik artikel.`
        : "Slug halaman relevan dengan topik artikel.",
      score,
    });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => ({ anchorText: s.anchorText, url: s.url, reason: s.reason }));
}
