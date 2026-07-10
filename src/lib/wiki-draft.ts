export type WikiDraft = {
  pageId: string;
  title: string;
  content: string;
  baseRevision: number;
  savedAt: string;
};

export function wikiDraftStorageKey(pageId: string): string {
  return `dcc:wiki-draft:${pageId}`;
}

export function parseWikiDraft(raw: string | null, pageId: string): WikiDraft | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<WikiDraft>;
    if (
      value.pageId !== pageId ||
      typeof value.title !== "string" ||
      typeof value.content !== "string" ||
      typeof value.baseRevision !== "number" ||
      !Number.isInteger(value.baseRevision) ||
      typeof value.savedAt !== "string" ||
      !Number.isFinite(Date.parse(value.savedAt))
    ) {
      return null;
    }
    return value as WikiDraft;
  } catch {
    return null;
  }
}

export function shouldRecoverWikiDraft(
  draft: WikiDraft,
  server: { title: string; content: string; updatedAt: string },
): boolean {
  if (draft.title === server.title && draft.content === server.content) return false;
  return Date.parse(draft.savedAt) >= Date.parse(server.updatedAt);
}

export type WikiDiffSegment = { kind: "same" | "added" | "removed"; text: string };

export function htmlToWikiText(html: string): string {
  return html
    .replace(/<\/(p|div|h[1-6]|li|blockquote|pre|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Word diff LCS yang dibatasi agar dialog history tetap responsif. */
export function diffWikiText(beforeHtml: string, afterHtml: string): WikiDiffSegment[] {
  const before = htmlToWikiText(beforeHtml).split(/(\s+)/).filter(Boolean);
  const after = htmlToWikiText(afterHtml).split(/(\s+)/).filter(Boolean);
  if (before.length * after.length > 250_000) {
    return [
      { kind: "removed", text: before.join("") },
      { kind: "added", text: after.join("") },
    ];
  }
  const table = Array.from({ length: before.length + 1 }, () =>
    new Uint16Array(after.length + 1),
  );
  for (let i = before.length - 1; i >= 0; i -= 1) {
    for (let j = after.length - 1; j >= 0; j -= 1) {
      table[i][j] =
        before[i] === after[j]
          ? table[i + 1][j + 1] + 1
          : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const result: WikiDiffSegment[] = [];
  const push = (kind: WikiDiffSegment["kind"], text: string) => {
    const last = result.at(-1);
    if (last?.kind === kind) last.text += text;
    else result.push({ kind, text });
  };
  let i = 0;
  let j = 0;
  while (i < before.length || j < after.length) {
    if (i < before.length && j < after.length && before[i] === after[j]) {
      push("same", before[i]);
      i += 1;
      j += 1;
    } else if (j < after.length && (i === before.length || table[i][j + 1] >= table[i + 1][j])) {
      push("added", after[j]);
      j += 1;
    } else {
      push("removed", before[i]);
      i += 1;
    }
  }
  return result;
}
