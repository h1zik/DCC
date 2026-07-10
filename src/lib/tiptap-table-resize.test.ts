import { describe, expect, it } from "vitest";
import type { Editor } from "@tiptap/core";
import { Schema, type NodeSpec } from "@tiptap/pm/model";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { tableNodes } from "@tiptap/pm/tables";
import {
  clampWikiImageWidth,
  clampWikiTableColumnWidth,
  clampWikiTableRowHeight,
  createWikiTableColumnResizePlugin,
  getActiveTableColumnWidth,
  getActiveTableRowHeight,
  setActiveTableColumnWidth,
  setActiveTableRowHeight,
} from "@/lib/tiptap-table-resize";

function createTableEditor(): Editor {
  const tableSpecs = tableNodes({
    tableGroup: "block",
    cellContent: "block+",
    cellAttributes: {},
  });
  const rowSpec = tableSpecs.table_row as NodeSpec;
  const schema = new Schema({
    nodes: {
      doc: { content: "block+" },
      paragraph: { content: "inline*", group: "block" },
      text: { group: "inline" },
      ...tableSpecs,
      table_row: {
        ...rowSpec,
        attrs: { ...(rowSpec.attrs ?? {}), height: { default: null } },
      },
    },
  });
  let state = EditorState.create({
    schema,
    doc: schema.nodeFromJSON({
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "table_row",
              content: [
                { type: "table_cell", content: [{ type: "paragraph" }] },
                { type: "table_cell", content: [{ type: "paragraph" }] },
              ],
            },
            {
              type: "table_row",
              content: [
                { type: "table_cell", content: [{ type: "paragraph" }] },
                { type: "table_cell", content: [{ type: "paragraph" }] },
              ],
            },
          ],
        },
      ],
    }),
  });
  state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 4)));

  const editor = {
    isActive: (name: string) => name === "table",
    view: {
      dispatch: (transaction: typeof state.tr) => {
        state = state.apply(transaction);
      },
    },
  } as unknown as Editor;
  Object.defineProperty(editor, "state", { get: () => state });
  return editor;
}

describe("Wiki editor dimensions", () => {
  it("menjaga tinggi row dalam batas yang usable", () => {
    expect(clampWikiTableRowHeight(4)).toBe(28);
    expect(clampWikiTableRowHeight(44.6)).toBe(45);
  });

  it("mengizinkan kolom diperkecil tanpa menjadi tak terlihat", () => {
    expect(clampWikiTableColumnWidth(10)).toBe(48);
    expect(clampWikiTableColumnWidth(96)).toBe(96);
  });

  it("membatasi ukuran gambar ekstrem", () => {
    expect(clampWikiImageWidth(1)).toBe(80);
    expect(clampWikiImageWidth(9_999)).toBe(2_400);
  });

  it("menyimpan tinggi row aktif dan dapat mengembalikannya ke otomatis", () => {
    const editor = createTableEditor();
    expect(setActiveTableRowHeight(editor, 52)).toBe(true);
    expect(getActiveTableRowHeight(editor)).toBe(52);
    expect(setActiveTableRowHeight(editor, null)).toBe(true);
    expect(getActiveTableRowHeight(editor)).toBeNull();
  });

  it("menerapkan lebar kolom aktif secara konsisten ke seluruh row", () => {
    const editor = createTableEditor();
    expect(setActiveTableColumnWidth(editor, 72)).toBe(true);
    expect(getActiveTableColumnWidth(editor)).toBe(72);

    const table = editor.state.doc.firstChild!;
    expect(table.child(0).child(0).attrs.colwidth).toEqual([72]);
    expect(table.child(1).child(0).attrs.colwidth).toEqual([72]);
  });

  it("selalu menyediakan handler drag kolom meski status editable berubah belakangan", () => {
    const plugin = createWikiTableColumnResizePlugin();
    expect(plugin.spec.props?.handleDOMEvents?.mousemove).toBeTypeOf("function");
    expect(plugin.spec.props?.handleDOMEvents?.mousedown).toBeTypeOf("function");
  });
});
