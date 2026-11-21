function normalizeHashtag(keyword: string): string {
  return keyword.replace(/^#/, "").replace(/\s+/g, "").toLowerCase();
}

/** Variasi hashtag dari keyword — mis. "Lip Tint" → liptint + lip_tint */
export function expandInstagramHashtagCandidates(keyword: string): string[] {
  const raw = keyword.trim();
  if (!raw) return [];

  const tags = new Set<string>();
  tags.add(normalizeHashtag(raw));
  const underscored = raw.replace(/^#/, "").replace(/\s+/g, "_").toLowerCase();
  if (underscored) tags.add(underscored);

  return [...tags];
}
