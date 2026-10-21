"use client";

import { Keyboard, Maximize, Minus, Plus, ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const ZOOM_PRESETS = [0.5, 1, 2];

export function WhiteboardZoomControls({
  zoom,
  hasSelection,
  onZoomIn,
  onZoomOut,
  onZoomTo,
  onFit,
  onFitSelection,
  onShowShortcuts,
}: {
  zoom: number;
  hasSelection: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomTo: (zoom: number) => void;
  onFit: () => void;
  onFitSelection: () => void;
  onShowShortcuts: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={onShowShortcuts}
              aria-label="Pintasan papan tik"
              className="bg-card/95 hidden size-9 rounded-xl shadow-md backdrop-blur sm:inline-flex"
            >
              <Keyboard className="size-4" aria-hidden />
            </Button>
          }
        />
        <TooltipContent side="top">Pintasan papan tik (?)</TooltipContent>
      </Tooltip>

      <div className="border-border bg-card/95 flex h-9 items-center rounded-xl border p-0.5 shadow-md backdrop-blur">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={onZoomOut}
                aria-label="Perkecil"
                className="rounded-lg"
              >
                <Minus className="size-3.5" aria-hidden />
              </Button>
            }
          />
          <TooltipContent side="top">Perkecil (Ctrl −)</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label="Pilihan zoom"
                className="text-foreground hover:bg-muted focus-visible:ring-ring min-w-13 rounded-lg px-1.5 py-1 text-center text-xs font-semibold tabular-nums outline-none focus-visible:ring-2"
              >
                {Math.round(zoom * 100)}%
              </button>
            }
          />
          <DropdownMenuContent align="end" side="top" className="w-52">
            {ZOOM_PRESETS.map((preset) => (
              <DropdownMenuItem key={preset} onClick={() => onZoomTo(preset)}>
                Zoom {preset * 100}%
                {preset === 1 ? (
                  <DropdownMenuShortcut>Ctrl 0</DropdownMenuShortcut>
                ) : null}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onFit}>
              <Maximize className="size-3.5" aria-hidden />
              Muat seluruh papan
              <DropdownMenuShortcut>1</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!hasSelection} onClick={onFitSelection}>
              <ScanSearch className="size-3.5" aria-hidden />
              Perbesar ke pilihan
              <DropdownMenuShortcut>2</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={onZoomIn}
                aria-label="Perbesar"
                className="rounded-lg"
              >
                <Plus className="size-3.5" aria-hidden />
              </Button>
            }
          />
          <TooltipContent side="top">Perbesar (Ctrl +)</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
