"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { TableKit } from "@tiptap/extension-table";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { Details, DetailsContent, DetailsSummary } from "@tiptap/extension-details";
import { DragHandle } from "@tiptap/extension-drag-handle-react";
import Youtube from "@tiptap/extension-youtube";
import { createLowlight } from "lowlight";
// Daftar bahasa eksplisit (bukan `common` = ~37 bahasa) — memangkas ratusan KB
// highlight.js dari bundle editor. Tambah bahasa lain di sini bila dibutuhkan.
import langBash from "highlight.js/lib/languages/bash";
import langCss from "highlight.js/lib/languages/css";
import langJavascript from "highlight.js/lib/languages/javascript";
import langJson from "highlight.js/lib/languages/json";
import langPython from "highlight.js/lib/languages/python";
import langSql from "highlight.js/lib/languages/sql";
import langTypescript from "highlight.js/lib/languages/typescript";
import langXml from "highlight.js/lib/languages/xml";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUpToLine,
  Bold,
  Braces,
  ChevronDown,
  Code,
  FileUp,
  GripVertical,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Lightbulb,
  Link as LinkIcon,
  List,
  ListChecks,
  ListCollapse,
  ListOrdered,
  type LucideIcon,
  Minus as DividerIcon,
  Pilcrow,
  PanelLeft,
  PanelTop,
  Quote,
  Redo,
  Minus,
  Plus,
  RotateCcw,
  Strikethrough,
  Table2,
  TableCellsMerge,
  TableCellsSplit,
  Trash2,
  Type,
  Undo,
  Underline as UnderlineIcon,
  Unlink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FontSize } from "@/lib/tiptap-font-size";
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
  type WikiSlashCommandSection,
} from "@/lib/wiki-editor";
import {
  clampWikiImageWidth,
  getActiveTableColumnWidth,
  getActiveTableRowHeight,
  ResizableTableRow,
  setActiveTableColumnWidth,
  setActiveTableRowHeight,
  TableColumnResize,
  TableRowResize,
} from "@/lib/tiptap-table-resize";
import {
  normalizeWikiImageAlignment,
  ResizableWikiImage,
  type WikiImageAlignment,
} from "@/lib/tiptap-image-layout";
import { TableControlsOverlay } from "@/components/rich-text-editor-table-controls";
import { FontSizeControl } from "@/components/editor-font-size-control";
import { EditorBubbleMenu } from "@/components/editor-bubble-menu";
import { EditorColorPicker } from "@/components/editor-color-picker";
import { EditorToc } from "@/components/editor-toc";
import {
  Callout,
  normalizeCalloutVariant,
  type WikiCalloutVariant,
} from "@/lib/tiptap-callout";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const lowlight = createLowlight({
  bash: langBash,
  css: langCss,
  html: langXml,
  javascript: langJavascript,
  js: langJavascript,
  json: langJson,
  python: langPython,
  sql: langSql,
  ts: langTypescript,
  typescript: langTypescript,
  xml: langXml,
});

