"use client";

import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { NodeSelection } from "@tiptap/pm/state";
import { CellSelection } from "@tiptap/pm/tables";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Code,
  X,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListChecks,
  ListOrdered,
  Pilcrow,
  Quote,
  Strikethrough,
  Underline as UnderlineIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EditorColorPicker } from "@/components/editor-color-picker";
import { FontSizeControl } from "@/components/editor-font-size-control";
import { normalizeCalloutVariant, type WikiCalloutVariant } from "@/lib/tiptap-callout";
import { cn } from "@/lib/utils";

const CALLOUT_SWATCHES: Array<{ value: WikiCalloutVariant; label: string; color: string }> = [
  { value: "info", label: "Info", color: "#0ea5e9" },
  { value: "tip", label: "Tips", color: "#10b981" },
  { value: "warning", label: "Peringatan", color: "#f59e0b" },
  { value: "danger", label: "Bahaya", color: "#f43f5e" },
];

type TextAlignValue = "left" | "center" | "right" | "justify";

const ALIGN_OPTIONS: Array<{ value: TextAlignValue; label: string; icon: React.ReactNode }> = [
  { value: "left", label: "Rata kiri", icon: <AlignLeft className="size-4" aria-hidden /> },
  { value: "center", label: "Rata tengah", icon: <AlignCenter className="size-4" aria-hidden /> },
  { value: "right", label: "Rata kanan", icon: <AlignRight className="size-4" aria-hidden /> },
  { value: "justify", label: "Rata kiri-kanan", icon: <AlignJustify className="size-4" aria-hidden /> },
];

function activeAlign(editor: Editor): TextAlignValue {
  for (const option of ["center", "right", "justify"] as const) {
    if (editor.isActive({ textAlign: option })) return option;
  }
  return "left";
}

