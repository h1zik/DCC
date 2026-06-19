"use client";

import { useMemo, useState } from "react";
import { SocialMentionClass } from "@prisma/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
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

export type MentionFeedRow = {
  id: string;
  platform: string;
  text: string;
  author: string | null;
  classification: SocialMentionClass;
  likes: number;
  comments: number;
  views: number;
  isViral: boolean;
  url: string | null;
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
    case "RECOMMENDATION":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function SocialMentionFeed({ rows }: { rows: MentionFeedRow[] }) {
  const [filter, setFilter] = useState<SocialMentionClass | "ALL">("ALL");

  const filtered = useMemo(() => {
    if (filter === "ALL") return rows;
    return rows.filter((r) => r.classification === filter);
  }, [rows, filter]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          {filtered.length} mention
        </p>
        <Select
          value={filter}
          onValueChange={(v) => setFilter(v as SocialMentionClass | "ALL")}
        >
          <SelectTrigger className="h-8 w-44 text-xs">
            {filter === "ALL" ? "Semua klasifikasi" : SOCIAL_MENTION_CLASS_LABELS[filter]}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Semua klasifikasi</SelectItem>
            {(Object.keys(SOCIAL_MENTION_CLASS_LABELS) as SocialMentionClass[]).map(
              (key) => (
                <SelectItem key={key} value={key}>
                  {SOCIAL_MENTION_CLASS_LABELS[key]}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Klasifikasi</TableHead>
            <TableHead>Mention</TableHead>
            <TableHead className="text-right">Engagement</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                    classTone(row.classification),
                  )}
                >
                  {SOCIAL_MENTION_CLASS_LABELS[row.classification]}
                </span>
              </TableCell>
              <TableCell className="max-w-md">
                <p className="line-clamp-2 text-sm leading-snug">{row.text}</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {row.author ? `@${row.author}` : "—"} · {row.platform}
                  {row.isViral ? " · viral" : ""}
                </p>
              </TableCell>
              <TableCell className="text-right text-xs">
                {row.likes.toLocaleString("id-ID")} likes
                <br />
                {row.comments.toLocaleString("id-ID")} komentar
                <br />
                {row.views.toLocaleString("id-ID")} views
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