export type RichTextEditorProps = {
  /** Konten awal (HTML). Komponen tidak controlled — perubahan dilaporkan via `onUpdate`. */
  initialContent: string;
  /** Dipanggil dengan HTML terkini ketika konten berubah (sudah di-debounce di parent). */
  onUpdate: (html: string) => void;
  placeholder?: string;
  editable?: boolean;
  className?: string;
  onUploadFile?: (file: File) => Promise<UploadedRichTextFile>;
  wikiPages?: { id: string; title: string }[];
  onNavigateWikiPage?: (pageId: string) => void;
  /** Tampilkan panel Daftar Isi otomatis dari heading (dipakai wiki view). */
  showTableOfContents?: boolean;
  /**
   * false = tanpa toolbar statis ala Notion: format via bubble menu + slash `/`;
   * kontrol tabel/gambar/callout tetap muncul kontekstual saat kursor di dalamnya.
   */
  showToolbar?: boolean;
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
  wikiPages = [],
  onNavigateWikiPage,
  showTableOfContents = false,
  showToolbar = true,
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
      TableColumnResize,
      TableKit.configure({
        table: {
          resizable: false,
          View: null,
        },
        tableRow: false,
      }),
      ResizableTableRow,
      TableRowResize,
      ResizableWikiImage.configure({
        allowBase64: false,
        resize: {
          enabled: true,
          minWidth: 80,
          minHeight: 40,
          alwaysPreserveAspectRatio: true,
        },
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
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Color,
      Highlight.configure({ multicolor: true }),
      Callout,
      Details.configure({ persist: true, HTMLAttributes: { class: "wiki-toggle" } }),
      DetailsSummary,
      DetailsContent,
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

  const applyWikiPageLink = useCallback(
    (page: { id: string; title: string }) => {
      if (!editor) return;
      const href = `#wiki-page-${page.id}`;
      if (editor.state.selection.empty) {
        editor
          .chain()
          .focus()
          .insertContent({
            type: "text",
            text: page.title || "Tanpa judul",
            marks: [{ type: "link", attrs: { href } }],
          })
          .run();
      } else {
        editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
      }
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
        case "callout":
          chain.setCallout({ variant: "info" }).run();
          break;
        case "toggle":
          chain.setDetails().run();
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
      if (href.startsWith("#wiki-page-") && onNavigateWikiPage) {
        onNavigateWikiPage(href.slice("#wiki-page-".length));
        return;
      }
      window.open(href, "_blank", "noopener,noreferrer");
    };
    dom.addEventListener("click", onClick, true);
    return () => dom.removeEventListener("click", onClick, true);
  }, [editor, onNavigateWikiPage]);

  if (!editor) {
    return (
      <div className={cn("min-h-[60vh] animate-pulse rounded-md bg-muted/30", className)} />
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {showToolbar ? (
        <Toolbar
          editor={editor}
          onOpenLinkDialog={openLinkDialog}
          onRemoveLink={removeLink}
          onOpenMediaDialog={openMediaDialog}
          editable={editable}
        />
      ) : editable ? (
        <EditorContextualBar editor={editor} />
      ) : null}
      {showTableOfContents ? <EditorToc editor={editor} /> : null}
      <div className="relative">
        <EditorContent editor={editor} />
        <TableControlsOverlay editor={editor} editable={editable} />
      </div>
      {editable ? <EditorBubbleMenu editor={editor} onOpenLinkDialog={openLinkDialog} /> : null}
      {editable ? (
        <DragHandle editor={editor} className="wiki-drag-handle">
          <GripVertical className="size-4" aria-hidden />
        </DragHandle>
      ) : null}
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
        wikiPages={wikiPages}
        onApplyWikiPage={applyWikiPageLink}
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

const SLASH_COMMAND_ICONS: Record<string, LucideIcon> = {
  pilcrow: Pilcrow,
  "heading-1": Heading1,
  "heading-2": Heading2,
  "heading-3": Heading3,
  quote: Quote,
  minus: DividerIcon,
  list: List,
  "list-ordered": ListOrdered,
  "list-checks": ListChecks,
  image: ImageIcon,
  "file-up": FileUp,
  braces: Braces,
  table: Table2,
  code: Code,
  lightbulb: Lightbulb,
  "list-collapse": ListCollapse,
};

const SLASH_COMMAND_SECTIONS: WikiSlashCommandSection[] = [
  "Dasar",
  "Daftar",
  "Media",
  "Lanjutan",
];

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
  // Saat ada query, hasil diurutkan berdasar relevansi lintas section — render
  // flat supaya urutan visual = urutan navigasi keyboard. Tanpa query, urutan
  // WIKI_SLASH_COMMANDS sudah per section sehingga header aman ditampilkan.
  const grouped = query.trim().length === 0;

  const item = (command: (typeof commands)[number]) => {
    const index = commands.indexOf(command);
    const Icon = SLASH_COMMAND_ICONS[command.icon];
    return (
      <button
        key={command.id}
        type="button"
        role="option"
        aria-selected={selected === index}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onSelect(command.id)}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left transition-colors",
          selected === index ? "bg-primary/10 text-foreground" : "hover:bg-muted",
        )}
      >
        <span className="border-border bg-background text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-md border">
          {Icon ? <Icon className="size-4" aria-hidden /> : null}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">{command.label}</span>
          <span className="text-muted-foreground truncate text-xs">{command.description}</span>
        </span>
      </button>
    );
  };

  return (
    <div
      role="listbox"
      aria-label="Sisipkan block"
      className="border-border bg-popover fixed z-50 max-h-80 w-72 overflow-y-auto rounded-lg border p-1 shadow-xl"
      style={{ left: Math.min(left, window.innerWidth - 304), top: Math.min(top, window.innerHeight - 340) }}
    >
      {commands.length === 0 ? (
        <p className="text-muted-foreground px-3 py-4 text-center text-sm">Command tidak ditemukan.</p>
      ) : grouped ? (
        SLASH_COMMAND_SECTIONS.map((section) => {
          const items = commands.filter((command) => command.section === section);
          if (items.length === 0) return null;
          return (
            <div key={section}>
              <p className="text-muted-foreground px-2.5 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-wide">
                {section}
              </p>
              {items.map(item)}
            </div>
          );
        })
      ) : (
        commands.map(item)
      )}
      <p className="text-muted-foreground border-border mt-1 border-t px-2 py-1.5 text-[10px]">
        ↑↓ pilih · Enter sisipkan · Esc tutup
      </p>
    </div>
  );
}

