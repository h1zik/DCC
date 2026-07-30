"use client";

import Image from "next/image";
import { Download, FileJson, FileImage, PencilLine, Users } from "lucide-react";
import type { WhiteboardPresence } from "@/lib/whiteboard/bus";
import { cursorColorFor } from "@/lib/whiteboard/palette";
import { worldToScreen, type Viewport } from "@/lib/whiteboard/geometry";
import { TOOL_META, type WhiteboardTool } from "@/lib/whiteboard/tools";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { SyncStatus } from "./use-whiteboard-sync";

/**
 * Kursor peserta lain di atas kanvas + bilah status kolaborasi.
 */

export function WhiteboardPresenceLayer({
  presence,
  viewport,
  currentUserId,
}: {
  presence: WhiteboardPresence[];
  viewport: Viewport;
  currentUserId: string;
}) {
  return (
    <g style={{ pointerEvents: "none" }}>
      {presence.map((peer) => {
        if (!peer.cursor) return null;
        const screen = worldToScreen(peer.cursor, viewport);
        const color = cursorColorFor(peer.userId);
        const isLaser = peer.tool === "laser";
        const label =
          peer.userId === currentUserId ? `${peer.name} (tab lain)` : peer.name;

        return (
          <g key={peer.sessionId} transform={`translate(${screen.x} ${screen.y})`}>
            {isLaser ? (
              <>
                <circle r={14} fill={color} opacity={0.18} />
                <circle r={5} fill={color} opacity={0.85} />
              </>
            ) : (
              <>
                <path
                  d="M0 0 L0 16 L4.2 12.4 L6.8 18 L9.6 16.7 L7 11.2 L12 11 Z"
                  fill={color}
                  stroke="#ffffff"
                  strokeWidth={1}
                  strokeLinejoin="round"
                />
                <g transform="translate(12 18)">
                  <rect
                    x={0}
                    y={0}
                    rx={4}
                    height={18}
                    width={Math.max(28, label.length * 6.4 + 12)}
                    fill={color}
                  />
                  <text
                    x={6}
                    y={12.5}
                    fill="#ffffff"
                    fontSize={11}
                    fontWeight={600}
                    style={{ userSelect: "none" }}
                  >
                    {label.slice(0, 22)}
                  </text>
                </g>
              </>
            )}
          </g>
        );
      })}
    </g>
  );
}

const STATUS_META: Record<SyncStatus, { label: string; className: string }> = {
  connecting: { label: "Menyambung…", className: "bg-amber-500" },
  live: { label: "Tersambung", className: "bg-emerald-500" },
  saving: { label: "Menyimpan…", className: "bg-sky-500" },
  offline: { label: "Terputus — mencoba lagi", className: "bg-rose-500" },
};

export function WhiteboardPresenceBar({
  presence,
  status,
  currentUser,
  onExport,
  onRename,
}: {
  presence: WhiteboardPresence[];
  status: SyncStatus;
  currentUser: { id: string; name: string; image: string | null };
  onExport: (format: "png" | "svg" | "json") => void;
  onRename?: () => void;
}) {
  // Satu orang bisa membuka dua tab; tampilkan satu avatar per orang.
  const unique = new Map<string, WhiteboardPresence>();
  for (const peer of presence) {
    if (!unique.has(peer.userId)) unique.set(peer.userId, peer);
  }
  const peers = [...unique.values()].filter((p) => p.userId !== currentUser.id);
  const meta = STATUS_META[status];

  return (
    <div className="border-border bg-card/95 flex items-center gap-2 rounded-xl border p-1.5 shadow-lg backdrop-blur">
      <Tooltip>
        <TooltipTrigger
          render={
            <span className="flex items-center gap-1.5 pl-1">
              <span
                className={cn("size-2 rounded-full", meta.className)}
                aria-hidden
              />
              <span className="text-muted-foreground hidden text-[11px] font-medium sm:inline">
                {peers.length + 1} online
              </span>
            </span>
          }
        />
        <TooltipContent side="bottom">{meta.label}</TooltipContent>
      </Tooltip>

      {peers.length > 0 ? (
        <div className="flex -space-x-1.5">
          {peers.slice(0, 5).map((peer) => (
            <Tooltip key={peer.userId}>
              <TooltipTrigger
                render={
                  <span
                    className="border-card relative flex size-6 items-center justify-center overflow-hidden rounded-full border-2 text-[10px] font-semibold text-white"
                    style={{ background: cursorColorFor(peer.userId) }}
                  >
                    {peer.image ? (
                      <Image
                        src={peer.image}
                        alt={peer.name}
                        width={24}
                        height={24}
                        className="size-full object-cover"
                        unoptimized
                      />
                    ) : (
                      initials(peer.name)
                    )}
                  </span>
                }
              />
              <TooltipContent side="bottom">
                {peer.name}
                <span className="text-background/70 ml-1">
                  · {TOOL_META[peer.tool as WhiteboardTool]?.label ?? "Pilih"}
                </span>
              </TooltipContent>
            </Tooltip>
          ))}
          {peers.length > 5 ? (
            <span className="border-card bg-muted text-muted-foreground flex size-6 items-center justify-center rounded-full border-2 text-[10px] font-semibold">
              +{peers.length - 5}
            </span>
          ) : null}
        </div>
      ) : (
        <span className="text-muted-foreground flex items-center gap-1 px-1 text-[11px]">
          <Users className="size-3.5" aria-hidden />
          <span className="hidden sm:inline">Hanya Anda</span>
        </span>
      )}

      {onRename ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onRename}
          aria-label="Ubah nama papan"
        >
          <PencilLine className="size-3.5" aria-hidden />
        </Button>
      ) : null}

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Ekspor papan"
            >
              <Download className="size-3.5" aria-hidden />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onExport("png")}>
            <FileImage className="size-3.5" aria-hidden />
            Ekspor PNG
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onExport("svg")}>
            <FileImage className="size-3.5" aria-hidden />
            Ekspor SVG
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onExport("json")}>
            <FileJson className="size-3.5" aria-hidden />
            Ekspor JSON
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/u).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}
