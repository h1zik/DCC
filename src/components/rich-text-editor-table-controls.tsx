"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUpToLine,
  Copy,
  Eraser,
  GripHorizontal,
  GripVertical,
  PanelLeft,
  PanelTop,
  Plus,
  TableCellsMerge,
  TableCellsSplit,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  addColumnAtEnd,
  addRowAtEnd,
  clearSelectedCells,
  duplicateTableColumn,
  duplicateTableRow,
  getTableHoverContext,
  selectTableColumn,
  selectTableRow,
  type TableHoverContext,
} from "@/lib/tiptap-table-actions";
import { cn } from "@/lib/utils";

type Box = { left: number; top: number; width: number; height: number };

type OverlayGeometry = {
  table: Box;
  row: { top: number; height: number };
  col: { left: number; width: number };
  /** Grip kolom disembunyikan bila kolomnya ter-scroll keluar `.tableWrapper`. */
  colGripVisible: boolean;
  /** Batas kanan/lebar wrapper — clamp tombol "+" saat tabel overflow. */
  wrapper: { left: number; width: number };
};

type HoverState = { ctx: TableHoverContext; geo: OverlayGeometry };

const GRIP_KEEP_ALIVE_PX = 40;

/**
 * Overlay kontrol tabel ala Notion: grip baris/kolom dengan menu aksi dan
 * tombol "+" di tepi tabel. Hidup di luar DOM ProseMirror sehingga tidak
 * pernah ikut terserialisasi ke HTML.
 */
