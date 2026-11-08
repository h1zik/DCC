"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TREND_RADAR_STATUS_LABELS, formatRelativeTime } from "@/lib/research/labels";
import type { RunLedgerCounts } from "@/components/research-hub/kit/run-ledger";
import { RunStatusBadge, type RunTone } from "@/components/research-hub/kit/run-status";
import {
  ResearchFilterBar,
  filterRuns,
  type RunToneFilter,
} from "@/components/research-hub/kit/research-filter-bar";
import {
  ResearchTable,
  SortableHead,
  useSortedRows,
} from "@/components/research-hub/kit/research-table";
import type { TrendRadarPageData } from "./trend-radar-client";
import { formatWeekRange, trendToneOf } from "./trend-status";

type Digest = TrendRadarPageData["digests"][number];

function scopeLabel(d: Digest) {
  return d.isGlobal ? "Global" : (d.watchlistName ?? "Watchlist");
}

/** Arsip digest (20 terakhir): filter status, cari tipe, urutkan. */
export function TrendDigestArchive({
  digests,
  counts,
  statusLabels,
}: {
  digests: Digest[];
  counts: RunLedgerCounts;
  statusLabels: Partial<Record<RunTone, string>>;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<RunToneFilter>("all");

  const filtered = useMemo(
    () =>
      filterRuns(digests, {
        search,
        status,
        text: (d) => scopeLabel(d),
        tone: (d) => trendToneOf(d.status),
      }),
    [digests, search, status],
  );

  const { sorted, sort, toggle } = useSortedRows(filtered, {
    week: (d) => d.weekStart,
    scope: (d) => scopeLabel(d),
    items: (d) => d.itemCount,
    updated: (d) => d.generatedAt ?? "",
  });

  return (
    <div className="flex flex-col gap-3">
      <ResearchFilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Cari global atau nama watchlist…"
        status={status}
        onStatusChange={setStatus}
        statusCounts={counts}
        statusLabels={statusLabels}
        resultCount={filtered.length}
        totalCount={digests.length}
        onReset={() => {
          setSearch("");
          setStatus("all");
        }}
      />

      {sorted.length === 0 ? (
        <p className="rh-meta border-border rounded-xl border border-dashed px-5 py-8 text-center text-[13px]">
          Tidak ada digest yang cocok dengan filter ini.
        </p>
      ) : (
        <ResearchTable maxHeight="70vh">
          <TableHeader sticky>
            <TableRow>
              <SortableHead sortKey="week" sort={sort} onSort={toggle}>
                Periode
              </SortableHead>
              <SortableHead sortKey="scope" sort={sort} onSort={toggle}>
                Cakupan
              </SortableHead>
              <TableHead>Status</TableHead>
              <SortableHead sortKey="items" sort={sort} onSort={toggle} align="right">
                Tren
              </SortableHead>
              <SortableHead sortKey="updated" sort={sort} onSort={toggle}>
                Dibuat
              </SortableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((d) => (
              <TableRow key={d.id}>
                <TableCell>
                  <Link
                    href={`/research-hub/trend-radar/${d.id}`}
                    className="text-foreground focus-visible:ring-ring rounded font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
                  >
                    {formatWeekRange(d.weekStart, d.weekEnd)}
                  </Link>
                </TableCell>
                <TableCell>{scopeLabel(d)}</TableCell>
                <TableCell>
                  <RunStatusBadge
                    tone={trendToneOf(d.status)}
                    label={TREND_RADAR_STATUS_LABELS[d.status]}
                  />
                </TableCell>
                <TableCell className="rh-num text-right">
                  {d.itemCount > 0 ? d.itemCount : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {d.generatedAt ? (
                    <time
                      dateTime={d.generatedAt}
                      title={new Date(d.generatedAt).toLocaleString("id-ID")}
                    >
                      {formatRelativeTime(new Date(d.generatedAt))}
                    </time>
                  ) : (
                    "Belum selesai"
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </ResearchTable>
      )}
    </div>
  );
}
