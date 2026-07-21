import { Extension, type Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode, NodeSpec } from "@tiptap/pm/model";
import { Plugin } from "@tiptap/pm/state";
import { TextSelection } from "@tiptap/pm/state";
import { selectionCell, TableMap } from "@tiptap/pm/tables";

function tableRole(node: ProseMirrorNode): string | undefined {
  return (node.type.spec as NodeSpec & { tableRole?: string }).tableRole;
}

/** Pindah baris/kolom hanya untuk tabel tanpa merge — cell gabungan membuat grid ambigu. */
export function tableHasMergedCells(table: ProseMirrorNode): boolean {
  let merged = false;
  table.descendants((node) => {
    const role = tableRole(node);
    if (role === "cell" || role === "header_cell") {
      const colspan = Number(node.attrs.colspan ?? 1);
      const rowspan = Number(node.attrs.rowspan ?? 1);
      if (colspan > 1 || rowspan > 1) merged = true;
      return false;
    }
    return !merged;
  });
  return merged;
}

/** Susun ulang baris tabel; `to` adalah index tujuan setelah baris diambil. */
export function moveTableRowNode(
  table: ProseMirrorNode,
  from: number,
  to: number,
): ProseMirrorNode | null {
  const count = table.childCount;
  if (from === to || from < 0 || to < 0 || from >= count || to >= count) return null;
  if (tableHasMergedCells(table)) return null;
  const rows: ProseMirrorNode[] = [];
  table.forEach((row) => rows.push(row));
  const [moved] = rows.splice(from, 1);
  rows.splice(to, 0, moved);
  return table.type.create(table.attrs, rows, table.marks);
}

/** Susun ulang kolom tabel dengan memindahkan cell pada index yang sama di tiap baris. */
export function moveTableColumnNode(
  table: ProseMirrorNode,
  from: number,
  to: number,
): ProseMirrorNode | null {
  if (from === to || from < 0 || to < 0) return null;
  if (tableHasMergedCells(table)) return null;
  const width = TableMap.get(table).width;
  if (from >= width || to >= width) return null;
  const rows: ProseMirrorNode[] = [];
  let valid = true;
  table.forEach((row) => {
    const cells: ProseMirrorNode[] = [];
    row.forEach((cell) => cells.push(cell));
    if (cells.length !== width) {
      valid = false;
      return;
    }
    const [moved] = cells.splice(from, 1);
    cells.splice(to, 0, moved);
    rows.push(row.type.create(row.attrs, cells, row.marks));
  });
  if (!valid) return null;
  return table.type.create(table.attrs, rows, table.marks);
}

function dispatchTableReplace(
  editor: Editor,
  tablePos: number,
  table: ProseMirrorNode,
  nextTable: ProseMirrorNode | null,
): boolean {
  if (!nextTable) return false;
  const { tr } = editor.state;
  const selectionPos = editor.state.selection.from;
  tr.replaceWith(tablePos, tablePos + table.nodeSize, nextTable);
  const $pos = tr.doc.resolve(Math.min(selectionPos, tr.doc.content.size));
  tr.setSelection(TextSelection.near($pos));
  editor.view.dispatch(tr);
  return true;
}

/** Pindahkan baris/kolom pada tabel di posisi dokumen tertentu (dipakai drag handle). */
export function moveTableRowAt(
  editor: Editor,
  tablePos: number,
  from: number,
  to: number,
): boolean {
  const table = editor.state.doc.nodeAt(tablePos);
  if (!table || tableRole(table) !== "table") return false;
  return dispatchTableReplace(editor, tablePos, table, moveTableRowNode(table, from, to));
}

export function moveTableColumnAt(
  editor: Editor,
  tablePos: number,
  from: number,
  to: number,
): boolean {
  const table = editor.state.doc.nodeAt(tablePos);
  if (!table || tableRole(table) !== "table") return false;
  return dispatchTableReplace(editor, tablePos, table, moveTableColumnNode(table, from, to));
}

function activeTableContext(editor: Editor) {
  const $cell = selectionCell(editor.state);
  const table = $cell.node(-1);
  const tableStart = $cell.start(-1);
  const map = TableMap.get(table);
  const rect = map.findCell($cell.pos - tableStart);
  return { table, tablePos: tableStart - 1, row: rect.top, column: rect.left };
}

/** Tombol toolbar: geser baris aktif ke atas/bawah. */
export function moveActiveTableRow(editor: Editor, direction: -1 | 1): boolean {
  if (!editor.isActive("table")) return false;
  const { table, tablePos, row } = activeTableContext(editor);
  return dispatchTableReplace(
    editor,
    tablePos,
    table,
    moveTableRowNode(table, row, row + direction),
  );
}

