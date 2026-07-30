"use client";

import {
  ArrowUpRight,
  Circle,
  Diamond,
  Eraser,
  Frame,
  Hand,
  Highlighter,
  Image as ImageIcon,
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
  Zap,
  type LucideIcon,
} from "lucide-react";
import { TOOL_META, type WhiteboardTool } from "@/lib/whiteboard/tools";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Bilah alat mengambang di atas kanvas.
 *
 * Urutannya sengaja meniru Miro/Figma: alat navigasi di kiri, alat pembuat
 * objek di tengah, dan undo/redo di kanan.
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

const GROUPS: WhiteboardTool[][] = [
  ["select", "hand"],
  ["sticky", "text", "rectangle", "ellipse", "diamond", "triangle"],
  ["arrow", "line", "connector"],
  ["draw", "highlighter", "eraser"],
  ["frame", "image", "laser"],
];

export function WhiteboardToolbar({
  tool,
  onToolChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: {
  tool: WhiteboardTool;
  onToolChange: (tool: WhiteboardTool) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}) {
  return (
    <div className="border-border bg-card/95 flex items-center gap-0.5 rounded-xl border p-1 shadow-lg backdrop-blur">
      {GROUPS.map((group, index) => (
        <div key={index} className="flex items-center gap-0.5">
          {index > 0 ? (
            <Separator orientation="vertical" className="mx-0.5 h-6" />
          ) : null}
          {group.map((item) => {
            const Icon = TOOL_ICONS[item];
            const meta = TOOL_META[item];
            const active = tool === item;
            return (
              <Tooltip key={item}>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      onClick={() => onToolChange(item)}
                      aria-label={meta.label}
                      aria-pressed={active}
                      className={cn(
                        "flex size-8 items-center justify-center rounded-lg transition-colors",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <Icon className="size-4" aria-hidden />
                    </button>
                  }
                />
                <TooltipContent side="bottom">
                  {meta.label}
                  {meta.shortcut ? (
                    <span className="text-muted-foreground ml-1.5 uppercase">
                      {meta.shortcut}
                    </span>
                  ) : null}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      ))}

      <Separator orientation="vertical" className="mx-0.5 h-6" />

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={!canUndo}
              onClick={onUndo}
              aria-label="Urungkan"
            >
              <Undo2 className="size-4" aria-hidden />
            </Button>
          }
        />
        <TooltipContent side="bottom">Urungkan · Ctrl+Z</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={!canRedo}
              onClick={onRedo}
              aria-label="Ulangi"
            >
              <Redo2 className="size-4" aria-hidden />
            </Button>
          }
        />
        <TooltipContent side="bottom">Ulangi · Ctrl+Shift+Z</TooltipContent>
      </Tooltip>
    </div>
  );
}
