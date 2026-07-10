import { describe, expect, it } from "vitest";
import {
  normalizeWikiImageAlignment,
  WIKI_IMAGE_ALIGNMENTS,
} from "@/lib/tiptap-image-layout";

describe("Wiki image layout", () => {
  it("mendukung alignment kiri, tengah, dan kanan", () => {
    expect(WIKI_IMAGE_ALIGNMENTS).toEqual(["left", "center", "right"]);
    expect(normalizeWikiImageAlignment("left")).toBe("left");
    expect(normalizeWikiImageAlignment("right")).toBe("right");
  });

  it("mempertahankan kompatibilitas gambar lama dengan default center", () => {
    expect(normalizeWikiImageAlignment(undefined)).toBe("center");
    expect(normalizeWikiImageAlignment("invalid")).toBe("center");
  });
});
