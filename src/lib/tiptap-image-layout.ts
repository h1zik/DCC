import Image from "@tiptap/extension-image";

export const WIKI_IMAGE_ALIGNMENTS = ["left", "center", "right"] as const;

export type WikiImageAlignment = (typeof WIKI_IMAGE_ALIGNMENTS)[number];

export function normalizeWikiImageAlignment(value: unknown): WikiImageAlignment {
  return WIKI_IMAGE_ALIGNMENTS.includes(value as WikiImageAlignment)
    ? (value as WikiImageAlignment)
    : "center";
}

/** Image Tiptap dengan alignment persisten dan fallback center untuk dokumen lama. */
export const ResizableWikiImage = Image.extend({
  addAttributes() {
    return {
      ...(this.parent?.() ?? {}),
      alignment: {
        default: "center",
        parseHTML: (element: HTMLElement) =>
          normalizeWikiImageAlignment(element.getAttribute("data-align")),
        renderHTML: (attributes: { alignment?: unknown }) => ({
          "data-align": normalizeWikiImageAlignment(attributes.alignment),
        }),
      },
    };
  },
});
