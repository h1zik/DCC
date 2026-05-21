"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { TextStyle } from "@tiptap/extension-text-style";
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListChecks,
  ListOrdered,
  Quote,
  Redo,
  Minus,
  Plus,
  Strikethrough,
  Type,
  Undo,
  Unlink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_FONT_SIZE_PT,
  FontSize,
  clampFontSizePt,
  fontSizeCSSValueToNumber,
  numberToFontSizeCSSValue,
} from "@/lib/tiptap-font-size";
import { EditorLinkDialog } from "@/components/editor-link-dialog";

export type RichTextEditorProps = {
  /** Konten awal (HTML). Komponen tidak controlled — perubahan dilaporkan via `onUpdate`. */
  initialContent: string;
  /** Dipanggil dengan HTML terkini ketika konten berubah (sudah di-debounce di parent). */
  onUpdate: (html: string) => void;
  placeholder?: string;
  editable?: boolean;
  className?: string;
};

/**
 * Editor rich-text: heading, font size, bold/italic/strike, hyperlink,
 * list, blockquote, code. Auto-save dilakukan oleh parent.
 */
export function RichTextEditor({
  initialContent,
  onUpdate,
  placeholder = "Mulai menulis…",
  editable = true,
  className,
}: RichTextEditorProps) {
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const initialContentRef = useRef(initialContent);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkInitialUrl, setLinkInitialUrl] = useState("");

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        bulletList: { keepMarks: true, keepAttributes: true },
        orderedList: { keepMarks: true, keepAttributes: true },
        link: false,
      }),
      TextStyle,
      FontSize,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        defaultProtocol: "https",
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank",
          class: "text-primary underline underline-offset-2 cursor-pointer",
        },
      }),
      Placeholder.configure({ placeholder }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    [placeholder],
  );

  const editorProps = useMemo(
    () => ({
      attributes: {
        class: "tiptap min-h-[60vh] focus:outline-none",
      },
    }),
    [],
  );

  const editor = useEditor(
    {
      extensions,
      content: initialContentRef.current || "",
      editable,
      immediatelyRender: false,
      editorProps,
      onUpdate: ({ editor: ed }) => {
        onUpdateRef.current(ed.getHTML());
      },
    },
    [],
  );

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  const openLinkDialog = useCallback(() => {
    if (!editor) return;
    const prev = (editor.getAttributes("link").href as string | undefined) ?? "";
    setLinkInitialUrl(prev);
    setLinkDialogOpen(true);
  }, [editor]);

  const applyLink = useCallback(
    (href: string) => {
      if (!editor) return;
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    },
    [editor],
  );

  const removeLink = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setLinkDialogOpen(false);
  }, [editor]);

  useEffect(() => {
    if (!editor || !editable) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openLinkDialog();
      }
    };
    const el = editor.view.dom;
    el.addEventListener("keydown", onKeyDown);
    return () => el.removeEventListener("keydown", onKeyDown);
  }, [editor, editable, openLinkDialog]);

  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    /** Capture phase: buka tautan sebelum ProseMirror menangani klik (mode edit memblokir openOnClick bawaan). */
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.defaultPrevented) return;
      const anchor = (e.target as HTMLElement).closest<HTMLAnchorElement>("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href")?.trim();
      if (!href || href === "#") return;
      // Alt+klik: biarkan kursor masuk ke tautan untuk mengedit teks
      if (e.altKey) return;
      e.preventDefault();
      e.stopPropagation();
      window.open(href, "_blank", "noopener,noreferrer");
    };
    dom.addEventListener("click", onClick, true);
    return () => dom.removeEventListener("click", onClick, true);
  }, [editor]);

  if (!editor) {
    return (
      <div className={cn("min-h-[60vh] animate-pulse rounded-md bg-muted/30", className)} />
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Toolbar
        editor={editor}
        onOpenLinkDialog={openLinkDialog}
        onRemoveLink={removeLink}
        editable={editable}
      />
      <EditorContent editor={editor} />
      <EditorLinkDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        initialUrl={linkInitialUrl}
        onApply={applyLink}
        onRemove={removeLink}
      />
    </div>
  );
}

