import type { Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode, ResolvedPos } from "@tiptap/pm/model";
import { CellSelection, deleteCellSelection, TableMap } from "@tiptap/pm/tables";

export type TableHoverContext = {
  /** Posisi node tabel di dokumen. */
  tablePos: number;
  rowIndex: number;
  colIndex: number;
  rowCount: number;
  colCount: number;
  tableEl: HTMLTableElement;
  /** `.tableWrapper` (punya overflow-x) — acuan clipping grip kolom. */
  wrapperEl: HTMLElement;
  cellEl: HTMLTableCellElement;
  rowEl: HTMLTableRowElement;
};

function tableRoleOf(node: ProseMirrorNode | null | undefined): string | undefined {
  return (node?.type.spec as { tableRole?: string } | undefined)?.tableRole;
}

function findDepthByRole($pos: ResolvedPos, roles: string[]): number | null {
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const role = tableRoleOf($pos.node(depth));
    if (role && roles.includes(role)) return depth;
  }
  return null;
}

/**
 * Resolve elemen DOM (target hover) menjadi konteks tabel ProseMirror.
 * Aman untuk merged cell: index kolom diambil dari TableMap, bukan posisi DOM.
 */
export function getTableHoverContext(
  editor: Editor,
  target: Element,
): TableHoverContext | null {
  const cellEl = target.closest<HTMLTableCellElement>("td, th");
  const rowEl = cellEl?.closest("tr");
  const tableEl = cellEl?.closest("table");
  const wrapperEl = tableEl?.closest<HTMLElement>(".tableWrapper");
  if (!cellEl || !rowEl || !tableEl || !wrapperEl) return null;
  if (!editor.view.dom.contains(cellEl)) return null;

  let inside: number;
  try {
    inside = editor.view.posAtDOM(cellEl, 0);
  } catch {
    return null;
  }
  if (inside < 0 || inside > editor.state.doc.content.size) return null;
  const $inside = editor.state.doc.resolve(inside);
  const cellDepth = findDepthByRole($inside, ["cell", "header_cell"]);
  const tableDepth = findDepthByRole($inside, ["table"]);
  if (cellDepth == null || tableDepth == null) return null;

  const table = $inside.node(tableDepth);
  const tableStart = $inside.start(tableDepth);
  const map = TableMap.get(table);
  const rect = map.findCell($inside.before(cellDepth) - tableStart);

  return {
    tablePos: tableStart - 1,
    rowIndex: rect.top,
    colIndex: rect.left,
    rowCount: map.height,
    colCount: map.width,
    tableEl,
    wrapperEl,
    cellEl,
    rowEl,
  };
}

function tableAt(editor: Editor, tablePos: number): ProseMirrorNode | null {
  const node = editor.state.doc.nodeAt(tablePos);
  return tableRoleOf(node) === "table" ? node : null;
}

/** Seleksi satu baris penuh (menyalakan overlay `.selectedCell`). */
export function selectTableRow(editor: Editor, tablePos: number, rowIndex: number): boolean {
  const table = tableAt(editor, tablePos);
  if (!table) return false;
  const map = TableMap.get(table);
  if (rowIndex < 0 || rowIndex >= map.height) return false;
  const $anchor = editor.state.doc.resolve(tablePos + 1 + map.map[rowIndex * map.width]);
  editor.view.dispatch(editor.state.tr.setSelection(CellSelection.rowSelection($anchor)));
  editor.view.focus();
  return true;
}

/** Seleksi satu kolom penuh. */
export function selectTableColumn(editor: Editor, tablePos: number, colIndex: number): boolean {
  const table = tableAt(editor, tablePos);
  if (!table) return false;
  const map = TableMap.get(table);
  if (colIndex < 0 || colIndex >= map.width) return false;
  const $anchor = editor.state.doc.resolve(tablePos + 1 + map.map[colIndex]);
  editor.view.dispatch(editor.state.tr.setSelection(CellSelection.colSelection($anchor)));
  editor.view.focus();
  return true;
}

function rowHasSpanIntersection(map: TableMap, rowIndex: number): boolean {
  for (let col = 0; col < map.width; col += 1) {
    const index = rowIndex * map.width + col;
    if (rowIndex > 0 && map.map[index] === map.map[index - map.width]) return true;
    if (rowIndex < map.height - 1 && map.map[index] === map.map[index + map.width]) return true;
  }
  return false;
}

