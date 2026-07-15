"use client";

import { useState } from "react";
import { ImageIcon, Trash2 } from "lucide-react";
import {
  AdPosterImage,
  VideoFramePoster,
} from "@/components/brand-hub/ad-creative-media";
import { isRenderableImageUrl } from "@/lib/brand-research/ad-library-media";
import { cn } from "@/lib/utils";

function MoodboardThumbnail({
  imageUrl,
  videoUrl,
  title,
}: {
  imageUrl: string;
  videoUrl?: string | null;
  title: string | null;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const alt = title ?? "Visual reference";
  const poster = isRenderableImageUrl(imageUrl) && !imgFailed ? imageUrl : null;
  const fallbackVideo = videoUrl?.trim() || null;

  if (poster) {
    return (
      <AdPosterImage
        src={poster}
        alt={alt}
        onError={() => setImgFailed(true)}
      />
    );
  }

  if (fallbackVideo) {
    return (
      <VideoFramePoster
        videoUrl={fallbackVideo}
        alt={alt}
      />
    );
  }

  return (
    <div className="flex aspect-[4/5] w-full items-center justify-center bg-muted text-muted-foreground">
      <ImageIcon className="size-8" aria-hidden />
    </div>
  );
}

/** Galeri moodboard gaya bento: tile rounded-2xl dengan hover lift + border aksen. */
export function MoodboardGrid({
  assets,
  onDelete,
}: {
  assets: {
    id: string;
    imageUrl: string;
    title: string | null;
    videoUrl?: string | null;
    deletable?: boolean;
  }[];
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
            className={cn(
              "group relative overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_1px_2px_rgb(30_25_15/0.05)]",
              "transition-[transform,box-shadow,border-color] duration-200 ease-out motion-reduce:transition-none",
              "hover:-translate-y-1 hover:border-[color-mix(in_srgb,var(--lab-accent,var(--primary))_50%,var(--border))] hover:shadow-[0_10px_28px_-12px_rgb(30_25_15/0.3)]",
              "motion-reduce:hover:translate-y-0",
            )}
            onMouseEnter={() => setHoveredId(a.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <div className="relative aspect-[4/5] w-full overflow-hidden">
              <MoodboardThumbnail
                imageUrl={a.imageUrl}
                videoUrl={a.videoUrl}
                title={a.title}
              />
            </div>
            {a.title ? (
              <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] bg-gradient-to-t from-black/75 via-black/35 to-transparent p-2.5 pt-6 text-[10px] font-medium leading-snug text-white line-clamp-2">
                {a.title}
              </figcaption>
            ) : null}
            {canDelete ? (
              <button
                type="button"
                aria-label="Hapus gambar"
                tabIndex={isHovered ? 0 : -1}
                className={cn(
                  "absolute top-2 right-2 z-10 flex size-7 items-center justify-center rounded-lg bg-destructive text-white shadow-md ring-2 ring-black/25 transition-opacity duration-150",
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