/** Input angka +/− seperti Google Docs (satuan pt, 1–400). */
function FontSizeControl({ editor }: { editor: Editor }) {
  const [inputValue, setInputValue] = useState(String(DEFAULT_FONT_SIZE_PT));
  const editingRef = useRef(false);

  const syncFromEditor = useCallback(() => {
    const raw = editor.getAttributes("textStyle").fontSize as string | undefined;
    const n = fontSizeCSSValueToNumber(raw) ?? DEFAULT_FONT_SIZE_PT;
    setInputValue(String(n));
  }, [editor]);

  useEffect(() => {
    syncFromEditor();
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

function Toolbar({
  editor,
  onOpenLinkDialog,
  onRemoveLink,
  editable,
}: {
  editor: ReturnType<typeof useEditor>;
  onOpenLinkDialog: () => void;
  onRemoveLink: () => void;
  editable: boolean;
}) {
  if (!editor || !editable) return null;

  const btn = (
    active: boolean,
    label: string,
    onClick: () => void,
    icon: React.ReactNode,
    disabled = false,
  ) => (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "text-muted-foreground hover:bg-muted hover:text-foreground inline-flex size-8 items-center justify-center rounded-md transition-colors disabled:opacity-40",
        active && "bg-primary/10 text-primary hover:bg-primary/15",
      )}
    >
      {icon}
    </button>
  );

  return (
    <div
      role="toolbar"
      aria-label="Format teks"
      className="border-border bg-card sticky top-14 z-10 flex flex-wrap items-center gap-0.5 rounded-lg border px-1.5 py-1 shadow-sm"
    >
      {btn(
        editor.isActive("heading", { level: 1 }),
        "Heading 1",
        () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
        <Heading1 className="size-4" aria-hidden />,
      )}
      {btn(
        editor.isActive("heading", { level: 2 }),
        "Heading 2",
        () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        <Heading2 className="size-4" aria-hidden />,
      )}
      {btn(
        editor.isActive("heading", { level: 3 }),
        "Heading 3",
        () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
        <Heading3 className="size-4" aria-hidden />,
      )}
      <span className="bg-border mx-1 h-5 w-px" aria-hidden />
      <div className="flex items-center gap-1">
        <Type className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
        <FontSizeControl editor={editor} />
      </div>
      <span className="bg-border mx-1 h-5 w-px" aria-hidden />
      {btn(
        editor.isActive("bold"),
        "Tebal (Ctrl+B)",
        () => editor.chain().focus().toggleBold().run(),
        <Bold className="size-4" aria-hidden />,
      )}
      {btn(
        editor.isActive("italic"),
        "Miring (Ctrl+I)",
        () => editor.chain().focus().toggleItalic().run(),
        <Italic className="size-4" aria-hidden />,
      )}
      {btn(
        editor.isActive("strike"),
        "Coret",
        () => editor.chain().focus().toggleStrike().run(),
        <Strikethrough className="size-4" aria-hidden />,
      )}
      {btn(
        editor.isActive("link"),
        "Tautan (Ctrl+K)",
        onOpenLinkDialog,
        <LinkIcon className="size-4" aria-hidden />,
      )}
      {editor.isActive("link")
        ? btn(
            false,
            "Hapus tautan",
            onRemoveLink,
            <Unlink className="size-4" aria-hidden />,
          )
        : null}
      <span className="bg-border mx-1 h-5 w-px" aria-hidden />
      {btn(
        editor.isActive("bulletList"),
        "Daftar berpoin",
        () => editor.chain().focus().toggleBulletList().run(),
        <List className="size-4" aria-hidden />,
      )}
      {btn(
        editor.isActive("orderedList"),
        "Daftar bernomor",
        () => editor.chain().focus().toggleOrderedList().run(),
        <ListOrdered className="size-4" aria-hidden />,
      )}
      {btn(
        editor.isActive("taskList"),
        "Daftar tugas",
        () => editor.chain().focus().toggleTaskList().run(),
        <ListChecks className="size-4" aria-hidden />,
      )}
      <span className="bg-border mx-1 h-5 w-px" aria-hidden />
      {btn(
        editor.isActive("blockquote"),
        "Kutipan",
        () => editor.chain().focus().toggleBlockquote().run(),
        <Quote className="size-4" aria-hidden />,
      )}
      {btn(
        editor.isActive("codeBlock"),
        "Blok kode",
        () => editor.chain().focus().toggleCodeBlock().run(),
        <Code className="size-4" aria-hidden />,
      )}
      <span className="bg-border mx-1 h-5 w-px" aria-hidden />
      {btn(
        false,
        "Undo (Ctrl+Z)",
        () => editor.chain().focus().undo().run(),
        <Undo className="size-4" aria-hidden />,
        !editor.can().undo(),
      )}
      {btn(
        false,
        "Redo (Ctrl+Y)",
        () => editor.chain().focus().redo().run(),
        <Redo className="size-4" aria-hidden />,
        !editor.can().redo(),
      )}
    </div>
  );
}
