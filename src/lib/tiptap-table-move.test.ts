import { describe, expect, it } from "vitest";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Schema } from "@tiptap/pm/model";
import { tableNodes } from "@tiptap/pm/tables";
import {
  moveTableColumnNode,
  moveTableRowNode,
  tableHasMergedCells,
} from "@/lib/tiptap-table-move";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { content: "inline*", group: "block" },
    text: { group: "inline" },
    ...tableNodes({
      tableGroup: "block",
      cellContent: "block+",
      cellAttributes: {},
    }),
  },
});

function cell(text: string, attrs: Record<string, unknown> = {}) {
  return {
    type: "table_cell",
    attrs,
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}

function buildTable(rows: string[][]): ProseMirrorNode {
  return schema.nodeFromJSON({
    type: "table",
    content: rows.map((cells) => ({
      type: "table_row",
      content: cells.map((text) => cell(text)),
    })),
  });
}

function cellText(table: ProseMirrorNode, row: number, column: number): string {
  return table.child(row).child(column).textContent;
}

describe("moveTableRowNode", () => {
  it("memindahkan baris beserta seluruh isinya", () => {
    const table = buildTable([
      ["a1", "a2"],
      ["b1", "b2"],
      ["c1", "c2"],
    ]);
    const moved = moveTableRowNode(table, 0, 2)!;
    expect(cellText(moved, 0, 0)).toBe("b1");
    expect(cellText(moved, 1, 0)).toBe("c1");
    expect(cellText(moved, 2, 0)).toBe("a1");
    expect(cellText(moved, 2, 1)).toBe("a2");
  });

  it("menolak index di luar jangkauan atau tanpa perpindahan", () => {
    const table = buildTable([
      ["a1", "a2"],
      ["b1", "b2"],
    ]);
    expect(moveTableRowNode(table, 0, 0)).toBeNull();
    expect(moveTableRowNode(table, 0, 2)).toBeNull();
    expect(moveTableRowNode(table, -1, 0)).toBeNull();
  });
});

describe("moveTableColumnNode", () => {
  it("memindahkan cell pada index sama di setiap baris", () => {
    const table = buildTable([
      ["a1", "a2", "a3"],
      ["b1", "b2", "b3"],
    ]);
    const moved = moveTableColumnNode(table, 2, 0)!;
    expect(cellText(moved, 0, 0)).toBe("a3");
    expect(cellText(moved, 0, 1)).toBe("a1");
    expect(cellText(moved, 1, 0)).toBe("b3");
    expect(cellText(moved, 1, 2)).toBe("b2");
  });

  it("menolak index kolom di luar lebar tabel", () => {
    const table = buildTable([["a1", "a2"]]);
    expect(moveTableColumnNode(table, 0, 2)).toBeNull();
    expect(moveTableColumnNode(table, 1, 1)).toBeNull();
  });
});

describe("tableHasMergedCells", () => {
  it("mendeteksi colspan/rowspan dan membatalkan perpindahan", () => {
    const merged = schema.nodeFromJSON({
      type: "table",
      content: [
        { type: "table_row", content: [cell("a", { colspan: 2 })] },
        { type: "table_row", content: [cell("b"), cell("c")] },
      ],
    });
    expect(tableHasMergedCells(merged)).toBe(true);
    expect(moveTableRowNode(merged, 0, 1)).toBeNull();
    expect(moveTableColumnNode(merged, 0, 1)).toBeNull();

    const plain = buildTable([
      ["a", "b"],
      ["c", "d"],
    ]);
    expect(tableHasMergedCells(plain)).toBe(false);
  });
});
