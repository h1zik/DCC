"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { Baseline, Highlighter } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { WIKI_HIGHLIGHT_COLORS, WIKI_TEXT_COLORS } from "@/lib/editor-colors";
import { cn } from "@/lib/utils";

/**
 * Picker warna teks / highlight. Swatch memakai onMouseDown preventDefault
 * supaya seleksi teks di editor tidak hilang saat memilih warna.
 */
export function EditorColorPicker({
  editor,
  mode,
}: {
  editor: Editor;
  mode: "color" | "highlight";
}) {
  const [open, setOpen] = useState(false);

  const activeColor =
    mode === "color"
      ? ((editor.getAttributes("textStyle").color as string | undefined) ?? null)
      : ((editor.getAttributes("highlight").color as string | undefined) ?? null);

  const swatches = mode === "color" ? WIKI_TEXT_COLORS : WIKI_HIGHLIGHT_COLORS;
  const label = mode === "color" ? "Warna teks" : "Highlight";

  const apply = (value: string | null) => {
    const chain = editor.chain().focus();
    if (mode === "color") {
      (value == null ? chain.unsetColor() : chain.setColor(value)).run();
    } else {
      (value == null ? chain.unsetHighlight() : chain.setHighlight({ color: value })).run();
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        title={label}
        aria-label={label}
        className={cn(
          "text-muted-foreground hover:bg-muted hover:text-foreground inline-flex size-8 flex-col items-center justify-center gap-0.5 rounded-md transition-colors",
          activeColor && "bg-primary/10",
        )}
      >
        {mode === "color" ? (
          <>
            <Baseline className="size-4" aria-hidden />
            <span
              aria-hidden
              className="h-[3px] w-4 rounded-full"
              style={{ backgroundColor: activeColor ?? "currentColor" }}
            />
          </>
        ) : (
          <Highlighter
            className="size-4"
            aria-hidden
            style={activeColor ? { color: activeColor.slice(0, 7) } : undefined}
          />
        )}
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <p className="text-muted-foreground text-xs font-medium">{label}</p>
        <div className="grid grid-cols-5 gap-1">
          <button
            type="button"
            title="Default"
            aria-label={`${label} default`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => apply(null)}
            className={cn(
              "border-border hover:bg-muted relative flex size-8 items-center justify-center rounded-md border text-xs font-semibold",
              activeColor == null && "ring-primary ring-2",
            )}
          >
            <span aria-hidden>A</span>
            <span aria-hidden className="bg-destructive absolute h-px w-5 rotate-45" />
          </button>
          {swatches.map((swatch) => (
            <button
              key={swatch.value}
              type="button"
              title={swatch.label}
              aria-label={`${label} ${swatch.label}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => apply(swatch.value)}
              className={cn(
                "border-border hover:bg-muted flex size-8 items-center justify-center rounded-md border text-sm font-semibold",
                activeColor?.toLowerCase() === swatch.value.toLowerCase() &&
                  "ring-primary ring-2",
              )}
              style={mode === "highlight" ? { backgroundColor: swatch.value } : undefined}
            >
              {mode === "color" ? (
                <span aria-hidden style={{ color: swatch.value }}>
                  A
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
