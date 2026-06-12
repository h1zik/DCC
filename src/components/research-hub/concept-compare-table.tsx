import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type CompareDimension = {
  label: string;
  scores: {
    conceptId: string;
    conceptTitle: string;
    score: number;
    note: string;
  }[];
};

export function ConceptCompareTable({
  dimensions,
}: {
  dimensions: CompareDimension[];
}) {
  if (dimensions.length === 0) return null;

  return (
    <div className="space-y-6">
      {dimensions.map((dim) => (
        <div key={dim.label}>
          <h3 className="mb-2 text-sm font-semibold">{dim.label}</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Konsep</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead>Catatan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dim.scores.map((s) => (
                <TableRow key={`${dim.label}-${s.conceptId}`}>
                  <TableCell className="font-medium">{s.conceptTitle}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.score}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{s.note}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ))}
    </div>
  );
}
