"use client";

import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function ProductDiscoveryProductThumb({
  imageUrl,
  name,
  className,
}: {
  imageUrl: string | null;
  name: string;
  className?: string;
}) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={name}
        loading="lazy"
        className={cn(
          "bg-muted object-cover",
          className,
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "bg-muted text-muted-foreground flex items-center justify-center",
        className,
      )}
      aria-hidden
    >
      <ImageIcon className="size-5 opacity-50" />
    </div>
  );
}
