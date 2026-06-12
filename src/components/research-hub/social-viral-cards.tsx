import { ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
        <Card key={`${item.platform}-${i}`} className="border-amber-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate">
                {item.author ? `@${item.author}` : "Anonim"}
              </span>
              <span className="text-muted-foreground text-[10px] font-normal uppercase">
                {item.platform}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground line-clamp-3 leading-relaxed">
              {item.text}
            </p>
            <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
              <span>{item.views.toLocaleString("id-ID")} views</span>
              <span>{item.likes.toLocaleString("id-ID")} likes</span>
              {item.url ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary inline-flex items-center gap-1 hover:underline"
                >
                  Buka <ExternalLink className="size-3" />
                </a>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
