"use client";

import { useState } from "react";
import {
  ArrowUpRight,
  ChevronUp,
  Circle,
  Diamond,
  Eraser,
  Frame,
  Hand,
  Highlighter,
  Image as ImageIcon,
  Lock,
  Minus,
  MousePointer2,
  Pencil,
  Redo2,
  Spline,
  Square,
  StickyNote,
  Triangle,
  Type,
  Undo2,
  Unlock,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { paletteEntry, STICKY_PALETTE } from "@/lib/whiteboard/palette";
import { TOOL_META, type WhiteboardTool } from "@/lib/whiteboard/tools";
import type { WhiteboardColorToken } from "@/lib/whiteboard/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Dock alat di bawah kanvas.
 *
 * Alat sejenis (bentuk, garis, pena) dilipat jadi satu tombol yang mengingat
 * varian terakhir, plus panah kecil untuk memilih varian lain — dock tetap
 * muat di layar sempit tanpa menyembunyikan alat apa pun. Sticky note
 * mendapat tempat utama dan menampilkan warna kertas yang akan dipakai.
 */

const TOOL_ICONS: Record<WhiteboardTool, LucideIcon> = {
  select: MousePointer2,
  hand: Hand,
  sticky: StickyNote,
  rectangle: Square,
  ellipse: Circle,
  diamond: Diamond,
  triangle: Triangle,
  arrow: ArrowUpRight,
  line: Minus,
  connector: Spline,
  draw: Pencil,
  highlighter: Highlighter,
  eraser: Eraser,
  text: Type,
  frame: Frame,
  image: ImageIcon,
  laser: Zap,
};

type FamilyKey = "shapes" | "lines" | "pens";

const FAMILIES: Record<FamilyKey, { label: string; tools: WhiteboardTool[] }> = {
  shapes: { label: "Bentuk", tools: ["rectangle", "ellipse", "diamond", "triangle"] },
  lines: { label: "Garis & panah", tools: ["arrow", "connector", "line"] },
  pens: { label: "Pena", tools: ["draw", "highlighter"] },
};

export function WhiteboardToolbar({
  tool,
  onToolChange,
  toolLocked,
  onToggleToolLock,
  stickyColor,
  onStickyColorChange,
  dark,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: {
  tool: WhiteboardTool;
  onToolChange: (tool: WhiteboardTool) => void;
  toolLocked: boolean;
  onToggleToolLock: () => void;
  stickyColor: WhiteboardColorToken;
  onStickyColorChange: (color: WhiteboardColorToken) => void;
  dark: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}) {
  // Varian terakhir yang dipakai per keluarga alat. Saat alat aktif berasal
  // dari keluarga itu (mis. lewat pintasan), tombolnya ikut menampilkannya.
  const [lastUsed, setLastUsed] = useState<Record<FamilyKey, WhiteboardTool>>({
    shapes: "rectangle",
    lines: "arrow",
    pens: "draw",
  });

  const familyTool = (key: FamilyKey) =>
    FAMILIES[key].tools.includes(tool) ? tool : lastUsed[key];

  const pickFromFamily = (key: FamilyKey, next: WhiteboardTool) => {
    setLastUsed((prev) => ({ ...prev, [key]: next }));
    onToolChange(next);
  };

  return (
    <div
      role="toolbar"
      aria-label="Alat papan"
      className="border-border bg-card/95 flex items-center gap-0.5 overflow-x-auto rounded-2xl border p-1 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.35)] backdrop-blur [scrollbar-width:none]"
    >
      <ToolButton tool="select" active={tool === "select"} onSelect={onToolChange} />
      <ToolButton tool="hand" active={tool === "hand"} onSelect={onToolChange} />

      <Divider />

      <StickyButton
        active={tool === "sticky"}
        color={stickyColor}
        dark={dark}
        onSelect={() => onToolChange("sticky")}
        onColorChange={onStickyColorChange}
      />
      <ToolButton tool="text" active={tool === "text"} onSelect={onToolChange} />
      {(Object.keys(FAMILIES) as FamilyKey[]).map((key) => (
        <FamilyButton
          key={key}
          family={key}
          current={familyTool(key)}
          active={FAMILIES[key].tools.includes(tool)}
          onSelect={(next) => pickFromFamily(key, next)}
        />
      ))}
      <ToolButton tool="eraser" active={tool === "eraser"} onSelect={onToolChange} />

      <Divider />

      <ToolButton tool="frame" active={tool === "frame"} onSelect={onToolChange} />
      <ToolButton tool="image" active={false} onSelect={onToolChange} />
      <ToolButton tool="laser" active={tool === "laser"} onSelect={onToolChange} />

      <Divider />

      <DockButton
        label={toolLocked ? "Alat tetap aktif" : "Kembali ke Pilih setelah membuat"}
        shortcut="Q"
        pressed={toolLocked}
        onClick={onToggleToolLock}
        tone={toolLocked ? "accent" : "default"}
      >
        {toolLocked ? (
          <Lock className="size-4" aria-hidden />
        ) : (
          <Unlock className="size-4" aria-hidden />
        )}
      </DockButton>
      <DockButton label="Urungkan" shortcut="Ctrl Z" disabled={!canUndo} onClick={onUndo}>
        <Undo2 className="size-4" aria-hidden />
      </DockButton>
      <DockButton
        label="Ulangi"
        shortcut="Ctrl Shift Z"
        disabled={!canRedo}
        onClick={onRedo}
      >
        <Redo2 className="size-4" aria-hidden />
      </DockButton>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Divider() {
  return <span className="bg-border mx-1 h-6 w-px shrink-0" aria-hidden />;
}

function ShortcutHint({ keys }: { keys: string }) {
  return (
    <span className="ml-2 inline-flex gap-0.5">
      {keys.split(" ").map((key) => (
        <kbd
          key={key}
          className="bg-background/15 rounded px-1 font-sans text-[10px] font-semibold uppercase"
        >
          {key}
        </kbd>
      ))}
    </span>
  );
}

function DockButton({
  label,
  shortcut,
  pressed,
  disabled,
  tone = "default",
  onClick,
  children,
}: {
  label: string;
  shortcut?: string | null;
  pressed?: boolean;
  disabled?: boolean;
  tone?: "default" | "active" | "accent";
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            aria-pressed={pressed}
            className={cn(
              "focus-visible:ring-ring relative flex size-9 shrink-0 items-center justify-center rounded-xl outline-none transition-colors focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-35",
              tone === "active"
                ? "bg-primary text-primary-foreground"
                : tone === "accent"
                  ? "bg-primary/10 text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {children}
          </button>
        }
      />
      <TooltipContent side="top">
        {label}
        {shortcut ? <ShortcutHint keys={shortcut} /> : null}
      </TooltipContent>
    </Tooltip>
  );
}

function ToolButton({
  tool,
  active,
  onSelect,
}: {
  tool: WhiteboardTool;
  active: boolean;
  onSelect: (tool: WhiteboardTool) => void;
}) {
  const Icon = TOOL_ICONS[tool];
  const meta = TOOL_META[tool];
  return (
    <DockButton
      label={meta.label}
      shortcut={meta.shortcut}
      pressed={active}
      tone={active ? "active" : "default"}
      onClick={() => onSelect(tool)}
    >
      <Icon className="size-4" aria-hidden />
    </DockButton>
  );
}

/** Tombol keluarga alat: klik memakai varian aktif, panah membuka varian lain. */
function FamilyButton({
  family,
  current,
  active,
  onSelect,
}: {
  family: FamilyKey;
  current: WhiteboardTool;
  active: boolean;
  onSelect: (tool: WhiteboardTool) => void;
}) {
  const Icon = TOOL_ICONS[current];
  const meta = TOOL_META[current];
  const { label, tools } = FAMILIES[family];

  return (
    <div
      className={cn(
        "flex shrink-0 items-center rounded-xl transition-colors",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground",
      )}
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              onClick={() => onSelect(current)}
              aria-label={meta.label}
              aria-pressed={active}
              className={cn(
                "focus-visible:ring-ring flex size-9 items-center justify-center rounded-l-xl outline-none focus-visible:ring-2",
                !active && "hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden />
            </button>
          }
        />
        <TooltipContent side="top">
          {meta.label}
          {meta.shortcut ? <ShortcutHint keys={meta.shortcut} /> : null}
        </TooltipContent>
      </Tooltip>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label={`Pilih ${label.toLowerCase()}`}
              className={cn(
                "focus-visible:ring-ring -ml-0.5 flex h-9 w-5 items-center justify-center rounded-r-xl outline-none focus-visible:ring-2",
                !active && "hover:bg-muted hover:text-foreground",
              )}
            >
              <ChevronUp className="size-3.5" aria-hidden />
            </button>
          }
        />
        <DropdownMenuContent side="top" align="center" className="w-48">
          {tools.map((item) => {
            const ItemIcon = TOOL_ICONS[item];
            const itemMeta = TOOL_META[item];
            return (
              <DropdownMenuItem
                key={item}
                onClick={() => onSelect(item)}
                className={cn(item === current && active && "bg-accent")}
              >
                <ItemIcon className="size-4" aria-hidden />
                {itemMeta.label}
                {itemMeta.shortcut ? (
                  <DropdownMenuShortcut className="uppercase">
                    {itemMeta.shortcut}
                  </DropdownMenuShortcut>
                ) : null}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/**
 * Tombol sticky note: ikonnya adalah sticky mini berwarna kertas yang akan
 * dipakai, jadi pengguna tahu warna apa yang keluar sebelum mengklik.
 */
function StickyButton({
  active,
  color,
  dark,
  onSelect,
  onColorChange,
}: {
  active: boolean;
  color: WhiteboardColorToken;
  dark: boolean;
  onSelect: () => void;
  onColorChange: (color: WhiteboardColorToken) => void;
}) {
  const entry = paletteEntry(color, dark);
  return (
    <div
      className={cn(
        "flex shrink-0 items-center rounded-xl transition-colors",
        active ? "bg-primary/10 ring-primary/50 ring-1" : "",
      )}
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              onClick={onSelect}
              aria-label="Sticky note"
              aria-pressed={active}
              className="focus-visible:ring-ring hover:bg-muted flex h-9 w-10 items-center justify-center rounded-l-xl outline-none focus-visible:ring-2"
            >
              <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
                <path
                  d="M3 3.5 Q3 3 3.5 3 H18.5 Q19 3 19 3.5 V14 L14 19 H3.5 Q3 19 3 18.5 Z"
                  fill={entry.surface}
                  stroke={dark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.16)"}
                  strokeWidth="1"
                  transform={active ? "rotate(-6 11 11)" : undefined}
                  style={{ transition: "transform 160ms ease" }}
                />
                <path
                  d="M19 14 L14 14 L14 19 Z"
                  fill={dark ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.1)"}
                  transform={active ? "rotate(-6 11 11)" : undefined}
                  style={{ transition: "transform 160ms ease" }}
                />
              </svg>
            </button>
          }
        />
        <TooltipContent side="top">
          Sticky note
          <ShortcutHint keys="N" />
        </TooltipContent>
      </Tooltip>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label="Pilih warna sticky"
              className="focus-visible:ring-ring text-muted-foreground hover:bg-muted hover:text-foreground -ml-0.5 flex h-9 w-5 items-center justify-center rounded-r-xl outline-none focus-visible:ring-2"
            >
              <ChevronUp className="size-3.5" aria-hidden />
            </button>
          }
        />
        <DropdownMenuContent side="top" align="start" className="w-auto p-2">
          <p className="text-muted-foreground px-0.5 pb-2 text-xs font-medium">
            Warna sticky berikutnya
          </p>
          <div className="grid grid-cols-6 gap-1.5">
            {STICKY_PALETTE.map((token) => {
              const swatch = paletteEntry(token, dark);
              return (
                <DropdownMenuItem
                  key={token}
                  onClick={() => onColorChange(token)}
                  aria-label={swatch.label}
                  className={cn(
                    "size-7 justify-center rounded-md border p-0",
                    token === color
                      ? "ring-primary ring-2 ring-offset-1"
                      : "border-black/10 dark:border-white/15",
                  )}
                  style={{ background: swatch.surface }}
                />
              );
            })}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
