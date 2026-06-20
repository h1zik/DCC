"use client";

import Link from "next/link";
import { TrendRadarStatus } from "@prisma/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TREND_RADAR_STATUS_LABELS,
  formatRelativeTime,
} from "@/lib/research/labels";
import { cn } from "@/lib/utils";

export type TrendDigestRow = {
  id: string;
  weekStart: string;
  weekEnd: string;
  status: TrendRadarStatus;
  isGlobal: boolean;
  watchlistName: string | null;
  itemCount: number;
  generatedAt: string | null;
};

function statusTone(status: TrendRadarStatus) {
  switch (status) {
    case "READY":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "FAILED":
      return "bg-rose-500/15 text-rose-700 dark:text-rose-300";
    case "COLLECTING":
    case "ANALYZING":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function TrendArchiveTable({
  digests,
  basePath = "/research-hub/trend-radar",
}: {
  digests: TrendDigestRow[];
  basePath?: string;
}) {
  if (digests.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">Belum ada digest tren.</p>
    );
  }

  return (
    <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Periode</TableHead>
            <TableHead>Tipe</TableHead>
            <TableHead>Tren</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Update</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {digests.map((d) => (
            <TableRow
              key={d.id}
              className="transition-colors duration-150 motion-reduce:transition-none hover:bg-muted/40"
            >
              <TableCell>
                <Link
                  href={`${basePath}/${d.id}`}
                  className="text-primary font-medium hover:underline"
                >
                  {new Date(d.weekStart).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                  })}{" "}
                  –{" "}
                  {new Date(d.weekEnd).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </Link>
              </TableCell>
              <TableCell>
                {d.isGlobal ? "Global" : d.watchlistName ?? "Watchlist"}
              </TableCell>
              <TableCell>{d.itemCount}</TableCell>
              <TableCell>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    statusTone(d.status),
                  )}
                >
                  {TREND_RADAR_STATUS_LABELS[d.status]}
                </span>
              </TableCell>
              <TableCell className="text-muted-foreground text-xs">
                {formatRelativeTime(
                  d.generatedAt ? new Date(d.generatedAt) : null,
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
  );
}
