import { mergeAttributes, Node } from "@tiptap/core";

export const WIKI_CALLOUT_VARIANTS = ["info", "tip", "warning", "danger"] as const;
export type WikiCalloutVariant = (typeof WIKI_CALLOUT_VARIANTS)[number];

export function normalizeCalloutVariant(value: unknown): WikiCalloutVariant {
  return WIKI_CALLOUT_VARIANTS.includes(value as WikiCalloutVariant)
    ? (value as WikiCalloutVariant)
    : "info";
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (attributes?: { variant?: WikiCalloutVariant }) => ReturnType;
      toggleCallout: (attributes?: { variant?: WikiCalloutVariant }) => ReturnType;
      unsetCallout: () => ReturnType;
      updateCalloutVariant: (variant: WikiCalloutVariant) => ReturnType;
    };
  }
}

/**
 * Blok callout ala Notion: `div[data-type="callout"][data-variant=…]`.
 * Ikon dirender via CSS (globals.css) sehingga HTML round-trip tanpa cleanup.
 */
export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      variant: {
        default: "info",
        parseHTML: (element) => normalizeCalloutVariant(element.getAttribute("data-variant")),
        renderHTML: (attributes) => ({
          "data-variant": normalizeCalloutVariant(attributes.variant),
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="callout"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "callout", class: "wiki-callout" }),
      0,
    ];
  },

  addCommands() {
    return {
      setCallout:
        (attributes) =>
        ({ commands }) =>
          commands.wrapIn(this.name, { variant: attributes?.variant ?? "info" }),
      toggleCallout:
        (attributes) =>
        ({ commands }) =>
          commands.toggleWrap(this.name, { variant: attributes?.variant ?? "info" }),
      unsetCallout:
        () =>
        ({ commands }) =>
          commands.lift(this.name),
      updateCalloutVariant:
        (variant) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, { variant: normalizeCalloutVariant(variant) }),
    };
  },

  addKeyboardShortcuts() {
    return {
      // Escape hatch: keluar dari callout ke paragraf baru setelahnya.
      "Mod-Enter": () => {
        if (!this.editor.isActive(this.name)) return false;
        const { state } = this.editor;
        for (let depth = state.selection.$from.depth; depth > 0; depth -= 1) {
          if (state.selection.$from.node(depth).type.name !== this.name) continue;
          const after = state.selection.$from.after(depth);
          return this.editor
            .chain()
            .insertContentAt(after, { type: "paragraph" })
            .focus(after + 1)
            .run();
        }
        return false;
      },
    };
  },
});
