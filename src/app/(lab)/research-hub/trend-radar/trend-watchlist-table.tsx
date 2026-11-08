"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Pencil, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TREND_RADAR_STATUS_LABELS, formatRelativeTime } from "@/lib/research/labels";
import { countRunTones } from "@/components/research-hub/kit/run-ledger";
import { RunStatusBadge } from "@/components/research-hub/kit/run-status";
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
import { isTrendRunning, trendToneOf } from "./trend-status";

type Watchlist = TrendRadarPageData["watchlists"][number];

const STATUS_LABELS = { running: "Digest berjalan", idle: "Belum ada digest" } as const;

/** Tabel watchlist: filter, urutkan, aksi generate/edit/hapus per baris. */
export function TrendWatchlistTable({
  watchlists,
  pending,
  onGenerate,
  onEdit,
  onDelete,
}: {
  watchlists: Watchlist[];
  pending: boolean;
  onGenerate: (w: Watchlist) => void;
  onEdit: (w: Watchlist) => void;
  onDelete: (w: Watchlist) => void;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<RunToneFilter>("all");

  const counts = useMemo(
    () => countRunTones(watchlists, (w) => trendToneOf(w.latestDigest?.status)),
    [watchlists],
  );

  const filtered = useMemo(
    () =>
      filterRuns(watchlists, {
        search,
        status,
        text: (w) => `${w.name} ${w.keywords.join(" ")}`,
        tone: (w) => trendToneOf(w.latestDigest?.status),
      }),
    [watchlists, search, status],
  );

  const { sorted, sort, toggle } = useSortedRows(filtered, {
    name: (w) => w.name,
    keywords: (w) => w.keywords.length,
    updated: (w) => w.latestDigest?.generatedAt ?? "",
  });

  return (
    <div className="flex flex-col gap-3">
      <ResearchFilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Cari watchlist atau keyword…"
        status={status}
        onStatusChange={setStatus}
        statusCounts={counts}
        statusLabels={STATUS_LABELS}
        resultCount={filtered.length}
        totalCount={watchlists.length}
        onReset={() => {
          setSearch("");
          setStatus("all");
        }}
      />

      {sorted.length === 0 ? (
        <p className="rh-meta border-border rounded-xl border border-dashed px-5 py-8 text-center text-[13px]">
          Tidak ada watchlist yang cocok dengan filter ini.
        </p>
      ) : (
        <ResearchTable maxHeight="70vh">
          <TableHeader sticky>
            <TableRow>
              <SortableHead sortKey="name" sort={sort} onSort={toggle}>
                Watchlist
              </SortableHead>
              <TableHead>Digest terakhir</TableHead>
              <SortableHead sortKey="keywords" sort={sort} onSort={toggle} align="right">
                Keyword
              </SortableHead>
              <SortableHead sortKey="updated" sort={sort} onSort={toggle}>
                Diperbarui
              </SortableHead>
              <TableHead className="w-0 text-right">
                <span className="sr-only">Aksi</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((w) => {
              const digest = w.latestDigest;
              const tone = trendToneOf(digest?.status);
              return (
                <TableRow key={w.id} className="group">
                  <TableCell className="max-w-[24rem] whitespace-normal">
                    {digest?.status === "READY" ? (
                      <Link
                        href={`/research-hub/trend-radar/${digest.id}`}
                        className="text-foreground focus-visible:ring-ring rounded font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
                      >
                        {w.name}
                      </Link>
                    ) : (
                      <span className="text-foreground font-medium">{w.name}</span>
                    )}
                    <p className="rh-meta mt-0.5 line-clamp-1">{w.keywords.join(", ")}</p>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-0.5">
                      <RunStatusBadge
                        tone={tone}
                        label={digest ? TREND_RADAR_STATUS_LABELS[digest.status] : "Belum ada digest"}
                      />
                      {!w.isActive ? <span className="rh-meta">Nonaktif</span> : null}
                    </div>
                  </TableCell>
                  <TableCell className="rh-num text-right">{w.keywords.length}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {digest?.generatedAt ? (
                      <time
                        dateTime={digest.generatedAt}
                        title={new Date(digest.generatedAt).toLocaleString("id-ID")}
                      >
                        {formatRelativeTime(new Date(digest.generatedAt))}
                      </time>
                    ) : (
                      "Belum pernah"
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-0.5">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        disabled={pending || isTrendRunning(digest?.status)}
                        onClick={() => onGenerate(w)}
                        aria-label={`Generate digest "${w.name}"`}
                        title="Generate digest"
                      >
                        <RefreshCw aria-hidden />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => onEdit(w)}
                        aria-label={`Ubah "${w.name}"`}
                        title="Ubah"
                      >
                        <Pencil aria-hidden />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        disabled={pending}
                        onClick={() => onDelete(w)}
                        aria-label={`Hapus "${w.name}"`}
                        title="Hapus"
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </ResearchTable>
      )}
    </div>
  );
}
