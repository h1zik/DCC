import { describe, expect, it } from "vitest";
import {
  diffWikiText,
  parseWikiDraft,
  shouldRecoverWikiDraft,
  wikiDraftStorageKey,
} from "@/lib/wiki-draft";

describe("Wiki draft recovery", () => {
  it("memvalidasi payload dan namespace per halaman", () => {
    const raw = JSON.stringify({
      pageId: "page-1",
      title: "Draft",
      content: "<p>Isi</p>",
      baseRevision: 3,
      savedAt: "2026-07-10T04:00:00.000Z",
    });
    expect(parseWikiDraft(raw, "page-1")?.baseRevision).toBe(3);
    expect(parseWikiDraft(raw, "page-2")).toBeNull();
    expect(wikiDraftStorageKey("page-1")).toContain("page-1");
  });

  it("hanya memulihkan draft berbeda yang tidak lebih lama dari server", () => {
    const draft = parseWikiDraft(
      JSON.stringify({
        pageId: "p",
        title: "Lokal",
        content: "lokal",
        baseRevision: 1,
        savedAt: "2026-07-10T05:00:00.000Z",
      }),
      "p",
    )!;
    expect(
      shouldRecoverWikiDraft(draft, {
        title: "Server",
        content: "server",
        updatedAt: "2026-07-10T04:00:00.000Z",
      }),
    ).toBe(true);
  });
});

describe("Wiki version diff", () => {
  it("menandai kata tambah dan hapus", () => {
    const segments = diffWikiText("<p>Halo dunia</p>", "<p>Halo tim baru</p>");
    expect(segments.some((segment) => segment.kind === "removed" && segment.text.includes("dunia"))).toBe(true);
    expect(segments.some((segment) => segment.kind === "added" && segment.text.includes("tim"))).toBe(true);
  });
});
