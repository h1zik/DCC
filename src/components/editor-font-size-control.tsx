"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { Minus, Plus } from "lucide-react";
import {
  DEFAULT_FONT_SIZE_PT,
  clampFontSizePt,
  fontSizeCSSValueToNumber,
  numberToFontSizeCSSValue,
} from "@/lib/tiptap-font-size";

/** Input angka +/− seperti Google Docs (satuan pt, 1–400). */
export function FontSizeControl({ editor }: { editor: Editor }) {
  const [inputValue, setInputValue] = useState(String(DEFAULT_FONT_SIZE_PT));
  const editingRef = useRef(false);

  const syncFromEditor = useCallback(() => {
    const raw = editor.getAttributes("textStyle").fontSize as string | undefined;
    const n = fontSizeCSSValueToNumber(raw) ?? DEFAULT_FONT_SIZE_PT;
    setInputValue(String(n));
  }, [editor]);

  useEffect(() => {
    const handler = () => {
      if (!editingRef.current) syncFromEditor();
    };
    editor.on("selectionUpdate", handler);
    editor.on("transaction", handler);
    return () => {
      editor.off("selectionUpdate", handler);
      editor.off("transaction", handler);
    };
  }, [editor, syncFromEditor]);

  const applyFromInput = useCallback(() => {
    const trimmed = inputValue.trim().replace(",", ".");
    if (!trimmed) {
      syncFromEditor();
      return;
    }
    const parsed = Number.parseFloat(trimmed);
    if (!Number.isFinite(parsed)) {
      syncFromEditor();
      return;
    }
    const pt = clampFontSizePt(parsed);
    editor.chain().focus().setFontSize(numberToFontSizeCSSValue(pt)).run();
    setInputValue(String(pt));
  }, [editor, inputValue, syncFromEditor]);

  const step = useCallback(
    (delta: number) => {
      const raw = editor.getAttributes("textStyle").fontSize as string | undefined;
      const current = fontSizeCSSValueToNumber(raw) ?? DEFAULT_FONT_SIZE_PT;
      const next = clampFontSizePt(current + delta);
      editor.chain().focus().setFontSize(numberToFontSizeCSSValue(next)).run();
      setInputValue(String(next));
    },
    [editor],
  );

  const stepBtn = (label: string, onClick: () => void, icon: React.ReactNode) => (
    <button
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-8 shrink-0 items-center justify-center transition-colors"
    >
      {icon}
    </button>
  );

  return (
    <div
      className="border-border bg-background flex h-8 items-stretch overflow-hidden rounded-md border"
      title="Ukuran font (pt) — ketik angka lalu Enter"
    >
      {stepBtn("Perkecil", () => step(-1), <Minus className="size-3.5" aria-hidden />)}
      <input
        type="text"
        inputMode="decimal"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onFocus={() => {
          editingRef.current = true;
        }}
        onBlur={() => {
          editingRef.current = false;
          applyFromInput();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            applyFromInput();
          }
          if (e.key === "Escape") {
            editingRef.current = false;
            syncFromEditor();
            (e.target as HTMLInputElement).blur();
          }
        }}
        aria-label="Ukuran font dalam pt"
        className="text-foreground w-11 min-w-0 border-0 bg-transparent px-0.5 text-center text-xs tabular-nums outline-none"
      />
      {stepBtn("Perbesar", () => step(1), <Plus className="size-3.5" aria-hidden />)}
    </div>
  );
}
