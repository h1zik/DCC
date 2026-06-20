"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { KeywordEvidenceRow } from "@/lib/research/keyword-intel/keyword-signal-types";
import { dedupeKeywordEvidence } from "@/lib/research/keyword-intel/keyword-signal-types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function KeywordEvidenceTable({
  evidence,
}: {
  evidence: KeywordEvidenceRow[];
}) {
  const rows = useMemo(() => dedupeKeywordEvidence(evidence), [evidence]);

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">Belum ada bukti sinyal.</p>
    );
  }

  return (
    <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Sumber</TableHead>
            <TableHead>Metrik</TableHead>
            <TableHead>Nilai</TableHead>
            <TableHead>Link</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.signalId}
              className="transition-colors duration-150 motion-reduce:transition-none hover:bg-muted/40"
            >
              <TableCell className="text-xs">{row.source}</TableCell>
              <TableCell className="text-xs">{row.metric}</TableCell>
              <TableCell className="text-xs tabular-nums">
                {row.value.toLocaleString("id-ID")}
              </TableCell>
              <TableCell className="text-xs">
                {row.moduleHref ? (
                  <Link href={row.moduleHref} className="text-primary hover:underline">
                    Modul
                  </Link>
                ) : row.url ? (
                  <a
                    href={row.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    Sumber
                  </a>
                ) : (
                  "—"
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
  );
}
