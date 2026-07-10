import { mergeAttributes, Node } from "@tiptap/core";

/**
 * Block lampiran yang tetap tersimpan sebagai HTML portabel. Atribut dibatasi
 * ke metadata presentasi; otorisasi download tetap ditangani route `/uploads`.
 */
export const WikiFile = Node.create({
  name: "wikiFile",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      href: { default: null },
      name: { default: "Lampiran" },
      mimeType: { default: "application/octet-stream" },
      size: { default: 0 },
    };
  },

  parseHTML() {
    return [{ tag: "a[data-wiki-file]" }];
  },

  renderHTML({ HTMLAttributes }) {
    const size = Number(HTMLAttributes.size) || 0;
    return [
      "a",
      mergeAttributes(HTMLAttributes, {
        "data-wiki-file": "true",
        href: HTMLAttributes.href,
        target: "_blank",
        rel: "noopener noreferrer",
        class: "wiki-file-node",
      }),
      ["span", { class: "wiki-file-node__icon", "aria-hidden": "true" }, "↧"],
      [
        "span",
        { class: "wiki-file-node__body" },
        ["strong", { class: "wiki-file-node__name" }, HTMLAttributes.name],
        [
          "span",
          { class: "wiki-file-node__meta" },
          `${HTMLAttributes.mimeType || "File"}${size > 0 ? ` · ${formatBytes(size)}` : ""}`,
        ],
      ],
    ];
  },
});

/** Preview tautan generik tanpa mengambil metadata pihak ketiga di server. */
export const WikiEmbed = Node.create({
  name: "wikiEmbed",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      href: { default: null },
      title: { default: "Tautan" },
    };
  },

  parseHTML() {
    return [{ tag: "a[data-wiki-embed]" }];
  },

  renderHTML({ HTMLAttributes }) {
    let host = "Tautan eksternal";
    try {
      host = new URL(String(HTMLAttributes.href)).hostname;
    } catch {
      // URL lama yang tidak valid tetap dirender sebagai tautan biasa.
    }
    return [
      "a",
      mergeAttributes(HTMLAttributes, {
        "data-wiki-embed": "true",
        href: HTMLAttributes.href,
        target: "_blank",
        rel: "noopener noreferrer",
        class: "wiki-embed-node",
      }),
      ["strong", {}, HTMLAttributes.title || host],
      ["span", {}, host],
    ];
  },
});

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
