import { describe, expect, it } from "vitest";
import {
  buildWikiTree,
  findWikiBacklinks,
  normalizeWikiTags,
  searchWikiPages,
} from "@/lib/wiki-organization";

const pages = [
  { id: "root", parentId: null, title: "Strategi", content: "<p>Target pasar</p>", tags: ["brand"] },
  { id: "child", parentId: "root", title: "Riset", content: '<p><a href="#wiki-page-root">Strategi</a></p>', tags: ["riset"] },
  { id: "orphan", parentId: "missing", title: "Catatan", content: "", tags: [] },
];

describe("Wiki organization", () => {
  it("membangun tree dan menjaga orphan di root", () => {
    const tree = buildWikiTree(pages);
    expect(tree.map((node) => node.id)).toEqual(["root", "orphan"]);
    expect(tree[0].children[0].id).toBe("child");
  });

  it("mencari judul, isi, dan tag dengan semua kata", () => {
    expect(searchWikiPages(pages, "target brand").map((page) => page.id)).toEqual(["root"]);
    expect(searchWikiPages(pages, "riset").map((page) => page.id)).toEqual(["child"]);
  });

  it("menemukan backlink internal stabil", () => {
    expect(findWikiBacklinks(pages, "root").map((page) => page.id)).toEqual(["child"]);
  });

  it("menormalisasi dan membatasi tag", () => {
    expect(normalizeWikiTags([" Brand Strategy ", "brand strategy", "Riset Pasar"])).toEqual([
      "brand-strategy",
      "riset-pasar",
    ]);
  });
});