function PixelDimensionControl({
  label,
  value,
  fallback,
  step,
  onApply,
  onReset,
}: {
  label: string;
  value: number | null;
  fallback: number;
  step: number;
  onApply: (value: number) => void;
  onReset: () => void;
}) {
  const [inputValue, setInputValue] = useState(value == null ? "" : String(value));
  const editingRef = useRef(false);

  useEffect(() => {
    if (!editingRef.current) setInputValue(value == null ? "" : String(value));
  }, [value]);

  const applyInput = () => {
    const parsed = Number.parseFloat(inputValue);
    if (!inputValue.trim() || !Number.isFinite(parsed)) {
      onReset();
      setInputValue("");
      return;
    }
    onApply(parsed);
  };

  const applyStep = (delta: number) => {
    const next = (value ?? fallback) + delta;
    onApply(next);
    setInputValue(String(next));
  };

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-muted-foreground whitespace-nowrap text-xs font-medium">{label}</span>
      <div className="border-border bg-background flex h-8 items-stretch overflow-hidden rounded-md border">
        <button
          type="button"
          title={`Perkecil ${label.toLowerCase()}`}
          aria-label={`Perkecil ${label.toLowerCase()}`}
          onClick={() => applyStep(-step)}
          className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-8 items-center justify-center"
        >
          <Minus className="size-3.5" aria-hidden />
        </button>
        <input
          type="number"
          inputMode="numeric"
          min="1"
          value={inputValue}
          placeholder="Auto"
          aria-label={`${label} dalam pixel`}
          title={`${label} dalam pixel`}
          onChange={(event) => setInputValue(event.target.value)}
          onFocus={() => {
            editingRef.current = true;
          }}
          onBlur={() => {
            editingRef.current = false;
            applyInput();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              applyInput();
            }
            if (event.key === "Escape") {
              editingRef.current = false;
              setInputValue(value == null ? "" : String(value));
              event.currentTarget.blur();
            }
          }}
          className="text-foreground w-14 min-w-0 border-x border-y-0 border-border bg-transparent px-1 text-center text-xs tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <button
          type="button"
          title={`Perbesar ${label.toLowerCase()}`}
          aria-label={`Perbesar ${label.toLowerCase()}`}
          onClick={() => applyStep(step)}
          className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-8 items-center justify-center"
        >
          <Plus className="size-3.5" aria-hidden />
        </button>
      </div>
      <button
        type="button"
        title={`Kembalikan ${label.toLowerCase()} ke otomatis`}
        aria-label={`Kembalikan ${label.toLowerCase()} ke otomatis`}
        onClick={() => {
          onReset();
          setInputValue("");
        }}
        className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex size-8 items-center justify-center rounded-md"
      >
        <RotateCcw className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}

function selectedImageElement(editor: Editor): HTMLImageElement | null {
  const dom = editor.view.nodeDOM(editor.state.selection.from);
  if (dom instanceof HTMLImageElement) return dom;
  return dom instanceof HTMLElement ? dom.querySelector<HTMLImageElement>("img") : null;
}

function renderedImageWidth(editor: Editor): number | null {
  const image = selectedImageElement(editor);
  if (!image) return null;
  const width = image.getBoundingClientRect().width;
  return width > 0 ? Math.round(width) : null;
}

