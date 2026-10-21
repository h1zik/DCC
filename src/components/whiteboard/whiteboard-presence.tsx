"use client";

import Image from "next/image";
import { Download, FileJson, FileImage, Users } from "lucide-react";
import type { WhiteboardPresence } from "@/lib/whiteboard/bus";
import { cursorColorFor } from "@/lib/whiteboard/palette";
import { worldToScreen, type Viewport } from "@/lib/whiteboard/geometry";
import { TOOL_META, type WhiteboardTool } from "@/lib/whiteboard/tools";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
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

const STATUS_META: Record<
  SyncStatus,
  { label: string; detail: string; className: string }
> = {
  connecting: {
    label: "Menyambung",
    detail: "Menyambung ke server kolaborasi…",
    className: "bg-amber-500",
  },
  live: {
    label: "Tersimpan",
    detail: "Semua perubahan tersimpan dan tersinkron realtime.",
    className: "bg-emerald-500",
  },
  saving: {
    label: "Menyimpan",
    detail: "Menyimpan perubahan terakhir…",
    className: "bg-sky-500 animate-pulse",
  },
  offline: {
    label: "Offline",
    detail:
      "Koneksi terputus. Perubahan Anda tetap tercatat dan dikirim otomatis saat tersambung lagi.",
    className: "bg-rose-500",
  },
};

export function WhiteboardPresenceBar({
  presence,
  status,
  unsaved,
  currentUser,
  onExport,
  exportScope,
}: {
  presence: WhiteboardPresence[];
  status: SyncStatus;
  /** Masih ada perubahan yang belum sampai ke server. */
  unsaved: boolean;
  currentUser: { id: string; name: string; image: string | null };
  onExport: (format: "png" | "svg" | "json") => void;
  /** Ekspor berlaku untuk objek terpilih atau seluruh papan. */
  exportScope: "selection" | "board";
}) {
  // Satu orang bisa membuka dua tab; tampilkan satu avatar per orang.
  const unique = new Map<string, WhiteboardPresence>();
  for (const peer of presence) {
    if (!unique.has(peer.userId)) unique.set(peer.userId, peer);
  }
  const peers = [...unique.values()].filter((p) => p.userId !== currentUser.id);
  const effective: SyncStatus =
    status === "live" && unsaved ? "saving" : status;
  const meta = STATUS_META[effective];
  const scopeLabel = exportScope === "selection" ? "pilihan" : "papan";

  return (
    <div className="border-border bg-card/95 flex h-10 items-center gap-1.5 rounded-2xl border px-1.5 shadow-md backdrop-blur">
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              className="flex items-center gap-1.5 pr-1 pl-1.5"
              role="status"
              aria-live="polite"
            >
              <span
                className={cn("size-2 rounded-full", meta.className)}
                aria-hidden
              />
              <span className="text-muted-foreground hidden text-xs font-medium md:inline">
                {meta.label}
              </span>
            </span>
          }
        />
        <TooltipContent side="bottom" className="max-w-64">
          {meta.detail}
        </TooltipContent>
      </Tooltip>

      <span className="bg-border h-5 w-px" aria-hidden />

      {peers.length > 0 ? (
        <div className="flex -space-x-1.5 px-0.5">
          {peers.slice(0, 5).map((peer) => (
            <Tooltip key={peer.userId}>
              <TooltipTrigger
                render={
                  <span
                    className="border-card relative flex size-7 items-center justify-center overflow-hidden rounded-full border-2 text-[10px] font-semibold text-white"
                    style={{ background: cursorColorFor(peer.userId) }}
                  >
                    {peer.image ? (
                      <Image
                        src={peer.image}
                        alt={peer.name}
                        width={28}
                        height={28}
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
                {peer.name} sedang memakai{" "}
                {(TOOL_META[peer.tool as WhiteboardTool]?.label ?? "Pilih").toLowerCase()}
              </TooltipContent>
            </Tooltip>
          ))}
          {peers.length > 5 ? (
            <span className="border-card bg-muted text-muted-foreground flex size-7 items-center justify-center rounded-full border-2 text-[10px] font-semibold">
              +{peers.length - 5}
            </span>
          ) : null}
        </div>
      ) : (
        <Tooltip>
          <TooltipTrigger
            render={
              <span className="text-muted-foreground flex items-center gap-1 px-1 text-xs">
                <Users className="size-3.5" aria-hidden />
                <span className="hidden md:inline">Hanya Anda</span>
              </span>
            }
          />
          <TooltipContent side="bottom">
            Anggota ruangan yang membuka papan ini akan tampil di sini.
          </TooltipContent>
        </Tooltip>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 rounded-xl px-2 text-xs"
              aria-label={`Ekspor ${scopeLabel}`}
            >
              <Download className="size-3.5" aria-hidden />
              <span className="hidden lg:inline">Ekspor</span>
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              {exportScope === "selection"
                ? "Ekspor objek terpilih"
                : "Ekspor seluruh papan"}
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onExport("png")}>
              <FileImage className="size-3.5" aria-hidden />
              Gambar PNG
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExport("svg")}>
              <FileImage className="size-3.5" aria-hidden />
              Vektor SVG
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExport("json")}>
              <FileJson className="size-3.5" aria-hidden />
              Data JSON
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/s+/u).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}