export function TableControlsOverlay({
  editor,
  editable,
}: {
  editor: Editor;
  editable: boolean;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState<HoverState | null>(null);
  const [rowMenuOpen, setRowMenuOpen] = useState(false);
  const [colMenuOpen, setColMenuOpen] = useState(false);

  const menuOpenRef = useRef(false);
  const hoverRef = useRef<HoverState | null>(null);
  useEffect(() => {
    menuOpenRef.current = rowMenuOpen || colMenuOpen;
    hoverRef.current = hover;
  }, [rowMenuOpen, colMenuOpen, hover]);

  const measure = useCallback((ctx: TableHoverContext): OverlayGeometry | null => {
    const root = rootRef.current;
    if (!root || !ctx.tableEl.isConnected) return null;
    // Selama drag-resize berlangsung, sembunyikan semua kontrol.
    if (
      ctx.tableEl.querySelector("tr[data-row-resizing]") ||
      ctx.tableEl.querySelector(".column-resize-dragging")
    ) {
      return null;
    }
    const rootRect = root.getBoundingClientRect();
    const tableRect = ctx.tableEl.getBoundingClientRect();
    const wrapperRect = ctx.wrapperEl.getBoundingClientRect();
    const rowRect = ctx.rowEl.getBoundingClientRect();
    const cellRect = ctx.cellEl.getBoundingClientRect();
    const colCenter = cellRect.left + cellRect.width / 2;
    return {
      table: {
        left: tableRect.left - rootRect.left,
        top: tableRect.top - rootRect.top,
        width: tableRect.width,
        height: tableRect.height,
      },
      row: { top: rowRect.top - rootRect.top, height: rowRect.height },
      col: { left: cellRect.left - rootRect.left, width: cellRect.width },
      colGripVisible:
        colCenter >= wrapperRect.left + 4 && colCenter <= wrapperRect.right - 4,
      wrapper: { left: wrapperRect.left - rootRect.left, width: wrapperRect.width },
    };
  }, []);

  /** Ambil ulang konteks dari DOM cell tersimpan — posisi doc bisa bergeser setelah transaksi. */
  const refreshContext = useCallback((): TableHoverContext | null => {
    const current = hoverRef.current;
    if (!current || !current.ctx.cellEl.isConnected) return null;
    return getTableHoverContext(editor, current.ctx.cellEl);
  }, [editor]);

  const remeasure = useCallback(() => {
    const ctx = refreshContext();
    if (!ctx) {
      if (hoverRef.current) setHover(null);
      return;
    }
    const geo = measure(ctx);
    setHover(geo ? { ctx, geo } : null);
  }, [measure, refreshContext]);

  useEffect(() => {
    if (!editable) return;

    let frame: number | null = null;
    let lastEvent: MouseEvent | null = null;

    const process = () => {
      frame = null;
      const event = lastEvent;
      if (!event || menuOpenRef.current) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      // Di atas kontrol overlay (grip / tombol +) → pertahankan hover.
      if (rootRef.current?.contains(target)) return;
      const ctx = getTableHoverContext(editor, target);
      if (ctx) {
        const geo = measure(ctx);
        setHover(geo ? { ctx, geo } : null);
        return;
      }
      // Di luar tabel: pertahankan selama kursor masih di zona keep-alive
      // (yang sudah mencakup grip di kiri/atas dan tombol + di kanan/bawah,
      // termasuk celah tipis di antara tepi tabel dan tombolnya). Clear hanya
      // saat kursor benar-benar menjauh — tanpa mouseleave yang menghapus dini.
      setHover((current) => {
        if (!current || !current.ctx.tableEl.isConnected) return null;
        const rect = current.ctx.tableEl.getBoundingClientRect();
        const within =
          event.clientX >= rect.left - GRIP_KEEP_ALIVE_PX &&
          event.clientX <= rect.right + GRIP_KEEP_ALIVE_PX &&
          event.clientY >= rect.top - GRIP_KEEP_ALIVE_PX &&
          event.clientY <= rect.bottom + GRIP_KEEP_ALIVE_PX;
        return within ? current : null;
      });
    };

    const onMouseMove = (event: MouseEvent) => {
      lastEvent = event;
      if (frame == null) frame = requestAnimationFrame(process);
    };
    const onScrollOrResize = () => {
      if (!hoverRef.current) return;
      if (frame == null) {
        frame = requestAnimationFrame(() => {
          frame = null;
          remeasure();
        });
      }
    };
    const onTransaction = () => {
      if (hoverRef.current) remeasure();
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    editor.on("transaction", onTransaction);
    return () => {
      if (frame != null) cancelAnimationFrame(frame);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
      editor.off("transaction", onTransaction);
    };
  }, [editable, editor, measure, remeasure]);

  const runAction = useCallback(
    (action: (ctx: TableHoverContext) => void) => {
      const ctx = refreshContext();
      setRowMenuOpen(false);
      setColMenuOpen(false);
      setHover(null); // geometri berubah — biarkan hover berikutnya menggambar ulang
      if (ctx) action(ctx);
    },
    [refreshContext],
  );

  const handleRowMenuOpenChange = useCallback(
    (open: boolean) => {
      setRowMenuOpen(open);
      if (!open) return;
      const ctx = refreshContext();
      if (ctx) selectTableRow(editor, ctx.tablePos, ctx.rowIndex);
    },
    [editor, refreshContext],
  );

  const handleColMenuOpenChange = useCallback(
    (open: boolean) => {
      setColMenuOpen(open);
      if (!open) return;
      const ctx = refreshContext();
      if (ctx) selectTableColumn(editor, ctx.tablePos, ctx.colIndex);
    },
    [editor, refreshContext],
  );

  if (!editable) return null;

  const geo = hover?.geo ?? null;
  const gripClass = cn(
    "pointer-events-auto absolute z-[5] flex items-center justify-center rounded-md border border-border bg-card text-muted-foreground shadow-sm transition-colors",
    "before:absolute before:-inset-1.5 before:content-['']",
    "hover:bg-muted hover:text-foreground data-popup-open:bg-primary/10 data-popup-open:text-primary",
  );
  const plusClass =
    "pointer-events-auto absolute z-[5] flex items-center justify-center rounded-md border border-dashed border-border bg-card/80 text-muted-foreground opacity-70 shadow-sm transition-all hover:border-solid hover:bg-muted hover:text-foreground hover:opacity-100";

  return (
    <div ref={rootRef} aria-hidden className="pointer-events-none absolute inset-0">
      {geo ? (
        <>
          {/* Grip baris */}
          <DropdownMenu open={rowMenuOpen} onOpenChange={handleRowMenuOpenChange}>
            <DropdownMenuTrigger
              title="Aksi baris"
              className={cn(gripClass, "h-6 w-[18px]")}
              style={{
                left: geo.table.left - 24,
                top: geo.row.top + geo.row.height / 2 - 12,
              }}
            >
              <GripVertical className="size-3.5" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="start">
              <DropdownMenuItem
                onClick={() => runAction(() => editor.chain().focus().addRowBefore().run())}
              >
                <ArrowUpToLine /> Sisipkan baris di atas
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => runAction(() => editor.chain().focus().addRowAfter().run())}
              >
                <ArrowDownToLine /> Sisipkan baris di bawah
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  runAction((ctx) => duplicateTableRow(editor, ctx.tablePos, ctx.rowIndex))
                }
              >
                <Copy /> Duplikat baris
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => runAction(() => editor.chain().focus().toggleHeaderRow().run())}
              >
                <PanelTop /> Toggle baris header
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!editor.can().mergeCells()}
                onClick={() => runAction(() => editor.chain().focus().mergeCells().run())}
              >
                <TableCellsMerge /> Gabungkan cell
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!editor.can().splitCell()}
                onClick={() => runAction(() => editor.chain().focus().splitCell().run())}
              >
                <TableCellsSplit /> Pisahkan cell
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => runAction(() => clearSelectedCells(editor))}>
                <Eraser /> Kosongkan isi
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => runAction(() => editor.chain().focus().deleteRow().run())}
              >
                <Trash2 /> Hapus baris
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => runAction(() => editor.chain().focus().deleteTable().run())}
              >
                <Trash2 /> Hapus tabel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Grip kolom */}
          {geo.colGripVisible ? (
            <DropdownMenu open={colMenuOpen} onOpenChange={handleColMenuOpenChange}>
              <DropdownMenuTrigger
                title="Aksi kolom"
                className={cn(gripClass, "h-[18px] w-6")}
                style={{
                  left: geo.col.left + geo.col.width / 2 - 12,
                  top: geo.table.top - 24,
                }}
              >
                <GripHorizontal className="size-3.5" aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="start">
                <DropdownMenuItem
                  onClick={() => runAction(() => editor.chain().focus().addColumnBefore().run())}
                >
                  <ArrowLeftToLine /> Sisipkan kolom di kiri
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => runAction(() => editor.chain().focus().addColumnAfter().run())}
                >
                  <ArrowRightToLine /> Sisipkan kolom di kanan
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    runAction((ctx) => duplicateTableColumn(editor, ctx.tablePos, ctx.colIndex))
                  }
                >
                  <Copy /> Duplikat kolom
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => runAction(() => editor.chain().focus().toggleHeaderColumn().run())}
                >
                  <PanelLeft /> Toggle kolom header
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!editor.can().mergeCells()}
                  onClick={() => runAction(() => editor.chain().focus().mergeCells().run())}
                >
                  <TableCellsMerge /> Gabungkan cell
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!editor.can().splitCell()}
                  onClick={() => runAction(() => editor.chain().focus().splitCell().run())}
                >
                  <TableCellsSplit /> Pisahkan cell
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => runAction(() => clearSelectedCells(editor))}>
                  <Eraser /> Kosongkan isi
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => runAction(() => editor.chain().focus().deleteColumn().run())}
                >
                  <Trash2 /> Hapus kolom
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => runAction(() => editor.chain().focus().deleteTable().run())}
                >
                  <Trash2 /> Hapus tabel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}

          {/* Tombol "+" kolom (tepi kanan) */}
          <button
            type="button"
            title="Tambah kolom di akhir"
            aria-label="Tambah kolom di akhir"
            className={cn(plusClass, "w-[16px]")}
            style={{
              left:
                Math.min(
                  geo.table.left + geo.table.width,
                  geo.wrapper.left + geo.wrapper.width,
                ) + 4,
              top: geo.table.top,
              height: geo.table.height,
            }}
            onClick={() => runAction((ctx) => addColumnAtEnd(editor, ctx.tablePos))}
          >
            <Plus className="size-3" aria-hidden />
          </button>

          {/* Tombol "+" baris (tepi bawah) */}
          <button
            type="button"
            title="Tambah baris di akhir"
            aria-label="Tambah baris di akhir"
            className={cn(plusClass, "h-[16px]")}
            style={{
              left: geo.table.left,
              top: geo.table.top + geo.table.height + 4,
              width: Math.min(geo.table.width, geo.wrapper.width),
            }}
            onClick={() => runAction((ctx) => addRowAtEnd(editor, ctx.tablePos))}
          >
            <Plus className="size-3" aria-hidden />
          </button>
        </>
      ) : null}
    </div>
  );
}