/** Tombol toolbar: geser kolom aktif ke kiri/kanan. */
export function moveActiveTableColumn(editor: Editor, direction: -1 | 1): boolean {
  if (!editor.isActive("table")) return false;
  const { table, tablePos, column } = activeTableContext(editor);
  return dispatchTableReplace(
    editor,
    tablePos,
    table,
    moveTableColumnNode(table, column, column + direction),
  );
}

type DragState = {
  axis: "row" | "column";
  tableEl: HTMLTableElement;
  tablePos: number;
  from: number;
  to: number;
};

function domRows(tableEl: HTMLTableElement): HTMLTableRowElement[] {
  return Array.from(tableEl.querySelectorAll<HTMLTableRowElement>("tr"));
}

function domTableHasMergedCells(tableEl: HTMLTableElement): boolean {
  return Boolean(
    tableEl.querySelector(
      '[rowspan]:not([rowspan="1"]), [colspan]:not([colspan="1"])',
    ),
  );
}

function tablePosFromDom(editor: Editor, tableEl: HTMLTableElement): number | null {
  // posAtDOM pada offset 0 mengarah tepat setelah pembuka node tabel.
  const inside = editor.view.posAtDOM(tableEl, 0);
  for (const candidate of [inside - 1, inside]) {
    if (candidate < 0) continue;
    const node = editor.state.doc.nodeAt(candidate);
    if (node && tableRole(node) === "table") return candidate;
  }
  return null;
}

/**
 * Handle drag ala Google Docs: hover tabel memunculkan grip di kiri baris dan
 * atas kolom; drag grip memindahkan seluruh baris/kolom beserta isinya.
 * Resize (drag tepi cell) dari `tiptap-table-resize.ts` tetap berlaku — grip
 * ini berada di luar area cell sehingga keduanya tidak bentrok.
 */
