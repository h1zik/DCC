const MAX_TAGS = 20;
const MAX_TAG_LEN = 32;

export function normalizeRoomDocumentTags(input: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    const t = raw
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u00C0-\u024F._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, MAX_TAG_LEN);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

export const ROOM_DOCUMENT_TAG_LIMITS = { maxTags: MAX_TAGS, maxLen: MAX_TAG_LEN };
