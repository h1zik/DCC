"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { TableKit } from "@tiptap/extension-table";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { TextStyle } from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import Youtube from "@tiptap/extension-youtube";
import { common, createLowlight } from "lowlight";
import {
  Bold,
  Braces,
  Code,
  Columns3,
  FileUp,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListChecks,
  ListOrdered,
  Minus as DividerIcon,
  Quote,
  Redo,
  Minus,
  Plus,
  Strikethrough,
  Table2,
  Type,
  Undo,
  Underline as UnderlineIcon,
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
import {
  RichTextMediaDialog,
  type RichTextMediaMode,
  type UploadedRichTextFile,
} from "@/components/rich-text-media-dialog";
import { WikiEmbed, WikiFile } from "@/lib/tiptap-wiki-file";
import {
  cleanRichTextPasteHtml,
  filterWikiSlashCommands,
  type WikiSlashCommandId,
} from "@/lib/wiki-editor";

const lowlight = createLowlight(common);

export type RichTextEditorProps = {
  /** Konten awal (HTML). Komponen tidak controlled — perubahan dilaporkan via `onUpdate`. */
  initialContent: string;
  /** Dipanggil dengan HTML terkini ketika konten berubah (sudah di-debounce di parent). */
  onUpdate: (html: string) => void;
  placeholder?: string;
  editable?: boolean;
  className?: string;
  onUploadFile?: (file: File) => Promise<UploadedRichTextFile>;
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
  onUploadFile,
}: RichTextEditorProps) {
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const [editorInitialContent] = useState(initialContent);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkInitialUrl, setLinkInitialUrl] = useState("");
  const [mediaDialog, setMediaDialog] = useState<{
    open: boolean;
    mode: RichTextMediaMode;
  }>({ open: false, mode: "image" });
  const [slashMenu, setSlashMenu] = useState<{
    from: number;
    to: number;
    query: string;
    left: number;
    top: number;
  } | null>(null);
  const [slashSelected, setSlashSelected] = useState(0);

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        bulletList: { keepMarks: true, keepAttributes: true },
        orderedList: { keepMarks: true, keepAttributes: true },
        codeBlock: false,
        link: false,
      }),
      CodeBlockLowlight.configure({ lowlight }),
      TextStyle,
      FontSize,
      Underline,
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
      TableKit.configure({
        table: { resizable: true, lastColumnResizable: false },
      }),
      Image.configure({
        allowBase64: false,
        resize: { enabled: true, minWidth: 120, minHeight: 80 },
        HTMLAttributes: { loading: "lazy" },
      }),
      Youtube.configure({
        controls: true,
        nocookie: true,
        modestBranding: true,
        HTMLAttributes: { class: "wiki-youtube" },
      }),
      WikiFile,
      WikiEmbed,
    ],
    [placeholder],
  );

  const editorProps = useMemo(
    () => ({
      attributes: {
        class: "tiptap min-h-[60vh] focus:outline-none",
      },
      transformPastedHTML: cleanRichTextPasteHtml,
    }),
    [],
  );

  const updateSlashMenu = useCallback((ed: Editor) => {
    const { selection } = ed.state;
    const { $from } = selection;
    if (!selection.empty || $from.parent.type.name !== "paragraph") {
      setSlashMenu(null);
      return;
    }
    const before = $from.parent.textBetween(0, $from.parentOffset, "\0", "\0");
    const match = /(?:^|\s)\/([\p{L}\p{N}_-]*)$/u.exec(before);
    if (!match) {
      setSlashMenu(null);
      return;
    }
    const query = match[1] ?? "";
    const from = $from.pos - query.length - 1;
    const coords = ed.view.coordsAtPos($from.pos);
    setSlashMenu({ from, to: $from.pos, query, left: coords.left, top: coords.bottom + 8 });
    setSlashSelected(0);
  }, []);

  const editor = useEditor(
    {
      extensions,
      content: editorInitialContent || "",
      editable,
      immediatelyRender: false,
      editorProps,
      onUpdate: ({ editor: ed }) => {
        onUpdateRef.current(ed.getHTML());
        updateSlashMenu(ed);
      },
      onSelectionUpdate: ({ editor: ed }) => updateSlashMenu(ed),
    },
    [editorInitialContent, updateSlashMenu],
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

  const openMediaDialog = useCallback((mode: RichTextMediaMode) => {
    setSlashMenu(null);
    setMediaDialog({ open: true, mode });
  }, []);

  const insertEmbed = useCallback(
    (url: string, title: string) => {
      if (!editor) return;
      const host = new URL(url).hostname.toLowerCase();
      if (host === "youtu.be" || host.endsWith("youtube.com")) {
        editor.chain().focus().setYoutubeVideo({ src: url, width: 720, height: 405 }).run();
        return;
      }
      editor
        .chain()
        .focus()
        .insertContent({ type: "wikiEmbed", attrs: { href: url, title: title || host } })
        .run();
    },
    [editor],
  );

  const runSlashCommand = useCallback(
    (id: WikiSlashCommandId) => {
      if (!editor || !slashMenu) return;
      const chain = editor.chain().focus().deleteRange({ from: slashMenu.from, to: slashMenu.to });
      setSlashMenu(null);
      switch (id) {
        case "paragraph":
          chain.setParagraph().run();
          break;
        case "heading1":
          chain.setHeading({ level: 1 }).run();
          break;
        case "heading2":
          chain.setHeading({ level: 2 }).run();
          break;
        case "heading3":
          chain.setHeading({ level: 3 }).run();
          break;
        case "bulletList":
          chain.toggleBulletList().run();
          break;
        case "orderedList":
          chain.toggleOrderedList().run();
          break;
        case "taskList":
          chain.toggleTaskList().run();
          break;
        case "blockquote":
          chain.toggleBlockquote().run();
          break;
        case "codeBlock":
          chain.toggleCodeBlock().run();
          break;
        case "table":
          chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
          break;
        case "divider":
          chain.setHorizontalRule().run();
          break;
        case "image":
        case "file":
        case "embed":
          chain.run();
          openMediaDialog(id);
          break;
      }
    },
    [editor, openMediaDialog, slashMenu],
  );

  const slashCommands = useMemo(
    () => (slashMenu ? filterWikiSlashCommands(slashMenu.query) : []),
    [slashMenu],
  );
  const slashMenuRef = useRef(slashMenu);
  const slashCommandsRef = useRef(slashCommands);
  const slashSelectedRef = useRef(slashSelected);
  const runSlashCommandRef = useRef(runSlashCommand);
  useEffect(() => {
    slashMenuRef.current = slashMenu;
    slashCommandsRef.current = slashCommands;
    slashSelectedRef.current = slashSelected;
    runSlashCommandRef.current = runSlashCommand;
  }, [runSlashCommand, slashCommands, slashMenu, slashSelected]);

  useEffect(() => {
    if (!editor || !editable) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openLinkDialog();
        return;
      }
      if (!slashMenuRef.current) return;
      const commands = slashCommandsRef.current;
      if (e.key === "Escape") {
        e.preventDefault();
        setSlashMenu(null);
      } else if (e.key === "ArrowDown" && commands.length > 0) {
        e.preventDefault();
        setSlashSelected((current) => (current + 1) % commands.length);
      } else if (e.key === "ArrowUp" && commands.length > 0) {
        e.preventDefault();
        setSlashSelected((current) => (current - 1 + commands.length) % commands.length);
      } else if (e.key === "Enter" && commands.length > 0) {
        e.preventDefault();
        runSlashCommandRef.current(commands[slashSelectedRef.current]?.id ?? commands[0].id);
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
        onOpenMediaDialog={openMediaDialog}
        editable={editable}
      />
      <EditorContent editor={editor} />
      {slashMenu ? (
        <SlashCommandMenu
          left={slashMenu.left}
          top={slashMenu.top}
          query={slashMenu.query}
          selected={slashSelected}
          onSelect={runSlashCommand}
        />
      ) : null}
      <EditorLinkDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        initialUrl={linkInitialUrl}
        onApply={applyLink}
        onRemove={removeLink}
      />
      {mediaDialog.open ? (
        <RichTextMediaDialog
          key={mediaDialog.mode}
          open
          mode={mediaDialog.mode}
          onOpenChange={(open) => setMediaDialog((current) => ({ ...current, open }))}
          onUploadFile={onUploadFile}
          onInsertImage={(url, alt) => {
            editor.chain().focus().setImage({ src: url, alt }).run();
          }}
          onInsertFile={(file) => {
            editor
              .chain()
              .focus()
              .insertContent({
                type: "wikiFile",
                attrs: {
                  href: file.url,
                  name: file.name,
                  mimeType: file.mimeType,
                  size: file.size,
                },
              })
              .run();
          }}
          onInsertEmbed={insertEmbed}
        />
      ) : null}
    </div>
  );
}

function SlashCommandMenu({
  left,
  top,
  query,
  selected,
  onSelect,
}: {
  left: number;
  top: number;
  query: string;
  selected: number;
  onSelect: (id: WikiSlashCommandId) => void;
}) {
  const commands = filterWikiSlashCommands(query);
  return (
    <div
      role="listbox"
      aria-label="Sisipkan block"
      className="border-border bg-popover fixed z-50 max-h-80 w-72 overflow-y-auto rounded-lg border p-1 shadow-xl"
      style={{ left: Math.min(left, window.innerWidth - 304), top: Math.min(top, window.innerHeight - 340) }}
    >
      {commands.length === 0 ? (
        <p className="text-muted-foreground px-3 py-4 text-center text-sm">Command tidak ditemukan.</p>
      ) : (
        commands.map((command, index) => (
          <button
            key={command.id}
            type="button"
            role="option"
            aria-selected={selected === index}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onSelect(command.id)}
            className={cn(
              "flex w-full flex-col rounded-md px-2.5 py-2 text-left transition-colors",
              selected === index ? "bg-primary/10 text-foreground" : "hover:bg-muted",
            )}
          >
            <span className="text-sm font-medium">{command.label}</span>
            <span className="text-muted-foreground text-xs">{command.description}</span>
          </button>
        ))
      )}
      <p className="text-muted-foreground border-border mt-1 border-t px-2 py-1.5 text-[10px]">
        ↑↓ pilih · Enter sisipkan · Esc tutup
      </p>
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
  onOpenMediaDialog,
  editable,
}: {
  editor: ReturnType<typeof useEditor>;
  onOpenLinkDialog: () => void;
  onRemoveLink: () => void;
  onOpenMediaDialog: (mode: RichTextMediaMode) => void;
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
        editor.isActive("underline"),
        "Garis bawah (Ctrl+U)",
        () => editor.chain().focus().toggleUnderline().run(),
        <UnderlineIcon className="size-4" aria-hidden />,
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
        "Blok kode dengan syntax highlight",
        () => editor.chain().focus().toggleCodeBlock().run(),
        <Code className="size-4" aria-hidden />,
      )}
      <span className="bg-border mx-1 h-5 w-px" aria-hidden />
      {btn(
        false,
        "Sisipkan tabel",
        () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
        <Table2 className="size-4" aria-hidden />,
      )}
      {editor.isActive("table") ? (
        <>
          {btn(false, "Tambah baris", () => editor.chain().focus().addRowAfter().run(), <Plus className="size-4" aria-hidden />)}
          {btn(false, "Tambah kolom", () => editor.chain().focus().addColumnAfter().run(), <Columns3 className="size-4" aria-hidden />)}
          {btn(false, "Hapus tabel", () => editor.chain().focus().deleteTable().run(), <TrashTableIcon />)}
        </>
      ) : null}
      {btn(
        false,
        "Garis pemisah",
        () => editor.chain().focus().setHorizontalRule().run(),
        <DividerIcon className="size-4" aria-hidden />,
      )}
      <span className="bg-border mx-1 h-5 w-px" aria-hidden />
      {btn(false, "Sisipkan gambar", () => onOpenMediaDialog("image"), <ImageIcon className="size-4" aria-hidden />)}
      {btn(false, "Sisipkan file", () => onOpenMediaDialog("file"), <FileUp className="size-4" aria-hidden />)}
      {btn(false, "Embed tautan atau video", () => onOpenMediaDialog("embed"), <Braces className="size-4" aria-hidden />)}
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

function TrashTableIcon() {
  return (
    <span className="relative inline-flex size-4 items-center justify-center" aria-hidden>
      <Table2 className="size-4" />
      <span className="bg-destructive absolute h-px w-5 rotate-45" />
    </span>
  );
}
