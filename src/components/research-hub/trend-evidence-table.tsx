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
                className="transition-colors duration-150 motion-reduce:transition-none hover:bg-muted/40"
              >
                <TableCell className="text-xs font-medium">
                  {SOURCE_LABELS[row.source] ?? row.source}
                </TableCell>
                <TableCell className="max-w-[200px] truncate text-xs">
                  {row.term}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {row.metric}
                </TableCell>
                <TableCell className="text-right tabular-nums text-xs">
                  {row.value.toLocaleString("id-ID")}
                </TableCell>
                <TableCell className="text-right tabular-nums text-xs">
                  {row.deltaPct != null
                    ? `${row.deltaPct > 0 ? "+" : ""}${row.deltaPct.toFixed(0)}%`
                    : "—"}
                </TableCell>
                <TableCell className="text-xs">
                  {href ? (
                    href.startsWith("/") ? (
                      <Link href={href} className="text-primary hover:underline">
                        Buka
                      </Link>
                    ) : (
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
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
  );
}
