"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { RoomWhiteboardElementType } from "@prisma/client";
import { worldToScreen, type Viewport } from "@/lib/whiteboard/geometry";
import { paletteEntry } from "@/lib/whiteboard/palette";
import {
  FONT_STACKS,
  LINE_HEIGHT_RATIO,
  TEXT_PADDING,
} from "@/lib/whiteboard/text-layout";
import type {
  WhiteboardElement,
  WhiteboardFontFamily,
} from "@/lib/whiteboard/types";
import { effectiveFontSize } from "./whiteboard-element";

/**
 * Editor teks in-place.
 *
 * Sebuah `<textarea>` transparan ditumpuk tepat di atas elemen dengan font,
 * ukuran, dan perataan yang sama persis, sehingga saat mengetik terlihat
 * seolah-olah teks disunting langsung di kanvas. Teks SVG aslinya
 * disembunyikan selama editor aktif (lihat `ctx.editingId`).
 */

export function WhiteboardTextEditor({
  element,
  viewport,
  dark,
  onCommit,
}: {
  element: WhiteboardElement;
  viewport: Viewport;
  dark: boolean;
  /**
   * Dipanggil sekali saat penyuntingan selesai. Teks sengaja TIDAK ditulis ke
   * store saat mengetik: teks SVG-nya memang disembunyikan selama editor
   * aktif, dan menulis lebih awal membuat perbandingan "apakah berubah?" di
   * `commitText` selalu bernilai sama sehingga perubahan tidak pernah
   * tersimpan.
   */
  onCommit: (text: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const [value, setValue] = useState(element.props.text ?? "");
  const committedRef = useRef(false);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.focus({ preventScroll: true });
    node.setSelectionRange(node.value.length, node.value.length);
  }, [element.id]);

  useEffect(() => {
    const commitOnOutside = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        commit();
      }
    };
    // `pointerdown` di kanvas sudah menutup editor; ini jaring pengaman untuk
    // klik di panel/toolbar.
    window.addEventListener("pointerdown", commitOnOutside, true);
    return () => window.removeEventListener("pointerdown", commitOnOutside, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function commit() {
    if (committedRef.current) return;
    committedRef.current = true;
    onCommit(value);
  }

  const screen = worldToScreen({ x: element.x, y: element.y }, viewport);
  const fontSize = effectiveFontSize({ ...element, props: { ...element.props, text: value } });
  const family = (element.props.fontFamily ?? "sans") as WhiteboardFontFamily;
  const isStandalone = element.type === RoomWhiteboardElementType.TEXT;
  const align = element.props.textAlign ?? (isStandalone ? "left" : "center");
  const vAlign = element.props.verticalAlign ?? (isStandalone ? "top" : "middle");

  const color = element.props.textColor
    ? paletteEntry(element.props.textColor, dark).on
    : dark
      ? "#fafafa"
      : "#18181b";

  const padding = TEXT_PADDING * viewport.zoom;

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") {
          event.preventDefault();
          commit();
          return;
        }
        // Enter menyisipkan baris baru; Ctrl/Cmd+Enter & Tab menyelesaikan.
        if (
          (event.key === "Enter" && (event.metaKey || event.ctrlKey)) ||
          event.key === "Tab"
        ) {
          event.preventDefault();
          commit();
        }
      }}
      onBlur={commit}
      onPointerDown={(event) => event.stopPropagation()}
      spellCheck={false}
      className="absolute resize-none overflow-hidden border-0 bg-transparent outline-none"
      style={{
        left: screen.x,
        top: screen.y,
        width: element.width * viewport.zoom,
        height: element.height * viewport.zoom,
        padding,
        fontSize: fontSize * viewport.zoom,
        lineHeight: LINE_HEIGHT_RATIO,
        fontFamily: FONT_STACKS[family],
        fontWeight: element.props.fontWeight ?? 400,
        fontStyle: element.props.italic ? "italic" : undefined,
        textDecoration: element.props.underline ? "underline" : undefined,
        textAlign: align,
        color,
        // Perataan vertikal ditiru dengan flex-like padding pada textarea.
        display: "block",
        transform: element.rotation
          ? `rotate(${(element.rotation * 180) / Math.PI}deg)`
          : undefined,
        transformOrigin: "center center",
        caretColor: color,
        ...verticalAlignStyle(vAlign, element.height * viewport.zoom, padding),
      }}
    />
  );
}

/**
 * `<textarea>` tidak mendukung perataan vertikal, jadi ditiru dengan
 * menambah padding atas. Ini hanya pendekatan visual saat mengetik — hasil
 * akhirnya tetap dihitung ulang oleh tata letak SVG.
 */
function verticalAlignStyle(
  align: string,
  height: number,
  padding: number,
): React.CSSProperties {
  if (align === "top") return {};
  if (align === "bottom") return { paddingTop: Math.max(padding, height * 0.5) };
  return { paddingTop: Math.max(padding, height * 0.22) };
}