function setSelectedImageAlignment(
  editor: Editor,
  alignment: WikiImageAlignment,
): boolean {
  if (!editor.isActive("image")) return false;
  const image = selectedImageElement(editor);
  const changed = editor
    .chain()
    .focus()
    .updateAttributes("image", { alignment })
    .run();
  image?.setAttribute("data-align", alignment);
  return changed;
}

function setSelectedImageWidth(editor: Editor, value: number | null): boolean {
  if (!editor.isActive("image")) return false;
  const image = selectedImageElement(editor);

  if (value == null) {
    const changed = editor
      .chain()
      .focus()
      .updateAttributes("image", { width: null, height: null })
      .run();
    image?.style.removeProperty("width");
    image?.style.removeProperty("height");
    return changed;
  }

  const currentWidth = image?.getBoundingClientRect().width ?? 0;
  const currentHeight = image?.getBoundingClientRect().height ?? 0;
  const naturalRatio = image?.naturalWidth && image.naturalHeight
    ? image.naturalWidth / image.naturalHeight
    : 0;
  const ratio = currentWidth > 0 && currentHeight > 0
    ? currentWidth / currentHeight
    : naturalRatio || 1;
  const editorWidth = Math.max(80, editor.view.dom.clientWidth);
  const width = Math.min(clampWikiImageWidth(value), editorWidth);
  const height = Math.max(1, Math.round(width / ratio));
  const changed = editor
    .chain()
    .focus()
    .updateAttributes("image", { width, height })
    .run();
  if (image) {
    image.style.width = `${width}px`;
    image.style.height = `${height}px`;
  }
  return changed;
}

function TableDimensionControls({
  editor,
  rowHeight,
  columnWidth,
}: {
  editor: Editor;
  rowHeight: number | null;
  columnWidth: number | null;
}) {
  const applyRowHeight = (value: number | null) => {
    editor.chain().focus().run();
    setActiveTableRowHeight(editor, value);
  };
  const applyColumnWidth = (value: number | null) => {
    editor.chain().focus().run();
    setActiveTableColumnWidth(editor, value);
  };

  const actionBtn = (
    label: string,
    onClick: () => void,
    icon: React.ReactNode,
    disabled = false,
  ) => (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex size-8 items-center justify-center rounded-md transition-colors disabled:opacity-40"
    >
      {icon}
    </button>
  );

  return (
    <>
      <div role="group" aria-label="Aksi baris" className="flex items-center gap-0.5">
        {actionBtn("Sisipkan baris di atas", () => editor.chain().focus().addRowBefore().run(), <ArrowUpToLine className="size-4" aria-hidden />)}
        {actionBtn("Sisipkan baris di bawah", () => editor.chain().focus().addRowAfter().run(), <ArrowDownToLine className="size-4" aria-hidden />)}
        {actionBtn("Hapus baris", () => editor.chain().focus().deleteRow().run(), <Trash2 className="size-4" aria-hidden />, !editor.can().deleteRow())}
      </div>
      <span className="bg-border mx-1 h-5 w-px" aria-hidden />
      <div role="group" aria-label="Aksi kolom" className="flex items-center gap-0.5">
        {actionBtn("Sisipkan kolom di kiri", () => editor.chain().focus().addColumnBefore().run(), <ArrowLeftToLine className="size-4" aria-hidden />)}
        {actionBtn("Sisipkan kolom di kanan", () => editor.chain().focus().addColumnAfter().run(), <ArrowRightToLine className="size-4" aria-hidden />)}
        {actionBtn("Hapus kolom", () => editor.chain().focus().deleteColumn().run(), <Trash2 className="size-4" aria-hidden />, !editor.can().deleteColumn())}
      </div>
      <span className="bg-border mx-1 h-5 w-px" aria-hidden />
      <div role="group" aria-label="Header dan cell" className="flex items-center gap-0.5">
        {actionBtn("Toggle baris header", () => editor.chain().focus().toggleHeaderRow().run(), <PanelTop className="size-4" aria-hidden />)}
        {actionBtn("Toggle kolom header", () => editor.chain().focus().toggleHeaderColumn().run(), <PanelLeft className="size-4" aria-hidden />)}
        {actionBtn("Gabungkan cell", () => editor.chain().focus().mergeCells().run(), <TableCellsMerge className="size-4" aria-hidden />, !editor.can().mergeCells())}
        {actionBtn("Pisahkan cell", () => editor.chain().focus().splitCell().run(), <TableCellsSplit className="size-4" aria-hidden />, !editor.can().splitCell())}
        {actionBtn("Hapus tabel", () => editor.chain().focus().deleteTable().run(), <TrashTableIcon />)}
      </div>
      <span className="bg-border mx-1 h-5 w-px" aria-hidden />
      <PixelDimensionControl
        label="Tinggi row"
        value={rowHeight}
        fallback={44}
        step={4}
        onApply={applyRowHeight}
        onReset={() => applyRowHeight(null)}
      />
      <span className="bg-border mx-1 h-5 w-px" aria-hidden />
      <PixelDimensionControl
        label="Lebar kolom"
        value={columnWidth}
        fallback={120}
        step={16}
        onApply={applyColumnWidth}
        onReset={() => applyColumnWidth(null)}
      />
      <span className="text-muted-foreground hidden text-[11px] xl:inline">
        Hover tabel untuk grip baris/kolom, atau drag tepinya
      </span>
    </>
  );
}