function columnHasSpanIntersection(map: TableMap, colIndex: number): boolean {
  for (let row = 0; row < map.height; row += 1) {
    const index = row * map.width + colIndex;
    if (colIndex > 0 && map.map[index] === map.map[index - 1]) return true;
    if (colIndex < map.width - 1 && map.map[index] === map.map[index + 1]) return true;
    if (row > 0 && map.map[index] === map.map[index - map.width]) return true;
  }
  return false;
}

/**
 * Duplikat baris berikut isinya (termasuk attr `height`/`colwidth`).
 * Tabel dengan rowspan/colspan yang memotong baris ini jatuh ke fallback:
 * sisipkan baris kosong lewat perintah bawaan (posisi span tetap valid).
 */
export function duplicateTableRow(editor: Editor, tablePos: number, rowIndex: number): boolean {
  const table = tableAt(editor, tablePos);
  if (!table) return false;
  const map = TableMap.get(table);
  if (rowIndex < 0 || rowIndex >= map.height) return false;

  if (rowHasSpanIntersection(map, rowIndex)) {
    if (!selectTableRow(editor, tablePos, rowIndex)) return false;
    return editor.chain().focus().addRowAfter().run();
  }

  const row = table.child(rowIndex);
  let insertPos = tablePos + 1;
  for (let index = 0; index <= rowIndex; index += 1) {
    insertPos += table.child(index).nodeSize;
  }
  editor.view.dispatch(
    editor.state.tr.insert(insertPos, row.type.create(row.attrs, row.content)),
  );
  return true;
}

/** Duplikat kolom berikut isinya; fallback kolom kosong bila ada merged cell. */
export function duplicateTableColumn(editor: Editor, tablePos: number, colIndex: number): boolean {
  const table = tableAt(editor, tablePos);
  if (!table) return false;
  const map = TableMap.get(table);
  if (colIndex < 0 || colIndex >= map.width) return false;

  if (columnHasSpanIntersection(map, colIndex)) {
    if (!selectTableColumn(editor, tablePos, colIndex)) return false;
    return editor.chain().focus().addColumnAfter().run();
  }

  const transaction = editor.state.tr;
  for (let row = 0; row < map.height; row += 1) {
    const cellOffset = map.map[row * map.width + colIndex];
    const cell = table.nodeAt(cellOffset);
    if (!cell) continue;
    const insertPos = tablePos + 1 + cellOffset + cell.nodeSize;
    transaction.insert(
      transaction.mapping.map(insertPos),
      cell.type.create(cell.attrs, cell.content),
    );
  }
  if (!transaction.docChanged) return false;
  editor.view.dispatch(transaction);
  return true;
}

/** Kosongkan isi cell yang terseleksi (CellSelection) tanpa menghapus strukturnya. */
export function clearSelectedCells(editor: Editor): boolean {
  return editor
    .chain()
    .focus()
    .command(({ state, dispatch }) => deleteCellSelection(state, dispatch))
    .run();
}

/**
 * Tambah baris di paling bawah tabel (tombol "+" tepi bawah).
 * Seleksi cell di-dispatch nyata dulu (bukan lewat chain) supaya `addRowAfter`
 * membaca seleksi yang benar — persis pola jalur menu yang sudah bekerja.
 */
export function addRowAtEnd(editor: Editor, tablePos: number): boolean {
  const table = tableAt(editor, tablePos);
  if (!table) return false;
  const map = TableMap.get(table);
  const anchorCell = tablePos + 1 + map.map[map.width * map.height - 1];
  editor.view.dispatch(
    editor.state.tr.setSelection(CellSelection.create(editor.state.doc, anchorCell)),
  );
  return editor.chain().focus().addRowAfter().run();
}

/** Tambah kolom di paling kanan tabel (tombol "+" tepi kanan). */
export function addColumnAtEnd(editor: Editor, tablePos: number): boolean {
  const table = tableAt(editor, tablePos);
  if (!table) return false;
  const map = TableMap.get(table);
  const anchorCell = tablePos + 1 + map.map[map.width - 1];
  editor.view.dispatch(
    editor.state.tr.setSelection(CellSelection.create(editor.state.doc, anchorCell)),
  );
  return editor.chain().focus().addColumnAfter().run();
}
