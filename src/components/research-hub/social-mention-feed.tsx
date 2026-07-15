"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { SocialMentionClass } from "@prisma/client";
import { Input } from "@/components/ui/input";
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
import type { SelectItemDef } from "@/lib/select-option-items";
import { cn } from "@/lib/utils";

const MENTION_CLASS_ITEMS: SelectItemDef[] = [
  { value: "ALL", label: "Semua klasifikasi" },
  ...(Object.keys(SOCIAL_MENTION_CLASS_LABELS) as SocialMentionClass[]).map(
    (key) => ({ value: key, label: SOCIAL_MENTION_CLASS_LABELS[key] }),
  ),
];

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
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "ALL" && r.classification !== filter) return false;
      if (!q) return true;
      return (
        r.text.toLowerCase().includes(q) ||
        (r.author ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, filter, query]);

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar: count + cari + filter klasifikasi */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">
          {filtered.length === rows.length
            ? `${rows.length.toLocaleString("id-ID")} mention`
            : `${filtered.length.toLocaleString("id-ID")} dari ${rows.length.toLocaleString("id-ID")} mention`}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search
              className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari teks atau author…"
              className="h-8 w-48 pl-8 text-xs"
            />
          </div>
          <Select
            value={filter}
            items={MENTION_CLASS_ITEMS}
            onValueChange={(v) => setFilter(v as SocialMentionClass | "ALL")}
          >
            <SelectTrigger className="h-8 w-44 text-xs">
              {filter === "ALL"
                ? "Semua klasifikasi"
                : SOCIAL_MENTION_CLASS_LABELS[filter]}
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
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Klasifikasi</TableHead>
              <TableHead>Mention</TableHead>
              <TableHead className="text-right">Engagement</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="text-muted-foreground py-8 text-center text-sm"
                >
                  Tidak ada mention cocok dengan filter.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
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
                  <TableCell className="max-w-md">
                    <p className="line-clamp-2 text-sm leading-snug">
                      {row.text}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {row.author ? `@${row.author}` : "—"} · {row.platform}
                      {row.isViral ? (
                        <span className="ml-1.5 inline-flex items-center rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700 dark:text-amber-300">
                          Viral
                        </span>
                      ) : null}
                    </p>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="text-muted-foreground flex flex-col items-end gap-0.5 text-xs tabular-nums">
                      <span>
                        <span className="text-foreground font-semibold">
                          {row.likes.toLocaleString("id-ID")}
                        </span>{" "}
                        likes
                      </span>
                      <span>
                        <span className="text-foreground font-semibold">
                          {row.comments.toLocaleString("id-ID")}
                        </span>{" "}
                        komentar
                      </span>
                      <span>
                        <span className="text-foreground font-semibold">
                          {row.views.toLocaleString("id-ID")}
                        </span>{" "}
                        views
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