/** Menu format melayang ala Notion, muncul saat teks diseleksi. */
export function EditorBubbleMenu({
  editor,
  onOpenLinkDialog,
}: {
  editor: Editor;
  onOpenLinkDialog: () => void;
}) {
  const btn = (
    active: boolean,
    label: string,
    onClick: () => void,
    icon: React.ReactNode,
  ) => (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "text-muted-foreground hover:bg-muted hover:text-foreground inline-flex size-8 items-center justify-center rounded-md transition-colors",
        active && "bg-primary/10 text-primary hover:bg-primary/15",
      )}
    >
      {icon}
    </button>
  );

  const turnInto: Array<{ label: string; icon: React.ReactNode; run: () => void; active: boolean }> = [
    {
      label: "Teks",
      icon: <Pilcrow />,
      run: () => editor.chain().focus().setParagraph().run(),
      active: editor.isActive("paragraph"),
    },
    {
      label: "Heading 1",
      icon: <Heading1 />,
      run: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      active: editor.isActive("heading", { level: 1 }),
    },
    {
      label: "Heading 2",
      icon: <Heading2 />,
      run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      active: editor.isActive("heading", { level: 2 }),
    },
    {
      label: "Heading 3",
      icon: <Heading3 />,
      run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      active: editor.isActive("heading", { level: 3 }),
    },
    {
      label: "Daftar poin",
      icon: <List />,
      run: () => editor.chain().focus().toggleBulletList().run(),
      active: editor.isActive("bulletList"),
    },
    {
      label: "Daftar nomor",
      icon: <ListOrdered />,
      run: () => editor.chain().focus().toggleOrderedList().run(),
      active: editor.isActive("orderedList"),
    },
    {
      label: "Checklist",
      icon: <ListChecks />,
      run: () => editor.chain().focus().toggleTaskList().run(),
      active: editor.isActive("taskList"),
    },
    {
      label: "Kutipan",
      icon: <Quote />,
      run: () => editor.chain().focus().toggleBlockquote().run(),
      active: editor.isActive("blockquote"),
    },
  ];
  const currentBlock = turnInto.find((item) => item.active) ?? turnInto[0];
  const align = activeAlign(editor);
  const alignOption = ALIGN_OPTIONS.find((option) => option.value === align) ?? ALIGN_OPTIONS[0];

  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: "top", offset: 8 }}
      shouldShow={({ editor: currentEditor, state }) => {
        if (!currentEditor.isEditable) return false;
        const { selection } = state;
        if (selection.empty) return false;
        if (selection instanceof NodeSelection) return false;
        if (selection instanceof CellSelection) return false;
        if (currentEditor.isActive("codeBlock")) return false;
        return state.doc.textBetween(selection.from, selection.to, " ").trim().length > 0;
      }}
      className="border-border bg-card flex items-center gap-0.5 rounded-lg border p-1 shadow-lg"
    >
      <DropdownMenu>
        <DropdownMenuTrigger
          title="Ubah jadi"
          onMouseDown={(event) => event.preventDefault()}
          className="text-muted-foreground hover:bg-muted hover:text-foreground flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors"
        >
          {currentBlock.label}
          <ChevronDown className="size-3" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-44" align="start">
          {turnInto.map((item) => (
            <DropdownMenuItem
              key={item.label}
              onClick={item.run}
              className={cn(item.active && "bg-primary/10 text-primary")}
            >
              {item.icon} {item.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <span className="bg-border mx-0.5 h-5 w-px" aria-hidden />
      <FontSizeControl editor={editor} />
      <span className="bg-border mx-0.5 h-5 w-px" aria-hidden />
      {btn(editor.isActive("bold"), "Tebal", () => editor.chain().focus().toggleBold().run(), <Bold className="size-4" aria-hidden />)}
      {btn(editor.isActive("italic"), "Miring", () => editor.chain().focus().toggleItalic().run(), <Italic className="size-4" aria-hidden />)}
      {btn(editor.isActive("underline"), "Garis bawah", () => editor.chain().focus().toggleUnderline().run(), <UnderlineIcon className="size-4" aria-hidden />)}
      {btn(editor.isActive("strike"), "Coret", () => editor.chain().focus().toggleStrike().run(), <Strikethrough className="size-4" aria-hidden />)}
      {btn(editor.isActive("code"), "Kode inline", () => editor.chain().focus().toggleCode().run(), <Code className="size-4" aria-hidden />)}
      {btn(editor.isActive("link"), "Tautan", onOpenLinkDialog, <LinkIcon className="size-4" aria-hidden />)}
      <span className="bg-border mx-0.5 h-5 w-px" aria-hidden />
      <EditorColorPicker editor={editor} mode="color" />
      <EditorColorPicker editor={editor} mode="highlight" />
      <DropdownMenu>
        <DropdownMenuTrigger
          title="Perataan teks"
          aria-label="Perataan teks"
          onMouseDown={(event) => event.preventDefault()}
          className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex size-8 items-center justify-center rounded-md transition-colors"
        >
          {alignOption.icon}
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-44" align="start">
          {ALIGN_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => editor.chain().focus().setTextAlign(option.value).run()}
              className={cn(align === option.value && "bg-primary/10 text-primary")}
            >
              {option.icon} {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {editor.isActive("callout") ? (
        <>
          <span className="bg-border mx-0.5 h-5 w-px" aria-hidden />
          {CALLOUT_SWATCHES.map((swatch) => {
            const activeVariant = normalizeCalloutVariant(
              editor.getAttributes("callout").variant,
            );
            return (
              <button
                key={swatch.value}
                type="button"
                title={`Callout ${swatch.label}`}
                aria-label={`Callout ${swatch.label}`}
                aria-pressed={activeVariant === swatch.value}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() =>
                  editor.chain().focus().updateCalloutVariant(swatch.value).run()
                }
                className="hover:bg-muted inline-flex size-8 items-center justify-center rounded-md transition-colors"
              >
                <span
                  aria-hidden
                  className={cn(
                    "size-3.5 rounded-full",
                    activeVariant === swatch.value &&
                      "ring-primary ring-2 ring-offset-1 ring-offset-popover",
                  )}
                  style={{ backgroundColor: swatch.color }}
                />
              </button>
            );
          })}
          {btn(
            false,
            "Hapus callout (angkat isi keluar)",
            () => editor.chain().focus().unsetCallout().run(),
            <X className="size-4" aria-hidden />,
          )}
        </>
      ) : null}
    </BubbleMenu>
  );
}