function ImageDimensionControls({
  editor,
  width,
  alignment,
}: {
  editor: Editor;
  width: number | null;
  alignment: WikiImageAlignment;
}) {
  const applyPercentage = (percentage: number) => {
    setSelectedImageWidth(editor, editor.view.dom.clientWidth * percentage);
  };

  const alignmentButtons: Array<{
    value: WikiImageAlignment;
    label: string;
    icon: React.ReactNode;
  }> = [
    { value: "left", label: "Ratakan gambar ke kiri", icon: <AlignLeft className="size-4" aria-hidden /> },
    { value: "center", label: "Ratakan gambar ke tengah", icon: <AlignCenter className="size-4" aria-hidden /> },
    { value: "right", label: "Ratakan gambar ke kanan", icon: <AlignRight className="size-4" aria-hidden /> },
  ];

  return (
    <>
      <PixelDimensionControl
        label="Lebar gambar"
        value={width}
        fallback={renderedImageWidth(editor) ?? 480}
        step={24}
        onApply={(value) => setSelectedImageWidth(editor, value)}
        onReset={() => setSelectedImageWidth(editor, null)}
      />
      <span className="bg-border mx-1 h-5 w-px" aria-hidden />
      <div role="group" aria-label="Alignment gambar" className="flex items-center gap-0.5">
        {alignmentButtons.map((option) => (
          <button
            key={option.value}
            type="button"
            title={option.label}
            aria-label={option.label}
            aria-pressed={alignment === option.value}
            onClick={() => setSelectedImageAlignment(editor, option.value)}
            className={cn(
              "text-muted-foreground hover:bg-muted hover:text-foreground inline-flex size-8 items-center justify-center rounded-md",
              alignment === option.value && "bg-primary/10 text-primary",
            )}
          >
            {option.icon}
          </button>
        ))}
        <button
          type="button"
          title="Lebar penuh seperti justify"
          aria-label="Lebar penuh seperti justify"
          onClick={() => applyPercentage(1)}
          className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex size-8 items-center justify-center rounded-md"
        >
          <AlignJustify className="size-4" aria-hidden />
        </button>
      </div>
      <div role="group" aria-label="Preset lebar gambar" className="flex items-center gap-0.5">
        {[25, 50, 75, 100].map((percentage) => (
          <button
            key={percentage}
            type="button"
            title={`Atur gambar ke ${percentage}% lebar editor`}
            onClick={() => applyPercentage(percentage / 100)}
            className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-md px-2 py-1.5 text-xs"
          >
            {percentage}%
          </button>
        ))}
      </div>
      <span className="text-muted-foreground hidden text-[11px] xl:inline">
        Atau drag titik sudut gambar
      </span>
    </>
  );
}

