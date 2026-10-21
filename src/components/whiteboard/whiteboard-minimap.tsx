"use client";

import { useMemo, useState } from "react";
import { Map as MapIcon, X } from "lucide-react";
import {
  elementAABB,
  elementsBounds,
  screenToWorld,
  type Viewport,
} from "@/lib/whiteboard/geometry";
import { paletteEntry } from "@/lib/whiteboard/palette";
import { LINEAR_TYPES, type WhiteboardElement } from "@/lib/whiteboard/types";
import { cn } from "@/lib/utils";

/**
 * Peta mini papan. Menampilkan seluruh objek sebagai kotak kecil beserta
 * posisi viewport saat ini; klik untuk melompat ke area tersebut.
 */

const MAP_WIDTH = 176;
const MAP_HEIGHT = 116;

export function WhiteboardMinimap({
  elements,
  viewport,
  size,
  dark,
  onNavigate,
}: {
  elements: WhiteboardElement[];
  viewport: Viewport;
  size: { width: number; height: number };
  dark: boolean;
  onNavigate: (world: { x: number; y: number }) => void;
}) {
  const [open, setOpen] = useState(true);

  const view = useMemo(() => {
    const topLeft = screenToWorld({ x: 0, y: 0 }, viewport);
    const bottomRight = screenToWorld(
      { x: size.width, y: size.height },
      viewport,
    );
    return {
      x: topLeft.x,
      y: topLeft.y,
      width: bottomRight.x - topLeft.x,
      height: bottomRight.y - topLeft.y,
    };
  }, [viewport, size]);

  const bounds = useMemo(() => {
    const content = elementsBounds(elements);
    if (!content) return { ...view };
    // Gabungkan isi papan dengan viewport agar penanda selalu terlihat.
    const minX = Math.min(content.x, view.x);
    const minY = Math.min(content.y, view.y);
    const maxX = Math.max(content.x + content.width, view.x + view.width);
    const maxY = Math.max(content.y + content.height, view.y + view.height);
    const pad = Math.max(40, (maxX - minX) * 0.06);
    return {
      x: minX - pad,
      y: minY - pad,
      width: maxX - minX + pad * 2,
      height: maxY - minY + pad * 2,
    };
  }, [elements, view]);

  const scale = Math.min(
    MAP_WIDTH / Math.max(1, bounds.width),
    MAP_HEIGHT / Math.max(1, bounds.height),
  );
  const offsetX = (MAP_WIDTH - bounds.width * scale) / 2;
  const offsetY = (MAP_HEIGHT - bounds.height * scale) / 2;

  const project = (x: number, y: number) => ({
    x: (x - bounds.x) * scale + offsetX,
    y: (y - bounds.y) * scale + offsetY,
  });

  const navigateTo = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const mapX = event.clientX - rect.left;
    const mapY = event.clientY - rect.top;
    onNavigate({
      x: (mapX - offsetX) / scale + bounds.x,
      y: (mapY - offsetY) / scale + bounds.y,
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Tampilkan peta mini"
        className="border-border bg-card/95 text-muted-foreground hover:text-foreground hidden size-9 items-center justify-center rounded-xl border shadow-md backdrop-blur sm:flex"
      >
        <MapIcon className="size-4" aria-hidden />
      </button>
    );
  }

  return (
    <div className="border-border bg-card/95 group/minimap relative hidden rounded-xl border p-1 shadow-md backdrop-blur sm:block">
      <svg
        width={MAP_WIDTH}
        height={MAP_HEIGHT}
        role="img"
        aria-label="Peta mini papan — klik atau seret untuk berpindah area"
        className={cn(
          "block cursor-grab touch-none rounded-lg active:cursor-grabbing",
          dark ? "bg-black/25" : "bg-black/[0.04]",
        )}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          navigateTo(event);
        }}
        onPointerMove={(event) => {
          // Seret penanda viewport untuk menjelajah papan dengan cepat.
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            navigateTo(event);
          }
        }}
      >
        {elements.map((element) => {
          const box = elementAABB(element);
          const topLeft = project(box.x, box.y);
          const w = Math.max(1.5, box.width * scale);
          const h = Math.max(1.5, box.height * scale);
          const token = LINEAR_TYPES.has(element.type)
            ? element.props.stroke
            : element.props.fill;
          const entry = paletteEntry(token ?? "slate", dark);
          return (
            <rect
              key={element.id}
              x={topLeft.x}
              y={topLeft.y}
              width={w}
              height={h}
              rx={1}
              fill={token === "transparent" ? entry.ink : entry.surface}
              opacity={0.75}
            />
          );
        })}

        {(() => {
          const topLeft = project(view.x, view.y);
          return (
            <rect
              x={topLeft.x}
              y={topLeft.y}
              width={Math.max(4, view.width * scale)}
              height={Math.max(4, view.height * scale)}
              fill={dark ? "rgba(96,165,250,0.1)" : "rgba(37,99,235,0.07)"}
              stroke={dark ? "#60a5fa" : "#2563eb"}
              strokeWidth={1.5}
              rx={2}
            />
          );
        })()}
      </svg>
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label="Sembunyikan peta mini"
        className="bg-card/90 text-muted-foreground hover:text-foreground border-border absolute top-2 right-2 flex size-6 items-center justify-center rounded-md border opacity-0 transition-opacity group-hover/minimap:opacity-100 focus-visible:opacity-100"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}