export const TableMoveHandles = Extension.create({
  name: "tableMoveHandles",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        view: (editorView) => {
          // Grip dipasang fixed di body: saat plugin dibuat, parent editor masih
          // elemen sementara Tiptap sehingga positioning relatif tidak andal.
          const rowGrip = document.createElement("button");
          rowGrip.type = "button";
          rowGrip.className = "wiki-table-grip";
          rowGrip.dataset.axis = "row";
          rowGrip.setAttribute("aria-label", "Seret untuk memindahkan baris");
          rowGrip.title = "Seret untuk memindahkan baris";
          const colGrip = document.createElement("button");
          colGrip.type = "button";
          colGrip.className = "wiki-table-grip";
          colGrip.dataset.axis = "column";
          colGrip.setAttribute("aria-label", "Seret untuk memindahkan kolom");
          colGrip.title = "Seret untuk memindahkan kolom";
          const indicator = document.createElement("div");
          indicator.className = "wiki-table-drop-indicator";
          document.body.append(rowGrip, colGrip, indicator);

          let hovered: { tableEl: HTMLTableElement; row: number; column: number } | null = null;
          let drag: DragState | null = null;
          let removeDragListeners: (() => void) | null = null;

          const hideGrips = () => {
            rowGrip.style.display = "none";
            colGrip.style.display = "none";
          };
          hideGrips();
          indicator.style.display = "none";

          const positionGrips = () => {
            if (!hovered) return;
            const tableRect = hovered.tableEl.getBoundingClientRect();
            const rows = domRows(hovered.tableEl);
            const rowEl = rows[hovered.row];
            const cellEl = rowEl?.cells[hovered.column];
            if (!rowEl || !cellEl) {
              hideGrips();
              return;
            }
            const rowRect = rowEl.getBoundingClientRect();
            const cellRect = cellEl.getBoundingClientRect();
            rowGrip.style.display = "flex";
            rowGrip.style.left = `${tableRect.left - 24}px`;
            rowGrip.style.top = `${rowRect.top + rowRect.height / 2 - 10}px`;
            colGrip.style.display = "flex";
            colGrip.style.left = `${cellRect.left + cellRect.width / 2 - 10}px`;
            colGrip.style.top = `${tableRect.top - 24}px`;
          };

          const onEditorMouseMove = (event: MouseEvent) => {
            if (drag) return;
            if (!editorView.editable) {
              hovered = null;
              hideGrips();
              return;
            }
            const target = event.target instanceof HTMLElement ? event.target : null;
            const cellEl = target?.closest<HTMLTableCellElement>("td, th");
            const tableEl = cellEl?.closest("table");
            const rowEl = cellEl?.closest("tr");
            if (!cellEl || !tableEl || !rowEl || domTableHasMergedCells(tableEl)) {
              hovered = null;
              hideGrips();
              return;
            }
            hovered = {
              tableEl,
              row: domRows(tableEl).indexOf(rowEl),
              column: cellEl.cellIndex,
            };
            positionGrips();
          };

          const onEditorMouseLeave = (event: MouseEvent) => {
            if (drag) return;
            const next = event.relatedTarget instanceof HTMLElement ? event.relatedTarget : null;
            if (next && (next === rowGrip || next === colGrip)) return;
            hovered = null;
            hideGrips();
          };

          const paintIndicator = () => {
            if (!drag) return;
            const tableRect = drag.tableEl.getBoundingClientRect();
            indicator.style.display = "block";
            if (drag.axis === "row") {
              const rowEl = domRows(drag.tableEl)[drag.to];
              if (!rowEl) return;
              const rect = rowEl.getBoundingClientRect();
              indicator.style.left = `${tableRect.left}px`;
              indicator.style.width = `${tableRect.width}px`;
              indicator.style.top = `${rect.top}px`;
              indicator.style.height = `${rect.height}px`;
            } else {
              const firstRow = domRows(drag.tableEl)[0];
              const cellEl = firstRow?.cells[drag.to];
              if (!cellEl) return;
              const rect = cellEl.getBoundingClientRect();
              indicator.style.left = `${rect.left}px`;
              indicator.style.width = `${rect.width}px`;
              indicator.style.top = `${tableRect.top}px`;
              indicator.style.height = `${tableRect.height}px`;
            }
          };

          const startDrag = (axis: "row" | "column") => (event: MouseEvent) => {
            if (event.button !== 0 || !hovered || !editorView.editable) return;
            const tablePos = tablePosFromDom(this.editor, hovered.tableEl);
            if (tablePos == null) return;
            event.preventDefault();
            drag = {
              axis,
              tableEl: hovered.tableEl,
              tablePos,
              from: axis === "row" ? hovered.row : hovered.column,
              to: axis === "row" ? hovered.row : hovered.column,
            };
            const previousCursor = document.body.style.cursor;
            const previousUserSelect = document.body.style.userSelect;
            document.body.style.cursor = "grabbing";
            document.body.style.userSelect = "none";
            paintIndicator();

            const onDrag = (moveEvent: MouseEvent) => {
              if (!drag) return;
              const under = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
              const cellEl = under instanceof Element
                ? under.closest<HTMLTableCellElement>("td, th")
                : null;
              const rowEl = cellEl?.closest("tr");
              if (!cellEl || !rowEl || cellEl.closest("table") !== drag.tableEl) return;
              drag.to = drag.axis === "row"
                ? domRows(drag.tableEl).indexOf(rowEl)
                : cellEl.cellIndex;
              paintIndicator();
            };
            const cleanup = () => {
              document.removeEventListener("mousemove", onDrag);
              document.removeEventListener("mouseup", onDrop);
              removeDragListeners = null;
              document.body.style.cursor = previousCursor;
              document.body.style.userSelect = previousUserSelect;
              indicator.style.display = "none";
              drag = null;
            };
            const onDrop = () => {
              if (drag && drag.to !== drag.from) {
                if (drag.axis === "row") {
                  moveTableRowAt(this.editor, drag.tablePos, drag.from, drag.to);
                } else {
                  moveTableColumnAt(this.editor, drag.tablePos, drag.from, drag.to);
                }
              }
              cleanup();
              hideGrips();
            };
            removeDragListeners = cleanup;
            document.addEventListener("mousemove", onDrag);
            document.addEventListener("mouseup", onDrop);
          };

          const onRowGripDown = startDrag("row");
          const onColGripDown = startDrag("column");
          rowGrip.addEventListener("mousedown", onRowGripDown);
          colGrip.addEventListener("mousedown", onColGripDown);
          editorView.dom.addEventListener("mousemove", onEditorMouseMove);
          editorView.dom.addEventListener("mouseleave", onEditorMouseLeave);

          return {
            destroy: () => {
              removeDragListeners?.();
              editorView.dom.removeEventListener("mousemove", onEditorMouseMove);
              editorView.dom.removeEventListener("mouseleave", onEditorMouseLeave);
              rowGrip.removeEventListener("mousedown", onRowGripDown);
              colGrip.removeEventListener("mousedown", onColGripDown);
              rowGrip.remove();
              colGrip.remove();
              indicator.remove();
            },
          };
        },
      }),
    ];
  },
});
