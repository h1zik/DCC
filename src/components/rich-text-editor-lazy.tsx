"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

/**
 * Versi lazy dari RichTextEditor — TipTap + lowlight (~ratusan KB) baru
 * diunduh saat halaman yang benar-benar memuat editor dirender, tidak ikut
 * chunk awal halaman notes/wiki/draft.
 */
export const RichTextEditorLazy = dynamic(
  () => import("./rich-text-editor").then((m) => m.RichTextEditor),
  {
    ssr: false,
    loading: () => (
      <div className="text-muted-foreground flex min-h-40 items-center justify-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Memuat editor…
      </div>
    ),
  },
);
