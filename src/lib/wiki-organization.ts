import { htmlToWikiText } from "@/lib/wiki-draft";

export const WIKI_TAG_LIMITS = { maxTags: 10, maxLength: 30 } as const;

export type WikiOrganizationPage = {
  id: string;
  parentId: string | null;
  title: string;
  content: string;
  tags: string[];
};

export type WikiTreeNode<T extends WikiOrganizationPage> = T & {
  children: WikiTreeNode<T>[];
};

export function normalizeWikiTags(tags: string[]): string[] {
  const normalized: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim().toLocaleLowerCase("id-ID").replace(/\s+/g, "-").slice(0, WIKI_TAG_LIMITS.maxLength);
    if (!tag || normalized.includes(tag)) continue;
    normalized.push(tag);
    if (normalized.length === WIKI_TAG_LIMITS.maxTags) break;
  }
  return normalized;
}

export function buildWikiTree<T extends WikiOrganizationPage>(pages: T[]): WikiTreeNode<T>[] {
  const nodes = new Map<string, WikiTreeNode<T>>(
    pages.map((page) => [page.id, { ...page, children: [] }]),
  );
  const roots: WikiTreeNode<T>[] = [];
  for (const page of pages) {
    const node = nodes.get(page.id)!;
    const parent = page.parentId ? nodes.get(page.parentId) : null;
    if (parent && parent.id !== node.id) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

export function searchWikiPages<T extends WikiOrganizationPage>(pages: T[], query: string): T[] {
  const terms = query
    .trim()
    .toLocaleLowerCase("id-ID")
    .split(/\s+/)
    .filter(Boolean);
  if (terms.length === 0) return pages;
  return pages.filter((page) => {
    const haystack = [page.title, (page.tags ?? []).join(" "), htmlToWikiText(page.content)]
      .join(" ")
      .toLocaleLowerCase("id-ID");
    return terms.every((term) => haystack.includes(term));
  });
}

/**
 * Cuplikan teks di sekitar kata pertama yang cocok, untuk daftar hasil pencarian.
 * `query` dipecah per kata seperti `searchWikiPages` agar keduanya konsisten.
 */
export function wikiSearchSnippet(html: string, query: string, radius = 60): string {
  const text = htmlToWikiText(html).replace(/\s+/g, " ").trim();
  if (!text) return "";
  const terms = query.trim().toLocaleLowerCase("id-ID").split(/\s+/).filter(Boolean);
  const lower = text.toLocaleLowerCase("id-ID");
  let index = -1;
  for (const term of terms) {
    const found = lower.indexOf(term);
    if (found !== -1 && (index === -1 || found < index)) index = found;
  }
  if (index === -1) return text.slice(0, radius * 2) + (text.length > radius * 2 ? "…" : "");
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + radius);
  return (
    (start > 0 ? "…" : "") + text.slice(start, end).trim() + (end < text.length ? "…" : "")
  );
}

export function findWikiBacklinks<T extends WikiOrganizationPage>(pages: T[], targetId: string): T[] {
  const encodedId = targetId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`href=["']#wiki-page-${encodedId}["']`, "i");
  return pages.filter((page) => page.id !== targetId && pattern.test(page.content));
}
