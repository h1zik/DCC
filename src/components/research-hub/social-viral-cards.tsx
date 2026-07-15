import { ExternalLink, Eye, Heart } from "lucide-react";
import { hub } from "@/components/research-hub/research-hub-primitives";
import { cn } from "@/lib/utils";

export type ViralContentRow = {
  text: string;
  author: string | null;
  platform: string;
  url: string | null;
  views: number;
  likes: number;
};

/**
 * Kartu konten viral — tile amber hangat dengan metrik ikon.
 * Visual-only; dipakai juga brand-hub.
 */
export function SocialViralCards({ items }: { items: ViralContentRow[] }) {
  if (items.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">Belum ada konten viral terdeteksi.</p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item, i) => (
        <div
          key={`${item.platform}-${i}`}
          className={cn(
            hub.entrance,
            "flex flex-col rounded-xl bg-amber-500/8 p-3.5 ring-1 ring-inset ring-amber-500/20 dark:bg-amber-400/10",
          )}
          style={
            i > 0 && i < 8 ? { animationDelay: `${i * 40}ms` } : undefined
          }
        >
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-bold tracking-tight">
              {item.author ? `@${item.author}` : "Anonim"}
            </span>
            <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-800 dark:text-amber-300">
              {item.platform}
            </span>
          </div>
          <p className="text-muted-foreground mt-2 line-clamp-3 flex-1 text-sm leading-relaxed">
            {item.text}
          </p>
          <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1 font-semibold tabular-nums">
              <Eye className="size-3.5" aria-hidden />
              {item.views.toLocaleString("id-ID")}
            </span>
            <span className="inline-flex items-center gap-1 font-semibold tabular-nums">
              <Heart className="size-3.5" aria-hidden />
              {item.likes.toLocaleString("id-ID")}
            </span>
            {item.url ? (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary ml-auto inline-flex items-center gap-1 font-semibold hover:underline"
              >
                Buka <ExternalLink className="size-3" aria-hidden />
              </a>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
