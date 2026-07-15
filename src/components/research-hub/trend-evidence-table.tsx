"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { TrendEvidenceRow } from "@/lib/research/trend-radar/trend-signal-types";
import { dedupeTrendEvidence } from "@/lib/research/trend-radar/trend-signal-types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const SOURCE_LABELS: Record<string, string> = {
  google_trends: "Google Trends",
  rss: "RSS",
  tiktok: "TikTok",
  bpom: "BPOM",
  review_intel: "Review Intel",
  competitor: "Competitor",
  keyword_intel: "Keyword Intel",
  social_listening: "Social Listening",
};

export function TrendEvidenceTable({
  evidence,
  moduleBasePath = "/research-hub",
}: {
  evidence: TrendEvidenceRow[];
  moduleBasePath?: string;
}) {
  const rows = useMemo(() => dedupeTrendEvidence(evidence), [evidence]);

  if (rows.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Sumber</TableHead>
            <TableHead>Term</TableHead>
            <TableHead>Metrik</TableHead>
            <TableHead className="text-right">Nilai</TableHead>
            <TableHead className="text-right">Delta</TableHead>
            <TableHead className="w-[80px]">Link</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const href =
              row.moduleHref?.startsWith("/")
                ? row.moduleHref.replace(/^\/research-hub/, moduleBasePath)
                : row.url ?? row.moduleHref;
            return (
              <TableRow
                key={row.signalId}
                className="hover:bg-muted/40 transition-colors duration-150 motion-reduce:transition-none"
              >
                <TableCell className="text-xs">
                  <span className="bg-muted/70 text-foreground/80 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold">
                    {SOURCE_LABELS[row.source] ?? row.source}
                  </span>
                </TableCell>
                <TableCell className="max-w-[200px] truncate text-xs font-medium">
                  {row.term}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {row.metric}
                </TableCell>
                <TableCell className="text-right text-xs font-semibold tabular-nums">
                  {row.value.toLocaleString("id-ID")}
                </TableCell>
                <TableCell className="text-right text-xs tabular-nums">
                  {row.deltaPct != null ? (
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        row.deltaPct > 0
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          : row.deltaPct < 0
                            ? "bg-rose-500/10 text-rose-700 dark:text-rose-300"
                            : "bg-muted text-muted-foreground",
                      )}
                    >
                      {row.deltaPct > 0 ? "+" : ""}
                      {row.deltaPct.toFixed(0)}%
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-xs">
                  {href ? (
                    href.startsWith("/") ? (
                      <Link href={href} className="text-primary font-medium hover:underline">
                        Buka
                      </Link>
                    ) : (
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary font-medium hover:underline"
                      >
                        Buka
                      </a>
                    )
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
