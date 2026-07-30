"use client";

import { Maximize, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function WhiteboardZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
  onFit,
}: {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onFit: () => void;
}) {
  return (
    <div className="border-border bg-card/95 flex items-center gap-0.5 rounded-xl border p-1 shadow-lg backdrop-blur">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onZoomOut}
              aria-label="Perkecil"
            >
              <Minus className="size-3.5" aria-hidden />
            </Button>
          }
        />
        <TooltipContent side="top">Perkecil · Ctrl+−</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              onClick={onReset}
              className="text-muted-foreground hover:text-foreground min-w-12 rounded-md px-1 text-center text-[11px] font-medium tabular-nums"
            >
              {Math.round(zoom * 100)}%
            </button>
          }
        />
        <TooltipContent side="top">Kembali ke 100% · Ctrl+0</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onZoomIn}
              aria-label="Perbesar"
            >
              <Plus className="size-3.5" aria-hidden />
            </Button>
          }
        />
        <TooltipContent side="top">Perbesar · Ctrl++</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onFit}
              aria-label="Muat seluruh papan"
            >
              <Maximize className="size-3.5" aria-hidden />
            </Button>
          }
        />
        <TooltipContent side="top">Muat seluruh papan · 1</TooltipContent>
      </Tooltip>
    </div>
  );
}
