"use client";

import { SocialMentionClass } from "@prisma/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SOCIAL_MENTION_CLASS_LABELS } from "@/lib/research/labels";
import { cn } from "@/lib/utils";

export type CommentFeedRow = {
  id: string;
  text: string;
  author: string | null;
  platform: string;
  classification: SocialMentionClass;
  likes: number;
  painPoint: string | null;
};

function classTone(c: SocialMentionClass) {
  switch (c) {
    case "COMPLAINT":
      return "bg-rose-500/15 text-rose-700 dark:text-rose-300";
    case "PRAISE":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "WISHLIST":
      return "bg-violet-500/15 text-violet-700 dark:text-violet-300";
    case "QUESTION":
      return "bg-sky-500/15 text-sky-700 dark:text-sky-300";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function SocialCommentFeed({ rows }: { rows: CommentFeedRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Belum ada teks komentar terkumpul. Refresh monitor — fase 1:{" "}
        <code className="text-xs">clockworks/tiktok-scraper</code> (video),
        fase 2:{" "}
        <code className="text-xs">clockworks/tiktok-comments-scraper</code>{" "}
        (komentar video teratas).
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Klasifikasi</TableHead>
            <TableHead>Komentar</TableHead>
            <TableHead className="text-right">Likes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.id}
              className="transition-colors duration-150 motion-reduce:transition-none hover:bg-muted/40"
            >
              <TableCell>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold",
                    classTone(row.classification),
                  )}
                >
                  {SOCIAL_MENTION_CLASS_LABELS[row.classification]}
                </span>
              </TableCell>
              <TableCell className="max-w-lg">
                <p className="line-clamp-2 text-sm">{row.text}</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {row.author ? `@${row.author}` : "—"} · {row.platform}
                  {row.painPoint ? ` · ${row.painPoint}` : ""}
                </p>
              </TableCell>
              <TableCell className="text-right text-xs font-semibold tabular-nums">
                {row.likes.toLocaleString("id-ID")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