function Toolbar({
  editor,
  onOpenLinkDialog,
  onRemoveLink,
  onOpenMediaDialog,
  editable,
}: {
  editor: Editor;
  onOpenLinkDialog: () => void;
  onRemoveLink: () => void;
  onOpenMediaDialog: (mode: RichTextMediaMode) => void;
  editable: boolean;
}) {
  const toolbarState = useEditorState({
    editor,
    selector: ({ editor: currentEditor, transactionNumber }) => {
      const isTable = currentEditor.isActive("table");
      const isImage = currentEditor.isActive("image");
      const isCallout = currentEditor.isActive("callout");
      const imageAttributes = currentEditor.getAttributes("image");
      const imageWidth = Number(imageAttributes.width);
      return {
        transactionNumber,
        isTable,
        isImage,
        isCallout,
        calloutVariant: normalizeCalloutVariant(currentEditor.getAttributes("callout").variant),
        rowHeight: isTable ? getActiveTableRowHeight(currentEditor) : null,
        columnWidth: isTable ? getActiveTableColumnWidth(currentEditor) : null,
        imageWidth: Number.isFinite(imageWidth) && imageWidth > 0 ? imageWidth : null,
        imageAlignment: normalizeWikiImageAlignment(imageAttributes.alignment),
      };
    },
  });

  if (!editable) return null;

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
      className="border-border/60 bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-14 z-10 flex flex-wrap items-center gap-0.5 rounded-lg border px-1.5 py-1 backdrop-blur"
    >
      <BlockTypeDropdown editor={editor} />
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
      <EditorColorPicker editor={editor} mode="color" />
      <EditorColorPicker editor={editor} mode="highlight" />
      <TextAlignDropdown editor={editor} />
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
      <DropdownMenu>
        <DropdownMenuTrigger
          title="Sisipkan block"
          className="text-muted-foreground hover:bg-muted hover:text-foreground flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors"
        >
          <Plus className="size-4" aria-hidden />
          Sisipkan
          <ChevronDown className="size-3" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-52" align="start">
          <DropdownMenuItem
            onClick={() =>
              editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
            }
          >
            <Table2 /> Tabel
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => editor.chain().focus().setCallout({ variant: "info" }).run()}
          >
            <Lightbulb /> Callout
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => editor.chain().focus().setDetails().run()}>
            <ListCollapse /> Toggle list
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => editor.chain().focus().setHorizontalRule().run()}>
            <DividerIcon /> Garis pemisah
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onOpenMediaDialog("image")}>
            <ImageIcon /> Gambar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onOpenMediaDialog("file")}>
            <FileUp /> File
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onOpenMediaDialog("embed")}>
            <Braces /> Embed tautan/video
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
      {toolbarState.isTable || toolbarState.isImage || toolbarState.isCallout ? (
        <div className="border-border mt-1 flex basis-full flex-wrap items-center gap-2 border-t px-1 pt-1">
          {toolbarState.isTable ? (
            <TableDimensionControls
              editor={editor}
              rowHeight={toolbarState.rowHeight}
              columnWidth={toolbarState.columnWidth}
            />
          ) : null}
          {toolbarState.isImage ? (
            <ImageDimensionControls
              editor={editor}
              width={toolbarState.imageWidth}
              alignment={toolbarState.imageAlignment}
            />
          ) : null}
          {toolbarState.isCallout && !toolbarState.isTable && !toolbarState.isImage ? (
            <CalloutControls editor={editor} variant={toolbarState.calloutVariant} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Mode tanpa toolbar (ala Notion): bar ini hanya muncul saat GAMBAR dipilih
 * (aksi klik yang disengaja). Tabel dikontrol lewat grip hover + drag; callout
 * lewat bubble menu — sekadar meletakkan kursor tidak memunculkan apa pun.
 */
function EditorContextualBar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: currentEditor, transactionNumber }) => {
      const isImage = currentEditor.isActive("image");
      const imageAttributes = currentEditor.getAttributes("image");
      const imageWidth = Number(imageAttributes.width);
      return {
        transactionNumber,
        isImage,
        imageWidth: Number.isFinite(imageWidth) && imageWidth > 0 ? imageWidth : null,
        imageAlignment: normalizeWikiImageAlignment(imageAttributes.alignment),
      };
    },
  });

  if (!state.isImage) return null;

  return (
    <div
      role="toolbar"
      aria-label="Kontrol gambar"
      className="border-border/60 bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-14 z-10 flex flex-wrap items-center gap-2 rounded-lg border px-2 py-1 backdrop-blur"
    >
      <ImageDimensionControls
        editor={editor}
        width={state.imageWidth}
        alignment={state.imageAlignment}
      />
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

/** Dropdown jenis blok (Teks/H1–H3) — menggantikan 3 tombol heading agar toolbar lega. */
function BlockTypeDropdown({ editor }: { editor: Editor }) {
  const options = [
    {
      key: "p",
      label: "Teks",
      icon: <Pilcrow className="size-4" aria-hidden />,
      active: editor.isActive("paragraph"),
      run: () => editor.chain().focus().setParagraph().run(),
    },
    {
      key: "h1",
      label: "Heading 1",
      icon: <Heading1 className="size-4" aria-hidden />,
      active: editor.isActive("heading", { level: 1 }),
      run: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      key: "h2",
      label: "Heading 2",
      icon: <Heading2 className="size-4" aria-hidden />,
      active: editor.isActive("heading", { level: 2 }),
      run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      key: "h3",
      label: "Heading 3",
      icon: <Heading3 className="size-4" aria-hidden />,
      active: editor.isActive("heading", { level: 3 }),
      run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
  ];
  const current = options.find((option) => option.key !== "p" && option.active) ?? options[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        title="Jenis blok"
        aria-label="Jenis blok"
        className="text-muted-foreground hover:bg-muted hover:text-foreground flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors"
      >
        {current.icon}
        <span className="hidden sm:inline">{current.label}</span>
        <ChevronDown className="size-3" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-44" align="start">
        {options.map((option) => (
          <DropdownMenuItem
            key={option.key}
            onClick={option.run}
            className={cn(current.key === option.key && "bg-primary/10 text-primary")}
          >
            {option.icon} {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const TEXT_ALIGN_OPTIONS: Array<{
  value: "left" | "center" | "right" | "justify";
  label: string;
  icon: React.ReactNode;
}> = [
  { value: "left", label: "Rata kiri", icon: <AlignLeft className="size-4" aria-hidden /> },
  { value: "center", label: "Rata tengah", icon: <AlignCenter className="size-4" aria-hidden /> },
  { value: "right", label: "Rata kanan", icon: <AlignRight className="size-4" aria-hidden /> },
  { value: "justify", label: "Rata kiri-kanan", icon: <AlignJustify className="size-4" aria-hidden /> },
];

function TextAlignDropdown({ editor }: { editor: Editor }) {
  const active =
    TEXT_ALIGN_OPTIONS.find((option) => editor.isActive({ textAlign: option.value })) ??
    TEXT_ALIGN_OPTIONS[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        title="Perataan teks"
        aria-label="Perataan teks"
        className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex h-8 items-center gap-0.5 rounded-md px-1.5 transition-colors"
      >
        {active.icon}
        <ChevronDown className="size-3" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-44" align="start">
        {TEXT_ALIGN_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => editor.chain().focus().setTextAlign(option.value).run()}
            className={cn(active.value === option.value && "bg-primary/10 text-primary")}
          >
            {option.icon} {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const CALLOUT_VARIANT_OPTIONS: Array<{ value: WikiCalloutVariant; label: string }> = [
  { value: "info", label: "Info" },
  { value: "tip", label: "Tips" },
  { value: "warning", label: "Peringatan" },
  { value: "danger", label: "Bahaya" },
];

function CalloutControls({
  editor,
  variant,
}: {
  editor: Editor;
  variant: WikiCalloutVariant;
}) {
  return (
    <>
      <span className="text-muted-foreground whitespace-nowrap text-xs font-medium">Callout</span>
      <div role="group" aria-label="Varian callout" className="flex items-center gap-0.5">
        {CALLOUT_VARIANT_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            title={`Callout ${option.label}`}
            aria-pressed={variant === option.value}
            onClick={() => editor.chain().focus().updateCalloutVariant(option.value).run()}
            className={cn(
              "text-muted-foreground hover:bg-muted hover:text-foreground rounded-md px-2 py-1.5 text-xs transition-colors",
              variant === option.value && "bg-primary/10 text-primary",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      <span className="bg-border mx-1 h-5 w-px" aria-hidden />
      <button
        type="button"
        title="Hapus callout (angkat isi keluar)"
        onClick={() => editor.chain().focus().unsetCallout().run()}
        className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-md px-2 py-1.5 text-xs transition-colors"
      >
        Hapus callout
      </button>
    </>
  );
}
