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
    const haystack = [page.title, page.tags.join(" "), htmlToWikiText(page.content)]
      .join(" ")
      .toLocaleLowerCase("id-ID");
    return terms.every((term) => haystack.includes(term));
  });
}

export function findWikiBacklinks<T extends WikiOrganizationPage>(pages: T[], targetId: string): T[] {
  const encodedId = targetId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`href=["']#wiki-page-${encodedId}["']`, "i");
  return pages.filter((page) => page.id !== targetId && pattern.test(page.content));
}
