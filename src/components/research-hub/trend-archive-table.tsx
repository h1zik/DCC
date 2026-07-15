"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { TrendRadarStatus } from "@prisma/client";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
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
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return digests;
    return digests.filter((d) =>
      (d.isGlobal ? "global" : (d.watchlistName ?? "watchlist"))
        .toLowerCase()
        .includes(q),
    );
  }, [digests, query]);

  if (digests.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">Belum ada digest tren.</p>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Toolbar: count + search */}
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-foreground font-bold tracking-tight">
            Arsip digest
          </p>
          <p className="text-muted-foreground text-xs">
            {visible.length === digests.length
              ? `${digests.length} digest`
              : `${visible.length} dari ${digests.length} digest`}
          </p>
        </div>
        {digests.length > 5 ? (
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari tipe / watchlist…"
              className="h-9 w-52 pl-8 text-xs"
            />
          </div>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Periode</TableHead>
              <TableHead>Tipe</TableHead>
              <TableHead className="text-right">Tren</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Update</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((d) => (
              <TableRow
                key={d.id}
                className="hover:bg-muted/40 transition-colors duration-150 motion-reduce:transition-none"
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
                <TableCell className="text-sm">
                  {d.isGlobal ? "Global" : d.watchlistName ?? "Watchlist"}
                </TableCell>
                <TableCell className="text-right text-sm font-semibold tabular-nums">
                  {d.itemCount}
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold",
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
      </div>
    </div>
  );
}
