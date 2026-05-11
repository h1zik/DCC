"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
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
  Strikethrough,
  Undo,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
 * Editor rich-text gaya Google Docs ringan: heading H1-H3, bold/italic/strike,
 * list (bullet/numbered/task), blockquote, code block, tautan. Auto-save
 * dilakukan oleh parent — komponen ini hanya melaporkan perubahan via prop.
 */
export function RichTextEditor({
  initialContent,
  onUpdate,
  placeholder = "Mulai menulis…",
  editable = true,
  className,
}: RichTextEditorProps) {
  // Simpan callback terbaru di ref agar tidak perlu memicu re-create editor
  // hanya karena identitas fungsi berubah pada setiap render parent.
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  // PENTING: snapshot `initialContent` pada mount pertama. Tiptap adalah
  // source of truth untuk konten setelah editor dibuat; jika kita teruskan
  // prop yang berubah-ubah ke `useEditor`, `setOptions` akan jalan tiap
  // render dan dapat memicu race condition saat user mengetik (huruf yang
  // baru diketik “balik seperti semula”). Pergantian dokumen ditangani oleh
  // parent lewat prop `key`.
  const initialContentRef = useRef(initialContent);

  // Daftar ekstensi distabilkan agar `compareOptions` di useEditor menganggap
  // options tidak berubah — sehingga setOptions tidak dipanggil tiap render.
  const extensions = useMemo(
    () => [
      StarterKit.configure({
        bulletList: { keepMarks: true, keepAttributes: true },
        orderedList: { keepMarks: true, keepAttributes: true },
        link: false,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank",
          class: "text-primary hover:underline",
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
      // Hindari hydration mismatch saat SSR di Next.js (Tiptap v3 menyarankan ini).
      immediatelyRender: false,
      editorProps,
      onUpdate: ({ editor: ed }) => {
        onUpdateRef.current(ed.getHTML());
      },
    },
    // Deps kosong eksplisit: editor dibuat sekali, tidak akan di-recreate.
    [],
  );

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL tautan", prev ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    const href =
      /^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `https://${url}`;
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
  }, [editor]);

  if (!editor) {
    return (
      <div className={cn("min-h-[60vh] animate-pulse rounded-md bg-muted/30", className)} />
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Toolbar editor={editor} onSetLink={setLink} editable={editable} />
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({
  editor,
  onSetLink,
  editable,
}: {
  editor: ReturnType<typeof useEditor>;
  onSetLink: () => void;
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
        "Tautan",
        onSetLink,
        <LinkIcon className="size-4" aria-hidden />,
      )}
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
