import { ExternalLink } from "lucide-react";
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
            hub.nestedPanel,
            hub.entrance,
            "border-amber-500/30 bg-amber-500/5",
          )}
          style={
            i > 0 && i < 8 ? { animationDelay: `${i * 40}ms` } : undefined
          }
        >
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-medium">
              {item.author ? `@${item.author}` : "Anonim"}
            </span>
            <span className="text-muted-foreground text-[10px] font-semibold uppercase">
              {item.platform}
            </span>
          </div>
          <p className="text-muted-foreground mt-2 line-clamp-3 text-sm leading-relaxed">
            {item.text}
          </p>
          <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-3 text-xs">
            <span className="tabular-nums">
              {item.views.toLocaleString("id-ID")} views
            </span>
            <span className="tabular-nums">
              {item.likes.toLocaleString("id-ID")} likes
            </span>
            {item.url ? (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary inline-flex items-center gap-1 hover:underline"
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
