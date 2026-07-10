import { describe, expect, it } from "vitest";
import {
  cleanRichTextPasteHtml,
  filterWikiSlashCommands,
  normalizeWikiEmbedUrl,
} from "@/lib/wiki-editor";

describe("wiki slash commands", () => {
  it("mencari label dan sinonim", () => {
    expect(filterWikiSlashCommands("check").map((item) => item.id)).toContain("taskList");
    expect(filterWikiSlashCommands("youtube").map((item) => item.id)).toEqual(["embed"]);
  });

  it("menampilkan seluruh command untuk query kosong", () => {
    expect(filterWikiSlashCommands("").length).toBeGreaterThan(10);
  });
});

describe("normalizeWikiEmbedUrl", () => {
  it("menambahkan https untuk hostname", () => {
    expect(normalizeWikiEmbedUrl("youtube.com/watch?v=abc")).toBe(
      "https://youtube.com/watch?v=abc",
    );
  });

  it("menolak protokol yang tidak aman", () => {
    expect(normalizeWikiEmbedUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeWikiEmbedUrl("data:text/html,bad")).toBeNull();
  });
});

describe("cleanRichTextPasteHtml", () => {
  it("membuang metadata Word tetapi menjaga format semantik", () => {
    const result = cleanRichTextPasteHtml(
      '<!--StartFragment--><p class="MsoNormal" style="mso-margin-top-alt:auto;font-weight:700;font-family:Arial"><strong>Halo</strong></p>',
    );
    expect(result).not.toContain("MsoNormal");
    expect(result).not.toContain("mso-");
    expect(result).not.toContain("font-family");
    expect(result).toContain("font-weight:700");
    expect(result).toContain("<strong>Halo</strong>");
  });
});
