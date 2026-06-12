"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type KeywordMatrixRow = {
  keyword: string;
  volume: number;
  competition: number;
  trend: "up" | "down" | "stable";
  intent: "transactional" | "informational";
  source: string[];
};

function TrendIcon({ trend }: { trend: KeywordMatrixRow["trend"] }) {
  if (trend === "up") {
    return <ArrowUp className="size-3.5 text-emerald-600" aria-hidden />;
  }
  if (trend === "down") {
    return <ArrowDown className="size-3.5 text-rose-600" aria-hidden />;
  }
  return <Minus className="text-muted-foreground size-3.5" aria-hidden />;
}

export function KeywordMatrixTable({ rows }: { rows: KeywordMatrixRow[] }) {
  const [sortKey, setSortKey] = useState<"volume" | "competition">("volume");

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      if (sortKey === "volume") return b.volume - a.volume;
      return a.competition - b.competition;
    });
  }, [rows, sortKey]);

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">Belum ada data keyword.</p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
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
            <TableHead>Trend</TableHead>
            <TableHead>Intent</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((row) => (
            <TableRow key={row.keyword}>
              <TableCell className="font-medium">{row.keyword}</TableCell>
              <TableCell>{row.volume.toLocaleString("id-ID")}</TableCell>
              <TableCell>{(row.competition * 100).toFixed(0)}%</TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-1">
                  <TrendIcon trend={row.trend} />
                  <span className="text-xs capitalize">{row.trend}</span>
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
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
