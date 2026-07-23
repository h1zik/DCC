"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import { ChevronRight, TableOfContents } from "lucide-react";
import { cn } from "@/lib/utils";

type TocHeading = { level: number; text: string; pos: number };

function collectHeadings(editor: Editor): TocHeading[] {
  const headings: TocHeading[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "heading") {
      headings.push({
        level: Number(node.attrs.level) || 1,
        text: node.textContent.trim(),
        pos,
      });
    }
  });
  return headings;
}

/**
 * Daftar isi otomatis dari heading dokumen. Dihitung runtime (tanpa ID
 * persisten di HTML) sehingga tidak berdampak ke penyimpanan/export.
 * Berfungsi juga saat read-only.
 */
export function EditorToc({ editor, className }: { editor: Editor; className?: string }) {
  const [headings, setHeadings] = useState<TocHeading[]>(() => collectHeadings(editor));
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (timeout != null) clearTimeout(timeout);
      timeout = setTimeout(() => setHeadings(collectHeadings(editor)), 300);
    };
    refresh();
    editor.on("update", refresh);
    return () => {
      if (timeout != null) clearTimeout(timeout);
      editor.off("update", refresh);
    };
  }, [editor]);

  if (headings.length < 2) return null;

  const scrollTo = (heading: TocHeading) => {
    if (heading.pos > editor.state.doc.content.size) return;
    const dom = editor.view.nodeDOM(heading.pos);
    if (dom instanceof HTMLElement) {
      dom.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <nav
      aria-label="Daftar isi"
      className={cn("border-border bg-card/60 rounded-lg border px-3 py-2", className)}
    >
      <button
        type="button"
        onClick={() => setCollapsed((current) => !current)}
        aria-expanded={!collapsed}
        className="text-muted-foreground hover:text-foreground flex w-full items-center gap-1.5 text-xs font-semibold uppercase tracking-wide transition-colors"
      >
        <TableOfContents className="size-3.5" aria-hidden />
        Daftar isi
        <ChevronRight
          className={cn("size-3.5 transition-transform", !collapsed && "rotate-90")}
          aria-hidden
        />
      </button>
      {!collapsed ? (
        <ul className="mt-1.5 flex flex-col gap-0.5">
          {headings.map((heading, index) => (
            <li key={`${heading.pos}-${index}`}>
              <button
                type="button"
                onClick={() => scrollTo(heading)}
                className="text-muted-foreground hover:bg-muted hover:text-foreground w-full truncate rounded px-1.5 py-0.5 text-left text-sm transition-colors"
                style={{ paddingLeft: `${(heading.level - 1) * 14 + 6}px` }}
              >
                {heading.text || "Tanpa judul"}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </nav>
  );
}
