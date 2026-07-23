import { Extension, type Editor } from "@tiptap/core";
import { TableRow, TableView } from "@tiptap/extension-table";
import type { Node as ProseMirrorNode, NodeSpec } from "@tiptap/pm/model";
import { Plugin } from "@tiptap/pm/state";
import { columnResizing, selectionCell, TableMap } from "@tiptap/pm/tables";

export const WIKI_TABLE_ROW_MIN_HEIGHT = 28;
export const WIKI_TABLE_COLUMN_MIN_WIDTH = 48;
export const WIKI_IMAGE_MIN_WIDTH = 80;
export const WIKI_TABLE_COLUMN_HANDLE_WIDTH = 16;

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.round(Math.min(max, Math.max(min, value)));
}

export function clampWikiTableRowHeight(value: number): number {
  return clampInteger(value, WIKI_TABLE_ROW_MIN_HEIGHT, 800);
}

export function clampWikiTableColumnWidth(value: number): number {
  return clampInteger(value, WIKI_TABLE_COLUMN_MIN_WIDTH, 1_200);
}

export function clampWikiImageWidth(value: number): number {
  return clampInteger(value, WIKI_IMAGE_MIN_WIDTH, 2_400);
}

function parseDimension(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function isTableRow(node: ProseMirrorNode | null | undefined): node is ProseMirrorNode {
  return (node?.type.spec as NodeSpec & { tableRole?: string } | undefined)?.tableRole === "row";
}

/** TableRow dengan tinggi persisten; tetap kompatibel dengan HTML tabel lama. */
export const ResizableTableRow = TableRow.extend({
  addAttributes() {
    return {
      ...(this.parent?.() ?? {}),
      height: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          parseDimension(
            element.getAttribute("data-row-height") ??
              element.getAttribute("height") ??
              element.style.height,
          ),
        renderHTML: (attributes: { height?: number | null }) => {
          if (!attributes.height) return {};
          const height = clampWikiTableRowHeight(attributes.height);
          return {
            "data-row-height": String(height),
            height: String(height),
            style: `height: ${height}px`,
          };
        },
      },
    };
  },
});

/**
 * Tiptap hanya memasang columnResizing jika editor editable saat dibuat.
 * Wiki mulai read-only sambil menunggu lock, jadi plugin harus selalu ada;
 * handler ProseMirror sendiri tetap menghormati `view.editable`.
 */
export function createWikiTableColumnResizePlugin() {
  return columnResizing({
    handleWidth: WIKI_TABLE_COLUMN_HANDLE_WIDTH,
    cellMinWidth: WIKI_TABLE_COLUMN_MIN_WIDTH,
    defaultCellMinWidth: WIKI_TABLE_COLUMN_MIN_WIDTH,
    lastColumnResizable: true,
    View: TableView,
  });
}

export const TableColumnResize = Extension.create({
  name: "tableColumnResize",

  addProseMirrorPlugins() {
    return [createWikiTableColumnResizePlugin()];
  },
});

function activeCellContext(editor: Editor) {
  const { state } = editor;
  const $cell = selectionCell(state);
  const table = $cell.node(-1);
  const tableStart = $cell.start(-1);
  const map = TableMap.get(table);
  const cellOffset = $cell.pos - tableStart;
  const column = map.colCount(cellOffset);
  return { $cell, table, tableStart, map, column };
}

