/**
 * Parser pure hasil `on_page/content_parsing/live` → sinyal artikel.
 * Dipisah dari onpage.ts (server-only) agar mudah di-test.
 */

export type ParsedPageContent = {
  title: string | null;
  metaDescription: string | null;
  headings: { level: number; text: string }[];
  /** Teks konten utama (untuk analisis term — jangan dipersist). */
  bodyText: string;
  wordCount: number;
};

export type DfsContentTopic = {
  h_title?: string | null;
  level?: number | null;
  primary_content?: { text?: string | null }[] | null;
  secondary_content?: { text?: string | null }[] | null;
};

export type DfsContentParsingResult = {
  items?: {
    page_content?: {
      header?: { primary_content?: { text?: string | null }[] | null } | null;
      main_topic?: DfsContentTopic[] | null;
      secondary_topic?: DfsContentTopic[] | null;
    } | null;
    meta?: { title?: string | null; description?: string | null } | null;
  }[] | null;
};

export function parseContentParsingResult(
  result: DfsContentParsingResult[],
): ParsedPageContent | null {
  const item = result[0]?.items?.[0];
  const content = item?.page_content;
  if (!content) return null;

  const headings: { level: number; text: string }[] = [];
  const textParts: string[] = [];

  const walkTopics = (topics: DfsContentTopic[] | null | undefined) => {
    for (const topic of topics ?? []) {
      const title = topic.h_title?.trim();
      if (title) {
        const level =
          topic.level != null && topic.level >= 1 && topic.level <= 6
            ? topic.level
            : 2;
        headings.push({ level, text: title });
        textParts.push(title);
      }
      for (const block of [
        ...(topic.primary_content ?? []),
        ...(topic.secondary_content ?? []),
      ]) {
        const text = block?.text?.trim();
        if (text) textParts.push(text);
      }
    }
  };
  walkTopics(content.main_topic);
  walkTopics(content.secondary_topic);

  const bodyText = textParts.join(" ").replace(/\s+/g, " ").trim();
  if (!bodyText) return null;

  return {
    title:
      item?.meta?.title?.trim() ||
      headings.find((h) => h.level === 1)?.text ||
      null,
    metaDescription: item?.meta?.description?.trim() || null,
    headings,
    bodyText,
    wordCount: bodyText.split(/\s+/).length,
  };
}
