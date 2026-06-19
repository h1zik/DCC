"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function MoodboardGrid({
  assets,
  onDelete,
}: {
  assets: { id: string; imageUrl: string; title: string | null; deletable?: boolean }[];
  onDelete?: (id: string) => void;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
      {assets.map((a) => {
        const canDelete = Boolean(onDelete) && a.deletable !== false;
        const isHovered = hoveredId === a.id;

        return (
          <figure
            key={a.id}
            className="relative overflow-hidden rounded-xl border border-border/60 bg-muted/30"
            onMouseEnter={() => setHoveredId(a.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={a.imageUrl}
              alt={a.title ?? "Visual reference"}
              className={cn(
                "aspect-[4/5] w-full object-cover transition-transform duration-300",
                isHovered && "scale-105",
              )}
            />
            {a.title ? (
              <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] bg-gradient-to-t from-black/70 to-transparent p-2 text-[10px] text-white line-clamp-2">
                {a.title}
              </figcaption>
            ) : null}
            {canDelete ? (
              <button
                type="button"
                aria-label="Hapus gambar"
                tabIndex={isHovered ? 0 : -1}
                className={cn(
                  "absolute top-2 right-2 z-10 flex size-7 items-center justify-center rounded-md bg-destructive text-white shadow-md ring-2 ring-black/25 transition-opacity duration-150",
                  isHovered
                    ? "pointer-events-auto opacity-100"
                    : "pointer-events-none opacity-0",
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.(a.id);
                }}
              >
                <Trash2 className="size-3.5" aria-hidden />
              </button>
            ) : null}
          </figure>
        );
      })}
    </div>
  );
}