export function getActiveTableRowHeight(editor: Editor): number | null {
  if (!editor.isActive("table")) return null;
  const { $cell } = activeCellContext(editor);
  const value = Number($cell.parent.attrs.height);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function setActiveTableRowHeight(editor: Editor, value: number | null): boolean {
  if (!editor.isActive("table")) return false;
  const { $cell } = activeCellContext(editor);
  const rowPosition = $cell.before();
  const row = editor.state.doc.nodeAt(rowPosition);
  if (!isTableRow(row)) return false;
  const height = value == null ? null : clampWikiTableRowHeight(value);
  editor.view.dispatch(
    editor.state.tr.setNodeMarkup(rowPosition, undefined, { ...row.attrs, height }),
  );
  return true;
}

export function getActiveTableColumnWidth(editor: Editor): number | null {
  if (!editor.isActive("table")) return null;
  const { table, map, column } = activeCellContext(editor);
  const cellOffset = map.map[column];
  const cell = table.nodeAt(cellOffset);
  if (!cell) return null;
  const index = cell.attrs.colspan === 1 ? 0 : column - map.colCount(cellOffset);
  const value = Number(cell.attrs.colwidth?.[index]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Set lebar satu kolom pada setiap cell/row, sama seperti drag bawaan ProseMirror. */
export function setActiveTableColumnWidth(editor: Editor, value: number | null): boolean {
  if (!editor.isActive("table")) return false;
  const { table, tableStart, map, column } = activeCellContext(editor);
  const transaction = editor.state.tr;
  const width = value == null ? 0 : clampWikiTableColumnWidth(value);

  for (let row = 0; row < map.height; row += 1) {
    const mapIndex = row * map.width + column;
    if (row > 0 && map.map[mapIndex] === map.map[mapIndex - map.width]) continue;
    const cellOffset = map.map[mapIndex];
    const cell = table.nodeAt(cellOffset);
    if (!cell) continue;
    const index = cell.attrs.colspan === 1 ? 0 : column - map.colCount(cellOffset);
    const colwidth: number[] = cell.attrs.colwidth
      ? [...cell.attrs.colwidth]
      : Array.from({ length: cell.attrs.colspan }, () => 0);
    colwidth[index] = width;
    transaction.setNodeMarkup(tableStart + cellOffset, undefined, {
      ...cell.attrs,
      colwidth: colwidth.every((item) => item === 0) ? null : colwidth,
    });
  }

  if (!transaction.docChanged) return false;
  editor.view.dispatch(transaction);
  return true;
}

function rowPositionFromDom(editor: Editor, row: HTMLTableRowElement): number | null {
  const contentPosition = editor.view.posAtDOM(row, 0);
  for (const candidate of [contentPosition - 1, contentPosition]) {
    if (isTableRow(editor.state.doc.nodeAt(candidate))) return candidate;
  }
  return null;
}

/** Drag garis bawah row untuk mengubah tinggi seperti spreadsheet/Google Docs. */
export const TableRowResize = Extension.create({
  name: "tableRowResize",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        view: (editorView) => {
          let hoveredRow: HTMLTableRowElement | null = null;
          let removeDragListeners: (() => void) | null = null;
          let animationFrame: number | null = null;

          const clearHoveredRow = () => {
            hoveredRow?.removeAttribute("data-row-resize-hover");
            hoveredRow = null;
            if (editorView.dom.style.cursor === "row-resize") {
              editorView.dom.style.cursor = "";
            }
          };

          const rowNearPointer = (event: MouseEvent) => {
            const target = event.target instanceof HTMLElement ? event.target : null;
            const cell = target?.closest<HTMLTableCellElement>("td, th");
            const row = cell?.closest<HTMLTableRowElement>("tr") ?? null;
            if (!row) return null;
            const rect = row.getBoundingClientRect();
            const cellRect = cell!.getBoundingClientRect();
            const nearBottom = Math.abs(rect.bottom - event.clientY) <= 8;
            const nearColumnHandle = Math.abs(cellRect.right - event.clientX) <= 9;
            return nearBottom && !nearColumnHandle ? row : null;
          };

          const onMouseMove = (event: MouseEvent) => {
            const row = rowNearPointer(event);
            if (row === hoveredRow) return;
            clearHoveredRow();
            if (row) {
              hoveredRow = row;
              row.setAttribute("data-row-resize-hover", "true");
              editorView.dom.style.cursor = "row-resize";
            }
          };

          const onMouseLeave = () => clearHoveredRow();

          const onMouseDown = (event: MouseEvent) => {
            if (event.button !== 0 || !editorView.editable) return;
            const row = rowNearPointer(event);
            if (!row) return;
            const rowPosition = rowPositionFromDom(this.editor, row);
            if (rowPosition == null) return;
            event.preventDefault();
            const startY = event.clientY;
            const startHeight = row.getBoundingClientRect().height;
            const previousInlineHeight = row.style.height;
            let nextHeight = clampWikiTableRowHeight(startHeight);
            row.setAttribute("data-row-resizing", "true");
            const previousCursor = document.body.style.cursor;
            const previousUserSelect = document.body.style.userSelect;
            document.body.style.cursor = "row-resize";
            document.body.style.userSelect = "none";

            const renderHeight = () => {
              animationFrame = null;
              row.style.height = `${nextHeight}px`;
              row.style.setProperty("--wiki-live-row-height", `${nextHeight}px`);
            };

            const onDrag = (moveEvent: MouseEvent) => {
              nextHeight = clampWikiTableRowHeight(startHeight + moveEvent.clientY - startY);
              if (animationFrame == null) animationFrame = requestAnimationFrame(renderHeight);
            };
            const onDrop = () => {
              document.removeEventListener("mousemove", onDrag);
              document.removeEventListener("mouseup", onDrop);
              removeDragListeners = null;
              if (animationFrame != null) cancelAnimationFrame(animationFrame);
              animationFrame = null;
              renderHeight();
              row.removeAttribute("data-row-resizing");
              document.body.style.cursor = previousCursor;
              document.body.style.userSelect = previousUserSelect;
              const node = this.editor.state.doc.nodeAt(rowPosition);
              if (isTableRow(node)) {
                this.editor.view.dispatch(
                  this.editor.state.tr.setNodeMarkup(rowPosition, undefined, {
                    ...node.attrs,
                    height: nextHeight,
                  }),
                );
              }
              row.style.removeProperty("--wiki-live-row-height");
            };
            removeDragListeners = () => {
              document.removeEventListener("mousemove", onDrag);
              document.removeEventListener("mouseup", onDrop);
              if (animationFrame != null) cancelAnimationFrame(animationFrame);
              animationFrame = null;
              row.removeAttribute("data-row-resizing");
              row.style.removeProperty("--wiki-live-row-height");
              row.style.height = previousInlineHeight;
              document.body.style.cursor = previousCursor;
              document.body.style.userSelect = previousUserSelect;
            };
            document.addEventListener("mousemove", onDrag);
            document.addEventListener("mouseup", onDrop);
          };

          editorView.dom.addEventListener("mousemove", onMouseMove);
          editorView.dom.addEventListener("mouseleave", onMouseLeave);
          editorView.dom.addEventListener("mousedown", onMouseDown);

          return {
            destroy: () => {
              removeDragListeners?.();
              clearHoveredRow();
              editorView.dom.removeEventListener("mousemove", onMouseMove);
              editorView.dom.removeEventListener("mouseleave", onMouseLeave);
              editorView.dom.removeEventListener("mousedown", onMouseDown);
            },
          };
        },
      }),
    ];
  },
});
