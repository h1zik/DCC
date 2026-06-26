"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Download, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KeywordConfidenceBadge } from "@/components/research-hub/keyword-confidence-badge";
import { KeywordDiffBadge } from "@/components/research-hub/keyword-diff-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { KeywordMatrixRow } from "@/lib/research/keyword-intel/keyword-signal-types";

export type { KeywordMatrixRow };

function TrendIcon({ trend }: { trend: KeywordMatrixRow["trend"] }) {
  if (trend === "up") {
    return <ArrowUp className="size-3.5 text-emerald-600" aria-hidden />;
  }
  if (trend === "down") {
    return <ArrowDown className="size-3.5 text-rose-600" aria-hidden />;
  }
  if (trend === "stable") {
    return <Minus className="text-muted-foreground size-3.5" aria-hidden />;
  }
  return <span className="text-muted-foreground text-xs">—</span>;
}

function rowHasVolume(row: KeywordMatrixRow): boolean {
  if (row.hasVolumeData != null) return row.hasVolumeData;
  return row.volume > 0 || row.competition > 0;
}

/**
 * A row's volume is a measured search-demand number only when it carries a real
 * search source (Google Ads / DataForSEO). Otherwise it is a heuristic proxy derived
 * from marketplace rank/listings and must be disclosed as an estimate, not real volume.
 */
function rowVolumeIsEstimated(row: KeywordMatrixRow): boolean {
  if (!rowHasVolume(row)) return false;
  const src = row.source.map((s) => s.toLowerCase());
  const hasRealSearchVolume = src.some(
    (s) => s.includes("google") || s.includes("dataforseo"),
  );
  return !hasRealSearchVolume;
}

function exportCsv(rows: KeywordMatrixRow[]) {
  const header = [
    "keyword",
    "volume",
    "volume_is_estimated",
    "competition",
    "trend",
    "intent",
    "koiScore",
    "confidence",
    "listingSampleCount",
    "sources",
  ];
  const lines = rows.map((r) =>
    [
      r.keyword,
      r.volume,
      rowVolumeIsEstimated(r) ? "yes" : "no",
      r.competition,
      r.trend ?? "",
      r.intent,
      r.koiScore ?? "",
      r.confidence ?? "",
      r.listingSampleCount ?? "",
      r.source.join("|"),
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  const blob = new Blob([[header.join(","), ...lines].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "keyword-matrix.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function KeywordMatrixTable({
  rows,
  hasGoogleVolume = false,
}: {
  rows: KeywordMatrixRow[];
  hasGoogleVolume?: boolean;
}) {
  const [sortKey, setSortKey] = useState<"volume" | "koi" | "competition">(
    "koi",
  );
  const [filter, setFilter] = useState("");

  const sorted = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const filtered = f
      ? rows.filter((r) => r.keyword.toLowerCase().includes(f))
      : rows;
    return [...filtered].sort((a, b) => {
      if (sortKey === "volume") return b.volume - a.volume;
      if (sortKey === "koi") return (b.koiScore ?? 0) - (a.koiScore ?? 0);
      return a.competition - b.competition;
    });
  }, [rows, sortKey, filter]);

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">Belum ada data keyword.</p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {!hasGoogleVolume ? (
        <p className="rounded-md bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          DataForSEO tidak aktif — semua angka volume adalah estimasi proxy dari
          rank/listing marketplace (ditandai <span className="font-medium">est.</span>),
          bukan volume pencarian Google terukur.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Filter keyword…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-8 max-w-xs text-sm"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => exportCsv(sorted)}
        >
          <Download className="size-3.5" aria-hidden />
          CSV
        </Button>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Keyword</TableHead>
              <TableHead
                className="cursor-pointer"
                onClick={() => setSortKey("volume")}
              >
                Volume {sortKey === "volume" ? "↓" : ""}
              </TableHead>
              <TableHead
                className="cursor-pointer"
                onClick={() => setSortKey("competition")}
              >
                Kompetisi {sortKey === "competition" ? "↑" : ""}
              </TableHead>
              <TableHead
                className="cursor-pointer"
                onClick={() => setSortKey("koi")}
              >
                KOI {sortKey === "koi" ? "↓" : ""}
              </TableHead>
              <TableHead>Trend</TableHead>
              <TableHead>Intent</TableHead>
              <TableHead>Sumber</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((row) => {
              const hasVol = rowHasVolume(row);
              const volEstimated = rowVolumeIsEstimated(row);
              return (
                <TableRow
                  key={row.keyword}
                  className="transition-colors duration-150 motion-reduce:transition-none hover:bg-muted/40"
                >
                  <TableCell className="font-medium">
                    <span className="flex flex-wrap items-center gap-1">
                      {row.keyword}
                      <KeywordDiffBadge status={row.diffStatus} />
                    </span>
                  </TableCell>
                  <TableCell>
                    {!hasVol ? (
                      "—"
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        {row.volume.toLocaleString("id-ID")}
                        {volEstimated ? (
                          <span
                            className="rounded bg-amber-100 px-1 text-[9px] font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                            title="Estimasi proxy dari rank/listing marketplace — bukan volume pencarian Google terukur."
                          >
                            est.
                          </span>
                        ) : null}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {!hasVol ? "—" : `${(row.competition * 100).toFixed(0)}%`}
                  </TableCell>
                  <TableCell>
                    {typeof row.koiScore === "number" ? (
                      <KeywordConfidenceBadge
                        confidence={row.confidence ?? "LOW"}
                        koiScore={row.koiScore}
                      />
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1">
                      <TrendIcon trend={row.trend} />
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-medium",
                        row.intent === "transactional"
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {row.intent}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex max-w-40 flex-wrap gap-0.5">
                      {row.source.slice(0, 3).map((s) => (
                        <span
                          key={s}
                          className="bg-muted text-muted-foreground rounded px-1 py-0.5 text-[9px]"
                        >
                          {s.replace(/_/g, " ").slice(0, 12)}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
