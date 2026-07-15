import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type GapMatrixRow = {
  claim: string;
  competitors: string[];
  gapScore: number;
  opportunity: string;
  recommendedAction?: string;
  priority?: "P0" | "P1" | "P2";
  evidenceRefs?: string[];
};

function gapTone(score: number) {
  if (score >= 70)
    return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  if (score >= 40) return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
  return "bg-muted/70 text-muted-foreground";
}

function priorityTone(priority?: string) {
  switch (priority) {
    case "P0":
      return "bg-rose-500/15 text-rose-700 dark:text-rose-300";
    case "P1":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    case "P2":
      return "bg-muted/70 text-muted-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function GapMatrixTable({ rows }: { rows: GapMatrixRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground p-4 text-sm">
        Gap matrix belum tersedia.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Klaim</TableHead>
            <TableHead className="text-right">Gap</TableHead>
            <TableHead>Prioritas</TableHead>
            <TableHead>Peluang & Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow
              key={`${row.claim}-${i}`}
              className="hover:bg-muted/40 transition-colors duration-150 motion-reduce:transition-none"
            >
              <TableCell className="align-top font-medium">
                {row.claim}
                {row.competitors?.length > 0 ? (
                  <p className="text-muted-foreground mt-1 text-xs font-normal">
                    vs {row.competitors.slice(0, 4).join(", ")}
                  </p>
                ) : null}
              </TableCell>
              <TableCell className="text-right align-top">
                <span
                  className={cn(
                    "inline-flex min-w-9 items-center justify-center rounded-lg px-2 py-1 text-xs font-bold tabular-nums",
                    gapTone(row.gapScore),
                  )}
                >
                  {row.gapScore}
                </span>
              </TableCell>
              <TableCell className="align-top">
                {row.priority ? (
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold",
                      priorityTone(row.priority),
                    )}
                  >
                    {row.priority}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-xs">—</span>
                )}
              </TableCell>
              <TableCell className="max-w-md text-sm leading-snug">
                <p>{row.opportunity}</p>
                {row.recommendedAction ? (
                  <p className="text-foreground mt-1.5 text-xs font-medium">
                    → {row.recommendedAction}
                  </p>
                ) : null}
                {row.evidenceRefs && row.evidenceRefs.length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {row.evidenceRefs.slice(0, 4).map((ref, j) => (
                      <span
                        key={j}
                        className="bg-muted/60 text-muted-foreground rounded-md px-1.5 py-0.5 text-[10px] font-medium"
                      >
                        {ref}
                      </span>
                    ))}
                  </div>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
