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
};

function gapTone(score: number) {
  if (score >= 70) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  if (score >= 40) return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
  return "bg-muted text-muted-foreground";
}

export function GapMatrixTable({ rows }: { rows: GapMatrixRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">Gap matrix belum tersedia.</p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Klaim</TableHead>
          <TableHead>Kompetitor</TableHead>
          <TableHead className="text-right">Gap Score</TableHead>
          <TableHead>Peluang</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, i) => (
          <TableRow key={`${row.claim}-${i}`}>
            <TableCell className="font-medium">{row.claim}</TableCell>
            <TableCell className="text-muted-foreground max-w-xs text-xs">
              {row.competitors?.length > 0
                ? row.competitors.slice(0, 4).join(", ")
                : "—"}
            </TableCell>
            <TableCell className="text-right">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-semibold",
                  gapTone(row.gapScore),
                )}
              >
                {row.gapScore}
              </span>
            </TableCell>
            <TableCell className="text-sm leading-snug">{row.opportunity}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
