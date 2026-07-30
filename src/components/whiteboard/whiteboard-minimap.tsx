"use client";

import { useMemo, useState } from "react";
import { Map as MapIcon } from "lucide-react";
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

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Tampilkan peta mini"
        className="border-border bg-card/95 text-muted-foreground hover:text-foreground flex size-8 items-center justify-center rounded-lg border shadow-lg backdrop-blur"
      >
        <MapIcon className="size-4" aria-hidden />
      </button>
    );
  }

  return (
    <div className="border-border bg-card/95 hidden rounded-xl border p-1.5 shadow-lg backdrop-blur sm:block">
      <svg
        width={MAP_WIDTH}
        height={MAP_HEIGHT}
        className={cn(
          "cursor-pointer rounded-md",
          dark ? "bg-black/25" : "bg-black/5",
        )}
        onPointerDown={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const mapX = event.clientX - rect.left;
          const mapY = event.clientY - rect.top;
          onNavigate({
            x: (mapX - offsetX) / scale + bounds.x,
            y: (mapY - offsetY) / scale + bounds.y,
          });
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
              fill="none"
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
        className="text-muted-foreground hover:text-foreground mt-1 w-full text-[10px]"
      >
        Sembunyikan peta
      </button>
    </div>
  );
}
